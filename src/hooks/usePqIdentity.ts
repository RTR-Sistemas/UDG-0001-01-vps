/**
 * =============================================================================
 * File: src/hooks/usePqIdentity.ts
 * Purpose: Disponibiliza a identidade pós-quântica da conta logada para a UI.
 *
 * A identidade em si é criada de forma síncrona (é só derivar as chaves das
 * seeds guardadas); o que é assíncrono é PUBLICAR as chaves públicas no
 * Supabase. O hook faz as duas coisas e expõe um estado simples:
 *
 *   ready     → dá para cifrar agora
 *   publishing→ ainda subindo as chaves públicas
 *   error     → não deu (o chat continua funcionando, sem PQ)
 *
 * Também limpa tudo quando o usuário sai ou troca de conta.
 * =============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  pqSignOutCleanup,
  ensureIdentity,
  identityFingerprint,
  pqEnsureIdentityPublished,
  type PqIdentity,
} from "@/lib/pq";

export type PqIdentityState = {
  identity: PqIdentity | null;
  fingerprint: string | null;
  ready: boolean;
  publishing: boolean;
  error: string | null;
};

export function usePqIdentity(): PqIdentityState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);

  // Identidade local: síncrona e memoizada por conta.
  const identity = useMemo<PqIdentity | null>(() => {
    if (!userId || userId.startsWith("demo-")) return null;
    try {
      return ensureIdentity(userId);
    } catch (err) {
      console.warn("[pq] não foi possível preparar a identidade local:", err);
      return null;
    }
  }, [userId]);

  // Troca de conta: o material da conta anterior não pode ficar para trás.
  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      try {
        // Só os caches. A identidade da conta anterior continua guardada sob
        // a chave dela — voltar para aquela conta tem que reabrir o histórico.
        pqSignOutCleanup(previous);
      } catch {
        /* não bloqueia a troca de conta */
      }
      setPublished(false);
    }
    previousUserId.current = userId;
  }, [userId]);

  // Publicação das chaves públicas.
  useEffect(() => {
    if (!userId || !identity || published) return;
    let cancelled = false;

    setPublishing(true);
    setError(null);
    pqEnsureIdentityPublished(userId)
      .then(() => {
        if (!cancelled) setPublished(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setPublishing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, identity, published]);

  const fingerprint = useMemo(
    () => (identity ? identityFingerprint(identity) : null),
    [identity]
  );

  return { identity, fingerprint, ready: !!identity && published, publishing, error };
}
