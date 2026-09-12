/**
 * =============================================================================
 * File: src/hooks/useUnreadNews.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/isDemoMode";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


/**
 * Contador de novidades do Notificador (últimos 7 dias).
 * - Mostra badge no menu lateral (quantidade de itens novos desde o último viewed_at da seção "news")
 * - Zera quando o usuário entra em /news (markAsRead)
 *
 * Observação: A tabela last_viewed NÃO tem constraint única (user_id + section),
 * então sempre lemos o registro mais recente por viewed_at desc.
 */
export function useUnreadNews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-news", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;
      if (isDemoMode(user.id)) return 0;

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Último viewed_at do Notificador
      const { data: lastViewed, error: lastViewedError } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "news")
        .order("viewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastViewedError) {
        console.warn("Error fetching last viewed for news:", lastViewedError);
      }

      const lastViewedAt = lastViewed?.viewed_at ?? new Date(0).toISOString();

      // Amigos (friendships pode estar nos dois sentidos)
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.from("friendships").select("friend_id").eq("user_id", user.id),
        supabase.from("friendships").select("user_id").eq("friend_id", user.id),
      ]);

      const friendIds = [
        ...(a?.map((x) => x.friend_id) ?? []),
        ...(b?.map((x) => x.user_id) ?? []),
      ].filter(Boolean) as string[];

      // Comunidades onde participa
      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user.id);

      const communityIds = (memberships ?? []).map((m) => m.community_id);

      // Se não tiver amigos nem comunidades, sem novidades
      if (friendIds.length === 0 && communityIds.length === 0) return 0;

      const counts: number[] = [];

      if (friendIds.length > 0) {
        const { count: postsCount } = await supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .gt("created_at", lastViewedAt)
          .in("user_id", friendIds);

        counts.push(postsCount || 0);
      }

      if (communityIds.length > 0) {
        const { count: communityPostsCount } = await supabase
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .gt("created_at", lastViewedAt)
          .in("community_id", communityIds);

        counts.push(communityPostsCount || 0);
      }

      return counts.reduce((acc, n) => acc + n, 0);
    },
    refetchInterval: 30000,
  });

  const markAsRead = async () => {
    if (!user) return;
    if (isDemoMode(user.id)) return;

    try {
      const { error } = await supabase.from("last_viewed").insert({
        user_id: user.id,
        section: "news",
        viewed_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error marking news as read:", error);
      } else {
        queryClient.invalidateQueries({ queryKey: ["unread-news", user.id] });
      }
    } catch (err) {
      console.error("Error in markAsRead (news):", err);
    }
  };

  return { unreadCount, markAsRead };
}
