/**
 * =============================================================================
 * File: src/hooks/useBattleNotifications.ts
 * Purpose: Hook que escuta eventos de batalha (convites aceitos, extensões,
 *          fim de batalha) e dispara efeitos visuais/sonoros e notificações.
 * =============================================================================
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { playBattleSound } from "@/lib/battleUtils";
import type { Battle } from "@/services/battleService";

interface BattleEventHandlers {
  onInvite?: (battle: Battle) => void;
  onAccepted?: (battle: Battle) => void;
  onEnded?: (battle: Battle) => void;
}

export function useBattleNotifications(handlers?: BattleEventHandlers) {
  const { toast } = useToast();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // Sinaliza sonoro de convite ao receber uma nova batalha scheduled
    const onBattleEvent = (event: CustomEvent<{ battle: Battle }>) => {
      const { battle } = event.detail;
      if (!battle) return;

      switch (battle.status) {
        case "scheduled":
          playBattleSound("invite");
          toast({
            title: "⚔️ Novo desafio de batalha!",
            description: "Você recebeu um convite para uma batalha ao vivo.",
          });
          handlersRef.current?.onInvite?.(battle);
          break;
        case "live":
          playBattleSound("extension");
          handlersRef.current?.onAccepted?.(battle);
          break;
        case "ended":
          playBattleSound(battle.winner_id ? "victory" : "defeat");
          handlersRef.current?.onEnded?.(battle);
          break;
      }
    };

    window.addEventListener("udg:battle", onBattleEvent as EventListener);
    return () => {
      window.removeEventListener("udg:battle", onBattleEvent as EventListener);
    };
  }, [toast]);
}

/**
 * Dispara um evento local de batalha (usado pela sala para notificar
 * componentes globais sem callback hell).
 */
export function emitBattleEvent(battle: Battle) {
  try {
    window.dispatchEvent(new CustomEvent("udg:battle", { detail: { battle } }));
  } catch {
    // ignora (ambiente sem window)
  }
}