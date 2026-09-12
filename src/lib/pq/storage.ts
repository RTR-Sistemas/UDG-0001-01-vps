/**
 * =============================================================================
 * File: src/lib/pq/storage.ts
 * Purpose: Acesso a localStorage tolerante a falhas, isolado por conta.
 *
 * Por que não usar `@/utils/safeStorage`: aquele módulo toca `window` no topo
 * do arquivo, o que quebra os testes em ambiente Node e o service worker.
 * Aqui o acesso é preguiçoso e cai para memória quando o navegador bloqueia
 * storage (modo privado, prevenção de rastreamento, iframe sem permissão).
 *
 * IMPORTANTE — isolamento por conta: TODA chave é sufixada com o id do
 * usuário. Dois logins na mesma origem (o mesmo notebook usado por duas
 * pessoas) nunca compartilham identidade nem sessões.
 * =============================================================================
 */

const memoryFallback = new Map<string, string>();

function nativeStorage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    if (!s) return null;
    // Alguns navegadores só lançam no primeiro uso real, não no acesso.
    const probe = "__udg_pq_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function storageGet(key: string): string | null {
  const s = nativeStorage();
  if (s) {
    try {
      return s.getItem(key);
    } catch {
      /* cai para memória */
    }
  }
  return memoryFallback.has(key) ? (memoryFallback.get(key) as string) : null;
}

export function storageSet(key: string, value: string): void {
  const s = nativeStorage();
  if (s) {
    try {
      s.setItem(key, value);
      return;
    } catch {
      /* cota estourada ou storage bloqueado: cai para memória */
    }
  }
  memoryFallback.set(key, value);
}

export function storageRemove(key: string): void {
  const s = nativeStorage();
  if (s) {
    try {
      s.removeItem(key);
    } catch {
      /* ignora */
    }
  }
  memoryFallback.delete(key);
}

// -----------------------------------------------------------------------------
// SECTION: Nomes de chave (versionados — bump = invalidação limpa)
// -----------------------------------------------------------------------------

export const IDENTITY_KEY_PREFIX = "udg_pq_identity_v1_";
export const SESSIONS_KEY_PREFIX = "udg_pq_sessions_v1_";

export const identityKeyFor = (userId: string) => IDENTITY_KEY_PREFIX + userId;
export const sessionsKeyFor = (userId: string) => SESSIONS_KEY_PREFIX + userId;

/** Rejeita ids vazios/estranhos antes que virem chave de storage. */
export function assertUserId(userId: string, where: string): string {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error(`pq/${where}: userId obrigatório`);
  }
  return userId;
}
