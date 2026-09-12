/**
 * =============================================================================
 * File: src/hooks/useUdgRanking.ts
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


export type UdgRankingEntry = {
  userId: string;
  username: string | null;
  avatar_url: string | null;
  heartsTotal: number;
  bombsTotal: number;
};

function computeRanks(entries: UdgRankingEntry[]) {
  const heartsRanking = [...entries].sort(
    (a, b) => b.heartsTotal - a.heartsTotal
  );
  const bombsRanking = [...entries].sort(
    (a, b) => b.bombsTotal - a.bombsTotal
  );
  return { heartsRanking, bombsRanking };
}

export function useUdgRanking() {
  const { user } = useAuth();

  const { data = { entries: [], heartsRanking: [], bombsRanking: [] } } =
    useQuery({
      queryKey: ["udg-ranking"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("posts")
          .select(
            `
            id,
            user_id,
            profiles (
              id,
              username,
              avatar_url
            ),
            post_votes (vote_type)
          `
          );

        if (error) throw error;

        const map = new Map<string, UdgRankingEntry>();

        (data as any[]).forEach((post) => {
          const userId = post.user_id as string;
          const profile = post.profiles;
          if (!map.has(userId)) {
            map.set(userId, {
              userId,
              username: profile?.username ?? null,
              avatar_url: profile?.avatar_url ?? null,
              heartsTotal: 0,
              bombsTotal: 0,
            });
          }
          const entry = map.get(userId)!;

          (post.post_votes || []).forEach((v: any) => {
            if (v.vote_type === "heart") entry.heartsTotal++;
            if (v.vote_type === "bomb") entry.bombsTotal++;
          });
        });

        const entries = Array.from(map.values());
        const { heartsRanking, bombsRanking } = computeRanks(entries);

        return { entries, heartsRanking, bombsRanking };
      },
      refetchInterval: 10000,
    });

  const heartsRanking = data.heartsRanking;
  const bombsRanking = data.bombsRanking;

  const king = heartsRanking[0] ?? null;
  const bombado = bombsRanking[0] ?? null;

  const currentUserId = user?.id;
  const heartsPosition =
    currentUserId
      ? heartsRanking.findIndex((r) => r.userId === currentUserId) + 1 || null
      : null;
  const bombsPosition =
    currentUserId
      ? bombsRanking.findIndex((r) => r.userId === currentUserId) + 1 || null
      : null;

  return {
    heartsRanking,
    bombsRanking,
    king,
    bombado,
    heartsPosition,
    bombsPosition,
  };
}
