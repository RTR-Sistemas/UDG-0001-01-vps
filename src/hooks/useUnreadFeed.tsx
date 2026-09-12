/**
 * =============================================================================
 * File: src/hooks/useUnreadFeed.tsx
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


export function useUnreadFeed() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["unread-feed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      // Get last viewed time for feed
      const { data: lastViewed } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "feed")
        .maybeSingle();

      const lastViewedTime = lastViewed?.viewed_at || new Date(0).toISOString();

      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      if (!following || following.length === 0) {
        return 0;
      }

      const followingIds = following.map((f) => f.following_id);

      const { count: postsCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .in("user_id", followingIds)
        .gt("created_at", lastViewedTime);

      return postsCount || 0;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return count;
}
