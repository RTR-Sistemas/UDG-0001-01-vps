/**
 * =============================================================================
 * File: src/lib/battleUtils.ts
 * Purpose: Utilitários do sistema de Batalhas ao Vivo (formatação, sons,
 *          animações de presentes e comissão da plataforma).
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// SECTION: Formatação
// -----------------------------------------------------------------------------

export function formatCoins(amount: number | bigint | null | undefined): string {
  const n = Number(amount ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return String(n);
}

export function formatDiamonds(amount: number | bigint | null | undefined): string {
  return formatCoins(amount);
}

export function getPlatformFeePercentage(): number {
  return 0.5;
}

export function getWithdrawalFeePercentage(): number {
  return 0.05;
}

export function formatCurrencyBRL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// -----------------------------------------------------------------------------
// SECTION: Animação de presentes (emoji flutuante)
// -----------------------------------------------------------------------------

export function animateGift(emoji: string | null | undefined, label?: string): void {
  if (!emoji) return;
  const el = document.createElement("div");
  el.textContent = emoji;
  el.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:55%",
    "transform:translate(-50%,0)",
    "font-size:64px",
    "z-index:9999",
    "pointer-events:none",
    "animation:udgGiftFloat 1.8s ease-out forwards",
    "text-shadow:0 4px 20px rgba(0,0,0,.4)",
  ].join(";");
  if (label) el.setAttribute("aria-label", label);
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 1900);
}

// -----------------------------------------------------------------------------
// SECTION: Animação de corações (tap na tela — style TikTok)
// -----------------------------------------------------------------------------

export function spawnHearts(container: HTMLElement, count = 1): void {
  for (let i = 0; i < count; i++) {
    const heart = document.createElement("div");
    heart.textContent = ["❤️", "💖", "💘", "💗", "💜", "💕"][Math.floor(Math.random() * 6)];
    heart.style.cssText = [
      "position:absolute",
      `left:${45 + Math.random() * 10}%`,
      `bottom:20%`,
      `font-size:${18 + Math.random() * 22}px`,
      "z-index:40",
      "pointer-events:none",
      "animation:udgHeartFloat 1.4s ease-out forwards",
      "opacity:0.95",
    ].join(";");
    container.appendChild(heart);
    window.setTimeout(() => heart.remove(), 1500);
  }
}

// -----------------------------------------------------------------------------
// SECTION: Presente grande em tela cheia (efeito premium)
// -----------------------------------------------------------------------------

export function showBigGift(emoji: string, name: string, senderName?: string): void {
  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:10000",
    "pointer-events:none",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:radial-gradient(circle at center, rgba(0,0,0,0.35), rgba(0,0,0,0.65))",
    "animation:udgBigGiftBg 0.3s ease-out forwards",
  ].join(";");

  const ring = document.createElement("div");
  ring.style.cssText = "position:absolute;width:340px;height:340px;border-radius:50%;border:4px solid rgba(255,255,255,0.35);animation:udgBigGiftRing 1s ease-out forwards;";

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;animation:udgBigGiftIn 0.7s cubic-bezier(.34,1.56,.64,1) forwards;";

  const emojiEl = document.createElement("div");
  emojiEl.textContent = emoji;
  emojiEl.style.cssText = "font-size:110px;line-height:1;filter:drop-shadow(0 10px 30px rgba(0,0,0,0.6));animation:udgBigGiftBounce 1.2s ease-in-out infinite;";

  const nameEl = document.createElement("div");
  nameEl.textContent = name;
  nameEl.style.cssText = "font-size:22px;font-weight:900;letter-spacing:0.05em;color:#fff;text-transform:uppercase;text-shadow:0 4px 24px rgba(0,0,0,0.8);";

  const senderEl = document.createElement("div");
  senderEl.textContent = senderName ? `${senderName} enviou!` : "";
  senderEl.style.cssText = "font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);text-shadow:0 2px 12px rgba(0,0,0,0.8);";

  // chuva de emojis do presente
  for (let i = 0; i < 12; i++) {
    const drop = document.createElement("div");
    drop.textContent = emoji;
    drop.style.cssText = [
      "position:absolute",
      `left:${(i / 12) * 100}%`,
      "top:-40px",
      `font-size:${22 + Math.random() * 22}px`,
      "animation:udgBigGiftRain 1.6s ease-in forwards",
      `animation-delay:${i * 0.09}s`,
      "opacity:0",
    ].join(";");
    overlay.appendChild(drop);
  }

  wrap.appendChild(emojiEl);
  wrap.appendChild(nameEl);
  wrap.appendChild(senderEl);
  overlay.appendChild(ring);
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  window.setTimeout(() => {
    overlay.style.transition = "opacity 0.4s ease";
    overlay.style.opacity = "0";
    window.setTimeout(() => overlay.remove(), 420);
  }, 2200);
}

// -----------------------------------------------------------------------------
// SECTION: Confete (fim de batalha)
// -----------------------------------------------------------------------------

export function launchConfetti(durationMs = 2500): void {
  const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#eab308", "#22d3ee"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9998;";
  document.body.appendChild(container);

  const pieces = 90;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    piece.style.cssText = [
      "position:absolute",
      `left:${Math.random() * 100}%`,
      "top:-14px",
      `width:${size}px`,
      `height:${size * (0.5 + Math.random() * 0.8)}px`,
      `background:${color}`,
      "border-radius:2px",
      "animation:udgConfettiFall 2.2s linear forwards",
      `animation-delay:${Math.random() * 0.6}s`,
      `transform:rotate(${Math.random() * 360}deg)`,
    ].join(";");
    container.appendChild(piece);
  }

  const boom = document.createElement("div");
  boom.textContent = "🏆";
  boom.style.cssText = "position:absolute;top:50%;left:50%;margin:-60px 0 0 -60px;font-size:120px;animation:udgBigGiftIn 0.8s cubic-bezier(.34,1.56,.64,1) forwards;";
  container.appendChild(boom);

  window.setTimeout(() => container.remove(), durationMs + 700);
}

// -----------------------------------------------------------------------------
// SECTION: Sons de batalha (Web Audio API, sem arquivos externos)
// -----------------------------------------------------------------------------

let battleAudioCtx: AudioContext | null = null;

function getBattleAudioContext(): AudioContext | null {
  try {
    if (!battleAudioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      battleAudioCtx = new Ctor();
    }
    if (battleAudioCtx.state === "suspended") {
      battleAudioCtx.resume().catch(() => undefined);
    }
    return battleAudioCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.12
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export type BattleSoundEvent =
  | "gift"
  | "countdown"
  | "extension"
  | "victory"
  | "defeat"
  | "invite"
  | "tick";

export function playBattleSound(event: BattleSoundEvent): void {
  const ctx = getBattleAudioContext();
  if (!ctx) return;
  try {
    switch (event) {
      case "gift":
        tone(ctx, 660, 0, 0.12, "sine", 0.15);
        tone(ctx, 880, 0.09, 0.18, "sine", 0.12);
        break;
      case "countdown":
        tone(ctx, 1046, 0, 0.09, "square", 0.08);
        break;
      case "tick":
        tone(ctx, 392, 0, 0.06, "square", 0.06);
        break;
      case "extension":
        tone(ctx, 523, 0, 0.15, "triangle", 0.14);
        tone(ctx, 659, 0.12, 0.15, "triangle", 0.14);
        tone(ctx, 784, 0.24, 0.25, "triangle", 0.14);
        break;
      case "invite":
        tone(ctx, 587, 0, 0.15, "sine", 0.12);
        tone(ctx, 880, 0.14, 0.2, "sine", 0.12);
        break;
      case "victory":
        [523, 659, 784, 1046].forEach((f, i) => tone(ctx, f, i * 0.12, 0.22, "triangle", 0.16));
        tone(ctx, 1318, 0.5, 0.4, "triangle", 0.14);
        break;
      case "defeat":
        [659, 523, 392, 330].forEach((f, i) => tone(ctx, f, i * 0.14, 0.2, "sawtooth", 0.07));
        break;
    }
  } catch {
    // ignora falhas de áudio (ambiente sem permissão)
  }
}