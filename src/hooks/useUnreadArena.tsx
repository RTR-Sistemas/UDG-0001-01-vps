/**
 * =============================================================================
 * File: src/hooks/useUnreadArena.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export function useUnreadArena() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["unread-arena", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      const { data: lastViewed } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "arena")
        .maybeSingle();

      const lastViewedTime =
        lastViewed?.viewed_at ?? new Date(0).toISOString();

      const { count } = await supabase
        .from("posts")
        .select("*", { head: true, count: "exact" })
        .eq("post_type", "photo_audio")
        .gt("created_at", lastViewedTime);

      return count || 0;
    },
    refetchInterval: 30000,
  });

  return count;
}
