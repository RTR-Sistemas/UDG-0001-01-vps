/**
 * =============================================================================
 * File: src/hooks/useAuth.tsx
 * Purpose: Estado de autenticação compartilhado por toda a aplicação.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - 2026-08-27: o hook virou uma INSTÂNCIA ÚNICA (module singleton).
 *    Antes, cada componente que chamava useAuth() criava o seu próprio
 *    listener de auth, o seu próprio canal realtime `profile_session_*` e a
 *    sua própria consulta a `profiles`. Com 25 componentes usando o hook, isso
 *    abria ~25 canais por página e repetia o aviso
 *    "[Sessão] Detectado login em outro dispositivo" uma vez por componente.
 *    Agora existe um único motor de autenticação e os componentes apenas se
 *    inscrevem nele. A API pública (`{ user, session, loading, signOut }`) e
 *    todo o comportamento continuam exatamente iguais.
 * =============================================================================
 */

import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

function getLocalSessionId(): string {
  let sid = localStorage.getItem("local_device_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("local_device_session_id", sid);
  }
  return sid;
}

async function generateFriendCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("generate_friend_code");
  if (error || !data) {
    console.error("Erro ao gerar codigo UDG:", error);
    return null;
  }
  return data;
}

function normalizeUsername(username: string | null | undefined, email: string | null | undefined, id: string) {
  const fallback = email?.split("@")[0] || `user_${id.slice(0, 8)}`;
  return (username || fallback).trim() || fallback;
}

// -----------------------------------------------------------------------------
// SECTION: Store compartilhado (uma instância para toda a aplicação)
// -----------------------------------------------------------------------------

export interface AuthSnapshot {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

/**
 * O snapshot é um objeto imutável. A identidade só muda quando algum valor
 * muda de verdade — requisito do useSyncExternalStore (senão o React
 * re-renderiza em laço infinito).
 */
let snapshot: AuthSnapshot = { user: null, session: null, loading: true };

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try { l(); } catch { /* um listener com defeito não derruba os outros */ }
  });
}

function setAuthState(next: Partial<AuthSnapshot>) {
  const merged: AuthSnapshot = { ...snapshot, ...next };
  if (
    merged.user === snapshot.user &&
    merged.session === snapshot.session &&
    merged.loading === snapshot.loading
  ) {
    return; // nada mudou: não notifica (evita render desnecessário)
  }
  snapshot = merged;
  emit();
}

function getSnapshot(): AuthSnapshot {
  return snapshot;
}

// -----------------------------------------------------------------------------
// SECTION: Motor de autenticação (roda uma única vez)
// -----------------------------------------------------------------------------

let engineStarted = false;
let authSubscription: { unsubscribe: () => void } | null = null;

let lastEnsuredUserId: string | null = null;
let ensuringPromise: Promise<void> | null = null;

function hydrateFromDemoStorage() {
  const storedDemo = localStorage.getItem("local_demo_user");
  if (storedDemo) {
    try {
      const demoUser = JSON.parse(storedDemo);
      setAuthState({ user: demoUser, session: { user: demoUser, access_token: "demo-token" } as any });
      return true;
    } catch {
      setAuthState({ user: null, session: null });
      return false;
    }
  }
  setAuthState({ user: null, session: null });
  return false;
}

