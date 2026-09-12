
const BADGE_COUNT_KEY = "udg_app_badge_count";

function getNavigatorWithBadgeApi(): (Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}) | null {
  if (typeof navigator === 'undefined') return null;
  return navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
}

export function getStoredBadgeCount(): number {
  if (typeof localStorage === 'undefined') return 0;
  const value = Number(localStorage.getItem(BADGE_COUNT_KEY) || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function storeBadgeCount(count: number): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  localStorage.setItem(BADGE_COUNT_KEY, String(normalized));
}

export async function applyAppBadge(count: number): Promise<void> {
  const normalized = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  storeBadgeCount(normalized);

  const nav = getNavigatorWithBadgeApi();
  if (!nav) return;

  try {
    if (normalized > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(normalized);
      return;
    }

    if (normalized <= 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge();
      return;
    }

    if (normalized <= 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(0);
    }
  } catch (error) {
    console.debug('[Badge] Não foi possível atualizar o badge do app:', error);
  }
}

export async function incrementAppBadge(delta = 1): Promise<number> {
  const next = Math.max(0, getStoredBadgeCount() + Math.max(0, Math.floor(delta || 0)));
  await applyAppBadge(next);
  return next;
}

export async function clearAppBadgeState(): Promise<void> {
  await applyAppBadge(0);
}

export function notifyServiceWorkerBadgeUpdate(count: number): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage?.({
    type: 'SET_APP_BADGE',
    count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
  });
}
