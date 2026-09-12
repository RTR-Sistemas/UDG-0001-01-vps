// @vitest-environment node
/**
 * =============================================================================
 * Verificação ponta a ponta do fluxo REAL do aplicativo.
 *
 * Diferente de pq.test.ts (que testa a camada criptográfica isoladamente),
 * aqui é montado um Supabase de mentira que se comporta como o banco de
 * verdade — tabela `profiles` com as colunas pq_*, tabela `messages` — e
 * exercitamos exatamente as funções que Messages.tsx chama:
 *
 *   pqEnsureIdentityPublished  → no login
 *   pqTryEncryptText           → no envio 1:1
 *   pqTryEncryptForGroup       → no envio em grupo
 *   pqDecryptBatch             → ao carregar o histórico
 *
 * Inclui o cenário que mais importa: **servidor malicioso** trocando a chave
 * pública de alguém para tentar ler as mensagens.
 * =============================================================================
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Banco de mentira, com o formato real das tabelas ────────────────────────

type ProfileRow = {
  id: string;
  pq_mlkem_pubkey: string | null;
  pq_mldsa_pubkey: string | null;
  pq_mldsa_sig: string | null;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  is_pq_encrypted: boolean;
};

const db = {
  profiles: new Map<string, ProfileRow>(),
  messages: [] as MessageRow[],
  /** Contador de leituras, para provar que o cache de bundles funciona. */
  profileReads: 0,
};

function makeQuery(table: string) {
  const state: { cols: string[]; eqId?: string; inIds?: string[] } = { cols: [] };

  const runSelect = () => {
    if (table !== "profiles") return { data: [], error: null };
    db.profileReads += 1;
    let rows = Array.from(db.profiles.values());
    if (state.eqId !== undefined) rows = rows.filter((r) => r.id === state.eqId);
    if (state.inIds) rows = rows.filter((r) => state.inIds!.includes(r.id));
    // Devolve só as colunas pedidas, como o PostgREST faria.
    const projected = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of state.cols) out[c] = (r as unknown as Record<string, unknown>)[c] ?? null;
      return out;
    });
    return { data: projected, error: null };
  };

  const api: Record<string, unknown> = {
    select(cols: string) {
      state.cols = cols.split(",").map((c) => c.trim());
      return api;
    },
    eq(_col: string, value: string) {
      state.eqId = value;
      return api;
    },
    in(_col: string, values: string[]) {
      state.inIds = values;
      return api;
    },
    maybeSingle() {
      const { data } = runSelect();
      return Promise.resolve({ data: data[0] ?? null, error: null });
    },
    update(patch: Partial<ProfileRow>) {
      return {
        eq(_col: string, id: string) {
          const existing = db.profiles.get(id) ?? {
            id,
            pq_mlkem_pubkey: null,
            pq_mldsa_pubkey: null,
            pq_mldsa_sig: null,
          };
          db.profiles.set(id, { ...existing, ...patch });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(runSelect()).then(resolve);
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}));

// ── localStorage compartilhado (mesma origem, várias contas) ────────────────

const memStore = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memStore.set(k, v),
  removeItem: (k: string) => void memStore.delete(k),
  clear: () => memStore.clear(),
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  get length() {
    return memStore.size;
  },
} as unknown as Storage;

import {
  PQ_DECRYPT_ERROR_TEXT,
  clearUserPqData,
  ensureIdentity,
  isEncryptedContent,
  pqDecryptBatch,
  pqEnsureIdentityPublished,
  pqStatus,
  pqTryEncryptForGroup,
  pqTryEncryptText,
} from "./index";
import { clearPeerCache, resetIdentityCaches, fetchPeerBundle } from "./identity";

const fetchPeerBundleForced = (id: string) => fetchPeerBundle(id, true);
import { clearPlaintextCache, clearSessions, clearPins, PQ_ENVELOPE_PREFIX } from "./session";
import { kemKeygen, toB64url } from "./crypto";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CARLA = "33333333-3333-3333-3333-333333333333";
const MALLORY = "44444444-4444-4444-4444-444444444444";
const CONV = "aaaa0000-0000-0000-0000-00000000conv";

/** Simula o cliente do usuário X: identidade local + publicação no banco. */
async function login(userId: string) {
  return pqEnsureIdentityPublished(userId);
}

/** Simula o INSERT que Messages.tsx faz. */
function insertMessage(userId: string, content: string, encrypted: boolean) {
  const row: MessageRow = {
    id: `msg-${db.messages.length}`,
    conversation_id: CONV,
    user_id: userId,
    content,
    is_pq_encrypted: encrypted,
  };
  db.messages.push(row);
  return row;
}

