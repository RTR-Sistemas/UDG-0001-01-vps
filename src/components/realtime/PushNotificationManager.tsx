import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNativePush } from '@/hooks/useNativePush';
import { usePermissions } from '@/contexts/PermissionContext';
import {
  playAttentionAlertSound,
  playMessagePing,
  playNotificationPing,
  unlockAudioOnce,
} from '@/lib/notificationSounds';

const IOS_HINT_KEY = 'udg_push_ios_hint_shown';

function getPayloadTargetUrl(payload: any): string {
  return payload?.data?.url || '/';
}

function showForegroundNativeNotification(payload: any) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(payload?.title || 'Nova notificação', {
      body: payload?.body || 'Você recebeu uma nova atualização.',
      icon: payload?.icon || '/icon-192.png',
      badge: payload?.badge || '/icons/icon-72.png',
      tag: payload?.tag || `push:${payload?.data?.eventType || 'notification'}`,
      silent: false,
      data: {
        url: getPayloadTargetUrl(payload),
      },
    });

    notification.onclick = () => {
      const url = getPayloadTargetUrl(payload);
      try {
        window.focus();
        if (url && window.location.pathname + window.location.search !== url) {
          window.location.href = url;
        }
      } catch {
        // noop
      }
      notification.close();
    };
  } catch {
    // Alguns ambientes PWA/Windows podem falhar silenciosamente aqui.
  }
}

function showForegroundFeedback(payload: any, meta?: { systemNotificationShown?: boolean }) {
  const eventType = payload?.data?.eventType || 'notification';
  const title = payload?.title || 'Nova notificação';
  const body = payload?.body || 'Você recebeu uma nova atualização.';

  if (eventType === 'attention_call') {
    playAttentionAlertSound();
  } else if (eventType === 'message') {
    playMessagePing();
  } else {
    playNotificationPing();
  }

  if (!meta?.systemNotificationShown) {
    showForegroundNativeNotification(payload);
  }

  toast({
    title,
    description: body,
  });
}

export function PushNotificationManager() {
  const { user } = useAuth();
  const { requestPermission } = usePermissions();
  const promptHandledRef = useRef(false);
  const {
    support,
    shouldShowPermissionPrompt,
    enablePush,
    dismissPrompt,
  } = useNativePush(user?.id);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlock = () => void unlockAudioOnce();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!support.supported || !support.isSecureContext) return;

    if (support.isIos && !support.isStandalone && !sessionStorage.getItem(IOS_HINT_KEY)) {
      sessionStorage.setItem(IOS_HINT_KEY, '1');
      toast({
        title: 'Ative o app na Tela de Início',
        description: 'No iPhone/iPad, as notificações push exigem que o app esteja instalado como PWA.',
      });
    }
  }, [support, user?.id]);

  useEffect(() => {
    if (user?.id) {
      promptHandledRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!shouldShowPermissionPrompt) return;
    if (promptHandledRef.current) return;
    promptHandledRef.current = true;

    void requestPermission(
      'notifications',
      'O chat funciona em tempo real. Com as notificações ativas, você nunca perde uma mensagem ou chamada, mesmo com o app em segundo plano.'
    ).then((granted) => {
      if (!granted) {
        dismissPrompt();
        return;
      }
      return enablePush({ sendTestPush: true })
        .then(() => {
          toast({
            title: 'Notificações ligadas',
            description: 'Uma notificação de teste foi enviada para confirmar a ativação.',
          });
        })
        .catch((error: any) => {
          const msg = String(error?.message || "");
          if (msg.includes("Service Worker ainda não está ativo")) {
            console.debug("[Push] adiando ativação, SW ainda não ativo");
            return;
          }
          toast({
            title: 'Não foi possível ativar o push',
            description: error?.message || 'Tente novamente em instantes.',
            variant: 'destructive',
          });
        });
    });
  }, [shouldShowPermissionPrompt, requestPermission, enablePush, dismissPrompt]);


  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const type = event?.data?.type;
      if (type === 'PUSH_RECEIVED' && document.visibilityState === 'visible' && document.hasFocus()) {
        const payload = event.data.payload;
        const eventType = payload?.data?.eventType || 'notification';
        const url = payload?.data?.url || '';

        if (eventType === 'message' && url) {
          let pushConvId: string | null = null;
          try {
            const parsedUrl = new URL(url, 'https://dummy.com');
            pushConvId = parsedUrl.searchParams.get('conversation');
          } catch {
            const match = url.match(/[?&]conversation=([^&]+)/);
            if (match) pushConvId = match[1];
          }

          if (pushConvId) {
            const searchParams = new URLSearchParams(window.location.search);
            const activeConversation = searchParams.get('conversation');
            const isCurrentlyReadingThisConversation = window.location.pathname === '/messages' && activeConversation === pushConvId;
            if (isCurrentlyReadingThisConversation) {
              return; // Do not show toast or play sound, the user is already in the conversation
            }
          }
        }

        showForegroundFeedback(payload, event.data.meta);
      }

      if (type === 'PUSH_SUBSCRIPTION_CHANGE' && user?.id) {
        void enablePush({ sendTestPush: false }).catch((error: any) => {
          console.error('[Push] Falha ao renovar subscription após mudança:', error);
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [enablePush, user?.id]);

  return null;
}
