/**
 * =============================================================================
 * File: src/services/battleService.ts
 * Purpose: Serviços do sistema de Batalhas ao Vivo — RPCs, consultas e
 *          inscrições em tempo real (Supabase Realtime).
 * =============================================================================
 */

import { supabase } from "@/integrations/supabase/client";
import { openDb } from "@/lib/openDb";
import type { Tables } from "@/integrations/supabase/types";

// -----------------------------------------------------------------------------
// SECTION: Tipos
// -----------------------------------------------------------------------------

export type Battle = Tables<"battles">;
export type GiftCatalogItem = Tables<"gifts_catalog">;
export type GiftTransaction = Tables<"gift_transactions">;
export type BattleParticipant = Tables<"battle_participants">;
export type BattleExtension = Tables<"battle_extensions">;
export type BattleChatMessage = {
  id: string;
  battle_id: string;
  user_id: string;
  message: string;
  created_at: string;
};
export type BattleViewer = {
  battle_id: string;
  user_id: string;
  joined_at: string;
  last_seen_at: string;
};

export type BattleSide = "host" | "guest";

export type BattleInviteError =
  | "not_authenticated"
  | "guest_required"
  | "cannot_battle_self"
  | "guest_not_found"
  | "already_in_battle"
  | "battle_not_found"
  | "not_the_guest"
  | "not_the_host"
  | "battle_not_invite"
  | "unknown";

export function battleErrorMessage(e: unknown): string {
  const code = ((e as Error)?.message ?? "unknown") as BattleInviteError;
  switch (code) {
    case "not_authenticated":
      return "Você precisa estar logado.";
    case "guest_required":
      return "Selecione um adversário.";
    case "cannot_battle_self":
      return "Você não pode batalhar consigo mesmo.";
    case "guest_not_found":
      return "Adversário não encontrado.";
    case "already_in_battle":
      return "Você já está em uma batalha ativa.";
    case "not_the_guest":
      return "Apenas o convidado pode aceitar este convite.";
    case "not_the_host":
      return "Apenas o criador pode fazer isso.";
    case "battle_not_invite":
      return "Esta batalha não está mais como convite.";
    case "battle_not_found":
      return "Batalha não encontrada.";
    default:
      return "Erro inesperado. Tente novamente.";
  }
}

// -----------------------------------------------------------------------------
// SECTION: RPCs de batalha
// -----------------------------------------------------------------------------

export async function startBattle(guestId: string, duration?: number): Promise<string> {
  const { data, error } = await supabase.rpc("start_battle", {
    p_guest_id: guestId,
    p_duration: duration ?? null,
  });
  if (error) throw new Error(error.message || "unknown");
  return data as string;
}

export async function acceptBattle(battleId: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
  return data as string;
}

export async function declineBattle(battleId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
}

export async function cancelBattle(battleId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
}

