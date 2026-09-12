import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  disableNativePush,
  enableNativePush,
  fetchServerPushStatus,
  getCurrentPushSubscription,
  getPushSupportState,
  isCapacitorNative,
  syncPushSubscription,
  type PushSupportState,
  type ServerPushStatus,
} from '@/lib/pushClient';
import { useCapacitorPush } from '@/hooks/useCapacitorPush';

const DEFAULT_SERVER_STATUS: ServerPushStatus = {
  pushEnabled: true,
  subscriptionCount: 0,
};

function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

export function useNativePush(userId?: string) {
  const support = useMemo<PushSupportState>(() => getPushSupportState(), []);

  // ── APK Android (Capacitor + FCM) ─────────────────────────────────────────
  const isNative = useMemo(() => isCapacitorNative(), []);
  const capacitorPush = useCapacitorPush(isNative ? userId : undefined);
  // ──────────────────────────────────────────────────────────────────────────

  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [hasLocalSubscription, setHasLocalSubscription] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerPushStatus>(DEFAULT_SERVER_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const promptDismissKey = useMemo(() => `udg_push_prompt_dismissed:${userId || 'anonymous'}`, [userId]);
  const [promptDismissed, setPromptDismissed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(promptDismissKey) === '1';
  });

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setPromptDismissed(localStorage.getItem(promptDismissKey) === '1');
  }, [promptDismissKey]);

  useEffect(() => {
    if (support.isCapacitor) {
      if (capacitorPush.error) {
        if (capacitorPush.error.includes('não concedida')) {
          setPermission('denied');
        }
      } else if (capacitorPush.isRegistered) {
        setPermission('granted');
      } else {
        setPermission('default');
      }
      return;
    }

    setPermission(getNotificationPermission());

    if (!('permissions' in navigator) || typeof navigator.permissions?.query !== 'function') {
      return;
    }

    let active = true;
    let permissionStatus: PermissionStatus | null = null;

    navigator.permissions.query({ name: 'notifications' as PermissionName }).then((status) => {
      if (!active) return;
      permissionStatus = status;
      const syncPermission = () => setPermission(getNotificationPermission());
      status.addEventListener('change', syncPermission);
    }).catch(() => {
    });

    return () => {
      active = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [support.isCapacitor, capacitorPush.isRegistered, capacitorPush.error]);

  const dismissPrompt = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(promptDismissKey, '1');
    }
    setPromptDismissed(true);
  }, [promptDismissKey]);

  const reopenPrompt = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(promptDismissKey);
    }
    setPromptDismissed(false);
  }, [promptDismissKey]);

  const refreshStatus = useCallback(async () => {
    if (!userId) {
      if (!support.isCapacitor) setPermission(getNotificationPermission());
      setHasLocalSubscription(false);
      setServerStatus(DEFAULT_SERVER_STATUS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const serverPushStatus = await fetchServerPushStatus().catch(() => DEFAULT_SERVER_STATUS);
      let localSubscription = null;
      if (!support.isCapacitor) {
        localSubscription = await getCurrentPushSubscription().catch(() => null);
      }

      if (!support.isCapacitor) setPermission(getNotificationPermission());
      setServerStatus(serverPushStatus);
      setHasLocalSubscription(support.isCapacitor ? capacitorPush.isRegistered : !!localSubscription);

      if (!support.isCapacitor && getNotificationPermission() === 'granted' && localSubscription && serverPushStatus.pushEnabled !== false) {
        await syncPushSubscription().catch((error) => {
          console.warn('[Push] Falha ao sincronizar subscription existente:', error);
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, support.isCapacitor, capacitorPush.isRegistered]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const enablePush = useCallback(async (options?: { sendTestPush?: boolean }) => {
    setIsBusy(true);
    try {
      if (support.isCapacitor) {
        await capacitorPush.register();
        // Ativacao silenciada ou nao baseada no componente local
      } else {
        await enableNativePush(options);
      }
      dismissPrompt();
    } finally {
      await refreshStatus();
      setIsBusy(false);
    }
  }, [support.isCapacitor, capacitorPush, dismissPrompt, refreshStatus]);

  const disablePush = useCallback(async () => {
    setIsBusy(true);
    try {
      if (!support.isCapacitor) {
        await disableNativePush();
      } else {
        // Para capacitor, marcamos desativado no server. Nao existe clearToken local facilmente.
        const { setServerPushEnabled } = await import('@/lib/pushClient');
        await setServerPushEnabled(false);
      }
      reopenPrompt();
    } finally {
      await refreshStatus();
      setIsBusy(false);
    }
  }, [support.isCapacitor, refreshStatus, reopenPrompt]);

  const shouldShowPermissionPrompt = !!userId
    && !isLoading
    && support.supported
    && support.isSecureContext
    && permission !== 'denied'
    && serverStatus.pushEnabled !== false
    && !hasLocalSubscription
    && !promptDismissed
    && !(support.isIos && !support.isStandalone);

  const isEffectivelyEnabled = support.supported
    && support.isSecureContext
    && (support.isCapacitor ? capacitorPush.isRegistered : permission === 'granted')
    && serverStatus.pushEnabled !== false
    && (support.isCapacitor ? true : hasLocalSubscription);

  return {
    support,
    permission,
    hasLocalSubscription,
    serverStatus,
    isLoading: isLoading || capacitorPush.isLoading,
    isBusy,
    isEffectivelyEnabled,
    shouldShowPermissionPrompt,
    dismissPrompt,
    reopenPrompt,
    refreshStatus,
    enablePush,
    disablePush,
  };
}
