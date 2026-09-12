/**
 * =============================================================================
 * useEntitlement.ts
 * Hook de gating: verifica disponibilidade de uma feature (check_feature),
 * permite consumir (consume_feature) e refresca saldos. Usado pelos PayWalls.
 * =============================================================================
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkFeature,
  consumeFeature,
  fetchEntitlements,
  type Entitlements,
  type FeatureCheck,
} from "@/services/monetization";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useEntitlement(slug: string | null) {
  const [status, setStatus] = useState<FeatureCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const refreshEntitlements = useCallback(async () => {
    try {
      const ent = await fetchEntitlements();
      setEntitlements(ent);
    } catch {
      /* silencioso: saldos não são críticos */
    }
  }, []);

  const refreshStatus = useCallback(
    async (force = false) => {
      if (!slug) return;
      if (!force && requested.current) return;
      requested.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await checkFeature(slug);
        setStatus(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao verificar recurso");
        setStatus({ ok: false, reason: "feature_not_found" });
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    requested.current = false;
    setStatus(null);
    setLoading(true);
    setEntitlements(null);
    if (!slug) return;
    (async () => {
      try {
        const res = await checkFeature(slug);
        setStatus(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao verificar recurso");
        setStatus({ ok: false, reason: "feature_not_found" });
      } finally {
        setLoading(false);
      }
      await refreshEntitlements();
    })();
    return () => {
      requested.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /** Consome a feature (débito) e atualiza status + saldos. Rejeita se não ok. */
  const consume = useCallback(async (): Promise<FeatureCheck> => {
    if (!slug) throw new Error("no_slug");
    const res = await consumeFeature(slug, newRequestId());
    if (!res.ok) throw new Error(res.reason);
    await refreshStatus(true);
    await refreshEntitlements();
    return res;
  }, [slug, refreshStatus, refreshEntitlements]);

  return {
    available: status?.ok === true,
    status,
    loading,
    error,
    entitlements,
    consume,
    refresh: () => {
      refreshStatus(true);
      refreshEntitlements();
    },
  };
}