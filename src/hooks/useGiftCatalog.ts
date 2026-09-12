/**
 * =============================================================================
 * File: src/hooks/useGiftCatalog.ts
 * Purpose: Hook que carrega o catálogo de presentes com cache em memória.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { fetchGiftCatalog, type GiftCatalogItem } from "@/services/battleService";

let cachedCatalog: GiftCatalogItem[] | null = null;

export function useGiftCatalog() {
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>(cachedCatalog ?? []);
  const [loading, setLoading] = useState(cachedCatalog === null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    if (cachedCatalog) {
      setCatalog(cachedCatalog);
      setLoading(false);
      return;
    }
    fetchGiftCatalog()
      .then((items) => {
        cachedCatalog = items;
        if (active) {
          setCatalog(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useGiftCatalog] falha ao carregar catálogo:", err);
        if (active) {
          setError(err as Error);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { catalog, loading, error };
}