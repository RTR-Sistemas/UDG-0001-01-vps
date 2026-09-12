/**
 * =============================================================================
 * File: src/components/MessageBubble.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React, { useMemo, useState, useEffect } from "react";
import { useCountdown } from "../hooks/useCountdown";
import { detectLanguage } from "../lib/detectLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedTranslation, type TextCorrectionResult } from "@/hooks/useUnifiedTranslation";
import "../styles/chat.css";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  updated_at: string;
  viewed_at: string | null;
  expires_at: string | null;
  is_deleted: boolean;
};

type Props = {
  msg: Message;
  me: string;
  myLang: string;
};

export const MessageBubble: React.FC<Props> = ({ msg, me, myLang }) => {
  const isMine = msg.user_id === me;
  const { totalSec, label } = useCountdown(msg.expires_at);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [textCorrection, setTextCorrection] = useState<TextCorrectionResult | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);

  const { correctText, isCorrectingText } = useUnifiedTranslation();

  const det = useMemo(() => (msg.content ? detectLanguage(msg.content) : null), [msg.content]);
  const showTimer = Boolean(msg.viewed_at && msg.expires_at && !msg.is_deleted);
  const expired = msg.is_deleted || (showTimer && totalSec === 0);

  async function handleTranslate() {
    if (!msg.content) return;
    setTranslating(true);
    try {
      // Usa Netlify Function /translate (Google Translate unofficial + MyMemory fallback)
      const r = await fetch("/.netlify/functions/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, sourceLang: det?.iso2 || "auto", targetLang: myLang || "pt", type: "translate" })
      });
      const data = await r.json();
      if (data.success && data.data?.translatedText) {
        setTranslated(data.data.translatedText);
      } else {
        setTranslated(msg.content); // fallback para original
      }
    } finally {
      setTranslating(false);
    }
  }

  async function handleCorrectText() {
    if (!msg.content) return;
    setShowCorrection(true);
    try {
      const result = await correctText(msg.content);
      if (result) {
        setTextCorrection(result);
      }
    } finally {
      setShowCorrection(false);
    }
  }

  const applyCorrection = () => {
    if (!textCorrection) return;
    setTranslated(textCorrection.correctedText);
    setTextCorrection(null);
  };

  useEffect(() => {
    const markViewed = async () => {
      if (isMine || msg.viewed_at) return;
      await supabase.from("messages").update({ viewed_at: new Date().toISOString() }).eq("id", msg.id);
    };
    markViewed();
  }, [msg.id, msg.viewed_at, isMine]);

  if (expired) {
    return (
      <div className={`bubble ${isMine ? "mine" : "theirs"} vanish`}>
        <div className="deleted-text">Mensagem apagada para ambos usuários com total segurança.</div>
      </div>
    );
  }

  return (
    <div className={`bubble ${isMine ? "mine" : "theirs"}`}>
      {msg.content && (
        <div className="text">
          {textCorrection && textCorrection.hasErrors && textCorrection.correctedText !== msg.content && (
            <div className="correction-banner mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  Correção sugerida ({textCorrection.issuesCount} {textCorrection.issuesCount === 1 ? 'problema' : 'problemas'})
                </span>
                <div className="flex gap-1">
                  <button className="btn-ghost btn-xs" onClick={applyCorrection}>Aplicar</button>
                  <button className="btn-ghost btn-xs" onClick={() => setTextCorrection(null)}>Ignorar</button>
                </div>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{textCorrection.correctedText}</p>
            </div>
          )}
          {translated ? (
            <>
              <div className="translated">{translated}</div>
              <div className="original small">Original: {msg.content}</div>
            </>
          ) : (
            <>{msg.content}</>
          )}
        </div>
      )}

      {msg.media_urls?.length ? (
        <div className="media-grid">
          {msg.media_urls.map((u, i) => (
            <a href={u} target="_blank" rel="noreferrer" key={i} className="media-item">Abrir arquivo</a>
          ))}
        </div>
      ) : null}

      <div className="meta">
        <div className="left">
          {det?.name && (
            <span className="lang-tag">Idioma: {det.name}{det.iso2 ? ` (${det.iso2})` : ""}</span>
          )}
          {det?.iso2 && det.iso2 !== (myLang || "pt") && msg.content && (
            <button className="btn translate" onClick={handleTranslate} disabled={translating}>
              {translating ? "Traduzindo..." : "Traduzir"}
            </button>
          )}
          {msg.content && !translated && (
            <button className="btn translate" onClick={handleCorrectText} disabled={isCorrectingText || showCorrection}>
              {isCorrectingText || showCorrection ? "Verificando..." : "Corrigir"}
            </button>
          )}
        </div>
        <div className="right">
          {showTimer && (
            <span className="timer" title="Mensagem será apagada ao zerar">
              <span className="clock"/> {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
