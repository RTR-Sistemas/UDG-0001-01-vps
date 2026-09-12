/**
 * =============================================================================
 * File: src/contexts/BattleContext.tsx
 * Purpose: Contexto global das Batalhas ao Vivo — convites recebidos e
 *          batalha ativa do usuário (com inscrição em tempo real).
 * =============================================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { subscribeNewBattles, fetchBattle, type Battle } from "@/services/battleService";

// -----------------------------------------------------------------------------
// SECTION: Tipos
// -----------------------------------------------------------------------------

interface BattleContextType {
  invite: Battle | null;
  activeBattle: Battle | null;
  loadingBattle: boolean;
  openBattle: (battleId: string) => void;
  dismissInvite: () => void;
}

const BattleContext = createContext<BattleContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// SECTION: Provider
// -----------------------------------------------------------------------------

export const BattleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Battle | null>(null);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(true);
  const mountedRef = useRef(true);
  const dismissedInviteIdRef = useRef<string | null>(null);

  // Busca batalhas ativas do usuário no primeiro carregamento
  useEffect(() => {
    mountedRef.current = true;

    const loadInitial = async () => {
      if (!user) return;
      try {
        const { data, error } = await fetchMyCurrentBattles(user.id);
        if (error) throw error;
        if (!mountedRef.current) return;

        const rows = (data ?? []) as Battle[];
        const pendingInvite = rows.find((b) => b.status === "scheduled" && b.guest_id === user.id);
        const active = rows.find((b) => b.status === "live");

        if (pendingInvite && dismissedInviteIdRef.current !== pendingInvite.id) {
          setInvite(pendingInvite);
        }
        setActiveBattle(active ?? null);
      } catch (err) {
        console.error("[BattleContext] load inicial falhou:", err);
      } finally {
        if (mountedRef.current) setLoadingBattle(false);
      }
    };

    loadInitial();

    const unsubscribe = user
      ? subscribeNewBattles(user.id, {
          onInvite: (battle) => {
            if (dismissedInviteIdRef.current === battle.id) return;
            setInvite(battle);
          },
          onBattleChanged: (battle) => {
            // atualiza convite para o estado real
            if (battle.status === "live") {
              setInvite((prev) => (prev?.id === battle.id ? null : prev));
              setActiveBattle(battle);
            } else if (battle.status === "scheduled") {
              setInvite((prev) => prev ?? battle);
            } else {
              // ended/canceled
              setInvite((prev) => (prev?.id === battle.id ? null : prev));
              setActiveBattle((prev) => (prev?.id === battle.id ? null : prev));
            }
          },
        })
      : undefined;

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [user]);

  const openBattle = useCallback(
    (battleId: string) => {
      navigate(`/battle/${battleId}`);
    },
    [navigate]
  );

  const dismissInvite = useCallback(() => {
    setInvite((prev) => {
      if (prev) dismissedInviteIdRef.current = prev.id;
      return null;
    });
  }, []);

  useEffect(() => {
    if (!activeBattle) return;
    // Acompanha o estado da batalha ativa por polling leve (fallback se o realtime falhar)
    const timer = window.setInterval(async () => {
      try {
        const battle = await fetchBattle(activeBattle.id);
        if (!mountedRef.current || !battle) return;
        if (battle.status !== "live" && battle.status !== "scheduled") {
          setActiveBattle((prev) => (prev?.id === battle.id ? null : prev));
        } else {
          setActiveBattle((prev) => (prev?.id === battle.id ? battle : prev));
        }
      } catch {
        // ignora falhas pontuais do polling
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeBattle]);

  return (
    <BattleContext.Provider
      value={{
        invite,
        activeBattle,
        loadingBattle,
        openBattle,
        dismissInvite,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
};

// -----------------------------------------------------------------------------
// SECTION: Helpers internos
// -----------------------------------------------------------------------------

async function fetchMyCurrentBattles(userId: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase
    .from("battles")
    .select("*")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });
}

// -----------------------------------------------------------------------------
// SECTION: Hook
// -----------------------------------------------------------------------------

export function useBattle(): BattleContextType {
  const context = useContext(BattleContext);
  if (context === undefined) {
    throw new Error("useBattle deve ser usado dentro de um BattleProvider");
  }
  return context;
}