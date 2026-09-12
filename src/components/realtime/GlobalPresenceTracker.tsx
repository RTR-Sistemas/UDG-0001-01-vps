import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/isDemoMode";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const UDG_PRESENCE_CHANNEL = "udg-presence";

export type UDGPeerPresence = {
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  full_name?: string | null;
  current_page?: string | null;
  last_active: string;
};

const getPageFriendlyName = (pathname: string) => {
  if (pathname === "/") return "Lendo o Feed Geral";
  if (pathname === "/arena") return "Na Arena (Batalhas)";
  if (pathname === "/explore") return "Explorando";
  if (pathname === "/messages") return "No Chat / Mensagens";
  if (pathname === "/communities") return "Nas Comunidades";
  if (pathname.includes("/profile")) return "Visualizando Perfis";
  if (pathname === "/rankings") return "Olhando os Rankings";
  if (pathname === "/news") return "Lendo Notícias";
  return `Navegando (${pathname})`;
};

/**
 * Presença global dos usuários:
 *  - Canal Realtime comum "udg-presence": quem está ONLINE (com internet).
 *  - Heartbeat de profiles.last_seen para histórico de última vez online.
 */
export function GlobalPresenceTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isDemoMode(user.id)) return;

    const buildPayload = (): UDGPeerPresence => ({
      user_id: user.id,
      username: (user as unknown as { username?: string | null }).username || user.email?.split("@")[0] || "Usuário",
      avatar_url: user.user_metadata?.avatar_url || null,
      full_name: user.user_metadata?.full_name || null,
      current_page: getPageFriendlyName(location.pathname),
      last_active: new Date().toISOString(),
    });

    // 1) Canal global de presença (online — requer internet)
    const channel = supabase.channel(UDG_PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(buildPayload());
      }
    });

    // 2) Heartbeat: presença + last_seen no banco a cada 60s
    const heartbeatId = window.setInterval(() => {
      if (channelRef.current?.state === "joined") {
        channelRef.current.track(buildPayload());
      }
      const nowIso = new Date().toISOString();
      supabase
        .from("profiles")
        .update({ last_seen: nowIso })
        .eq("id", user.id)
        .then(() => undefined, () => undefined);
    }, 60000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.clearInterval(heartbeatId);
    };
  }, [user]); // Executa apenas quando o usuário muda

  // Efeito separado: atualiza o status (track) quando a rota muda
  useEffect(() => {
    if (!user || !channelRef.current) return;

    const channel = channelRef.current;
    const payload: UDGPeerPresence = {
      user_id: user.id,
      username: (user as unknown as { username?: string | null }).username || user.email?.split("@")[0] || "Usuário",
      avatar_url: user.user_metadata?.avatar_url || null,
      full_name: user.user_metadata?.full_name || null,
      current_page: getPageFriendlyName(location.pathname),
      last_active: new Date().toISOString(),
    };

    if (channel.state === "joined") {
      channel.track(payload);
    }
  }, [user, location.pathname]);

  return null; // Componente invisível
}
