/**
 * =============================================================================
 * File: src/components/Layout/AppLayout.tsx
 * Purpose: Layout component managing sliding pages and horizontal navigation.
 * 
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Adicionado espaçamento superior (pt-8) em mobile para evitar sobrepor indicador de slides.
 *  - Bloqueio de gestos swipe horizontal quando uma conversa estiver ativa.
 *  - Implementação de lazy loading para todas as páginas deslizantes (Feed, Explore, ZaneIA, Messages, etc.)
 *    para quebrar ciclos de importação/TDZ na inicialização do bundle.
 * =============================================================================
 */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { 
  Globe, Lock, Users, Swords, User, 
  Settings, Newspaper, LogOut, Sun, Moon, 
  Volume2, Trash2, X, Share2, Heart, MessageCircle, ChevronDown, Check, Trophy, Mic,
  LayoutGrid, Wifi, ChevronRight, Zap, Wallet, Search, ShieldCheck
} from "lucide-react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadNews } from "@/hooks/useUnreadNews";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeStorage";
import BackButton from "@/components/BackButton";
import { LiveTicker } from "@/components/Layout/LiveTicker";
import { AreaTutorialHost } from "@/components/tutorials/AreaTutorialHost";
import { PWAInstallBanner } from "@/components/pwa/PWAInstallBanner";
import { MoodDailyPrompt } from "@/components/mood/MoodDailyPrompt";
import MoodAnalysisModal from "@/components/mood/MoodAnalysisModal";

import logo from "@/assets/logo.png";

// Lazy-load sliding pages to prevent initialization timing/TDZ issues
const Feed = lazy(() => import("../../pages/Feed"));
const Messages = lazy(() => import("../../pages/Messages"));
const SearchPage = lazy(() => import("../../pages/Search"));

const Communities = lazy(() => import("../../pages/Communities"));
const Arena = lazy(() => import("../../pages/Arena"));
const Rankings = lazy(() => import("../../pages/Rankings"));
const Battles = lazy(async () => {
  const mod = await import("../../pages/Battles");
  return { default: mod.default };
});

// Secondary pages rendered through the router outlet (reachable from the "Mais" menu / profile)
const News = lazy(() => import("../../pages/News"));
const SettingsPage = lazy(() => import("../../pages/Settings"));