const _ensureProfileForSession = async (
  session: Session | null,
  opts: { claimSession?: boolean } = {}
) => {
  const u = session?.user;
  if (!u?.id) return;
  if (u.id.startsWith("demo-")) return;
  const claimSession = opts.claimSession !== false;

  // Evitar chamadas repetidas
  if (!claimSession && lastEnsuredUserId === u.id) return;
  if (lastEnsuredUserId === u.id) return;
  lastEnsuredUserId = u.id;

  const meta: any = u.user_metadata || {};
  const username = normalizeUsername(meta.username, u.email, u.id);
  const full_name = meta.full_name || null;
  const birth_date = meta.birth_date || null;
  const birth_date_public = meta.birth_date_public === true || meta.birth_date_public === "true";

  try {
    // Busca perfil, incluindo friend_code e active_session_id
    const { data: existing, error: selErr } = await supabase
      .from("profiles")
      .select("id, username, full_name, friend_code, birth_date, birth_date_public, active_session_id")
      .eq("id", u.id)
      .maybeSingle();

    // Se der erro de select, não quebra login
    if (selErr) {
      console.error("Erro ao buscar perfil do usuario:", selErr);
      return;
    }

    if (!existing) {
      // Cria perfil (best-effort, depende de RLS). Inclui friend_code para cobrir bancos
      // onde o trigger handle_new_user ainda nao esteja atualizado/ativo.
      const friendCode = await generateFriendCode();
      const payload: any = {
        id: u.id,
        username,
        full_name,
        birth_date,
        birth_date_public,
        active_session_id: getLocalSessionId(),
      };
      if (friendCode) payload.friend_code = friendCode;

      const { error: insertErr } = await supabase.from("profiles").insert(payload);
      if (insertErr) {
        console.error("Erro ao criar perfil do usuario:", insertErr);
      }
      return;
    }

    // Atualiza apenas campos vazios (não sobrescreve o que já existe)
    const patch: any = {};
    if (!existing.username && username) patch.username = username;
    if (!existing.full_name && full_name) patch.full_name = full_name;
    if (!existing.birth_date && birth_date) patch.birth_date = birth_date;
    if (existing.birth_date_public === null || existing.birth_date_public === undefined) {
      patch.birth_date_public = birth_date_public;
    }
    if (claimSession && existing.active_session_id !== getLocalSessionId()) {
      patch.active_session_id = getLocalSessionId();
    }

    // Correção principal: perfis antigos/criados sem trigger podem ficar sem friend_code.
    // Gera e salva automaticamente o codigo UDG no primeiro login em que ele estiver ausente.
    if (!existing.friend_code) {
      const friendCode = await generateFriendCode();
      if (friendCode) patch.friend_code = friendCode;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase.from("profiles").update(patch).eq("id", u.id);
      if (updateErr) {
        console.error("Erro ao atualizar perfil do usuario:", updateErr);
      }
    }
  } catch (error) {
    console.error("Falha ao garantir perfil do usuario:", error);
  }
};

// Semáforo: evita que onAuthStateChange e getSession chamem _ensureProfileForSession
// ao mesmo tempo (race condition), o que geraria dois INSERTs simultâneos no perfil.
const ensureProfileForSession = (
  session: Session | null,
  opts: { claimSession?: boolean } = {}
): Promise<void> => {
  if (ensuringPromise) return ensuringPromise;
  const promise = _ensureProfileForSession(session, opts).finally(() => {
    ensuringPromise = null;
  });
  ensuringPromise = promise;
  return promise;
};

// ── Vigia de sessão única (um canal realtime para toda a aplicação) ──────────
let watchedUserId: string | null = null;
let sessionChannel: ReturnType<typeof supabase.channel> | null = null;
let forcedSignOutDone = false;

function stopSessionWatch() {
  if (sessionChannel) {
    supabase.removeChannel(sessionChannel);
    sessionChannel = null;
  }
  watchedUserId = null;
}

