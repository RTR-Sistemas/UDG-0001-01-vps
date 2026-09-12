/**
 * =============================================================================
 * File: src/hooks/useUnreadMessages.tsx
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


export function useUnreadMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;
      if (isDemoMode(user.id)) return 0;

      // Get last viewed time for messages
      const { data: lastViewed, error: lastViewedError } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "messages")
        .order("viewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastViewedError) {
        console.warn("Error fetching last viewed for messages:", lastViewedError);
      }

      const lastViewedTime = lastViewed?.viewed_at || new Date(0).toISOString();

      // Get user's conversations
      const { data: userConversations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!userConversations || userConversations.length === 0) {
        return 0;
      }

      const conversationIds = userConversations.map((c) => c.conversation_id);

      // Count messages from others created after last view
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .neq("user_id", user.id)
        .gt("created_at", lastViewedTime);

      return count || 0;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsRead = async () => {
    if (!user) return;
    if (isDemoMode(user.id)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    try {
      const { error } = await supabase
        .from("last_viewed")
        .upsert(
          {
            user_id: user.id,
            section: "messages",
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,section" }
        );

      if (error) {
        const msg = String((error as any)?.message || "");
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          console.debug("[Messages] markAsRead offline, adiando:", msg.slice(0, 80));
        } else {
          console.warn("Error marking messages as read:", error);
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
      }
    } catch (error: any) {
      const msg = String(error?.message || "");
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || (typeof navigator !== "undefined" && navigator.onLine === false)) {
        console.debug("[Messages] markAsRead falhou offline (ignorado):", msg.slice(0, 80));
      } else {
        console.warn("Error in markAsRead:", error);
      }
    }
  };

  return { unreadCount, markAsRead };
}