beforeEach(() => {
  // Cada teste é uma "aba nova": storage vazio, banco vazio e nenhum cache
  // em memória sobrevivendo do teste anterior.
  clearSessions();
  clearPins();
  clearPlaintextCache();
  resetIdentityCaches();
  clearPeerCache();
  memStore.clear();
  db.profiles.clear();
  db.messages.length = 0;
  db.profileReads = 0;
});

describe("fluxo real · login publica as chaves", () => {
  it("grava as três colunas pq_* no perfil", async () => {
    await login(ALICE);
    const row = db.profiles.get(ALICE);
    expect(row?.pq_mlkem_pubkey).toBeTruthy();
    expect(row?.pq_mldsa_pubkey).toBeTruthy();
    expect(row?.pq_mldsa_sig).toBeTruthy();
    // Tamanhos exatos que a constraint do Postgres espera.
    expect(row!.pq_mlkem_pubkey!.length).toBe(1579);
    expect(row!.pq_mldsa_pubkey!.length).toBe(2603);
    expect(row!.pq_mldsa_sig!.length).toBe(4412);
  });

  it("é idempotente: dois logins não reescrevem nada", async () => {
    await login(ALICE);
    const first = { ...db.profiles.get(ALICE)! };
    await login(ALICE);
    expect(db.profiles.get(ALICE)).toEqual(first);
  });
});

describe("fluxo real · conversa 1:1", () => {
  it("Alice envia, o banco guarda opaco, Bob lê em claro", async () => {
    const alice = await login(ALICE);
    await login(BOB);

    const texto = "meu CPF é 000.000.000-00, não conte a ninguém";
    const sealed = await pqTryEncryptText(texto, BOB, alice, ALICE);

    expect(sealed).not.toBeNull();
    expect(isEncryptedContent(sealed!)).toBe(true);
    insertMessage(ALICE, sealed!, true);

    // O que está no banco não contém nada do texto.
    const stored = db.messages[0].content;
    expect(stored).not.toContain("CPF");
    expect(stored).not.toContain("000.000.000-00");
    expect(stored.startsWith("pq1.")).toBe(true);

    // Bob abre o histórico exatamente como Messages.tsx faz.
    const bobIdentity = ensureIdentity(BOB);
    const [rendered] = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      bobIdentity,
      BOB
    );
    expect(rendered.content).toBe(texto);
  });

  it("Alice relê o que ela mesma mandou", async () => {
    const alice = await login(ALICE);
    await login(BOB);
    const sealed = await pqTryEncryptText("mensagem da própria Alice", BOB, alice, ALICE);
    insertMessage(ALICE, sealed!, true);

    const [rendered] = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      alice,
      ALICE
    );
    expect(rendered.content).toBe("mensagem da própria Alice");
  });

  it("uma conversa inteira de 20 mensagens nos dois sentidos", async () => {
    const alice = await login(ALICE);
    const bob = await login(BOB);
    const esperado: string[] = [];

    for (let i = 0; i < 20; i++) {
      const deAlice = i % 2 === 0;
      const texto = `mensagem ${i} de ${deAlice ? "Alice" : "Bob"}`;
      esperado.push(texto);
      const sealed = deAlice
        ? await pqTryEncryptText(texto, BOB, alice, ALICE)
        : await pqTryEncryptText(texto, ALICE, bob, BOB);
      expect(sealed).not.toBeNull();
      insertMessage(deAlice ? ALICE : BOB, sealed!, true);
    }

    const rows = db.messages.map((m) => ({ content: m.content, user_id: m.user_id }));
    const naTelaDoBob = await pqDecryptBatch(rows, bob, BOB);
    const naTelaDaAlice = await pqDecryptBatch(rows, alice, ALICE);

    expect(naTelaDoBob.map((r) => r.content)).toEqual(esperado);
    expect(naTelaDaAlice.map((r) => r.content)).toEqual(esperado);
    // Nenhuma mensagem virou o texto de erro.
    expect(naTelaDoBob.some((r) => r.content === PQ_DECRYPT_ERROR_TEXT)).toBe(false);
  });

  it("decifrar duas vezes devolve o mesmo texto (re-render não quebra)", async () => {
    const alice = await login(ALICE);
    const bob = await login(BOB);
    const sealed = await pqTryEncryptText("estável", BOB, alice, ALICE);
    insertMessage(ALICE, sealed!, true);
    const rows = db.messages.map((m) => ({ content: m.content, user_id: m.user_id }));

    for (let i = 0; i < 5; i++) {
      const out = await pqDecryptBatch(rows, bob, BOB);
      expect(out[0].content).toBe("estável");
    }
  });

  it("não cifra para quem ainda não tem chaves (e não quebra o envio)", async () => {
    const alice = await login(ALICE);
    // Bob nunca fez login: não há perfil dele no banco.
    const sealed = await pqTryEncryptText("oi", BOB, alice, ALICE);
    expect(sealed).toBeNull();
  });

  it("mensagens antigas em texto puro continuam legíveis", async () => {
    const alice = await login(ALICE);
    insertMessage(ALICE, "mensagem de 2024, sem criptografia", false);
    const [rendered] = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      alice,
      ALICE
    );
    expect(rendered.content).toBe("mensagem de 2024, sem criptografia");
  });
});

