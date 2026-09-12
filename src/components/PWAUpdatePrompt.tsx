/**
 * =============================================================================
 * PWAUpdatePrompt — Overlay automático de atualização do PWA (Native Hook)
 *
 * Utiliza o hook `useRegisterSW` da biblioteca nativa do vite-plugin-pwa
 * para garantir 100% de confiabilidade na detecção do novo Service Worker,
 * sem depender de variáveis globais ou delays no React.
 *
 * Proteções anti-loop:
 *  - Conta reloads na sessionStorage (max 2 consecutivos)
 *  - Timeout de segurança: se ficar "Atualizando" por 12s, libera o app
 * =============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { safeSessionStorage } from "@/utils/safeStorage";

const AUTO_UPDATE_SECONDS = 5;
const MAX_UPDATE_RELOADS = 2;
const UPDATING_TIMEOUT_MS = 12_000;

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10, 5, 25, 0.88)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  animation: "udgFadeIn 0.4s ease-out",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  width: "90vw",
  maxWidth: 380,
  borderRadius: 28,
  padding: "36px 28px 32px",
  background: "linear-gradient(145deg, rgba(30, 20, 55, 0.97), rgba(18, 10, 38, 0.99))",
  border: "1px solid rgba(159, 122, 234, 0.28)",
  boxShadow: "0 0 80px rgba(159, 122, 234, 0.15), 0 25px 60px rgba(0,0,0,0.6)",
  overflow: "hidden",
  animation: "udgSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
};

/** Conta quantos reloads de update já ocorreram nesta sessão */
function getUpdateReloadCount(): number {
  return parseInt(safeSessionStorage.getItem("pwa_update_count") || "0", 10);
}
function incrementUpdateReloadCount(): void {
  const count = getUpdateReloadCount() + 1;
  safeSessionStorage.setItem("pwa_update_count", String(count));
}

