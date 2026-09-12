/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.addEventListener('error', (event) => {
  const msg = String(event?.message || event?.error?.message || '');
  if (msg.includes('Failed to fetch')) event.preventDefault();
});
self.addEventListener('unhandledrejection', (event) => {
  const msg = String(event?.reason?.message || event?.reason || '');
  if (msg.includes('Failed to fetch')) event.preventDefault();
});

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
try {
  precacheAndRoute(self.__WB_MANIFEST || []);
} catch (e) {
  console.debug('[SW] precacheRoute falhou offline (ignorado):', e);
}

const APP_NAME = 'UDG';
const DEFAULT_ICON = '/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-72.png';
const BADGE_CACHE = 'udg-badge-meta-v1';
const BADGE_KEY = '/__badge_count__';

const toAbsoluteUrl = (value) => {
  if (!value) return undefined;
  try {
    return new URL(value, self.location.origin).href;
  } catch {
    return undefined;
  }
};

const normalizePayload = (raw) => {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const url = payload.url || data.url || '/';
  const eventType = payload.eventType || data.eventType || 'notification';

  return {
    title: payload.title || APP_NAME,
    body: payload.body || payload.message || 'Você recebeu uma nova notificação.',
    icon: toAbsoluteUrl(payload.icon || data.icon || DEFAULT_ICON) || DEFAULT_ICON,
    badge: toAbsoluteUrl(payload.badge || data.badge || DEFAULT_BADGE) || DEFAULT_BADGE,
    image: toAbsoluteUrl(payload.image || data.image),
    color: '#7C3AED',
    tag: payload.tag || data.tag || `${eventType}:${url}`,
    renotify: Boolean(payload.renotify ?? true),
    requireInteraction: Boolean(payload.requireInteraction ?? false),
    silent: Boolean(payload.silent ?? false),
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [200, 100, 200],
    actions: Array.isArray(payload.actions) ? payload.actions : undefined,
    data: {
      ...data,
      url,
      eventType,
      receivedAt: Date.now(),
    },
  };
};

const postToClients = async (message) => {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(clientList.map((client) => client.postMessage(message)));
  return clientList;
};

async function readStoredBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const match = await cache.match(BADGE_KEY);
    if (!match) return 0;
    const payload = await match.json();
    const count = Number(payload?.count || 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  } catch {
    return 0;
  }
}

async function writeStoredBadgeCount(count) {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const cache = await caches.open(BADGE_CACHE);
  await cache.put(BADGE_KEY, new Response(JSON.stringify({ count: normalized }), {
    headers: { 'Content-Type': 'application/json' },
  }));
  return normalized;
}

async function applyBadgeCount(count) {
  const normalized = await writeStoredBadgeCount(count);
  try {
    if (typeof self.navigator?.setAppBadge === 'function') {
      if (normalized > 0) {
        await self.navigator.setAppBadge(normalized);
      } else if (typeof self.navigator?.clearAppBadge === 'function') {
        await self.navigator.clearAppBadge();
      } else {
        await self.navigator.setAppBadge(0);
      }
    }
  } catch (error) {
    console.debug('[SW] Não foi possível atualizar o badge do app:', error);
  }

  await postToClients({ type: 'APP_BADGE_UPDATED', count: normalized });
  return normalized;
}

self.addEventListener('message', (event) => {
  const type = event?.data?.type;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'PING') {
    event.source?.postMessage?.({ type: 'PONG' });
    return;
  }

  if (type === 'SET_APP_BADGE') {
    event.waitUntil(applyBadgeCount(Number(event?.data?.count || 0)));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let payload;
    try {
      payload = event.data.json();
    } catch {
      payload = { title: APP_NAME, body: event.data.text() };
    }

    const options = normalizePayload(payload);
    const requestedBadgeCount = Number(options.data?.badgeCount);
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClients = clientList.filter((client) => {
      try {
        return client.url?.startsWith(self.location.origin) && 
               (client.focused === true || client.visibilityState === 'visible');
      } catch {
        return false;
      }
    });

    let systemNotificationShown = false;

    if (!visibleClients.length) {
      try {
        await self.registration.showNotification(options.title, options);
        systemNotificationShown = true;
      } catch (error) {
        console.error('[SW] Falha ao exibir push principal:', error);
        await self.registration.showNotification(options.title, {
          body: options.body,
          icon: DEFAULT_ICON,
          badge: DEFAULT_BADGE,
          data: options.data,
        });
        systemNotificationShown = true;
      }
    }

    if (Number.isFinite(requestedBadgeCount) && requestedBadgeCount >= 0) {
      await applyBadgeCount(requestedBadgeCount);
    } else {
      const current = await readStoredBadgeCount();
      await applyBadgeCount(current + 1);
    }

    await Promise.all(clientList.map((client) => client.postMessage({
      type: 'PUSH_RECEIVED',
      payload: {
        title: options.title,
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        data: options.data,
      },
      meta: {
        appVisible: visibleClients.length > 0,
        systemNotificationShown,
      },
    })));
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const normalizedTarget = new URL(targetUrl, self.location.origin).href;
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of allClients) {
      if (!('focus' in client)) continue;

      const currentUrl = client.url || '';
      const sameOrigin = currentUrl.startsWith(self.location.origin);
      if (!sameOrigin) continue;

      await client.focus();
      if ('navigate' in client && currentUrl !== normalizedTarget) {
        await client.navigate(normalizedTarget);
      }
      return;
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(normalizedTarget);
    }
  })());
});

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(postToClients({
    type: 'PUSH_NOTIFICATION_CLOSED',
    payload: event.notification?.data || null,
  }));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    await postToClients({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
  })());
});

// Intercepta mídias e vídeos do Cloudinary.
// Requisições do tipo 'Range' (streaming) muitas vezes quebram (ERR_CACHE_OPERATION_NOT_SUPPORTED)
// se a Cache API tentar tocá-las. Fazendo bypass direto para a rede resolve o problema.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === 'https://res.cloudinary.com') {
    // Evita otimização (tree-shaking) do compilador mantendo um log de efeito colateral
    console.debug('[SW] Bypass Cloudinary asset:', url.href);
    return;
  }
});
