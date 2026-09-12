/**
 * =============================================================================
 * File: src/components/pwa/ServiceWorkerSoundBridge.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


/**
 * Recebe mensagens do Service Worker para:
 * - tocar som quando o push chega e o app está aberto
 * - navegar quando o usuário clica na notificação
 *
 * Observação: navegadores não permitem tocar som quando o app está fechado.
 */
export function ServiceWorkerSoundBridge() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const warnedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    audioRef.current = new Audio("/sounds/push.mp3");
    audioRef.current.preload = "auto";

    // Chrome/Edge bloqueiam áudio automático. Precisamos "desbloquear" após um gesto do usuário.
    // Fazemos isso uma vez (pointerdown/keydown) com um play/pause silencioso.
    const unlock = async () => {
      try {
        const a = audioRef.current;
        if (!a) return;
        const prevVol = a.volume;
        a.volume = 0;
        a.currentTime = 0;
        await a.play();
        a.pause();
        a.volume = prevVol;
        unlockedRef.current = true;
      } catch {
        // se falhar, continuamos tentando apenas quando houver novas interações
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data?.type === "PLAY_NOTIFICATION_SOUND") {
        const soundUrl = typeof data.soundUrl === "string" ? data.soundUrl : "/sounds/push.mp3";
        if (!audioRef.current) audioRef.current = new Audio(soundUrl);
        audioRef.current.src = soundUrl;
        audioRef.current.currentTime = 0;

        // Se ainda não houve gesto do usuário, não tente tocar (gera warnings).
        if (!unlockedRef.current) {
          if (!warnedRef.current) {
            warnedRef.current = true;
            // notificação removida
          }
          return;
        }

        audioRef.current.play().catch((e) => {
          // Se o mp3 não for servido corretamente (404/mime), o navegador pode disparar NotSupportedError.
          // Tentamos um fallback.
          try {
            audioRef.current!.src = "/sounds/alertasom.mp3";
            audioRef.current!.currentTime = 0;
            audioRef.current!.play().catch(() => {});
          } catch {}
          console.warn("Falha ao tocar som do push:", e);
        });
      }

      if (data?.type === "NAVIGATE" && typeof data.url === "string") {
        navigate(data.url);
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  return null;
}
