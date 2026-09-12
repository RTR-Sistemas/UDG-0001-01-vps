/**
 * =============================================================================
 * File: src/utils/pwaInstall.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// Centralized PWA install prompt handling.
//
// IMPORTANT LIMITATION:
// Browsers do NOT allow forcing a "download" of the PWA.
// The only supported flow is triggering the native install prompt
// (when the browser deems the site installable) or showing guidance.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>; 
}

let initialized = false;
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;

const listeners = new Set<() => void>();

function isStandaloneMode(): boolean {
  try {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const standaloneByMql = !!mql?.matches;
    const standaloneByIOS = (navigator as any).standalone === true;
    return standaloneByMql || standaloneByIOS;
  } catch {
    return false;
  }
}

function notify() {
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

export function subscribePwaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallState() {
  return {
    deferredPrompt: deferred,
    isStandalone: isStandaloneMode() || installed,
  };
}

// Alias for compatibility with older imports/versions.
export function getPwaInstallSnapshot() {
  return getPwaInstallState();
}

export function initPwaInstallListener(): void {
  if (initialized) return;
  initialized = true;

  installed = isStandaloneMode();

  // Capture the install prompt as soon as possible.
  const onBip = (e: Event) => {
    try {
      (e as any).preventDefault?.();
    } catch {
      // ignore
    }
    deferred = e as BeforeInstallPromptEvent;
    notify();
  };

  const onInstalled = () => {
    installed = true;
    deferred = null;
    notify();
  };

  window.addEventListener('beforeinstallprompt', onBip as any);
  window.addEventListener('appinstalled', onInstalled);

  // Also react to display-mode changes.
  try {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => {
      installed = isStandaloneMode();
      if (installed) deferred = null;
      notify();
    };
    mql?.addEventListener?.('change', onChange);
  } catch {
    // ignore
  }

  notify();
}

export async function promptPwaInstall(): Promise<
  | { ok: true; outcome: 'accepted' | 'dismissed'; platform: string }
  | { ok: false; reason: 'no_prompt' | 'prompt_failed' }
> {
  if (!deferred) {
    return { ok: false, reason: 'no_prompt' };
  }

  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;

    // If accepted, clear prompt and mark installed.
    if (choice?.outcome === 'accepted') {
      deferred = null;
      installed = true;
      notify();
    }

    return {
      ok: true,
      outcome: choice?.outcome ?? 'dismissed',
      platform: choice?.platform ?? 'unknown',
    };
  } catch {
    return { ok: false, reason: 'prompt_failed' };
  }
}

export function isIOS(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua);
}



// Extra named export to avoid bundler edge-cases.
export const getPwaInstallStateConst = () => getPwaInstallState();
