/**
 * =============================================================================
 * File: src/hooks/useBattleRanking.ts
 * Purpose: Hook que busca o ranking de espectadores de uma batalha e
 *          atualiza em tempo real conforme novos presentes chegam.
 * =============================================================================
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchBattleLeaderboard,
  type BattleParticipant,
} from "@/services/battleService";

export function useBattleRanking(battleId: string | undefined) {
  const [ranking, setRanking] = useState<BattleParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!battleId) return;
    setRefreshing(true);
    try {
      const rows = await fetchBattleLeaderboard(battleId);
      setRanking(rows);
    } catch (err) {
      console.error("[useBattleRanking] falha:", err);
    } finally {
      setRefreshing(false);
    }
  }, [battleId]);

  useEffect(() => {
    if (!battleId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // polling leve + realtime via subscribeBattle são feitos pela sala;
    // aqui garantimos atualização periódica de forma simples
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [battleId, refresh]);

  return { ranking, loading, refreshing, refresh };
}