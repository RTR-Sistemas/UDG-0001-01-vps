/**
 * =============================================================================
 * File: src/pages/Rankings.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUdgRanking } from "@/hooks/useUdgRanking";
import { UserLink } from "@/components/UserLink";
import { Crown, Heart, Bomb } from "lucide-react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export default function Rankings() {
  const { heartsRanking, bombsRanking } = useUdgRanking();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            Rankings
          </h1>
          <p className="text-sm text-muted-foreground">
            Veja os líderes em corações e bombas na comunidade
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-pink-500" />
              Top corações
            </h2>
            <div className="space-y-3">
              {heartsRanking.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-sm font-medium">
                      #{index + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback>
                        {entry.username?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <UserLink 
                        userId={entry.userId} 
                        username={entry.username || ""}
                        className="font-semibold text-sm hover:underline"
                      >
                        {entry.username}
                      </UserLink>
                      <span className="text-xs text-muted-foreground">
                        {entry.heartsTotal} corações
                      </span>
                    </div>
                  </div>
                  {index === 0 && (
                    <Crown className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              ))}
              {heartsRanking.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Ainda não há dados de corações
                </p>
              )}
            </div>
          </Card>           

          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-lg">
              <Bomb className="h-5 w-5 text-red-500" />
              Top bombas
            </h2>
            <div className="space-y-3">
              {bombsRanking.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-sm font-medium">
                      #{index + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback>
                        {entry.username?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <UserLink 
                        userId={entry.userId} 
                        username={entry.username || ""}
                        className="font-semibold text-sm hover:underline"
                      >
                        {entry.username}
                      </UserLink>
                      <span className="text-xs text-muted-foreground">
                        {entry.bombsTotal} bombas
                      </span>
                    </div>
                  </div>
                  {index === 0 && (
                    <Bomb className="h-5 w-5 text-red-500" />
                  )}
                </div>
              ))}
              {bombsRanking.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Ainda não há dados de bombas.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