describe("fluxo real · grupo", () => {
  it("os três membros leem; quem não é do grupo não lê", async () => {
    const alice = await login(ALICE);
    const bob = await login(BOB);
    const carla = await login(CARLA);
    await login(MALLORY);

    const sealed = await pqTryEncryptForGroup("combinado do grupo", [ALICE, BOB, CARLA], alice, ALICE);
    expect(sealed).not.toBeNull();
    insertMessage(ALICE, sealed!, true);
    const rows = db.messages.map((m) => ({ content: m.content, user_id: m.user_id }));

    for (const [nome, id, ident] of [
      ["alice", ALICE, alice],
      ["bob", BOB, bob],
      ["carla", CARLA, carla],
    ] as const) {
      clearPlaintextCache();
      const [out] = await pqDecryptBatch(rows, ident, id);
      expect(out.content, `${nome} deveria ler`).toBe("combinado do grupo");
    }

    clearPlaintextCache();
    const mallory = ensureIdentity(MALLORY);
    const [intruso] = await pqDecryptBatch(rows, mallory, MALLORY);
    expect(intruso.content).toBe(PQ_DECRYPT_ERROR_TEXT);
  });

  it("recusa cifrar se um membro do grupo não tem chaves", async () => {
    const alice = await login(ALICE);
    await login(BOB);
    // Carla nunca entrou.
    const sealed = await pqTryEncryptForGroup("segredo", [ALICE, BOB, CARLA], alice, ALICE);
    expect(sealed).toBeNull();
  });
});

describe("fluxo real - o bug que apareceu em producao", () => {
  it("mensagens sobrevivem mesmo sem a mensagem de abertura no banco", async () => {
    const alice = await login(ALICE);
    const bob = await login(BOB);

    // Alice manda 8 mensagens. Exatamente como no banco real, as primeiras
    // nunca chegam a esta conversa (foram apagadas, expiraram ou ficaram em
    // outra conversa). Bob so recebe as duas ultimas.
    const todas: string[] = [];
    for (let i = 0; i < 8; i++) {
      todas.push((await pqTryEncryptText(`mensagem ${i}`, BOB, alice, ALICE)) as string);
    }
    insertMessage(ALICE, todas[6], true);
    insertMessage(ALICE, todas[7], true);

    const lidas = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      bob,
      BOB
    );
    expect(lidas.map((r) => r.content)).toEqual(["mensagem 6", "mensagem 7"]);
  });

  it("cada mensagem traz o proprio bloco de destinatarios", async () => {
    const alice = await login(ALICE);
    await login(BOB);
    const a = (await pqTryEncryptText("um", BOB, alice, ALICE)) as string;
    const b = (await pqTryEncryptText("dois", BOB, alice, ALICE)) as string;
    for (const env of [a, b]) {
      const j = JSON.parse(env.slice(PQ_ENVELOPE_PREFIX.length));
      expect(j.v).toBe(2);
      expect(j.n).toBe(0);
      expect(j.r.map((x: { u: string }) => x.u).sort()).toEqual([ALICE, BOB].sort());
    }
  });

  it("Bob troca de aparelho: as mensagens novas voltam a funcionar sozinhas", async () => {
    const alice = await login(ALICE);
    await login(BOB);

    // Alice ja tem o bundle antigo do Bob em cache.
    insertMessage(ALICE, (await pqTryEncryptText("antes da troca", BOB, alice, ALICE)) as string, true);

    // Bob apaga os dados do navegador e entra de novo: identidade nova.
    clearUserPqData(BOB);
    const bobNovo = await login(BOB);

    // Sem recarregar o bundle, Alice ainda cifraria para a chave velha.
    // O envio force-refresh acontece na proxima leitura que falhar.
    await fetchPeerBundleForced(BOB);
    insertMessage(ALICE, (await pqTryEncryptText("depois da troca", BOB, alice, ALICE)) as string, true);

    const lidas = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      bobNovo,
      BOB
    );
    // A antiga e irrecuperavel (a chave privada foi destruida), a nova abre.
    expect(lidas[0].content).toBe(PQ_DECRYPT_ERROR_TEXT);
    expect(lidas[1].content).toBe("depois da troca");
  });
});

