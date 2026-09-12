/**
 * =============================================================================
 * File: src/components/battle/BattleScoreboard.tsx
 * Purpose: Placar ao vivo da batalha — barra de progresso que "empurra" o
 *          adversário, pontuações e cronômetro regressivo.
 * =============================================================================
 */

import React, { useEffect, useMemo, useState } from "react";
import { formatCoins, playBattleSound } from "@/lib/battleUtils";
import type { Battle } from "@/services/battleService";
import { cn } from "@/lib/utils";

interface BattleScoreboardProps {
  battle: Battle;
  myUserId?: string;
}

function useCountdown(battle: Battle) {
  const [now, setNow] = useState(() => Date.now());

  const endTime = useMemo(() => {
    if (!battle.actual_start) return null;
    return new Date(battle.actual_start).getTime() + battle.duration_seconds * 1000;
  }, [battle.actual_start, battle.duration_seconds]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = endTime ? Math.max(0, endTime - now) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const label = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const isEnded = battle.status === "ended";
  const expired = battle.status === "live" && endTime !== null && remainingMs <= 0;

  return { label, isEnded, expired, totalSec };
}

export function BattleScoreboard({ battle, myUserId }: BattleScoreboardProps) {
  const { label, isEnded, expired, totalSec } = useCountdown(battle);

  const total = battle.host_score + battle.guest_score || 1;
  const hostPct = Math.round((battle.host_score / total) * 100);
  const guestPct = 100 - hostPct;

  // alerta sonoro quando falta pouco tempo
  useEffect(() => {
    if (expired || isEnded) return;
    if (totalSec === 10 || totalSec === 5 || totalSec === 3) {
      playBattleSound("countdown");
    }
  }, [totalSec, expired, isEnded]);

  // vitória/derrota sonora ao encerrar
  useEffect(() => {
    if (!isEnded) return;
    if (myUserId && battle.winner_id === myUserId) playBattleSound("victory");
    else if (myUserId && battle.winner_id && battle.winner_id !== myUserId)
      playBattleSound("defeat");
  }, [isEnded, battle.winner_id, myUserId]);

  const hostIsMe = myUserId != null && battle.host_id === myUserId;
  const guestIsMe = myUserId != null && battle.guest_id === myUserId;

  return (
    <div className="space-y-3">
      {/* Cronômetro */}
      <div className="flex items-center justify-center">
        <div
          className={cn(
            "font-mono text-3xl font-black tracking-widest tabular-nums rounded-2xl px-6 py-2",
            expired
              ? "bg-red-500/15 text-red-500 animate-pulse"
              : isEnded
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
          )}
          data-testid="battle-timer"
        >
          {isEnded ? "FIM" : expired ? "ENCERRANDO..." : label}
        </div>
      </div>

      {/* Barra de progresso */}
      <div
        className="relative h-6 rounded-full overflow-hidden flex bg-border/60"
        data-testid="battle-progress"
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
          style={{ width: `${hostPct}%` }}
        />
        <div className="h-px flex-1" />
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-500"
          style={{ width: `${guestPct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full shadow-lg"
          style={{ left: `${hostPct}%`, transform: `translate(-50%, -50%) ${hostPct > 90 ? "translateX(4px)" : ""}` }}
        />
      </div>

      {/* Pontuações */}
      <div className="flex items-center justify-between text-sm">
        <div
          className={cn(
            "flex items-center gap-1.5 font-bold",
            hostIsMe && "text-primary"
          )}
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Host
          <span className="tabular-nums" data-testid="host-score">
            {formatCoins(battle.host_score)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          👑 {battle.winner_id ? (battle.winner_id === battle.host_id ? "Host venceu" : "Guest venceu") : isEnded ? "Empate" : ""}
        </span>
        <div
          className={cn(
            "flex items-center gap-1.5 font-bold",
            guestIsMe && "text-primary"
          )}
        >
          <span className="tabular-nums" data-testid="guest-score">
            {formatCoins(battle.guest_score)}
          </span>
          Guest
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
        </div>
      </div>
    </div>
  );
}