// Secondary menu screen with quick access to the remaining pages
const MoreMenu = ({ unreadNews, theme, toggleTheme, onLogout }: {
  unreadNews: number;
  theme: "light" | "dark" | "system";
  toggleTheme: () => void;
  onLogout: () => void;
}) => {
  const navigate = useNavigate();

  const items = [
    { label: "Perfil", desc: "Seu perfil público e estatísticas", icon: User, path: "/profile" },
    // Loja / Carteira desativada em 30/08/2026 — sem pagamento por enquanto.
    // Para reativar: descomente a linha e volte a rota /wallet no App.tsx.
    // { label: "Carteira", desc: "Moedas, diamantes e saques", icon: Wallet, path: "/wallet" },
    { label: "Notícias", desc: "Notificações, solicitações e novidades", icon: Newspaper, path: "/news", badge: unreadNews },
    { label: "Ajustes", desc: "Configurações do aplicativo", icon: Settings, path: "/settings" },
    { label: "Segurança", desc: "Criptografia pós-quântica das suas conversas", icon: ShieldCheck, path: "/seguranca" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutGrid className="h-6 w-6 text-primary" />
              Mais
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">Acesso rápido a todas as outras telas do UDG.</p>
        </header>

        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-card/60 hover:bg-card transition-colors text-left relative"
            >
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                "bg-primary/10 text-primary border border-primary/20"
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="bg-red-500 text-white rounded-full text-[9px] px-1.5 py-0.5 font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-card/60 hover:bg-card transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">Tema {theme === "dark" ? "Escuro" : "Claro"}</div>
              <div className="text-xs text-muted-foreground">Alternar entre tema escuro e claro</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-red-500/15 text-red-500 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">Sair da conta</div>
              <div className="text-xs text-muted-foreground">Encerrar sessão atual</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const [activeSlide, setActiveSlide] = useState(2); // Start on Chat (index 2 = Messages)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);

  // Unread badge counts
  const { unreadCount: unreadMessages } = useUnreadMessages();
  const { unreadCount: unreadNews } = useUnreadNews();


  // Map route to slide index
  useEffect(() => {
    const path = location.pathname;
    if (path === "/" || path === "/messages") {
      setActiveSlide(SLIDES.findIndex((s) => s.id === "messages"));
      return;
    }
    const matchIndex = SLIDES.findIndex((s) => s.path !== "/" && path.startsWith(s.path));
    if (matchIndex >= 0) {
      setActiveSlide(matchIndex);
    }
  }, [location.pathname, navigate]);

  // Handle slide selection
  const selectSlide = (index: number) => {
    setActiveSlide(index);
    navigate(SLIDES[index].path);
  };

  // Swipe Gestures Tracking (Mobile Only)
  // NOTE: Only enabled on slides that don't have their own complex touch handling (Feed manages its own)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeThreshold = 72; // minimum drag distance in pixels to trigger slide

  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent swiping horizontal slide changing when in a chat room
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("conversation")) {
      return;
    }

    // Prevent swiping inside maps, sliders, text fields, or pages that manage their own touch
    const target = e.target as HTMLElement;
    if (
      target.closest(".leaflet-container") ||
      target.closest("input, textarea, select") ||
      target.closest('[role="slider"]') ||
      target.closest(".no-swipe")
    ) {
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX.current;
    const diffY = touchEndY - touchStartY.current;

    // We only trigger horizontal swipe if movement is primarily horizontal
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        // Swipe Right -> Go to previous index
        if (activeSlide > 0) {
          selectSlide(activeSlide - 1);
        }
      } else {
        // Swipe Left -> Go to next index
        if (activeSlide < SLIDES.length - 1) {
          selectSlide(activeSlide + 1);
        }
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Theme configuration
  useEffect(() => {
    const stored = (safeLocalStorage.getItem("udg_theme") || "dark") as "light" | "dark" | "system";
    setTheme(stored);
    const resolved = stored === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light") : stored;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, []);

  const toggleTheme = () => {
    const resolved = theme === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light") : theme;
    const next = resolved === "dark" ? "light" : "dark";
    setTheme(next);
    safeLocalStorage.setItem("udg_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  // Define sliding tabs config
  const SLIDES = [
    { id: "feed", path: "/feed", name: "World-Flow", icon: Globe, component: <Feed /> },
    { id: "search", path: "/search", name: "Pesquisar", icon: Search, component: <SearchPage /> },
    { id: "messages", path: "/messages", name: "Chat Privado", icon: Lock, badge: unreadMessages, component: <Messages /> },
    { id: "communities", path: "/communities", name: "Comunidades", icon: Users, component: <Communities /> },
    { id: "arena", path: "/arena", name: "Arena", icon: Swords, component: <Arena /> },
    { id: "battles", path: "/battles", name: "Batalhas Ao Vivo", icon: Zap, component: <Battles /> },
    { id: "rankings", path: "/rankings", name: "Ranking", icon: Trophy, component: <Rankings /> },
    { id: "mais", path: "/mais", name: "Mais", icon: LayoutGrid, component: <MoreMenu unreadNews={unreadNews} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} /> },
  ];

  // Determine if we are on a sliding page or secondary sub-page
  // (declarado APÓS SLIDES para evitar ReferenceError de TDZ)
  const isSlidingRoute =
    location.pathname === "/" ||
    SLIDES.some(s => location.pathname.startsWith(s.path));

  return (
    <div className="app-root-height bg-background text-foreground flex flex-col overflow-hidden relative">
      <LiveTicker />
      <AreaTutorialHost />
      <PWAInstallBanner />

      {/* Prompt diário de humor + Modal de análise facial */}
      {user?.id && (
        <>
          <MoodDailyPrompt userId={user.id} onOpenAnalysis={() => setIsMoodModalOpen(true)} />
          <MoodAnalysisModal
            isOpen={isMoodModalOpen}
            onClose={() => setIsMoodModalOpen(false)}
            userId={user.id}
            onSuccess={() => {}}
          />
        </>
      )}

      {/* ────────────────── DESKTOP LEFT RAIL (estilo X) ────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-border/50 bg-background/60 backdrop-blur-xl z-40">
          <div className="px-6 pt-6 pb-5">
            <button onClick={() => selectSlide(0)} className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" aria-label="Ir para o World Flow">
              <img src={logo} alt="UndoinG" className="h-9 w-auto object-contain" />
            </button>
          </div>

          {/* Navegação principal */}
          <nav className="flex-1 px-3 pb-4 overflow-y-auto hide-scrollbar space-y-1">
            {SLIDES.map((slide, index) => {
              const Icon = slide.icon;
              const isActive = activeSlide === index;
              return (
                <button
                  key={slide.id}
                  onClick={() => selectSlide(index)}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-2.5 rounded-full text-[15px] transition-colors select-none",
                    isActive
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground hover:bg-card/70 hover:text-foreground"
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className={cn("h-6 w-6", isActive && "text-primary")} />
                    {slide.badge && slide.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full text-[9px] font-bold px-1.5 py-0.5 border border-background min-w-[16px] text-center">
                        {slide.badge > 9 ? '9+' : slide.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{slide.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Conta + ações */}
          <div className="p-3 border-t border-border/50">
            <div className="relative group">
              <button className="w-full flex items-center gap-3 p-2 rounded-full hover:bg-card/70 transition-colors">
                <Avatar className="h-9 w-9 ring-1 ring-border/40 shrink-0">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {user?.email?.[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold truncate">{user?.user_metadata?.full_name || user?.email}</p>
                  <p className="text-xs text-muted-foreground truncate">@{user?.email?.split("@")[0]}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              {/* Dropdown Menu Container */}
              <div className="absolute bottom-full right-0 mb-2 w-60 bg-popover border border-border/60 rounded-2xl shadow-xl p-1.5 hidden group-hover:block hover:block animate-in fade-in duration-200">
                <button onClick={toggleTheme} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-xl transition-colors text-left">
                  {theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
                  <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
                </button>
                <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-xl transition-colors text-left">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>Configurações</span>
                </button>
                <button onClick={() => navigate("/news")} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-xl transition-colors text-left">
                  <Newspaper className="w-4 h-4 text-muted-foreground" />
                  <span>Notícias</span>
                </button>
                <div className="h-px bg-border/40 my-1.5" />
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5 rounded-xl transition-colors text-left">
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ────────────────── MAIN SCREEN / SLIDING CONTAINER ────────────────── */}
        <main className="flex-1 relative min-h-0 min-w-0 w-full overflow-hidden">
          {isSlidingRoute ? (
          <div 
            className="flex flex-row h-full w-full transition-transform duration-300 ease-out select-none"
            style={{ 
              transform: `translate3d(-${activeSlide * 100}%, 0, 0)`
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {SLIDES.map((slide, index) => (
              <div 
                key={slide.id} 
                className={cn(
                  "w-full h-full flex-shrink-0 select-text relative transition-opacity duration-300 overflow-hidden pt-8 md:pt-0",
                  activeSlide !== index ? "pointer-events-none opacity-0" : "opacity-100"
                )} 
              >
                {activeSlide === index ? (
                  <Suspense fallback={
                    <div className="w-full h-full bg-background flex flex-col items-center justify-center">
                      <div className="animate-pulse text-sm text-muted-foreground">Carregando...</div>
                    </div>
                  }>
                    {slide.component}
                  </Suspense>
                ) : (
                  <div className="w-full h-full bg-background" />
                )}
              </div>
            ))}
          </div>
        ) : (
          // Secondary sub-pages (e.g. settings/admin) are rendered normally through the router outlet
          <div className="h-full w-full overflow-y-auto">
            <Outlet />
          </div>
        )}
        </main>
      </div>

      {/* ────────────────── MOBILE SLIDE INDICATOR OVERLAY ────────────────── */}
      {isSlidingRoute && (
        <div className="md:hidden absolute top-3 left-0 right-0 z-30 flex justify-center items-center gap-1.5 pointer-events-none">
          {SLIDES.map((_, index) => (
            <div 
              key={index} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 backdrop-blur-md", 
                activeSlide === index 
                  ? "w-6 bg-primary shadow-[0_0_8px_rgba(239,68,68,0.6)]" 
                  : "w-1.5 bg-white/40"
              )}
            />
          ))}
        </div>
      )}

      {/* ────────────────── MOBILE STATUS (ONLINE / REDE0UDG) ────────────────── */}

      {/* ────────────────── MOBILE BOTTOM ACTION TABS (estilo IG) ────────────────── */}
      <nav className="md:hidden flex items-center py-1.5 pb-safe bg-background/95 backdrop-blur-xl border-t border-border/40 z-40 flex-shrink-0 select-none overflow-x-auto overflow-y-hidden hide-scrollbar">
        <div className="flex w-full px-2 gap-1">
          {SLIDES.map((slide, index) => {
            const Icon = slide.icon;
            const isActive = activeSlide === index;
            return (
              <button
                key={slide.id}
                onClick={() => selectSlide(index)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 relative transition-all active:scale-95 min-w-[64px] flex-shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "w-12 h-7 flex items-center justify-center rounded-2xl transition-all duration-200",
                  isActive ? "bg-primary/10 scale-105" : ""
                )}>
                  <Icon className="w-[22px] h-[22px]" />
                </div>
                <span className={cn(
                  "text-[10px] leading-none whitespace-nowrap mt-0.5",
                  isActive ? "font-bold" : "font-medium"
                )}>{slide.name}</span>
                {slide.badge && slide.badge > 0 ? (
                  <span className="absolute top-0 right-0 bg-primary text-primary-foreground rounded-full text-[8px] font-bold px-1.5 py-0.5 border border-background min-w-[16px] text-center">
                    {slide.badge > 9 ? '9+' : slide.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}