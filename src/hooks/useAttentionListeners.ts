/**
 * =============================================================================
 * File: src/hooks/useAttentionListeners.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import * as React from "react";
import { startAttentionListenersAutoAck } from "@/services/attentionCalls";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type AttentionCall = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  created_at: string;
};

export function useAttentionListeners(
  currentUserId: string | null | undefined,
  onCall: (call: AttentionCall) => void
) {
  React.useEffect(() => {
    let stop: null | (() => void) = null;
    (async () => {
      if (!currentUserId) return;
      stop = await startAttentionListenersAutoAck(currentUserId, onCall);
    })();
    return () => {
      if (stop) stop();
      stop = null;
    };
  }, [currentUserId, onCall]);
}
