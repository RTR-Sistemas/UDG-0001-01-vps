
import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyAppBadge, notifyServiceWorkerBadgeUpdate } from '@/lib/appBadge';
import { isDemoMode } from '@/lib/isDemoMode';

type BadgeCountResponse = { count?: number };

async function fetchBadgeCount(): Promise<number> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return 0;

  const response = await fetch('/.netlify/functions/badge-count', {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text() || 'Falha ao consultar badge-count');
  }

  const payload = await response.json() as BadgeCountResponse;
  return Number(payload?.count || 0);
}

export function NotificationBadgeManager({ userId }: { userId?: string }) {
  const refreshBadge = useCallback(async () => {
    if (!userId) {
      await applyAppBadge(0);
      notifyServiceWorkerBadgeUpdate(0);
      return;
    }

    try {
      const count = await fetchBadgeCount();
      await applyAppBadge(count);
      notifyServiceWorkerBadgeUpdate(count);
    } catch (error) {
      console.debug('[Badge] Não foi possível sincronizar o badge:', error);
    }
  }, [userId]);

  useEffect(() => {
    void refreshBadge();
  }, [refreshBadge]);

  useEffect(() => {
    if (!userId) return;
    if (isDemoMode(userId)) return;

    const channel = supabase
      .channel(`badge-sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void refreshBadge())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentions', filter: `mentioned_user_id=eq.${userId}` }, () => void refreshBadge())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attention_calls', filter: `receiver_id=eq.${userId}` }, () => void refreshBadge())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` }, () => void refreshBadge())
      .subscribe();

    const onFocus = () => void refreshBadge();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    const interval = window.setInterval(() => void refreshBadge(), 30_000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      supabase.removeChannel(channel);
    };
  }, [refreshBadge, userId]);

  return null;
}
