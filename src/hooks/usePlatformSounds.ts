/**
 * =============================================================================
 * File: src/hooks/usePlatformSounds.ts
 * Purpose: Sons únicos e marcantes para a plataforma UndoinG
 *
 * Geração 100% via Web Audio API — sem arquivos externos
 * Sons modernos, futuristas e memoráveis
 * =============================================================================
 */

import { useCallback, useRef, useMemo } from "react";

// Contexto de áudio singleton
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioContext || globalAudioContext.state === "closed") {
    try {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return globalAudioContext;
}

// Resumo do contexto (browsers bloqueiam até interação do usuário)
async function resumeContext(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
}

// ──────────────────────────────────────────
// Funções de síntese
// ──────────────────────────────────────────

/** Tom com envelope ADSR */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.3,
  type: OscillatorType = "sine",
  detune = 0
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.detune.setValueAtTime(detune, startTime);

  // Envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/** Ruído filtrado (whoosh) */
function playNoise(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  volume = 0.1,
  filterFreq = 2000
) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, startTime);
  filter.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(startTime);
  source.stop(startTime + duration);
}

// ──────────────────────────────────────────
// SONS DA PLATAFORMA
// ──────────────────────────────────────────

/**
 * 🚀 STARTUP — Som de abertura do UndoinG
 * Futurista, ascendente, 2.2 segundos
 * Evoca "algo se ativando / despertando"
 */
export function playStartupSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    // Whoosh inicial
    playNoise(ctx, t, 0.4, 0.08, 800);

    // Sequência ascendente — notas da escala pentatônica em Mi menor
    const melody = [329.6, 392, 440, 523.2, 659.3];
    melody.forEach((freq, i) => {
      playTone(ctx, freq, t + 0.1 + i * 0.12, 0.35, 0.22, "triangle", 0);
      // Sub-harmônico
      playTone(ctx, freq / 2, t + 0.1 + i * 0.12, 0.25, 0.08, "sine");
    });

    // Acorde final — U-N-D-O-I-N-G chord
    const chord = [261.6, 329.6, 392, 523.2];
    chord.forEach((freq) => {
      playTone(ctx, freq, t + 0.85, 1.2, 0.12, "sine");
      playTone(ctx, freq * 2, t + 0.85, 0.8, 0.05, "triangle");
    });

    // Shimmer final
    playTone(ctx, 1046.5, t + 1.0, 0.9, 0.09, "sine");
    playTone(ctx, 1318.5, t + 1.15, 0.7, 0.06, "sine");

    // Click metálico de conclusão
    playNoise(ctx, t + 1.9, 0.08, 0.15, 4000);
  });
}

/**
 * 📤 MENSAGEM ENVIADA
 * Swoosh suave + ping — moderno, não-intrusivo
 */
export function playSendSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    // Whoosh de envio
    playNoise(ctx, t, 0.18, 0.06, 1200);

    // Ping confirmatório
    playTone(ctx, 880, t + 0.05, 0.18, 0.15, "sine");
    playTone(ctx, 1320, t + 0.1, 0.12, 0.08, "sine");
  });
}

/**
 * 📩 MENSAGEM RECEBIDA
 * Ping duplo moderno — reconhecível e não-irritante
 */
export function playReceiveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    playTone(ctx, 660, t, 0.12, 0.18, "sine");
    playTone(ctx, 990, t + 0.1, 0.14, 0.14, "sine");
    // Eco suave
    playTone(ctx, 660, t + 0.22, 0.1, 0.06, "sine");
  });
}

/**
 * 📌 PEDIDO DE SALVAMENTO
 * Tom interrogativo — chama atenção sem assustar
 */
export function playSaveRequestSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    // Dois tons ascendentes — "pergunta"
    playTone(ctx, 523.2, t, 0.15, 0.2, "triangle");
    playTone(ctx, 659.3, t + 0.12, 0.2, 0.2, "triangle");
    playTone(ctx, 783.9, t + 0.26, 0.25, 0.18, "sine");

    // Shimmer de atenção
    playNoise(ctx, t + 0.1, 0.2, 0.04, 3000);
  });
}

/**
 * ✅ SAVE APROVADO
 * Acorde positivo, celebratório
 */
export function playSaveApprovedSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    // Acorde maior ascendente
    const notes = [523.2, 659.3, 783.9, 1046.5];
    notes.forEach((freq, i) => {
      playTone(ctx, freq, t + i * 0.07, 0.5 - i * 0.05, 0.18 - i * 0.02, "sine");
    });

    // Brilho final
    playTone(ctx, 2093, t + 0.28, 0.3, 0.06, "sine");
  });
}

/**
 * ❌ SAVE REJEITADO
 * Tom descendente suave — negativo mas sem agressividade
 */
export function playSaveRejectedSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    playTone(ctx, 440, t, 0.15, 0.18, "triangle");
    playTone(ctx, 349.2, t + 0.12, 0.18, 0.16, "triangle");
    playTone(ctx, 293.7, t + 0.28, 0.25, 0.12, "sine");
  });
}

/**
 * 🔔 NOTIFICAÇÃO GERAL
 * Ping elegante único
 */
export function playNotifySound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  resumeContext(ctx).then(() => {
    const t = ctx.currentTime;

    playTone(ctx, 1046.5, t, 0.08, 0.2, "sine");
    playTone(ctx, 1318.5, t + 0.06, 0.18, 0.14, "sine");
  });
}

// ──────────────────────────────────────────
// Hook para uso nos componentes
// ──────────────────────────────────────────

export function usePlatformSounds() {
  // Flag para evitar sons duplicados em renders rápidos
  const lastPlayRef = useRef<Record<string, number>>({});

  const throttled = useCallback((key: string, fn: () => void, minInterval = 500) => {
    const now = Date.now();
    if ((lastPlayRef.current[key] || 0) + minInterval > now) return;
    lastPlayRef.current[key] = now;
    fn();
  }, []);

  return useMemo(() => ({
    playStartup: () => throttled("startup", playStartupSound, 5000),
    playSend: () => throttled("send", playSendSound, 300),
    playReceive: () => throttled("receive", playReceiveSound, 300),
    playSaveRequest: () => throttled("save_request", playSaveRequestSound, 1000),
    playSaveApproved: () => throttled("save_approved", playSaveApprovedSound, 1000),
    playSaveRejected: () => throttled("save_rejected", playSaveRejectedSound, 1000),
    playNotify: () => throttled("notify", playNotifySound, 500),
  }), [throttled]);
}
