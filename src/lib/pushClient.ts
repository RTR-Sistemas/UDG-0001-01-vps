import { supabase } from '@/integrations/supabase/client';
import { sendPushEvent, type SendPushEventResult } from '@/utils/push';

export type PushSupportState = {
  supported: boolean;
  isSecureContext: boolean;
  isIos: boolean;
  isStandalone: boolean;
  isCapacitor: boolean;
};

export type NativePushSubscriptionPayload = {
  subscription: ReturnType<PushSubscription['toJSON']>;
  platform: string;
  userAgent: string;
  appContext?: 'web' | 'pwa';
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
};

export type ServerPushStatus = {
  pushEnabled: boolean;
  subscriptionCount: number;
};

const IOS_REGEX = /iphone|ipad|ipod/i;

/**
 * Retorna true quando executando dentro do APK Capacitor (Android/iOS nativo).
 * Usado para alternar entre Web Push (browser/PWA) e FCM (APK).
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

export function getPushSupportState(): PushSupportState {
  // No APK nativo, Web Push não é suportado (usa FCM via useCapacitorPush)
  if (isCapacitorNative()) {
    return {
      supported: true,
      isSecureContext: true,
      isIos: false,
      isStandalone: true,
      isCapacitor: true,
    };
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = IOS_REGEX.test(ua);
  const isStandalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  return {
    supported: typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    isIos,
    isStandalone,
    isCapacitor: false,
  };
}


export function describeRuntimePlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

function describeDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

function describeAppContext(): 'web' | 'pwa' {
  return getPushSupportState().isStandalone ? 'pwa' : 'web';
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const cleanValue = String(base64String || '').trim();
  const padding = '='.repeat((4 - (cleanValue.length % 4)) % 4);
  const base64 = (cleanValue + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getSessionAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data?.session?.access_token ?? null;
}

export async function getAuthToken(): Promise<string | null> {
  let token = await getSessionAccessToken();
  if (token) return token;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData?.user) {
    token = await getSessionAccessToken();
    if (token) return token;
  }

  token = await tryRefreshAccessToken();
  return token ?? null;
}

async function readErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallbackMessage;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // ignore parse errors and keep raw text fallback below
  }

  return text;
}

async function apiAuthFetch(input: string, init: RequestInit = {}, options?: { allowMissingToken?: boolean }): Promise<Response | null> {
  let token = await getAuthToken();
  if (!token) {
    return options?.allowMissingToken ? null : Promise.reject(new Error('Sessão inválida ou expirada. Entre novamente e tente outra vez.'));
  }

  const execute = async (bearerToken: string) => fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  let response = await execute(token);
  if (response.status !== 401) return response;

  const refreshedToken = await tryRefreshAccessToken();
  if (!refreshedToken || refreshedToken === token) {
    return response;
  }

  token = refreshedToken;
  response = await execute(token);
  return response;
}

export async function fetchVapidPublicKey(): Promise<string> {
  const response = await fetch('/api/get-vapid-public-key', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Falha ao obter a chave pública VAPID');
  }

  const data = await response.json();
  if (!data?.publicKey) {
    throw new Error('Chave pública VAPID ausente na resposta');
  }

  return String(data.publicKey).trim();
}

function describeSubscribeError(error: unknown): Error {
  const anyError = error as { name?: string; message?: string };
  const message = String(anyError?.message || '');

  if (anyError?.name === 'AbortError' || /push service error/i.test(message)) {
    return new Error('O navegador recusou registrar este dispositivo no serviço de push. Verifique se o site está em HTTPS e se a chave VAPID pública configurada é a mesma que pertence à chave privada do servidor.');
  }

  if (anyError?.name === 'NotAllowedError') {
    return new Error('O navegador bloqueou a criação da inscrição push. Confirme a permissão de notificações deste site e tente novamente.');
  }

  return error instanceof Error ? error : new Error('Falha inesperada ao registrar notificações push.');
}

export async function saveSubscriptionToServer(payload: NativePushSubscriptionPayload): Promise<void> {
  const response = await apiAuthFetch('/api/push-subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response) {
    throw new Error('Sessão inválida para registrar a subscription.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Falha ao salvar a subscription');
    if (response.status === 401) {
      throw new Error('Sua sessão expirou durante a ativação do push. Faça login novamente e tente outra vez.');
    }
    throw new Error(message || 'Falha ao salvar a subscription');
  }
}

export async function deleteSubscriptionFromServer(endpoint: string): Promise<void> {
  const response = await apiAuthFetch('/api/push-unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  }, { allowMissingToken: true });

  if (!response || response.ok) return;

  if (response.status === 401) {
    throw new Error('Sua sessão expirou durante a remoção do dispositivo. Faça login novamente e tente outra vez.');
  }

  const message = await readErrorMessage(response, 'Falha ao remover a subscription');
  throw new Error(message || 'Falha ao remover a subscription');
}

export async function fetchServerPushStatus(): Promise<ServerPushStatus> {
  const response = await apiAuthFetch('/api/push-status', {
    method: 'GET',
  }, { allowMissingToken: true });

  if (!response) {
    return { pushEnabled: true, subscriptionCount: 0 };
  }

  if (!response.ok) {
    if (response.status === 401) {
      return { pushEnabled: true, subscriptionCount: 0 };
    }
    const message = await readErrorMessage(response, 'Falha ao consultar status do push');
    throw new Error(message || 'Falha ao consultar status do push');
  }

  const data = await response.json();
  return {
    pushEnabled: data?.pushEnabled !== false,
    subscriptionCount: Number(data?.subscriptionCount || 0),
  };
}

export async function setServerPushEnabled(pushEnabled: boolean): Promise<void> {
  const response = await apiAuthFetch('/api/push-preference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pushEnabled }),
  });

  if (!response) {
    throw new Error('Sessão inválida para atualizar preferências de push.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Falha ao atualizar preferências de push');
    if (response.status === 401) {
      throw new Error('Sua sessão expirou ao atualizar o push. Faça login novamente e tente outra vez.');
    }
    throw new Error(message || 'Falha ao atualizar preferências de push');
  }
}

/**
 * Espera o worker chegar ao estado 'activated'.
 *
 * Detalhe que causava o AbortError no console: `registration.active` ja fica
 * preenchido quando o worker entra em 'activating', mas o
 * `pushManager.subscribe()` so aceita 'activated'. Checar apenas
 * `registration.active` (como a versao anterior fazia) passava cedo demais e o
 * navegador respondia:
 *   AbortError: Subscription failed - no active Service Worker
 */
function waitForActivatedWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration | null> {
  const worker = registration.active;
  if (!worker) return Promise.resolve(null);
  if (worker.state === 'activated') return Promise.resolve(registration);

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: ServiceWorkerRegistration | null) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('statechange', onStateChange);
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    const onStateChange = () => {
      if (worker.state === 'activated') finish(registration);
      else if (worker.state === 'redundant') finish(null);
    };

    worker.addEventListener('statechange', onStateChange);
    timer = setTimeout(() => finish(null), timeoutMs);
  });
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker não suportado neste navegador.');
  }

  const ACTIVATION_TIMEOUT_MS = 10000;
  const READY_TIMEOUT_MS = 15000;

  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) {
    const activated = await waitForActivatedWorker(existing, ACTIVATION_TIMEOUT_MS);
    if (activated) return activated;
  }

  // `navigator.serviceWorker.ready` resolve quando existe worker ativo — mas,
  // pelo mesmo motivo acima, "ativo" pode ainda ser 'activating'. Por isso o
  // resultado dele tambem passa pela espera de 'activated'.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), READY_TIMEOUT_MS);
  });

  let ready: ServiceWorkerRegistration | null = null;
  try {
    ready = await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (ready) {
    const activated = await waitForActivatedWorker(ready, ACTIVATION_TIMEOUT_MS);
    if (activated) return activated;
  }

  if (existing) {
    const activated = await waitForActivatedWorker(existing, ACTIVATION_TIMEOUT_MS);
    if (activated) return activated;
  }
  throw new Error('O Service Worker ainda não está ativo. Recarregue a página e tente novamente.');
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const support = getPushSupportState();
  if (!support.supported || !support.isSecureContext) return null;

  const registration = await getPushRegistration();
  return registration.pushManager.getSubscription();
}

