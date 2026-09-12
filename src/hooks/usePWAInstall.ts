import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  platform: "android" | "ios" | "desktop" | "unknown";
  browser: string;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [state, setState] = useState<PWAInstallState>({
    canInstall: false,
    isInstalled: false,
    platform: "unknown",
    browser: "",
    deferredPrompt: null,
  });
  const { toast } = useToast();

  const detectPlatform = useCallback((): "android" | "ios" | "desktop" | "unknown" => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
    if (/windows|macintosh|linux/i.test(ua)) return "desktop";
    return "unknown";
  }, []);

  const detectBrowser = useCallback((): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edg")) return "Edge";
    return "Unknown";
  }, []);

  const checkIfInstalled = useCallback((): boolean => {
    // iOS PWA detection
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if ((window.navigator as any).standalone === true) return true; // iOS Safari
    // Android/Chrome
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    return false;
  }, []);

  useEffect(() => {
    const platform = detectPlatform();
    const browser = detectBrowser();
    const isInstalled = checkIfInstalled();

    setState(prev => ({ ...prev, platform, browser, isInstalled }));

    // Se o evento disparou antes do React montar (captura precoce via window)
    const early = (window as any).__deferredPrompt as BeforeInstallPromptEvent | undefined;
    if (early) {
      setState(prev => ({ ...prev, canInstall: true, deferredPrompt: prev.deferredPrompt || early }));
    }

    // Listen for beforeinstallprompt (Android/Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      (window as any).__deferredPrompt = promptEvent;
      setState(prev => ({ ...prev, canInstall: true, deferredPrompt: promptEvent }));
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setState(prev => ({ ...prev, isInstalled: true, canInstall: false, deferredPrompt: null }));
      toast({ title: "App instalado! 🎉", description: "Agora você pode acessar o UDG direto da tela inicial." });
      // Log install event
      (supabase as any).rpc("log_pwa_install", {
        p_platform: platform,
        p_browser: browser,
        p_source: "prompt",
        p_installed: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Initial check for already installed
    if (isInstalled) {
      setState(prev => ({ ...prev, isInstalled: true }));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [detectPlatform, detectBrowser, checkIfInstalled, toast]);

  const install = async (): Promise<true | false | "manual"> => {
    let prompt = state.deferredPrompt || (window as any).__deferredPrompt as BeforeInstallPromptEvent | undefined;
    if (!prompt) {
      // No Android/Chrome o prompt pode chegar com atraso (SW ainda registrando) — aguarda até 2s
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 250));
        prompt = (window as any).__deferredPrompt as BeforeInstallPromptEvent | undefined;
        if (prompt) break;
      }
    }
    if (!prompt) {
      // Sem prompt nativo: instalação manual (ainda instalável, só sem one-click)
      if (state.platform === "ios") {
        toast({
          title: "Como instalar no iPhone",
          description: "Toque em Compartilhar → Adicionar à Tela de Início → Adicionar",
          duration: 8000,
        });
      }
      // Garante que o Service Worker esteja ativo antes de mostrar o manual
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg || !reg.active) {
            try { await navigator.serviceWorker.ready; } catch {}
          }
        }
      } catch {}
      return "manual";
    }

    const activePrompt = prompt || state.deferredPrompt!;
    await activePrompt.prompt();
    const choice = await activePrompt.userChoice;

    if (choice.outcome === "accepted") {
      toast({ title: "Instalando...", description: "O app será adicionado à sua tela inicial." });
      (supabase as any).rpc("log_pwa_install", {
        p_platform: state.platform,
        p_browser: state.browser,
        p_source: "prompt",
        p_installed: true,
      }).catch(() => {});
      return true;
    } else {
      (supabase as any).rpc("log_pwa_install", {
        p_platform: state.platform,
        p_browser: state.browser,
        p_source: "prompt",
        p_installed: false,
      }).catch(() => {});
      return false;
    }
  };

  const dismissInstallPrompt = () => {
    setState(prev => ({ ...prev, canInstall: false }));
  };

  return { ...state, install, dismissInstallPrompt };
}

// Hook para mostrar banner de instalação inteligente
export function usePWAInstallBanner() {
  const { canInstall, isInstalled, platform, install, dismissInstallPrompt } = usePWAInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const v = localStorage.getItem("pwa_banner_dismissed_at");
      if (!v) return false;
      const ts = parseInt(v, 10);
      if (Number.isFinite(ts) && Date.now() - ts < 24 * 60 * 60 * 1000) return true;
      localStorage.removeItem("pwa_banner_dismissed_at");
      return false;
    } catch { return false; }
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("pwa_force") === "1") {
        setShowBanner(true);
        return;
      }
    } catch {}
    if (isInstalled || dismissed) {
      setShowBanner(false);
      return;
    }
    // Mostra sempre que não estiver instalado, mesmo sem beforeinstallprompt (fallback com instruções)
    const delay = canInstall ? 1500 : 3000;
    const timer = setTimeout(() => {
      if (!dismissed && !isInstalled) setShowBanner(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    dismissInstallPrompt();
    try { localStorage.setItem("pwa_banner_dismissed_at", String(Date.now())); } catch {}
  };

  return { showBanner, handleDismiss, install, platform };
}