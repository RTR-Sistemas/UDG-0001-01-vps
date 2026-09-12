/**
 * Dynamic API Client Router
 * Resolves endpoints to either the legacy Netlify serverless functions or the new Go Microservices Gateway.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Map Netlify function names to the Go microservice Gateway routes
const GATEWAY_MAPPINGS: Record<string, string> = {
  "send-push": "/api/notification/webhook",
  "cloudinary-sign": "/api/feed/posts", // signature proxies to feed posts
  "translate": "/api/chat/voice-clone-translate", // text translation falls to chat/translations
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

/**
 * Returns the resolved API endpoint path or absolute URL.
 * 
 * @param functionPath Caminho da função no servidor (e.g. "/api/send-push")
 * @returns Resolved URL pointing to either Go Gateway or Netlify function
 */
export function getApiUrl(functionPath: string): string {
  if (!API_BASE_URL) {
    return functionPath;
  }

  // Extract function name: "/api/send-push" -> "send-push"
  const parts = functionPath.split("/");
  const functionName = parts[parts.length - 1];

  const mappedRoute = GATEWAY_MAPPINGS[functionName];
  if (mappedRoute) {
    return `${API_BASE_URL.replace(/\/$/, "")}${mappedRoute}`;
  }

  return `${API_BASE_URL.replace(/\/$/, "")}/api/${functionName}`;
}
