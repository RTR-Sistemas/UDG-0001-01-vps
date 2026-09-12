import { useState, useEffect } from "react";
import { Download, Smartphone, X, CheckCheck, Loader2, Star, ShieldCheck, HardDrive, Users, Play, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePWAInstallBanner } from "@/hooks/usePWAInstall";

export function PWAInstallBanner() {
  const { showBanner, handleDismiss, install, platform } = usePWAInstallBanner();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "downloading" | "installing" | "installed" | "manual">("idle");
  const [showManualHelp, setShowManualHelp] = useState(false);

  if (!showBanner) return null;

  const isIOS = platform === "ios";
  const appIcon = "/icon-192.png";

  const handleInstallClick = async () => {
    if (isIOS) {
      await install();
      setPhase("manual");
      setShowManualHelp(true);
      return;
    }
    if (phase !== "idle") return;
    setPhase("downloading");
    setDownloadProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 6;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setDownloadProgress(100);
        setTimeout(async () => {
          setPhase("installing");
          const result = await install();
          if (result === true) {
            setPhase("installed");
            setTimeout(() => handleDismiss(), 4000);
          } else if (result === "manual") {
            setPhase("manual");
            setShowManualHelp(true);
          } else {
            // dismissed
            setPhase("idle");
            setDownloadProgress(0);
          }
        }, 600);
      } else {
        setDownloadProgress(Math.floor(p));
      }
    }, 180);
  };

  const handleOpenApp = () => {
    handleDismiss();
    try {
      localStorage.setItem("pwa_installed_hint", "1");
    } catch {}
    window.location.href = "/";
  };

  return (
    <>
      {/* Notificação sistema durante download - topo */}
      {phase === "downloading" && (
        <div className="fixed top-0 inset-x-0 z-[200] animate-in slide-in-from-top-2 duration-300">
          <div className="mx-2 mt-2 md:mx-auto md:max-w-md bg-[#202124] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <img src={appIcon} alt="UDG" className="h-10 w-10 rounded-xl bg-white p-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">Baixando Undoing…</p>
                <p className="text-xs text-white/60">Aguarde • {downloadProgress}% • 12 MB</p>
              </div>
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            </div>
            <div className="h-1 bg-white/10">
              <div className="h-full bg-[#34A853] transition-all duration-200" style={{ width: `${downloadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Card estilo Play Store / App Store */}
      <div
        className="fixed inset-x-2 bottom-2 md:bottom-6 md:left-auto md:right-6 md:w-[380px] z-[100] animate-in slide-in-from-bottom-4 duration-300"
        role="dialog"
        aria-label="Instalar aplicativo"
      >
        <div className="bg-card border border-border shadow-2xl rounded-[20px] overflow-hidden">
          {/* Header Play Store */}
          <div className="bg-gradient-to-b from-muted/50 to-card p-4">
            <div className="flex gap-3">
              <img
                src={appIcon}
                alt="Undoing"
                className="h-16 w-16 rounded-2xl shadow-md border border-border/50 bg-white"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[15px] leading-tight flex items-center gap-1">
                  Undoing <ShieldCheck className="h-3.5 w-3.5 text-[#01875F]" />
                </h3>
                <p className="text-xs text-[#01875F] font-medium">UDG Labs • Verificado</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5 font-medium text-foreground">
                    4,8 <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <span>• 12 mil avaliações</span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="h-7 w-7 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground -mt-1 -mr-1"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats linha */}
            <div className="flex divide-x divide-border/50 mt-3">
              <div className="flex-1 text-center py-1">
                <p className="text-xs font-bold flex items-center justify-center gap-1">
                  <HardDrive className="h-3 w-3" /> 12 MB
                </p>
                <p className="text-[10px] text-muted-foreground">Tamanho</p>
              </div>
              <div className="flex-1 text-center py-1">
                <p className="text-xs font-bold flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" /> 10 mil+
                </p>
                <p className="text-[10px] text-muted-foreground">Downloads</p>
              </div>
              <div className="flex-1 text-center py-1">
                <p className="text-xs font-bold">Livre</p>
                <p className="text-[10px] text-muted-foreground">Classificação</p>
              </div>
            </div>
          </div>

          {/* Screenshots mock */}
          <div className="px-3 pb-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <div className="h-28 w-16 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 border border-border/30 flex-shrink-0 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-primary/50" />
              </div>
              <div className="h-28 w-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-border/30 flex-shrink-0 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500/50" />
              </div>
              <div className="h-28 w-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-border/30 flex-shrink-0 flex items-center justify-center">
                <Play className="h-6 w-6 text-purple-500/50" />
              </div>
              <div className="h-28 flex-1 min-w-[100px] rounded-xl bg-muted/40 border border-dashed border-border/50 flex flex-col items-center justify-center p-2 text-center">
                <p className="text-[10px] font-medium leading-tight">Chat • Arena • Stories • Chamadas</p>
                <p className="text-[9px] text-muted-foreground mt-1">Tudo offline e tela cheia</p>
              </div>
            </div>
          </div>

          {/* Progress barra durante download */}
          {phase === "downloading" && (
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Baixando…</span>
                <span className="font-mono font-medium">{downloadProgress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#01875F] rounded-full transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="p-3 pt-0 flex gap-2">
            {phase === "idle" && (
              <>
                <Button
                  onClick={handleInstallClick}
                  className="flex-1 h-10 rounded-full bg-[#01875F] hover:bg-[#016f4f] text-white font-semibold shadow-sm"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Instalar
                </Button>
                <Button variant="outline" className="h-10 rounded-full px-4" onClick={handleDismiss}>
                  Depois
                </Button>
              </>
            )}
            {phase === "downloading" && (
              <Button disabled className="flex-1 h-10 rounded-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Baixando {downloadProgress}%
              </Button>
            )}
            {phase === "installing" && (
              <Button disabled className="flex-1 h-10 rounded-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Instalando…
              </Button>
            )}
            {phase === "installed" && (
              <>
                <Button onClick={handleOpenApp} className="flex-1 h-10 rounded-full bg-[#01875F] hover:bg-[#016f4f]">
                  <Play className="h-4 w-4 mr-1.5" />
                  Abrir
                </Button>
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium px-2">
                  <CheckCheck className="h-4 w-4" /> Instalado
                </div>
              </>
            )}
            {phase === "manual" && (
              <>
                <Button onClick={() => setShowManualHelp(true)} className="flex-1 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white">
                  Ver como instalar — 1 toque
                </Button>
                <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => { setPhase("idle"); setDownloadProgress(0); }}>
                  Tentar novamente
                </Button>
              </>
            )}
          </div>

          {/* Rodapé Play Store */}
          <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2.5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Verificado pela Play Protect
            </span>
            <span>Contém anúncios • Compras no app</span>
          </div>

          {/* Instruções iOS (quando não há prompt) */}
          {isIOS && phase === "idle" && (
            <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">No iPhone:</p>
              <p className="text-xs text-muted-foreground mt-1">
                Toque em <span className="font-medium">Compartilhar</span> → <span className="font-medium">Adicionar à Tela de Início</span> →
                <span className="font-medium"> Adicionar</span>. Depois abra pelo ícone na tela inicial.
              </p>
            </div>
          )}
        </div>

        {/* Selo "Baixe na loja" secundário */}
        <p className="text-center text-[10px] text-white/70 mt-2 drop-shadow">
          Disponível como app • Funciona offline • Sem loja necessária
        </p>
      </div>

      {/* Manual install - quando o navegador não liberou one-click, mostra como loja mas com 1 toque no menu */}
      {showManualHelp && (
        <div
          className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 animate-in fade-in"
          onClick={() => setShowManualHelp(false)}
        >
          <div
            className="bg-card rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <img src={appIcon} alt="UDG" className="h-12 w-12 rounded-xl shadow border border-border/50 bg-white" />
                  <div>
                    <h3 className="font-bold text-sm">Finalize a instalação</h3>
                    <p className="text-xs text-muted-foreground">1 toque — sem Play Store</p>
                  </div>
                </div>
                <button onClick={() => setShowManualHelp(false)} className="h-7 w-7 rounded-full hover:bg-accent flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Seta animada para o menu */}
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10 border border-primary/20 p-4 relative overflow-hidden">
                <div className="absolute top-2 right-4 animate-bounce">
                  <div className="bg-foreground text-background text-[10px] px-2 py-1 rounded-full font-bold">⋮ Menu aqui ↑</div>
                </div>
                <p className="text-xs font-semibold">Toque no menu do navegador</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {platform === "desktop"
                    ? "Clique no ícone ⊞ na barra de endereço → Instalar → Instalar"
                    : "Toque em ⋮ (canto superior direito) → Instalar app → Instalar"}
                </p>
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 rounded-xl bg-card border p-2.5 text-center">
                    <p className="text-lg">⋮</p>
                    <p className="text-[10px] font-medium">1. Menu</p>
                  </div>
                  <div className="flex items-center text-muted-foreground">→</div>
                  <div className="flex-1 rounded-xl bg-[#01875F] text-white border border-[#01875F] p-2.5 text-center">
                    <Download className="h-5 w-5 mx-auto" />
                    <p className="text-[10px] font-bold mt-1">2. Instalar app</p>
                  </div>
                  <div className="flex items-center text-muted-foreground">→</div>
                  <div className="flex-1 rounded-xl bg-card border p-2.5 text-center">
                    <CheckCheck className="h-5 w-5 mx-auto text-green-600" />
                    <p className="text-[10px] font-medium">3. Abrir</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button className="flex-1 h-10 rounded-full bg-[#01875F] hover:bg-[#016f4f]" onClick={() => setShowManualHelp(false)}>
                  Entendi, vou instalar
                </Button>
                <Button variant="outline" className="h-10 rounded-full" onClick={() => setShowManualHelp(false)}>
                  Depois
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-2.5">
                Depois, abra pelo ícone na tela inicial — o app abre em tela cheia, como da loja.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default PWAInstallBanner;
