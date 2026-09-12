/**
 * =============================================================================
 * File: src/lib/attentionEffects.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

let lastAttentionEffectAt = 0;

/**
 * Evita efeitos duplicados (Realtime + Push) disparando em sequência.
 * Retorna true quando é OK executar o efeito agora.
 */
export function shouldRunAttentionEffect(cooldownMs = 1400): boolean {
  const now = Date.now();
  if (now - lastAttentionEffectAt < cooldownMs) return false;
  lastAttentionEffectAt = now;
  return true;
}

export function runShakeEffect(durationMs = 700) {
  try {
    document.body.classList.add('shake');
    window.setTimeout(() => document.body.classList.remove('shake'), durationMs);
  } catch {
    // noop
  }
}

export function runAttentionVibration() {
  try {
    // Evita o "Blocked call to navigator.vibrate..." checking userActivation
    if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // noop
  }
}
