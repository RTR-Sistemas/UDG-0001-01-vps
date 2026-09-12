/**
 * =============================================================================
 * File: src/services/attentionCalls.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export type AttentionCallError =
  | "not_authenticated"
  | "receiver_required"
  | "cannot_alert_self"
  | "silenced_by_receiver"
  | "rate_limited_10_min"
  | "unknown";

export async function sendAttentionCall(receiverId: string, message?: string) {
  const { data, error } = await supabase.rpc("attention_call_create", {
    receiver_id: receiverId,
    message: message ?? null,
  });
  if (error) {
    const code =
      (error.message as AttentionCallError) ||
      (error.code as AttentionCallError) ||
      "unknown";
    throw new Error(code);
  }
  return data as unknown as string;
}

export function attentionErrorMessage(e: unknown) {
  const code = (e as Error)?.message as AttentionCallError;
  switch (code) {
    case "rate_limited_10_min":
      return "Você acabou de chamar atenção. Aguarde 10 minutos para enviar outro alerta.";
    case "silenced_by_receiver":
      return "Este destinatário silenciou seus alertas por enquanto.";
    case "cannot_alert_self":
      return "Você não pode enviar alerta para você mesmo.";
    case "receiver_required":
      return "Destinatário obrigatório.";
    case "not_authenticated":
      return "Faça login para enviar alertas.";
    default:
      return "Não foi possível enviar o alerta agora. Tente novamente.";
  }
}

/** Carga inicial: no máximo 1 por remetente, últimos 30s */
export async function fetchRecentAttentionCallsDistinctBySender(receiverId: string) {
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data, error } = await supabase
    .from("attention_calls")
    .select("id,sender_id,receiver_id,message,viewed_at,created_at")
    .eq("receiver_id", receiverId)
    // Só traz alertas não visualizados, para não reaparecer ao reabrir o app
    .is("viewed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  const distinct: Array<{
    id: string;
    sender_id: string;
    receiver_id: string;
    message: string | null;
    viewed_at: string | null;
    created_at: string;
  }> = [];
  for (const row of data ?? []) {
    if (!seen.has(row.sender_id)) {
      seen.add(row.sender_id);
      distinct.push(row);
    }
  }
  return distinct;
}

/** Realtime: 1 por remetente a cada 30s */
export function listenAttentionCallsOnePerSender(
  receiverId: string,
  onCall: (call: { id: string; sender_id: string; receiver_id: string; message: string | null; created_at: string; }) => void
) {
  const senderWindow = new Map<string, number>();
  const channel = supabase
    .channel("attention_calls_" + receiverId + "_dedupe")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "attention_calls", filter: `receiver_id=eq.${receiverId}` },
      (payload) => {
        const row = payload.new as {
          id: string;
          sender_id: string;
          receiver_id: string;
          message: string | null;
          viewed_at: string | null;
          created_at: string;
        };
        const now = Date.now();
        const created = new Date(row.created_at).getTime();
        if (now - created > 30_000) return;
        const last = senderWindow.get(row.sender_id) ?? 0;
        if (now - last < 30_000) return;
        senderWindow.set(row.sender_id, now);
        onCall(row);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ========== ACK / AUTO-DELETE ========== */

export async function ackAttentionCall(callId: string) {
  const { error } = await supabase.rpc("attention_call_ack", { p_call_id: callId });
  if (error) throw error;
}

export async function ackAttentionCalls(callIds: string[]) {
  if (!callIds.length) return;
  const { error } = await supabase.rpc("attention_call_ack_many", { p_call_ids: callIds });
  if (error) throw error;
}

export function listenAttentionCallsOnePerSenderAutoAck(
  receiverId: string,
  onCall: (call: { id: string; sender_id: string; receiver_id: string; message: string | null; created_at: string; }) => void
) {
  const unsub = listenAttentionCallsOnePerSender(receiverId, (call) => {
    onCall(call);
    ackAttentionCall(call.id).catch((e) => console.error("ack failed", e));
  });
  return unsub;
}

export async function startAttentionListeners(
  currentUserId: string,
  onCall: (call: { id: string; sender_id: string; receiver_id: string; message: string | null; created_at: string; }) => void
) {
  try {
    const initial = await fetchRecentAttentionCallsDistinctBySender(currentUserId);
    for (const call of initial) onCall(call);
  } catch (e) {
    console.error("Falha ao carregar alertas recentes:", attentionErrorMessage(e));
  }
  return listenAttentionCallsOnePerSender(currentUserId, onCall);
}

export async function startAttentionListenersAutoAck(
  currentUserId: string,
  onCall: (call: { id: string; sender_id: string; receiver_id: string; message: string | null; created_at: string; }) => void
) {
  try {
    const initial = await fetchRecentAttentionCallsDistinctBySender(currentUserId);
    const ids: string[] = [];
    for (const call of initial) {
      onCall(call);
      ids.push(call.id);
    }
    await ackAttentionCalls(ids);
  } catch (e) {
    console.error("Falha na carga inicial:", e);
  }
  return listenAttentionCallsOnePerSenderAutoAck(currentUserId, onCall);
}
