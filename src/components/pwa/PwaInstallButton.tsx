/**
 * =============================================================================
 * File: src/components/pwa/PwaInstallButton.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

  getPwaInstallState,
  promptPwaInstall,
  subscribePwaInstall,
  isIOS,
} from "@/utils/pwaInstall";

type Placement = "floating" | "sidebar";

export function PwaInstallButton({
  className,
  placement = "floating",
}: {
  className?: string;
  placement?: Placement;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [needsReloadFix, setNeedsReloadFix] = useState(false);
  const [{ deferredPrompt, isStandalone }, setState] = useState(() => getPwaInstallState());

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isAndroid = /Android/i.test(ua);
  const isXiaomi = /Xiaomi|Redmi|MIUI|2312CRNCCL/i.test(ua);
  const isChrome = /Chrome\/[0-9.]+/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua);

  const chromeSiteDetailsUrl = useMemo(() => {
    try {
      if (!isChrome || !isAndroid) return null;
      const origin = window.location.origin;
      return `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
    } catch {
      return null;
    }
  }, [isChrome, isAndroid]);

  const chromeSettingsUrl = useMemo(() => {
    if (!isChrome) return null;
    return "chrome://settings";
  }, [isChrome]);

  const canUseNativePrompt = !!deferredPrompt;
  const showButton = useMemo(() => !isStandalone, [isStandalone]);

  useEffect(() => {
    return subscribePwaInstall(() => setState(getPwaInstallState()));
  }, []);

  const handleInstallClick = async () => {
    // Some devices (including certain Xiaomi/MIUI setups) won't fire beforeinstallprompt
    // until the Service Worker is active and controlling the page. If we detect that
    // the page is not yet controlled, guide the user to reload once.
    try {
      if (
        !deferredPrompt &&
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        !navigator.serviceWorker.controller
      ) {
        setNeedsReloadFix(true);
        setHelpOpen(true);
        return;
      }
    } catch {
      // ignore
    }

    const res = await promptPwaInstall();
    if (!res.ok) {
      setHelpOpen(true);
      return;
    }

    // Dismissed -> keep showing button, but allow the user to try again later.
    if (res.outcome !== "accepted") {
      setHelpOpen(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleReload = () => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  if (!showButton) return null;

  const containerClass =
    placement === "floating"
      ? cn(
          "fixed bottom-4 left-4 right-4 z-40",
          "lg:left-[calc(18rem+1rem)] lg:right-4",
          className
        )
      : cn("w-full", className);

  const buttonClass =
    placement === "floating" ? "w-full max-w-md shadow-lg" : "w-full h-9";

  return (
    <>
      <div className={containerClass}>
        <div className={placement === "floating" ? "flex items-center justify-center" : ""}>
          <Button
            onClick={handleInstallClick}
            className={buttonClass}
            variant={placement === "floating" ? "default" : "secondary"}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar / Instalar PWA
          </Button>
        </div>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar o app</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {canUseNativePrompt ? (
                  <p>
                    O Chrome liberou o instalador. Se a janela n\u00e3o abrir, feche e abra o Chrome, atualize a
                    p\u00e1gina e clique novamente.
                  </p>
                ) : needsReloadFix ? (
                  <p>
                    Para o Chrome liberar a instala\u00e7\u00e3o, o app precisa ativar o Service Worker. No seu aparelho ele
                    ainda n\u00e3o est\u00e1 controlando esta p\u00e1gina. Clique em <b>Recarregar</b> e depois clique de novo em
                    <b> Baixar / Instalar PWA</b>.
                  </p>
                ) : isIOS() ? (
                  <p>
                    No iPhone/iPad: toque em <b>Compartilhar</b> (\u2191) e depois em <b>Adicionar \u00e0 Tela de In\u00edcio</b>.
                  </p>
                ) : isAndroid ? (
                  <div className="space-y-2">
                    <p>
                      Seu navegador n\u00e3o liberou o instalador automaticamente. Isso acontece quando o Chrome
                      considera que o site ainda n\u00e3o est\u00e1 instal\u00e1vel <b>ou</b> quando o Android (em alguns Xiaomi/Redmi)
                      bloqueia a permiss\u00e3o de criar atalhos na tela inicial.
                    </p>
                    {isXiaomi && (
                      <p>
                        <b>Xiaomi/Redmi (ex.: Redmi A3):</b> verifique se o Chrome tem permiss\u00e3o de criar atalhos.
                        Procure por <b>"Atalhos na tela inicial"</b> / <b>"Criar atalhos"</b> / <b>"Home screen shortcuts"</b>
                        em: <b>Configura\u00e7\u00f5es</b> \u2192 <b>Apps</b> \u2192 <b>Gerenciar apps</b> \u2192 <b>Chrome</b> \u2192
                        <b>Outras permiss\u00f5es</b> (ou <b>Gerenciar atalhos na tela inicial</b>) \u2192 <b>Permitir</b>.
                      </p>
                    )}
                    <p>
                      <b>Chrome (permiss\u00e3o \"Instalar apps\"):</b> no Chrome, confira se a permiss\u00e3o de instalar apps est\u00e1 liberada:
                      Menu \u22ee \u2192 <b>Configura\u00e7\u00f5es</b> \u2192 <b>Privacidade e seguran\u00e7a</b> \u2192 <b>Configura\u00e7\u00f5es do site</b> \u2192
                      <b>Permiss\u00f5es</b> \u2192 <b>Instalar apps</b> \u2192 <b>Perguntar/Permitir</b>.
                    </p>
                    <p>
                      Depois: feche o Chrome (remova dos recentes), abra novamente, volte aqui, recarregue a p\u00e1gina e
                      clique no bot\u00e3o de instalar.
                    </p>
                  </div>
                ) : (
                  <p>
                    Seu navegador n\u00e3o liberou o instalador automaticamente. Verifique se o site est\u00e1 aberto em um
                    navegador compat\u00edvel com PWA (Chrome/Edge) e tente novamente.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {(chromeSiteDetailsUrl || chromeSettingsUrl) && (
            <div className="grid grid-cols-1 gap-2">
              {chromeSiteDetailsUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    try {
                      window.location.href = chromeSiteDetailsUrl;
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Abrir permiss\u00f5es do site (Chrome)
                </Button>
              )}
              {chromeSettingsUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    try {
                      window.location.href = chromeSettingsUrl;
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Abrir configura\u00e7\u00f5es do Chrome
                </Button>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {needsReloadFix && (
              <Button type="button" className="flex-1" onClick={handleReload}>
                Recarregar
              </Button>
            )}
            <Button type="button" variant="outline" className="flex-1" onClick={handleCopyLink}>
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            <Button type="button" className="flex-1" onClick={() => setHelpOpen(false)}>
              Ok
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
