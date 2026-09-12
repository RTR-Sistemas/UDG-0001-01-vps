/**
 * =============================================================================
 * File: src/lib/notificationSounds.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

/**
 * Sons no navegador:
 * - Com o app ABERTO: dá para tocar som (após desbloquear com interação do usuário).
 * - Com o app FECHADO: o navegador/OS controla (web push NÃO permite som custom por payload).
 *
 * A ideia aqui é: quando o push chega e existe um client ativo, tocamos som no client.
 * Para "Chamar Atenção" usamos uma sirene (WebAudio), e para outros eventos um ping.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

let attentionAudio: HTMLAudioElement | null = null;

function getAttentionAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!attentionAudio) {
    attentionAudio = new Audio("/sounds/alertasom.mp3");
    attentionAudio.preload = "auto";
  }
  return attentionAudio;
}


export function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export async function unlockAudioOnce(): Promise<void> {
  const ctx = ensureAudioContext();
  if (!ctx || unlocked) return;

  try {
    if (ctx.state === "suspended") await ctx.resume();
    // “prime” o áudio com um buffer silencioso
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    unlocked = true;
  } catch {
    // ignore
  }
}

type ToneOpts = {
  frequency: number;
  durationMs: number;
  gain?: number;
};

function playTone({ frequency, durationMs, gain = 0.15 }: ToneOpts) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, now);

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playNotificationPing(): void {
  playTone({ frequency: 880, durationMs: 120, gain: 0.12 });
}

export function playMessagePing(): void {
  playTone({ frequency: 740, durationMs: 140, gain: 0.12 });
  setTimeout(() => playTone({ frequency: 880, durationMs: 100, gain: 0.1 }), 120);
}

export function playSirenLoud(durationMs = 2500): void {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  // Gain alto, mas ainda respeita o volume do dispositivo/navegador.
  const maxGain = 0.55;

  osc.type = "sawtooth";

  // varredura (600Hz <-> 1100Hz) em loop
  const sweepPeriod = 0.35; // segundos
  const steps = Math.max(1, Math.floor((durationMs / 1000) / sweepPeriod));
  let t = now;
  for (let i = 0; i < steps; i++) {
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.linearRampToValueAtTime(1100, t + sweepPeriod / 2);
    osc.frequency.linearRampToValueAtTime(650, t + sweepPeriod);
    t += sweepPeriod;
  }

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(maxGain, now + 0.02);
  g.gain.setValueAtTime(maxGain, now + (durationMs / 1000) - 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playAttentionAlertSound(): void {
  const attention = getAttentionAudio();
  if (attention && unlocked) {
    try {
      attention.currentTime = 0;
      void attention.play().catch(() => {
        playSirenLoud(1800);
      });
      return;
    } catch {
      // fallback abaixo
    }
  }

  playSirenLoud(1800);
}