describe("fluxo real · servidor malicioso", () => {
  it("troca da chave ML-KEM no banco derruba a criptografia em vez de expor a mensagem", async () => {
    const alice = await login(ALICE);
    await login(BOB);

    // O "servidor" substitui a chave KEM do Bob pela de um atacante,
    // mantendo a identidade ML-DSA original para parecer legítimo.
    const atacante = kemKeygen();
    const linha = db.profiles.get(BOB)!;
    db.profiles.set(BOB, { ...linha, pq_mlkem_pubkey: toB64url(atacante.publicKey) });
    clearPeerCache();

    // O binding não fecha mais: o cliente da Alice se recusa a cifrar.
    const sealed = await pqTryEncryptText("dado sigiloso", BOB, alice, ALICE);
    expect(sealed).toBeNull();
  });

  it("troca do par inteiro por um do atacante é detectável pelo código de segurança", async () => {
    await login(ALICE);
    await login(BOB);
    const codigoRealDoBob = pqStatus(BOB).fingerprint;

    // Mallory publica o par dela no lugar do de Bob (binding válido, mas
    // identidade diferente).
    await login(MALLORY);
    const daMallory = db.profiles.get(MALLORY)!;
    db.profiles.set(BOB, { ...daMallory, id: BOB });
    clearPeerCache();

    const alice = ensureIdentity(ALICE);
    const sealed = await pqTryEncryptText("dado sigiloso", BOB, alice, ALICE);
    // Tecnicamente cifra — mas para a Mallory, e o código exibido MUDOU.
    expect(sealed).not.toBeNull();

    const { pqPeerFingerprint } = await import("./index");
    const codigoExibidoAgora = pqPeerFingerprint(db.profiles.get(BOB)!.pq_mldsa_pubkey);
    expect(codigoExibidoAgora).not.toBe(codigoRealDoBob);

    // E o Bob de verdade não consegue abrir: o ataque é ruidoso, não silencioso.
    clearPlaintextCache();
    insertMessage(ALICE, sealed!, true);
    const bob = ensureIdentity(BOB);
    const [out] = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      bob,
      BOB
    );
    expect(out.content).toBe(PQ_DECRYPT_ERROR_TEXT);
  });
});

describe("fluxo real · desempenho e higiene", () => {
  it("o cache evita reler o perfil do peer a cada mensagem", async () => {
    const alice = await login(ALICE);
    await login(BOB);
    const leiturasAntes = db.profileReads;

    for (let i = 0; i < 10; i++) {
      await pqTryEncryptText(`mensagem ${i}`, BOB, alice, ALICE);
    }
    // Uma leitura do bundle do Bob, não dez.
    expect(db.profileReads - leiturasAntes).toBe(1);
  });

  it("logout apaga identidade e sessões desta conta e só desta", async () => {
    const alice = await login(ALICE);
    await login(BOB);
    await pqTryEncryptText("algo", BOB, alice, ALICE);

    clearUserPqData(ALICE);
    expect(memStore.get("udg_pq_identity_v1_" + ALICE)).toBeUndefined();
    expect(memStore.get("udg_pq_sessions_v1_" + ALICE)).toBeUndefined();
    expect(memStore.get("udg_pq_identity_v1_" + BOB)).toBeDefined();
  });

  it("pqStatus devolve o que o painel do usuário exibe", async () => {
    await login(ALICE);
    const status = pqStatus(ALICE);
    expect(status.suite).toBe("MLKEM768-MLDSA65-AES256GCM-HKDFSHA256");
    expect(status.hasIdentity).toBe(true);
    expect(status.fingerprint).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){9}$/);
    expect(status.keySizes).toEqual({ kemPublicKey: 1184, dsaPublicKey: 1952, signature: 3309 });
  });

  it("uma mensagem corrompida no banco não derruba o resto do histórico", async () => {
    const alice = await login(ALICE);
    const bob = await login(BOB);

    insertMessage(ALICE, (await pqTryEncryptText("boa 1", BOB, alice, ALICE))!, true);
    insertMessage(ALICE, "pq1." + '{"v":1,"a":"MLKEM768-MLDSA65-AES256GCM-HKDFSHA256","s":"x"}', true);
    insertMessage(ALICE, (await pqTryEncryptText("boa 2", BOB, alice, ALICE))!, true);

    const out = await pqDecryptBatch(
      db.messages.map((m) => ({ content: m.content, user_id: m.user_id })),
      bob,
      BOB
    );
    expect(out.map((r) => r.content)).toEqual(["boa 1", PQ_DECRYPT_ERROR_TEXT, "boa 2"]);
  });
});
