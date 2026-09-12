/**
 * =============================================================================
 * File: src/hooks/useUnreadCommunities.tsx
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


export function useUnreadCommunities() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["unread-communities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      // Get last viewed time for communities
      const { data: lastViewed } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "communities")
        .maybeSingle();

      const lastViewedTime = lastViewed?.viewed_at || new Date(0).toISOString();

      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        return 0;
      }

      const communityIds = memberships.map((m) => m.community_id);

      const { count: postsCount } = await supabase
        .from("community_posts")
        .select("*", { count: "exact", head: true })
        .in("community_id", communityIds)
        .gt("created_at", lastViewedTime);

      return postsCount || 0;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return count;
}
