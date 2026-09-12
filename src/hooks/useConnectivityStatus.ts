import { useEffect, useState, useCallback } from "react";

export type ConnectivityStatus = "online" | "offline";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

/**
 * Monitora a conectividade real com a internet.
 * navigator.onLine não é confiável — fazemos também um ping periódico
 * no endpoint de health do Supabase.
 */
export function useConnectivityStatus(intervalMs = 15000) {
  const [status, setStatus] = useState<ConnectivityStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online"
  );

  const check = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      // O gateway do Supabase exige o header `apikey` em /auth/v1/*.
      // Sem ele a resposta e 401 e o app se declarava "offline" para sempre.
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        signal: controller.signal,
        cache: "no-store",
        headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
      });
      clearTimeout(timer);
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const handleOnline = () => {
      setStatus("online");
      void check();
    };
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const id = window.setInterval(() => void check(), intervalMs);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(id);
    };
  }, [check, intervalMs]);

  return status;
}