export function PWAUpdatePrompt() {
  const [countdown, setCountdown] = useState(AUTO_UPDATE_SECONDS);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fallbackRefresh, setFallbackRefresh] = useState(false);
  const updatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Armazena a versão inicial para comparar
  const initialBuildId = useRef<string | null>(null);

  // Se já recarregou demais, não mostra mais o prompt (anti-loop)
  const isLooping = getUpdateReloadCount() >= MAX_UPDATE_RELOADS;

  const dismissedRef = useRef(false);
  dismissedRef.current = dismissed;
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  // Hook 100% nativo do vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        const updateSW = async () => {
          if (dismissedRef.current || isLoopingRef.current) return;
          if (typeof navigator !== "undefined" && navigator.onLine === false) return;
          try {
            await r.update();
            try {
              const res = await fetch('/build.json', { cache: 'no-store' });
              const data = await res.json();
              if (data?.buildId) {
                if (!initialBuildId.current) {
                   initialBuildId.current = data.buildId;
                } else if (initialBuildId.current !== data.buildId) {
                   console.warn('[PWA] Nova versão detectada via build.json!', data.buildId);
                   setFallbackRefresh(true);
                }
              }
            } catch (err) {
              if (typeof navigator !== "undefined" && navigator.onLine === false) return;
              console.debug('[PWA] build.json check falhou (offline ignorado):', err);
            }
          } catch(err: any) {
            if (typeof navigator !== "undefined" && navigator.onLine === false) return;
            const m = String(err?.message || "");
            if (m.includes("Failed to update") || m.includes("InvalidState") || m.includes("Not found")) {
              console.debug('[PWA] update check adiado (SW installing):', m.slice(0, 100));
            } else {
              console.debug('[PWA] Fallback update check falhou:', err);
            }
          }
        };

        const interval = setInterval(updateSW, 60 * 1000);

        // Verifica também quando o app volta a ter foco (ex: usuário abre aba após horas)
        const onFocus = () => {
          if (document.visibilityState === 'visible') {
            updateSW();
          }
        };
        window.addEventListener('visibilitychange', onFocus);
        window.addEventListener('focus', onFocus);
        // Tenta pegar o hash logo de cara
        setTimeout(() => updateSW(), 2000);
      }
    },
    onRegisterError(error) {
      console.error("[PWA] Erro crítico no ServiceWorker:", error);
    },
  });

  // Limpa o contador quando não há refresh pendente (app está estável)
  const isRefreshPending = needRefresh || fallbackRefresh;
  
  useEffect(() => {
    if (!isRefreshPending) {
      safeSessionStorage.removeItem("pwa_update_count");
    }
  }, [isRefreshPending]);

  const doUpdate = useCallback(async () => {
    if (updating) return;
    setUpdating(true);
    incrementUpdateReloadCount();

    try {
      if (needRefresh) {
        // Dispara o SKIP_WAITING no service worker nativamente.
        await updateServiceWorker(true);
      } else {
        // Em caso de fallback (build.json diferiu), forçamos reload bruto
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
        }
        window.location.reload();
      }
    } catch (e) {
      console.error("Erro ao atualizar SW:", e);
      // Se falhou, libera o app
      setUpdating(false);
      setDismissed(true);
      setNeedRefresh(false);
      setFallbackRefresh(false);
    }
  }, [updateServiceWorker, updating, setNeedRefresh, needRefresh]);

  // Timeout de segurança: se ficar travado em "atualizando", libera o app
  useEffect(() => {
    if (updating) {
      updatingTimerRef.current = setTimeout(() => {
        console.warn("[PWA] Update timeout — liberando o app");
        setUpdating(false);
        setDismissed(true);
        setNeedRefresh(false);
      }, UPDATING_TIMEOUT_MS);
    }

    return () => {
      if (updatingTimerRef.current) {
        clearTimeout(updatingTimerRef.current);
      }
    };
  }, [updating, setNeedRefresh]);

  // Contagem regressiva automática — atualiza SEM botão
  useEffect(() => {
    if (!isRefreshPending || updating || isLooping || dismissed) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          doUpdate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRefreshPending, updating, doUpdate, isLooping, dismissed]);

  // Não renderizar se: loop detectado, não precisa atualizar, ou foi dispensado
  if (!isRefreshPending || isLooping || dismissed) return null;

  // Cálculo do anel SVG circular
  const RADIUS = 54;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const elapsed = AUTO_UPDATE_SECONDS - countdown;
  const strokeDashoffset = CIRCUMFERENCE * (1 - elapsed / AUTO_UPDATE_SECONDS);

  return (
    <>
      <style>{`
        @keyframes udgFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes udgSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes udgOrb {
          0%, 100% { opacity: 0.5; transform: scale(1);    }
          50%      { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes udgSpin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes udgDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1;    }
        }
        @keyframes udgRingGlow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(159,122,234,0.5)); }
          50%      { filter: drop-shadow(0 0 14px rgba(159,122,234,0.9)); }
        }
      `}</style>

      <div style={overlayStyle}>
        <div style={cardStyle}>

          {/* Orbes decorativos */}
          <div style={{
            position: "absolute", top: -70, right: -70, width: 180, height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(159,122,234,0.28) 0%, transparent 70%)",
            animation: "udgOrb 3s ease-in-out infinite",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -50, left: -50, width: 140, height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            animation: "udgOrb 4s ease-in-out infinite 1.2s",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>

            {/* ── LOADING CIRCULAR ── */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
              <div style={{ position: "relative", width: 130, height: 130 }}>

                {/* Trilha de fundo */}
                <svg width="130" height="130" style={{ position: "absolute", inset: 0 }}>
                  <circle
                    cx="65" cy="65" r={RADIUS}
                    fill="none"
                    stroke="rgba(159,122,234,0.10)"
                    strokeWidth="9"
                  />
                </svg>

                {/* Anel de progresso */}
                <svg
                  width="130" height="130"
                  style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
                >
                  <defs>
                    <linearGradient id="udgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"   stopColor="#9F7AEA" />
                      <stop offset="100%" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="65" cy="65" r={RADIUS}
                    fill="none"
                    stroke={updating ? "#9F7AEA" : "url(#udgGrad)"}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={updating ? 0 : strokeDashoffset}
                    style={{
                      transition: "stroke-dashoffset 1s linear",
                      animation: "udgRingGlow 2s ease-in-out infinite",
                    }}
                  />
                </svg>

                {/* Conteúdo central */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {updating ? (
                    <RefreshCw
                      size={30}
                      color="#9F7AEA"
                      style={{ animation: "udgSpin 0.9s linear infinite" }}
                    />
                  ) : (
                    <>
                      <span style={{
                        fontSize: 36, fontWeight: 800, color: "#fff",
                        lineHeight: 1, letterSpacing: "-0.03em",
                      }}>
                        {countdown}
                      </span>
                      <span style={{
                        fontSize: 10, color: "rgba(255,255,255,0.45)",
                        letterSpacing: "0.12em", marginTop: 2,
                        fontWeight: 600,
                      }}>
                        SEG
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Título */}
            <h2 style={{
              fontSize: 21, fontWeight: 700, color: "#fff",
              margin: "0 0 8px", letterSpacing: "-0.02em",
            }}>
              {updating ? "Atualizando sistema..." : "Nova versão disponível!"}
            </h2>

            {/* Descrição */}
            <p style={{
              fontSize: 13.5, color: "rgba(255,255,255,0.55)",
              margin: "0 0 20px", lineHeight: 1.65,
            }}>
              {updating
                ? "Aplicando a atualização, aguarde um instante..."
                : "Baixamos novidades em segundo plano. O app vai reiniciar automaticamente."}
            </p>

            {/* Dots enquanto atualiza */}
            {updating && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#9F7AEA",
                      animation: `udgDot 1.2s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Texto discreto de contagem */}
            {!updating && (
              <p style={{
                fontSize: 12, color: "rgba(255,255,255,0.28)",
                marginTop: 2, fontVariantNumeric: "tabular-nums",
              }}>
                Reiniciando automaticamente em {countdown}s
              </p>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