export async function endBattle(battleId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("end_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
  return (data as string) ?? null;
}

export async function extendBattle(battleId: string): Promise<string> {
  const { data, error } = await supabase.rpc("extend_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
  return data as string;
}

export async function approveBattleExtension(
  extensionId: string,
  approve: boolean
): Promise<BattleExtension> {
  const { data, error } = await supabase.rpc("approve_battle_extension", {
    p_extension_id: extensionId,
    p_approve: approve,
  });
  if (error) throw new Error(error.message || "unknown");
  return data as BattleExtension;
}

// -----------------------------------------------------------------------------
// SECTION: Envio de presentes
// -----------------------------------------------------------------------------

export type SendGiftError =
  | "not_authenticated"
  | "receiver_required"
  | "cannot_gift_self"
  | "invalid_quantity"
  | "gift_not_found"
  | "insufficient_coins"
  | "battle_not_found"
  | "battle_not_live"
  | "receiver_not_in_battle"
  | "unknown";

export function sendGiftErrorMessage(e: unknown): string {
  const code = ((e as Error)?.message ?? "unknown") as SendGiftError;
  switch (code) {
    case "not_authenticated":
      return "Faça login para enviar presentes.";
    case "receiver_required":
      return "Selecione o destinatário do presente.";
    case "cannot_gift_self":
      return "Você não pode se presentear.";
    case "invalid_quantity":
      return "Quantidade inválida.";
    case "gift_not_found":
      return "Presente indisponível.";
    case "insufficient_coins":
      return "Moedas insuficientes. Compre mais moedas na Carteira.";
    case "battle_not_found":
      return "Batalha não encontrada.";
    case "battle_not_live":
      return "A batalha não está mais ao vivo.";
    case "receiver_not_in_battle":
      return "Criador fora desta batalha.";
    default:
      return "Erro ao enviar presente. Tente novamente.";
  }
}

export async function sendGift(
  receiverId: string,
  giftId: string,
  quantity = 1,
  battleId?: string | null
): Promise<GiftTransaction> {
  const { data, error } = await supabase.rpc("send_gift", {
    p_receiver_id: receiverId,
    p_gift_id: giftId,
    p_quantity: quantity,
    p_battle_id: battleId ?? null,
  });
  if (error) throw new Error(error.message || "unknown");
  return data as GiftTransaction;
}

// -----------------------------------------------------------------------------
// SECTION: Consultas
// -----------------------------------------------------------------------------

export async function fetchGiftCatalog(): Promise<GiftCatalogItem[]> {
  const { data, error } = await supabase
    .from("gifts_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GiftCatalogItem[];
}

export async function fetchLiveBattles(): Promise<Battle[]> {
  const { data, error } = await supabase
    .from("battles")
    .select("*")
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Battle[];
}

export async function fetchMyBattleHistory(userId: string, limit = 10): Promise<Battle[]> {
  const { data, error } = await supabase
    .from("battles")
    .select("*")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .in("status", ["ended", "canceled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Battle[];
}

export async function fetchBattle(battleId: string): Promise<Battle | null> {
  const { data, error } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battleId)
    .maybeSingle();
  if (error) throw error;
  return data as Battle | null;
}

export async function fetchBattleLeaderboard(battleId: string): Promise<BattleParticipant[]> {
  const { data, error } = await supabase.rpc("get_battle_leaderboard", {
    p_battle_id: battleId,
  });
  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("battle_participants")
      .select("*")
      .eq("battle_id", battleId)
      .order("total_coins_spent", { ascending: false })
      .limit(25);
    if (fallbackError) throw fallbackError;
    return (fallback ?? []) as BattleParticipant[];
  }
  return (data ?? []) as BattleParticipant[];
}

export async function fetchRecentGifts(battleId: string, limit = 20): Promise<GiftTransaction[]> {
  const { data, error } = await supabase
    .from("gift_transactions")
    .select("*")
    .eq("battle_id", battleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GiftTransaction[];
}

// -----------------------------------------------------------------------------
// SECTION: Chat ao vivo da batalha
// -----------------------------------------------------------------------------

export type BattleChatWithProfile = BattleChatMessage & {
  profiles: { id: string; username: string | null; avatar_url: string | null } | null;
};

export async function fetchBattleChat(
  battleId: string,
  limit = 60
): Promise<BattleChatWithProfile[]> {
  const { data, error } = await openDb
    .from("battle_chat")
    .select("*, profiles:user_id(id, username, avatar_url)")
    .eq("battle_id", battleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []).reverse()) as unknown as BattleChatWithProfile[];
}

export async function sendBattleChatMessage(battleId: string, message: string): Promise<void> {
  const trimmed = message.trim().slice(0, 300);
  if (!trimmed) return;
  const { error } = await openDb.from("battle_chat").insert({
    battle_id: battleId,
    message: trimmed,
  });
  if (error) throw error;
}

export function subscribeBattleChat(
  battleId: string,
  onMessage: (msg: BattleChatWithProfile) => void
): () => void {
  // JOIN: batemos no profile do usuário novamente para manter o nome completo
  const channel = supabase
    .channel(`battle_chat_${battleId}_${Math.random().toString(36).slice(2, 9)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "battle_chat", filter: `battle_id=eq.${battleId}` },
      (payload) => {
        const row = payload.new as BattleChatMessage;
        // postgres_changes com FK join não entrega profiles; busca separadamente
        void (async () => {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", row.user_id)
            .maybeSingle();
          onMessage({ ...row, profiles: (data ?? null) as BattleChatWithProfile["profiles"] });
        })();
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

// -----------------------------------------------------------------------------
// SECTION: Espectadores (presença ao vivo)
// -----------------------------------------------------------------------------

export async function joinBattleAsViewer(battleId: string): Promise<number> {
  const { data, error } = await supabase.rpc("join_battle_as_viewer", { p_battle_id: battleId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function leaveBattleAsViewer(battleId: string): Promise<number> {
  const { data, error } = await supabase.rpc("leave_battle_as_viewer", { p_battle_id: battleId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function touchBattleViewer(battleId: string): Promise<number> {
  const { data, error } = await supabase.rpc("touch_battle_viewer", { p_battle_id: battleId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export function subscribeBattleViewers(
  battleId: string,
  onEnter: (viewer: BattleViewer) => void
): () => void {
  const channel = supabase
    .channel(`battle_viewers_${battleId}_${Math.random().toString(36).slice(2, 9)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "battle_viewers", filter: `battle_id=eq.${battleId}` },
      (payload) => {
        onEnter(payload.new as BattleViewer);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

// -----------------------------------------------------------------------------
// SECTION: Corações (hearts) — tap ao vivo via broadcast (sem carga no banco)
// -----------------------------------------------------------------------------

let heartsChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeBattleHearts(
  battleId: string,
  onHearts: (payload: { side: BattleSide; count: number }) => void
): () => void {
  const name = `battle_hearts_${battleId}`;
  heartsChannel = supabase.channel(name);
  const sub = heartsChannel
    .on("broadcast", { event: "hearts" }, (payload) => {
      onHearts(payload.payload as { side: BattleSide; count: number });
    })
    .subscribe();
  return () => {
    void sub.unsubscribe();
    heartsChannel = null;
  };
}

export async function sendBattleHearts(battleId: string, side: BattleSide, count: number): Promise<void> {
  try {
    if (!heartsChannel) {
      heartsChannel = supabase.channel(`battle_hearts_${battleId}`);
      await heartsChannel.subscribe();
    }
    await heartsChannel.send({
      type: "broadcast",
      event: "hearts",
      payload: { side, count },
    });
  } catch {
    // best effort — corações são cosméticos
  }
}

// -----------------------------------------------------------------------------
// SECTION: Batalha (ações extras)
// -----------------------------------------------------------------------------

export async function surrenderBattle(battleId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("surrender_battle", { p_battle_id: battleId });
  if (error) throw new Error(error.message || "unknown");
  return (data as string) ?? null;
}

export function battleSurrenderErrorMessage(e: unknown): string {
  const code = ((e as Error)?.message ?? "unknown") as
    | "not_authenticated" | "battle_not_found" | "not_a_participant" | "battle_not_live" | "unknown";
  switch (code) {
    case "not_a_participant":
      return "Apenas participantes podem render-se.";
    case "battle_not_live":
      return "A batalha não está mais ao vivo.";
    case "battle_not_found":
      return "Batalha não encontrada.";
    default:
      return "Erro ao render-se. Tente novamente.";
  }
}

// -----------------------------------------------------------------------------
// SECTION: Realtime
// -----------------------------------------------------------------------------

export function subscribeBattle(
  battleId: string,
  callbacks: {
    onBattle?: (battle: Battle) => void;
    onGift?: (gift: GiftTransaction) => void;
    onExtension?: (extension: BattleExtension) => void;
    onParticipant?: (participant: BattleParticipant) => void;
  }
): () => void {
  const channel = supabase
    .channel(`battle_room_${battleId}_${Math.random().toString(36).slice(2, 9)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "battles", filter: `id=eq.${battleId}` },
      (payload) => {
        if (callbacks.onBattle) callbacks.onBattle(payload.new as Battle);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "gift_transactions",
        filter: `battle_id=eq.${battleId}`,
      },
      (payload) => {
        if (callbacks.onGift) callbacks.onGift(payload.new as GiftTransaction);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "battle_extensions",
        filter: `battle_id=eq.${battleId}`,
      },
      (payload) => {
        if (callbacks.onExtension) callbacks.onExtension(payload.new as BattleExtension);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "battle_participants",
        filter: `battle_id=eq.${battleId}`,
      },
      (payload) => {
        if (callbacks.onParticipant) callbacks.onParticipant(payload.new as BattleParticipant);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}

export function subscribeNewBattles(
  myUserId: string,
  callbacks: {
    onInvite?: (battle: Battle) => void;
    onBattleChanged?: (battle: Battle) => void;
  }
): () => void {
  const channel = supabase
    .channel(`battle_lobby_${myUserId}_${Math.random().toString(36).slice(2, 9)}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "battles",
        filter: `guest_id=eq.${myUserId}`,
      },
      (payload) => {
        if (callbacks.onInvite) callbacks.onInvite(payload.new as Battle);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "battles",
        filter: `guest_id=eq.${myUserId}`,
      },
      (payload) => {
        if (callbacks.onBattleChanged) callbacks.onBattleChanged(payload.new as Battle);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => undefined);
  };
}