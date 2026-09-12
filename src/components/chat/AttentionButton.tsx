/**
 * =============================================================================
 * File: src/components/chat/AttentionButton.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import * as React from "react";
import { sendAttentionCall, attentionErrorMessage } from "@/services/attentionCalls";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  receiverId: string;
  className?: string;
  label?: React.ReactNode;
  title?: string;
  onSuccess?: (id: string) => void;
  onError?: (message: string) => void;
};

export default function AttentionButton({
  receiverId,
  className,
  label = "Chamar Atenção",
  title,
  onSuccess,
  onError,
}: Props) {
  const [loading, setLoading] = React.useState(false);

  const handleClick = React.useCallback(async () => {
    if (!receiverId) {
      onError?.("Destinatário não informado.");
      return;
    }
    setLoading(true);
    try {
      const id = await sendAttentionCall(receiverId);

      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente
      // via INSERT na tabela attention_calls. Não chamar sendPushEvent aqui.

      onSuccess?.(id);
    } catch (e) {
      onError?.(attentionErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [receiverId, onSuccess, onError]);

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      title={typeof title === "string" ? title : "Chamar Atenção"}
    >
      {loading ? "Enviando..." : label}
    </button>
  );
}
