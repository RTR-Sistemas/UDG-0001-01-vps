/**
 * =============================================================================
 * File: src/main.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import "./utils/safeStorage"; // Run storage polyfill first to intercept any blocked localStorage/sessionStorage calls
import { createRoot } from "react-dom/client";
import { SecurityOverlay } from "./components/SecurityOverlay";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import { iniciarErrorTracking } from "./lib/errorTracking";
import "./index.css";

// Adicionado em 06/09/2026: além de imprimir no console (que só ajuda quem
// está com o DevTools aberto), os erros agora são enviados para /api/client-error
// e ficam registrados na tabela client_errors. É o que permite descobrir uma
// quebra em produção sem depender de um print de usuário.
iniciarErrorTracking();

// Captura erros globais fora do React (promises, eventos) e os exibe no console
// com prioridade, evitando "tela preta" sem rastro no log.
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Rejection]", event.reason);
});

// O registro do Service Worker é gerenciado pelo vite-plugin-pwa.
// Removemos apenas workers legados conhecidos para evitar conflito com o SW atual.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      const swUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
      const isLegacyWorker = [
        'sw-push.js',
        'OneSignalSDKWorker.js',
        'OneSignalSDKUpdaterWorker.js',
      ].some((needle) => swUrl.includes(needle));

      if (isLegacyWorker) {
        console.log('[SW Cleanup] Removendo worker legado:', swUrl);
        registration.unregister();
      }
    }
  }).catch(err => console.warn('[SW Cleanup] Erro ao listar registrations:', err));
}

// Interceptador Global de Fetch para Go Microservices Gateway
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === "string" && input.startsWith("/api/")) {
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (apiBase) {
      const functionName = input.split("/").pop() || "";
      const mappings: Record<string, string> = {
        "send-push": "/api/notification/webhook",
        "cloudinary-sign": "/api/feed/posts",
        "translate": "/api/chat/voice-clone-translate",
        "mark-messages-viewed": "/api/chat/messages", 
        "zane-ai-chat": "/api/chat/messages", 
        "huggingface-proxy": "/api/feed/posts",
        "get-vapid-public-key": "/api/notification/push/subscribe",
        "push-subscribe": "/api/notification/push/subscribe",
        "push-unsubscribe": "/api/notification/push/unsubscribe",
        "push-status": "/api/notification/push/preferences",
        "push-preference": "/api/notification/push/preferences",
        "push-register-fcm": "/api/notification/push/subscribe",
        "agora-token": "/api/chat/calls/token",
        "voice-clone-translate": "/api/chat/voice-clone-translate",
        "badge-count": "/api/notification/preferences",
        "yoti-session": "/api/identity/age-verification/session",
        "yoti-result": "/api/identity/age-verification/callback",
        "auth-recover": "/api/auth/recover"
      };
      const route = mappings[functionName] || `/api/${functionName}`;
      input = `${apiBase.replace(/\/$/, "")}${route}`;
      console.log(`🌐 [Gateway Redirect] ${functionName} -> ${input}`);
    }
  }
  return originalFetch(input, init);
};

// StrictMode foi removido: em dev ele monta/desmonta a árvore 2x, o que, somado
// a updates via HMR e a libs que mexem no DOM fora do React (ex.: Agora), causava
// `NotFoundError: removeChild` no commit do React.
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <SecurityOverlay>
      <App />
    </SecurityOverlay>
  </ErrorBoundary>
);
