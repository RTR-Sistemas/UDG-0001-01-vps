/**
 * =============================================================================
 * File: src/components/ChatEphemeral.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// src/components/ChatEphemeral.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { franc } from "franc-min";
import langs from "langs";
import dayjs from "dayjs";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Conversation = { id: string; is_group: boolean };
type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  viewed_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  is_deleted: boolean;
};

function detectLanguage(text?: string | null): string | undefined {
  if (!text) return undefined;
  const code3 = franc(text, { minLength: 10 });
  if (!code3 || code3 === "und") return undefined;
  try {
    const info = langs.where("3", code3);
    if (info) return (info["1"] as string) || (info["2T"] as string) || (info["2B"] as string) || (info["3"] as string);
  } catch { }
  return undefined;
}
function langName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    const info = (langs.where("1", code) || langs.where("2T", code) || langs.where("3", code)) as any;
    return info?.name;
  } catch {
    return undefined;
  }
}
async function translateText(text: string, to = "pt") {
  const api = (import.meta.env.VITE_TRANSLATE_API_URL as string) || "https://libretranslate.de/translate";
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: "auto", target: to, format: "text" }),
    });
    if (!res.ok) throw new Error("Falha no endpoint de tradução");
    const data = await res.json();
    return data.translatedText as string;
  } catch {
    return null;
  }
}

export default function ChatEphemeral({ conversation }: { conversation: Conversation }) {
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !conversation) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      setMessages((data as any) || []);
    })();

    const channel = supabase
      .channel(`conv-${conversation.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const rowNew = payload.new as any;
        const rowOld = payload.old as any;
        setMessages((prev) => {
          if (payload.eventType === "INSERT") return [...prev, rowNew];
          if (payload.eventType === "UPDATE") return prev.map((m) => (m.id === rowNew.id ? rowNew : m));
          if (payload.eventType === "DELETE") return prev.filter((m) => m.id !== rowOld.id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, conversation]);

  const sendText = async () => {
    if (!text.trim()) return;
    await supabase.rpc("send_text_message", { p_conversation_id: conversation.id, p_text: text.trim() });
    setText("");
  };

  const uploadAndSend = async () => {
    if (!files || files.length === 0) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${conversation.id}/${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name}`;
      const { error } = await supabase.storage.from("chat").upload(path, f, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("chat").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    if (urls.length) {
      await supabase.rpc("send_media_message", { p_conversation_id: conversation.id, p_media_urls: urls });
      setFiles(null);
      (document.getElementById("file-input") as HTMLInputElement).value = "";
    }
  };

  const now = useNow(1000);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !session) return;
    const io = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.mid;
        if (!id || !entry.isIntersecting) continue;
        const msg = messages.find((m) => m.id === id);
        if (!msg) continue;
        const isToMe = msg.user_id !== session.user.id; // não fui eu quem enviou
        if (isToMe && !msg.viewed_at && !msg.deleted_at) {
          await supabase.rpc("mark_viewed", { p_message_id: id });
        }
      }
    }, { root: containerRef.current, threshold: 0.7 });
    Array.from(containerRef.current.querySelectorAll("[data-mid]")).forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [messages, session]);

  const remainSeconds = (m: Message) => {
    if (!m.expires_at || m.deleted_at) return null;
    const diff = new Date(m.expires_at).getTime() - now;
    return Math.max(0, Math.ceil(diff / 1000));
  };

  const doTranslate = async (m: Message) => {
    if (!m.content) return;
    setTranslatingId(m.id);
    const t = await translateText(m.content, "pt");
    setTranslatingId(null);
    if (!t) {
      const sl = detectLanguage(m.content) || "auto";
      const params = new URLSearchParams({ sl, tl: "pt", text: m.content });
      window.open(`https://translate.google.com/?${params.toString()}`, "_blank");
      return;
    }
    setTranslations((prev) => ({ ...prev, [m.id]: t }));
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fafafa" }}>
        Conversa — mensagens apagam 2:00 após visualização
      </div>
      <div ref={containerRef} style={{ height: "60vh", overflowY: "auto", padding: 12, background: "#f8fafc" }}>
        {messages.map((m) => {
          const mine = session && (m.user_id === session.user.id);
          const code = detectLanguage(m.content || undefined);
          const name = code ? langName(code) : undefined;
          const remain = remainSeconds(m);
          return (
            <div key={m.id} data-mid={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "14px 0" }}>
              <div style={{ maxWidth: "75%", textAlign: mine ? "right" : "left" }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: m.deleted_at ? "#f8fafc" : mine ? "#111827" : "#fff",
                    color: m.deleted_at ? "#6b7280" : mine ? "#fff" : "#111",
                    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                  }}
                >
                  {!m.deleted_at ? (
                    <>
                      {m.content && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>}
                      {!!(m.media_urls?.length) && (
                        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                          {m.media_urls!.map((u, i) => {
                            const lower = u.toLowerCase();
                            const isImg = lower.match(/\.(png|jpg|jpeg|gif|webp)$/);
                            const isVid = lower.match(/\.(mp4|webm|ogg)$/);
                            return (
                              <div key={i}>
                                {isImg && <img src={u} alt="media" style={{ maxHeight: 260, borderRadius: 12 }} />}
                                {isVid && <video src={u} controls style={{ maxHeight: 260, borderRadius: 12 }} />}
                                {!isImg && !isVid && <a href={u} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#111", textDecoration: "underline" }}>{u}</a>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                        <span>{dayjs(m.created_at).format("HH:mm")}</span>
                        {m.viewed_at && remain !== null && (
                          <span style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid #F59E0B", background: "#FFFBEB", color: "#92400E" }}>
                            ⏳ {String(Math.floor(remain / 60)).padStart(1, "0")}:{String(remain % 60).padStart(2, "0")}
                          </span>
                        )}
                        {m.content && name && <span style={{ padding: "1px 6px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f3f4f6" }}>🌐 {name}</span>}
                        {m.content && (
                          <button onClick={() => doTranslate(m)} disabled={translatingId === m.id} style={{ borderRadius: 999, padding: "1px 8px", border: "1px solid #e5e7eb", background: "#f3f4f6", fontSize: 12, cursor: "pointer" }}>
                            🛈 {translatingId === m.id ? "Traduzindo…" : "Traduzir"}
                          </button>
                        )}
                      </div>
                      {translations[m.id] && (
                        <div style={{ marginTop: 8, fontSize: 13, fontStyle: "italic", background: "rgba(255,255,255,.6)", border: "1px solid rgba(0,0,0,.06)", borderRadius: 8, padding: 8 }}>
                          {translations[m.id]}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                      🗑️ mensagem apagada para ambos usuários com total segurança
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{m.viewed_at ? `Visualizada às ${dayjs(m.viewed_at).format("HH:mm")}` : "Entregue"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #eee", padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="Escreva uma mensagem secreta…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey ? (e.preventDefault(), sendText()) : null}
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 10, padding: "10px 12px" }}
        />
        <input id="file-input" type="file" multiple onChange={(e) => setFiles(e.target.files)} />
        <button onClick={uploadAndSend} style={{ borderRadius: 10, padding: "10px 14px", border: "1px solid #ddd", background: "#fff", color: "#111", cursor: "pointer" }}>Enviar arquivos</button>
        <button onClick={sendText} style={{ borderRadius: 10, padding: "10px 14px", border: 0, background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Enviar</button>
      </div>
    </div>
  );
}

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}