/**
 * =============================================================================
 * File: src/pages/RankingPage.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Crown, Bomb, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type RankingEntry = {
  userId: string;
  username: string | null;
  avatar_url: string | null;
  heartsApproved: number;
  bombs: number;
};

export default function RankingPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["ranking-global"],
    queryFn: async (): Promise<{ hearts: RankingEntry[]; bombs: RankingEntry[] }> => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          is_community_approved,
          profiles:user_id (
            id,
            username,
            avatar_url
          ),
          post_votes (
            user_id,
            vote_type
          )
        `);

      if (error) throw error;

      const map = new Map<string, RankingEntry>();

      (data || []).forEach((post: any) => {
        const userId = post.user_id as string | undefined;
        if (!userId) return;

        const profile = post.profiles as {
          id: string;
          username: string | null;
          avatar_url: string | null;
        };

        let entry = map.get(userId);
        if (!entry) {
          entry = {
            userId,
            username: profile?.username ?? null,
            avatar_url: profile?.avatar_url ?? null,
            heartsApproved: 0,
            bombs: 0,
          };
          map.set(userId, entry);
        }

        const votes: Array<{ vote_type: "heart" | "bomb" }> = post.post_votes ?? [];
        for (const vote of votes) {
          if (vote.vote_type === "heart" && post.is_community_approved) {
            entry.heartsApproved += 1;
          }
          if (vote.vote_type === "bomb") {
            entry.bombs += 1;
          }
        }
      });

      const entries = Array.from(map.values());

      const hearts = [...entries].sort((a, b) => b.heartsApproved - a.heartsApproved);
      const bombs = [...entries].sort((a, b) => b.bombs - a.bombs);

      return { hearts, bombs };
    },
    staleTime: 60000,
  });

  const heartsList = data?.hearts ?? [];
  const bombsList = data?.bombs ?? [];

  const renderList = (list: RankingEntry[], mode: "hearts" | "bombs") => (
    <div className="space-y-2">
      {list.map((entry, index) => {
        const isCurrentUser = user?.id === entry.userId;
        const position = index + 1;

        return (
          <Card
            key={entry.userId}
            className={cn(
              "flex items-center gap-3 px-4 py-3 border",
              isCurrentUser && "border-primary/80 shadow-md"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 text-sm font-semibold text-muted-foreground">
                #{position}
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage src={entry.avatar_url || ""} />
                <AvatarFallback>
                  {entry.username?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {entry.username || "Usuário"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {mode === "hearts"
                    ? `${entry.heartsApproved} corações aprovados`
                    : `${entry.bombs} bombas recebidas`}
                </div>
              </div>
            </div>
            {position === 1 && mode === "hearts" && (
              <Crown className="h-5 w-5 text-yellow-500" />
            )}
            {position === 1 && mode === "bombs" && (
              <Bomb className="h-5 w-5 text-red-500" />
            )}
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            Ranking Global
          </h1>
          <p className="text-sm text-muted-foreground">
            Veja quem domina nos corações e quem está levando mais bombas.
          </p>
        </header>

        {isLoading ? (
          <p className="text-center text-muted-foreground">Carregando ranking...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Top corações aprovados
              </h2>
              {heartsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há dados suficientes.
                </p>
              ) : (
                renderList(heartsList, "hearts")
              )}
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-2">
                <Bomb className="h-5 w-5 text-red-500" />
                Top bombas recebidas
              </h2>
              {bombsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há dados suficientes.
                </p>
              ) : (
                renderList(bombsList, "bombs")
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
