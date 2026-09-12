/**
 * =============================================================================
 * File: src/components/PWAInstallPrompt.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStandalone } from "@/utils/pwa";
import { Card } from "@/components/ui/card";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome\//i.test(ua) && !/EdgA\//i.test(ua) && !/OPR\//i.test(ua) && !/SamsungBrowser\//i.test(ua);
  const isXiaomi = /Xiaomi|MiuiBrowser|Mi Browser|MIUI/i.test(ua);
  // Many users open links inside apps (WhatsApp/Instagram/Facebook/etc.).
  // Those "in-app browsers" often don't show the install / add-to-home options.
  const isInAppBrowser = /(wv|FBAN|FBAV|Instagram|Line|WhatsApp|Telegram|TikTok|Snapchat)/i.test(ua);

  const openInChrome = () => {
    try {
      const url = window.location.href;
      // Android intent scheme: opens in Chrome from in-app browsers.
      const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=${window.location.protocol.replace(':', '')};package=com.android.chrome;end`;
      // Try intent first (works best from in-app browsers)
      window.location.href = intentUrl;
      // Fallback: open normally
      setTimeout(() => {
        window.open(url, '_blank');
      }, 500);
    } catch {
      window.open(window.location.href, '_blank');
    }
  };

  useEffect(() => {
    try {
      if (isStandalone()) {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    } catch {}
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [swControlled, setSwControlled] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    // Helps on some Android devices (including some Xiaomi):
    // PWA becomes installable only after the SW controls the page (often after 1 reload)
    setSwControlled(!!navigator?.serviceWorker?.controller);
    const onControllerChange = () => setSwControlled(!!navigator?.serviceWorker?.controller);
    navigator?.serviceWorker?.addEventListener?.('controllerchange', onControllerChange);

    // Check if already installed
    const checkInstalled = () => {
      // Check if running as standalone (installed PWA)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      
      // Check if running on mobile Safari home screen
      if ((navigator as any).standalone) {
        setIsInstalled(true);
        return true;
      }
      
      return false;
    };

    const installed = checkInstalled();

    // Listen for beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 3 seconds if not dismissed before
      setTimeout(() => {
        const raw = localStorage.getItem('pwa-prompt-dismissed-at');
        const last = raw ? Number(raw) : 0;
        const day = 24 * 60 * 60 * 1000;
        if (!installed && (!last || Date.now() - last > day)) setShowPrompt(true);
      }, 3000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For Safari and other browsers, show manual install prompt
    if (!installed && !deferredPrompt) {
      setTimeout(() => {
        const raw = localStorage.getItem('pwa-prompt-dismissed-at');
        const last = raw ? Number(raw) : 0;
        const day = 24 * 60 * 60 * 1000;
        if (!last || Date.now() - last > day) setShowPrompt(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      navigator?.serviceWorker?.removeEventListener?.('controllerchange', onControllerChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Chrome/Edge install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } else {
      // Manual install instructions remain visible
      // User needs to use browser menu
    }
  };

  const handleOpenPWA = () => {
    // Try to open the installed PWA
    const appUrl = window.location.origin;
    window.open(appUrl, '_blank');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    const now = Date.now();
    setDismissedAt(now);
    localStorage.setItem('pwa-prompt-dismissed-at', String(now));
  };

  if (dismissedAt || (!showPrompt && !isInstalled)) {
    return null;
  }

  // If installed, show "Open App" prompt
  if (isInstalled && !window.matchMedia('(display-mode: standalone)').matches) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96 animate-in slide-in-from-bottom-5">
        <Card className="p-4 shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-card/95 backdrop-blur">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">App Instalado!</h3>
              <p className="text-sm text-muted-foreground mb-3">
                O app já está instalado. Abra para uma melhor experiência.
              </p>
              
              <Button 
                onClick={handleOpenPWA}
                className="w-full bg-gradient-to-r from-primary to-secondary"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir App
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // If not installed, show install prompt
  if (showPrompt && !isInstalled) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden relative animate-in zoom-in-95 duration-300">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 bg-muted/50 hover:bg-muted rounded-full transition-colors z-10"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="p-6 flex flex-col items-center text-center">
            <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
              {iconFailed ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              ) : (
                <img src="/icon-192.png" alt="App Icon" className="h-16 w-16 rounded-2xl object-cover" onError={() => setIconFailed(true)} />
              )}
            </div>
            
            <h2 className="text-xl font-bold mb-2">Baixe o App Oficial</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Instale o Undoing no seu celular para uma experiência mais rápida, estável e notificações nativas.
            </p>

            {deferredPrompt ? (
              <Button 
                onClick={handleInstallClick} 
                className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              >
                <Download className="mr-2 h-5 w-5" />
                Instalar Aplicativo
              </Button>
            ) : (
              <div className="w-full space-y-2 text-xs text-muted-foreground text-left">
                <p className="font-medium text-center">Como instalar:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>iPhone:</strong> Compartilhar → Adicionar à Tela Inicial</li>
                  <li><strong>Android:</strong> ⋮ Menu → <strong>Instalar app</strong></li>
                </ul>

                {isAndroid && isInAppBrowser && (
                  <div className="mt-3 rounded-md border p-2">
                    <p className="font-medium">Navegador interno detectado</p>
                    <p>Abra no Chrome para conseguir instalar.</p>
                    <Button
                      onClick={openInChrome}
                      variant="secondary"
                      className="w-full mt-2"
                    >
                      Abrir no Google Chrome
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={handleDismiss}
              className="mt-5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
