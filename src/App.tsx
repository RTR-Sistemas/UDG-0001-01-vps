/**
 * =============================================================================
 * File: src/App.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Remoção de imports estáticos de páginas que são renderizadas de forma dinâmica/lazy
 *    no AppLayout (Feed, Arena, Explore, Messages, Communities, Profile, ZaneIA)
 *    para evitar problemas de inicialização/TDZ no bundler.
 * =============================================================================
 */

import { RealtimeAttentionListener } from "@/components/realtime/RealtimeAttentionListener";
import "@/styles/attention.css";
import React, { useEffect, useState } from "react";
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import AppLayout from "./components/Layout/AppLayout";
import News from "./pages/News";
import NotFound from "./pages/NotFound";
import DownloadApp from "./pages/DownloadApp";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Security from "./pages/Security";
import { LGPDConsentModal } from "@/components/onboarding/LGPDConsentModal";
import { useAuth } from "@/hooks/useAuth";
import Rankings from "@/pages/Rankings";
import Profile from "./pages/Profile";
import Explore from "./pages/Explore";
import SearchPage from "./pages/Search";
import { MovementStatusProvider } from "@/contexts/MovementStatusContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { PostLoginBootstrap } from "@/components/boot/PostLoginBootstrap";
import { GlobalPresenceTracker } from "@/components/realtime/GlobalPresenceTracker";
import { CallProvider } from "@/hooks/useCalls";
import { CallOverlay } from "@/components/chat/CallOverlay";
import { WalletProvider } from "@/contexts/WalletContext";
import { BattleProvider } from "@/contexts/BattleContext";
import { BattleInviteModal } from "@/components/battle/BattleInviteModal";
import BattleRoom from "./pages/BattleRoom";
// Loja / Carteira desativada em 30/08/2026 (src/config/monetizacao.ts).
// import Wallet from "./pages/Wallet";
import { PushNotificationManager } from "@/components/realtime/PushNotificationManager";
import { NotificationBadgeManager } from "@/components/realtime/NotificationBadgeManager";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { playStartupSound } from "@/hooks/usePlatformSounds";
import { safeLocalStorage } from "@/utils/safeStorage";
import { AppIntroVideo } from "@/components/boot/AppIntroVideo";


// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

const queryClient = new QueryClient();

let hasPlayedStartup = false;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasSeenIntro');
  });

  const handleIntroComplete = () => {
    sessionStorage.setItem('hasSeenIntro', 'true');
    setShowIntro(false);
  };

  useEffect(() => {
    if (user && Capacitor.isNativePlatform()) {
      const askForPermissions = async () => {
        try { await Camera.requestPermissions(); } catch(e) { console.error(e) }
        try { await Geolocation.requestPermissions(); } catch(e) { console.error(e) }
      };
      askForPermissions();
    }
  }, [user]);

  useEffect(() => {
    if (user && !hasPlayedStartup) {
      const playAndCleanup = () => {
        if (hasPlayedStartup) return;
        hasPlayedStartup = true;
        playStartupSound();
        removeListeners();
      };

      const removeListeners = () => {
        window.removeEventListener("click", playAndCleanup);
        window.removeEventListener("keydown", playAndCleanup);
        window.removeEventListener("touchstart", playAndCleanup);
      };

      // Browsers bloqueiam AudioContext antes de uma interação real do usuário.
      // Por isso, o som de abertura é tocado somente após clique/toque/tecla,
      // evitando o aviso de console: "AudioContext was not allowed to start".
      window.addEventListener("click", playAndCleanup);
      window.addEventListener("keydown", playAndCleanup);
      window.addEventListener("touchstart", playAndCleanup);

      return () => {
        removeListeners();
      };
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <PermissionProvider>
      <MovementStatusProvider>
        <CallProvider>
          <WalletProvider>
            <BattleProvider>
        {/* A4-COMPLIANCE: Modal LGPD — exibido até o usuário aceitar os termos */}
        <LGPDConsentModal />
        <PushNotificationManager />
        <NotificationBadgeManager userId={user.id} />
        <RealtimeAttentionListener />
        <GlobalPresenceTracker />
        <CallOverlay />
        <BattleInviteModal />
        {showIntro && <AppIntroVideo onComplete={handleIntroComplete} />}
        <PostLoginBootstrap userId={user.id}>{children}</PostLoginBootstrap>
            </BattleProvider>
          </WalletProvider>
        </CallProvider>
        </MovementStatusProvider>
    </PermissionProvider>
  );
}



const App = () => {
  // Configura a escala de fonte global no carregamento do app
  useEffect(() => {
    const savedScale = safeLocalStorage.getItem("font_scale") || "1";
    document.documentElement.style.setProperty("--font-scale", savedScale);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <Toaster />
        <BrowserRouter>
          <PWAUpdatePrompt />
        
        <Routes>
          {/* Auth + recuperação */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />

          {/* Rotas protegidas */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/messages" replace />} />
                    <Route path="/feed" element={null} />
                    <Route path="/arena" element={null} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/messages" element={null} />
                    <Route path="/communities" element={null} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/:userId" element={<Profile />} />
                    <Route path="/rankings" element={<Rankings />} />
                    <Route path="/mais" element={null} />
                    <Route path="/news" element={<News />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/seguranca" element={<Security />} />
                    <Route path="/battles" element={null} />
                    {/* Rota da Carteira desativada — ver src/config/monetizacao.ts */}
                    {/* <Route path="/wallet" element={<Wallet />} /> */}
                    <Route path="/download-app" element={<DownloadApp />} />
                  </Route>
                  <Route path="/battle/:id" element={<BattleRoom />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;