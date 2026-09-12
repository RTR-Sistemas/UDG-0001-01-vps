/**
 * =============================================================================
 * File: src/components/ChatScreen.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageBubble, type Message } from "./MessageBubble";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export const ChatScreen: React.FC<{ conversationId: string; me: string; myLang: string }>
= ({ conversationId, me, myLang }) => {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, user_id, content, media_urls, created_at, updated_at, viewed_at, expires_at, is_deleted")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (!error && data) setMsgs(data as Message[]);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMsgs((prev) => [...prev, payload.new as Message]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMsgs((prev) => prev.map(m => m.id === (payload.new as any).id ? (payload.new as Message) : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMsgs((prev) => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  async function sendText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: me,
        content: trimmed,
      })
      .select("id")
      .single();
    setText("");
    // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente.
  }

  return (
    <div className="chat-wrap">
      <div className="list">
        {msgs.map(m => (
          <MessageBubble key={m.id} msg={m} me={me} myLang={myLang} />
        ))}
      </div>
      <div className="composer">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem..."
          onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
        />
        <button onClick={sendText}>Enviar</button>
      </div>
    </div>
  );
};