function startSessionWatch(userId: string) {
  if (watchedUserId === userId && sessionChannel) return; // já vigiando este usuário
  stopSessionWatch();

  if (userId.startsWith("demo-") || import.meta.env.VITE_SUPABASE_URL?.includes("dummy")) return;

  watchedUserId = userId;
  forcedSignOutDone = false;

  const forceSignOut = (reason: string) => {
    if (forcedSignOutDone) return;
    forcedSignOutDone = true;
    console.warn("[Sessão] Detectado login em outro dispositivo — mantendo sessão local (auto-desconexão desativada).");
    try {
      window.dispatchEvent(new CustomEvent("udg_forced_signout", { detail: { reason } }));
    } catch {}
    // Auto signOut desativado para evitar loop de desconexão entre abas/dispositivos.
    // Se quiser forçar sessão única, reative: supabase.auth.signOut();
  };

  // Tópico único por criação: o supabase-js REUTILIZA canais com o mesmo nome.
  // Se reutilizar um canal já inscrito, o .on('postgres_changes') lança
  // "cannot add ... after subscribe()".
  sessionChannel = supabase
    .channel(`profile_session_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const newSessionId = (payload.new as any)?.active_session_id;
        if (newSessionId && newSessionId !== getLocalSessionId()) {
          forceSignOut("realtime");
        }
      }
    )
    .subscribe();

  // Verificação inicial, para o caso de ter mudado enquanto o app estava offline
  supabase
    .from("profiles")
    .select("active_session_id")
    .eq("id", userId)
    .maybeSingle()
    .then(({ data }) => {
      if (watchedUserId !== userId) return; // trocou de usuário no meio do caminho
      if (data && data.active_session_id && data.active_session_id !== getLocalSessionId()) {
        forceSignOut("initial-check");
      }
    });
}

/** Mantém o vigia de sessão alinhado com o usuário atual do store. */
function syncSessionWatch() {
  const id = snapshot.user?.id ?? null;
  if (!id) {
    stopSessionWatch();
    return;
  }
  startSessionWatch(id);
}

function startAuthEngine() {
  if (engineStarted) return;
  engineStarted = true;

  // ─── DEMO / OFFLINE MODE ────────────────────────────────────────────
  // When running with a dummy Supabase URL, skip all network auth calls
  // and hydrate state from localStorage only.
  if (import.meta.env.VITE_SUPABASE_URL?.includes("dummy")) {
    hydrateFromDemoStorage();
    setAuthState({ loading: false });
    return;
  }

  // ─── NORMAL MODE (real Supabase) ────────────────────────────────────
  // Sessão única: só reivindica a sessão em LOGIN explícito (SIGNED_IN),
  // nunca em TOKEN_REFRESHED / INITIAL_SESSION — isso eliminava o ping-pong
  // de desconexão entre abas/dispositivos do mesmo usuário.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setAuthState({ session, user: session?.user ?? null, loading: false });
    syncSessionWatch();
    if (event === "SIGNED_IN") {
      lastEnsuredUserId = null; // permite re-ensure e claim da sessão
      ensureProfileForSession(session);
    }
  });
  authSubscription = subscription;

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setAuthState({ session, user: session.user, loading: false });
      syncSessionWatch();
      // Não sobrescreve active_session_id aqui — apenas garante campos básicos
      ensureProfileForSession(session, { claimSession: false });
    } else {
      // Fallback for Demo / Offline Mode
      hydrateFromDemoStorage();
      setAuthState({ loading: false });
      syncSessionWatch();
    }
  }).catch(() => {
    // Fallback on network/auth fetch error
    const storedDemo = localStorage.getItem("local_demo_user");
    if (storedDemo) {
      try {
        const demoUser = JSON.parse(storedDemo);
        setAuthState({ user: demoUser, session: { user: demoUser, access_token: "demo-token" } as any });
      } catch {}
    }
    setAuthState({ loading: false });
    syncSessionWatch();
  });
}

/**
 * Encerra o motor. Não é usado pela aplicação (o estado de auth vive enquanto a
 * página existir), mas deixa o singleton testável e evita vazamento em testes.
 */
export function __resetAuthEngineForTests() {
  authSubscription?.unsubscribe();
  authSubscription = null;
  stopSessionWatch();
  listeners.clear();
  engineStarted = false;
  lastEnsuredUserId = null;
  ensuringPromise = null;
  forcedSignOutDone = false;
  snapshot = { user: null, session: null, loading: true };
}

function subscribe(listener: () => void) {
  startAuthEngine(); // idempotente: só o primeiro componente liga o motor
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // O motor NÃO é desligado quando o último componente desmonta: a sessão
    // precisa continuar viva durante a navegação entre telas.
  };
}

const signOut = async () => {
  // 🔐 Sai o que é volátil (textos já decifrados em memória, caches de rede).
  // A identidade deste aparelho FICA: apagá-la a cada logout gerava um par de
  // chaves novo no login seguinte, e aí o histórico da própria pessoa virava
  // "mensagem que este dispositivo não consegue abrir". Quem quiser apagar de
  // verdade tem o botão "Esquecer as chaves deste aparelho" em Segurança.
  const leavingUserId = snapshot.user?.id ?? null;
  try {
    const { pqSignOutCleanup } = await import("@/lib/pq");
    pqSignOutCleanup(leavingUserId ?? undefined);
  } catch (err) {
    console.warn("[pq] não foi possível limpar os caches criptográficos:", err);
  }

  localStorage.removeItem("local_demo_user");
  await supabase.auth.signOut();
  stopSessionWatch();
  lastEnsuredUserId = null;
  setAuthState({ user: null, session: null });
};

// -----------------------------------------------------------------------------
// SECTION: Hook público (API idêntica à versão anterior)
// -----------------------------------------------------------------------------

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { user: state.user, session: state.session, loading: state.loading, signOut };
}