export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  const support = getPushSupportState();
  if (!support.supported || !support.isSecureContext) {
    return null;
  }

  if (support.isIos && !support.isStandalone) {
    throw new Error('No iPhone/iPad, instale o app na Tela de Início para habilitar notificações push.');
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    throw new Error('As notificações estão bloqueadas nas configurações do navegador. Libere o acesso para este site e tente novamente.');
  }

  const registration = await getPushRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  const vapidPublicKey = await fetchVapidPublicKey();

  const doSubscribe = () => registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
  });

  try {
    return await doSubscribe();
  } catch (error) {
    const anyError = error as { name?: string; message?: string };
    const isAbort = anyError?.name === 'AbortError' || /push service error/i.test(String(anyError?.message));
    if (isAbort) {
      try {
        const stale = await registration.pushManager.getSubscription();
        await stale?.unsubscribe();
      } catch { /* best effort */ }
      try {
        await navigator.serviceWorker.ready;
        return await doSubscribe();
      } catch (retryError) {
        console.debug('[push] subscribe retry falhou:', (retryError as any)?.name, (retryError as any)?.message);
        throw describeSubscribeError(retryError);
      }
    }
    console.debug('[push] subscribe falhou:', anyError?.name, anyError?.message);
    throw describeSubscribeError(error);
  }
}

export async function syncPushSubscription(): Promise<PushSubscription | null> {
  const subscription = await ensurePushSubscription();
  if (!subscription) return null;

  await saveSubscriptionToServer({
    subscription: subscription.toJSON(),
    platform: describeRuntimePlatform(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    appContext: describeAppContext(),
    deviceType: describeDeviceType(),
  });

  return subscription;
}

export async function requestNativePushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') {
    throw new Error('Este navegador não expõe a API de notificações.');
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

async function showLocalActivationNotification(): Promise<void> {
  try {
    const registration = await getPushRegistration();
    await registration.showNotification('Notificação Ligada.', {
      body: 'Este dispositivo foi habilitado para receber notificações do sistema.',
      icon: '/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'push:activation-local',
      data: {
        eventType: 'test',
        url: '/news',
        localOnly: true,
      },
    });
  } catch (error) {
    console.debug('[Push] Falha ao exibir a notificação local de ativação:', error);
  }
}

async function ensureServerTestDelivered(result: SendPushEventResult | void): Promise<void> {
  const sendResult = result ? result.result : undefined;
  if (!result) {
    throw new Error('O servidor não conseguiu enviar a notificação de teste.');
  }
  if (!result.ok) {
    throw new Error(result.error || 'O servidor não conseguiu enviar a notificação de teste.');
  }
  if (!sendResult) return;

  if (sendResult.reason === 'no-subscriptions') {
    throw new Error('A inscrição local foi criada, mas o servidor ainda não encontrou este dispositivo salvo. Tente desligar e ligar novamente o push.');
  }

  if (typeof sendResult.total === 'number' && sendResult.total > 0 && Number(sendResult.sent || 0) <= 0) {
    throw new Error('A inscrição foi salva, mas o serviço push do servidor não conseguiu entregar a notificação de teste. Verifique se VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY formam o mesmo par.');
  }
}

export async function enableNativePush(options?: { sendTestPush?: boolean }): Promise<PushSubscription> {
  const permission = await requestNativePushPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'As notificações foram bloqueadas no navegador. Libere a permissão nas configurações do navegador para continuar.'
      : 'Permissão de notificação não concedida.');
  }

  const subscription = await syncPushSubscription();
  if (!subscription) {
    throw new Error('Não foi possível criar a inscrição de notificação neste dispositivo.');
  }

  await setServerPushEnabled(true);

  if (options?.sendTestPush !== false) {
    await showLocalActivationNotification();
    const result = await sendPushEvent({ eventType: 'test' });
    await ensureServerTestDelivered(result);
  }

  return subscription;
}

export async function disableNativePush(): Promise<void> {
  const currentSubscription = await getCurrentPushSubscription();
  if (currentSubscription) {
    const endpoint = currentSubscription.endpoint;

    try {
      await currentSubscription.unsubscribe();
    } catch (error) {
      console.warn('[Push] Não foi possível cancelar a subscription local:', error);
    }

    try {
      await deleteSubscriptionFromServer(endpoint);
    } catch (error) {
      console.warn('[Push] Não foi possível remover a subscription no servidor:', error);
    }
  }

  await setServerPushEnabled(false);
}

/**
 * Registra um token FCM (Android APK via Capacitor) no servidor.
 * Chamado automaticamente pelo useCapacitorPush quando o FCM token é obtido.
 */
export async function registerFcmToken(fcmToken: string): Promise<void> {
  const response = await apiAuthFetch('/api/push-register-fcm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fcmToken,
      platform: 'android',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'android-apk',
      deviceType: 'mobile',
    }),
  });

  if (!response) {
    throw new Error('Sessão inválida para registrar FCM token. Faça login novamente.');
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, 'Falha ao registrar token FCM');
    throw new Error(message);
  }
}
