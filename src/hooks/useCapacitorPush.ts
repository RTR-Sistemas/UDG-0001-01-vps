/**
 * useCapacitorPush.ts
 *
 * Hook e funções para push notifications nativas em APK Android (Capacitor + FCM).
 * Não interfere no fluxo Web Push (VAPID) usado no browser/PWA.
 *
 * Correções v2:
 *  - Listeners adicionados ANTES de PushNotifications.register() (race condition fix)
 *  - Canal "undoing_push_channel" criado com cor roxa e prioridade HIGH (Android 8+)
 *  - Deep-link via history.pushState + PopStateEvent (compatível React Router v6)
 *  - Cleanup correto de todos os listeners ao desmontar
 *  - Erros isolados — falha no foreground não quebra o fluxo principal
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFcmToken } from '@/lib/pushClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna true apenas quando rodando dentro do APK Capacitor (Android/iOS nativo).
 */
export function isCapacitorNative(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      !!(window as unknown as { Capacitor?: { isNativePlatform: () => boolean } })
        .Capacitor?.isNativePlatform?.()
    );
  } catch {
    return false;
  }
}

/**
 * Importação dinâmica do plugin para evitar erros em ambientes web onde
 * o módulo existe mas os métodos nativos não estão disponíveis.
 */
async function getPushPlugin() {
  try {
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  } catch {
    return null;
  }
}

/**
 * Cria o canal de notificação "undoing_push_channel" com alta prioridade
 * e cor roxa Undoing (#7C3AED). Requerido no Android 8+ (API 26+).
 * Deve ser chamado antes de PushNotifications.register().
 */
async function ensureNotificationChannel(PushNotifications: Record<string, unknown>) {
  if (typeof PushNotifications['createChannel'] !== 'function') return;
  try {
    await (PushNotifications['createChannel'] as (ch: object) => Promise<void>)({
      id: 'undoing_push_channel',
      name: 'Undoing — Notificações',
      description: 'Alertas, mensagens e atualizações do app Undoing',
      importance: 5,        // IMPORTANCE_HIGH — aparece como heads-up popup
      visibility: 1,        // VISIBILITY_PUBLIC — exibe no lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#7C3AED',  // LED roxo Undoing
    });
    console.log('[CapacitorPush] Canal "undoing_push_channel" criado/atualizado.');
  } catch (e) {
    // O canal pode já existir — ignorar silenciosamente
    console.debug('[CapacitorPush] createChannel (provavelmente já existe):', e);
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CapacitorPushState {
  isRegistered: boolean;
  isLoading: boolean;
  fcmToken: string | null;
  error: string | null;
}

type ListenerHandle = { remove: () => Promise<void> };

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook que gerencia o ciclo de vida das push notifications nativas no APK.
 * Deve ser chamado apenas quando isCapacitorNative() === true.
 */
export function useCapacitorPush(userId?: string): CapacitorPushState & { register: () => Promise<void> } {
  const [state, setState] = useState<CapacitorPushState>({
    isRegistered: false,
    isLoading: false,
    fcmToken: null,
    error: null,
  });

  const didRegister = useRef(false);
  const listenerHandles = useRef<ListenerHandle[]>([]);

  const removeAllListeners = useCallback(async () => {
    for (const handle of listenerHandles.current) {
      try { await handle.remove(); } catch { /* ignorar */ }
    }
    listenerHandles.current = [];
  }, []);

  const register = useCallback(async () => {
    if (!userId || didRegister.current) return;
    if (!isCapacitorNative()) return;

    didRegister.current = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const PushNotifications = await getPushPlugin();
      if (!PushNotifications) {
        setState((s) => ({ ...s, isLoading: false, error: 'Plugin PushNotifications não disponível' }));
        return;
      }

      await ensureNotificationChannel(PushNotifications as unknown as Record<string, unknown>);

      const permResult = await PushNotifications.checkPermissions();
      let permStatus = permResult.receive;

      if (permStatus === 'prompt' || permStatus === 'prompt-with-rationale') {
        const reqResult = await PushNotifications.requestPermissions();
        permStatus = reqResult.receive;
      }

      if (permStatus !== 'granted') {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Permissão de notificação não concedida.',
        }));
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tempo limite esgotado ao contatar o serviço de push.'));
        }, 12000);

        const onDone = () => {
          clearTimeout(timeout);
          resolve();
        };

        // Escuta pela token
        PushNotifications.addListener('registration', async (token) => {
          const fcmToken = String(token.value || '').trim();
          if (!fcmToken) {
            setState((s) => ({ ...s, isLoading: false, error: 'Token FCM vazio recebido' }));
            onDone();
            return;
          }

          try {
            await registerFcmToken(fcmToken);
            setState({ isRegistered: true, isLoading: false, fcmToken, error: null });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Falha ao salvar token FCM';
            setState((s) => ({ ...s, isLoading: false, error: msg }));
          }
          onDone();
        }).then(h => listenerHandles.current.push(h));

        PushNotifications.addListener('registrationError', (err) => {
          const msg = String((err as { error?: string })?.error || 'Falha no registro FCM');
          setState((s) => ({ ...s, isLoading: false, error: msg }));
          onDone();
        }).then(h => listenerHandles.current.push(h));

        PushNotifications.addListener('pushNotificationReceived', () => {}).then(h => listenerHandles.current.push(h));

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification?.data as Record<string, string> | undefined;
          const rawUrl = data?.url;
          if (rawUrl && typeof rawUrl === 'string') {
            try {
              const parsed = new URL(rawUrl, window.location.origin);
              const targetPath = parsed.pathname + parsed.search + parsed.hash;
              window.history.pushState(null, '', targetPath);
              window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            } catch {
              window.location.href = rawUrl;
            }
          }
        }).then(h => listenerHandles.current.push(h));

        // Inicia o processo nativo real
        PushNotifications.register().catch(err => {
          const msg = err instanceof Error ? err.message : 'Falha ao chamar register()';
          setState((s) => ({ ...s, isLoading: false, error: msg }));
          onDone(); // resolve early on crash
        });
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado no push nativo';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
    }
  }, [userId, removeAllListeners]);

  useEffect(() => {
    return () => {
      void removeAllListeners();
    };
  }, [removeAllListeners]);

  return { ...state, register };
}
