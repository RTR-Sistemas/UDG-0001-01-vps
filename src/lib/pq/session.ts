/**
 * =============================================================================
 * File: src/lib/pq/session.ts
 * Purpose: Protocolo E2EE pos-quantico da UndoinG.
 *
 * ─── Formato do envelope ────────────────────────────────────────────────────
 *   "pq1." + JSON
 *
 * O prefixo `pq1.` e o mesmo que a funcao `relay_mesh_messages()` do Postgres
 * exige para transportar mensagens: o gateway carrega o texto cifrado sem
 * nunca conseguir ler.
 *
 * ─── v2: CADA MENSAGEM E AUTOSSUFICIENTE ────────────────────────────────────
 *
 * A versao 1 estabelecia uma sessao na primeira mensagem e as seguintes
 * reaproveitavam a raiz guardada. Economizava bytes e QUEBROU EM PRODUCAO: a
 * legibilidade de centenas de mensagens passava a depender da sobrevivencia
 * de uma unica. Bastava a mensagem de abertura ser apagada, expirar (este
 * aplicativo tem mensagens temporarias) ou ter sido enviada em outra conversa
 * — a sessao e por par de usuarios, nao por conversa — para tudo depois dela
 * virar lixo indecifravel. Foi exatamente o que aconteceu.
 *
 * Agora cada mensagem carrega o proprio material de chave:
 *
 *   1. Sorteia uma raiz R de 32 bytes (CSPRNG).
 *   2. Para CADA destinatario, e para o proprio remetente, encapsula com
 *      ML-KEM-768: (ct_i, ss_i) = Encap(pk_i).
 *   3. Deriva uma chave de embrulho de ss_i e cifra R com ela (KEM-DEM).
 *   4. Deriva a chave da mensagem de R e cifra o texto com AES-256-GCM.
 *   5. Assina o envelope inteiro com ML-DSA-65.
 *
 * Custa ~6 KB a mais por mensagem. Em troca:
 *   - apagar, expirar ou recriar conversa nao afeta mais nada;
 *   - chegada fora de ordem e irrelevante;
 *   - forward secrecy passa a ser POR MENSAGEM (antes era a cada 500 ou 7
 *     dias). Comprometer uma chave nao revela nem a anterior nem a seguinte.
 *
 * Envelopes da v1 continuam sendo lidos: se `r` nao vier no envelope, o
 * leitor cai para o armazenamento de sessoes antigo.
 *
 * ─── Por que NAO ha rejeicao de replay aqui ─────────────────────────────────
 * A mesma mensagem e decifrada muitas vezes (cada re-render da lista). Um
 * contador de "ja vi" quebraria a interface. Unicidade de mensagem e
 * responsabilidade da tabela `messages`. O que esta camada garante e que
 * ninguem FORJA nem MOVE um envelope: o AAD amarra sessao, contador e
 * remetente, e a assinatura ML-DSA cobre o envelope inteiro.
 * =============================================================================
 */

import {
  PQ_LENGTHS,
  PQ_SUITE,
  aeadDecrypt,
  aeadEncrypt,
  bytesToUtf8,
  constantTimeEqual,
  dsaSign,
  dsaVerify,
  fromB64url,
  hkdfExpand,
  hkdfExtract,
  kemDecapsulate,
  kemEncapsulate,
  randomBytes,
  toB64url,
  utf8ToBytes,
  wipe,
} from "./crypto";
import type { PqIdentity } from "./identity";
import { assertUserId, sessionsKeyFor, storageGet, storageRemove, storageSet } from "./storage";

// -----------------------------------------------------------------------------
// SECTION: Parametros do protocolo
// -----------------------------------------------------------------------------

/** Prefixo do formato na fiacao. Tambem validado pelo relay no Postgres. */
export const PQ_ENVELOPE_PREFIX = "pq1.";

/** Versao do envelope que este cliente PRODUZ. Ele LE a 1 e a 2. */
export const PQ_ENVELOPE_VERSION = 2;

/**
 * Mantidos por compatibilidade de API. Na v2 nao existe mais sessao de longa
 * duracao: cada mensagem e a sua propria sessao, entao o ratchet e imediato.
 */
export const PQ_SESSION_MAX_MSGS = 1;
export const PQ_SESSION_MAX_AGE_MS = 0;

/** Quantas sessoes LEGADAS (v1) guardar antes de podar as mais antigas. */
export const PQ_MAX_STORED_SESSIONS = 400;

const SID_BYTES = 16;
const ROOT_BYTES = 32;

const DOMAIN_MSG_KEY = "udg-pq/msg-key|";
const DOMAIN_WRAP = "udg-pq/wrap|";

// -----------------------------------------------------------------------------
// SECTION: Tipos do envelope
// -----------------------------------------------------------------------------

type RecipientEntry = {
  /** id do usuario destinatario */
  u: string;
  /** ciphertext ML-KEM (base64url) */
  c: string;
  /** raiz embrulhada com a chave derivada do segredo KEM (base64url) */
  w: string;
};

type Envelope = {
  /** 1 = sessao compartilhada (legado); 2 = autossuficiente */
  v: 1 | 2;
  a: string;
  /** id desta mensagem (base64url, 16 bytes) */
  s: string;
  /** contador. Na v2 e sempre 0. */
  n: number;
  t: number;
  /** id do remetente */
  f: string;
  /** chave publica ML-DSA do remetente */
  ik?: string;
  /** chave publica ML-KEM do remetente (so na v1) */
  kp?: string;
  /** destinatarios. Na v2, sempre presente. */
  r?: RecipientEntry[];
  iv: string;
  c: string;
  /** assinatura ML-DSA-65 sobre o envelope canonico sem este campo */
  g: string;
};

export type PqRecipient = { userId: string; kemPublicKey: Uint8Array };

// -----------------------------------------------------------------------------
// SECTION: Armazenamento legado (somente leitura de envelopes v1)
// -----------------------------------------------------------------------------

type StoredSession = { root: string; next: number; createdAt: number; scope?: string };
type SessionStore = { v: 1; sessions: Record<string, StoredSession>; outbound: Record<string, string> };

const emptyStore = (): SessionStore => ({ v: 1, sessions: {}, outbound: {} });
const storeCache = new Map<string, SessionStore>();

function loadStore(userId: string): SessionStore {
  const cached = storeCache.get(userId);
  if (cached) return cached;

  const raw = storageGet(sessionsKeyFor(userId));
  let store = emptyStore();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SessionStore;
      if (parsed && parsed.v === 1 && parsed.sessions) {
        store = { v: 1, sessions: parsed.sessions, outbound: parsed.outbound ?? {} };
      }
    } catch {
      console.warn("[pq] store de sessoes legado corrompido - ignorando");
    }
  }
  storeCache.set(userId, store);
  return store;
}

function saveStore(userId: string, store: SessionStore): void {
  const ids = Object.keys(store.sessions);
  if (ids.length > PQ_MAX_STORED_SESSIONS) {
    ids
      .sort((a, b) => (store.sessions[a].createdAt ?? 0) - (store.sessions[b].createdAt ?? 0))
      .slice(0, ids.length - PQ_MAX_STORED_SESSIONS)
      .forEach((sid) => delete store.sessions[sid]);
  }
  storeCache.set(userId, store);
  storageSet(sessionsKeyFor(userId), JSON.stringify(store));
}

export function clearSessions(userId?: string): void {
  if (userId) {
    storeCache.delete(userId);
    storageRemove(sessionsKeyFor(userId));
    return;
  }
  for (const id of Array.from(storeCache.keys())) storageRemove(sessionsKeyFor(id));
  storeCache.clear();
}

// -----------------------------------------------------------------------------
// SECTION: Chaves de identidade fixadas por peer (trust on first use)
// -----------------------------------------------------------------------------

/**
 * Toda vez que abrimos com sucesso uma mensagem de alguem, a chave de
 * identidade usada fica FIXADA para aquele peer.
 *
 * Serve para duas coisas opostas:
 *   - Rotacao legitima: a pessoa troca de aparelho e publica uma chave nova.
 *     As mensagens antigas dela continuam legiveis, porque a chave antiga
 *     esta fixada aqui.
 *   - Servidor malicioso: uma chave que NAO esta fixada e NAO e a publicada
 *     no perfil e recusada. Trocar a identidade de alguem continua sendo
 *     visivel (o codigo de seguranca muda).
 */
const PINS_KEY_PREFIX = "udg_pq_pins_v1_";
const pinsKeyFor = (userId: string) => PINS_KEY_PREFIX + userId;

type PinStore = Record<string, string[]>;
const pinsCache = new Map<string, PinStore>();
const PQ_MAX_PINS_PER_PEER = 5;

function loadPins(userId: string): PinStore {
  const cached = pinsCache.get(userId);
  if (cached) return cached;
  let pins: PinStore = {};
  const raw = storageGet(pinsKeyFor(userId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PinStore;
      if (parsed && typeof parsed === "object") pins = parsed;
    } catch {
      /* fixacoes corrompidas: recomeca vazio */
    }
  }
  pinsCache.set(userId, pins);
  return pins;
}

function isPinned(userId: string, peerId: string, ikB64: string): boolean {
  return (loadPins(userId)[peerId] ?? []).includes(ikB64);
}

function pin(userId: string, peerId: string, ikB64: string): void {
  if (!peerId || !ikB64) return;
  const pins = loadPins(userId);
  const list = pins[peerId] ?? [];
  if (list.includes(ikB64)) return;
  list.unshift(ikB64);
  pins[peerId] = list.slice(0, PQ_MAX_PINS_PER_PEER);
  pinsCache.set(userId, pins);
  storageSet(pinsKeyFor(userId), JSON.stringify(pins));
}

export function clearPins(userId?: string): void {
  if (userId) {
    pinsCache.delete(userId);
    storageRemove(pinsKeyFor(userId));
    return;
  }
  for (const id of Array.from(pinsCache.keys())) storageRemove(pinsKeyFor(id));
  pinsCache.clear();
}

// -----------------------------------------------------------------------------
// SECTION: Derivacao de chaves
// -----------------------------------------------------------------------------

function sessionPrk(sid: Uint8Array, root: Uint8Array): Uint8Array {
  return hkdfExtract(sid, root);
}

function messageKey(prk: Uint8Array, counter: number): Uint8Array {
  return hkdfExpand(prk, utf8ToBytes(DOMAIN_MSG_KEY + counter), PQ_LENGTHS.aeadKey);
}

function wrapKeyAndNonce(sharedSecret: Uint8Array, sid: Uint8Array, recipientId: string) {
  const prk = hkdfExtract(sid, sharedSecret);
  const material = hkdfExpand(
    prk,
    utf8ToBytes(DOMAIN_WRAP + recipientId),
    PQ_LENGTHS.aeadKey + PQ_LENGTHS.aeadNonce
  );
  return {
    key: material.slice(0, PQ_LENGTHS.aeadKey),
    nonce: material.slice(PQ_LENGTHS.aeadKey),
  };
}

/** Amarra o texto cifrado a mensagem, ao contador e ao remetente. */
function messageAad(sid: string, counter: number, senderId: string): Uint8Array {
  return utf8ToBytes(`${PQ_ENVELOPE_PREFIX}|${PQ_SUITE}|${sid}|${counter}|${senderId}`);
}

function wrapAad(sid: string, recipientId: string): Uint8Array {
  return utf8ToBytes(`${PQ_ENVELOPE_PREFIX}|wrap|${sid}|${recipientId}`);
}

// -----------------------------------------------------------------------------
// SECTION: Serializacao canonica e assinatura
// -----------------------------------------------------------------------------

/**
 * Bytes assinados. Um ARRAY (nao objeto) porque a ordem de um array e fixa
 * por definicao, enquanto a ordem das chaves de um objeto depende de como ele
 * foi construido - fonte classica de falha de verificacao de assinatura.
 */
function signingBytes(env: Omit<Envelope, "g">): Uint8Array {
  const recipients = (env.r ?? []).map((r) => [r.u, r.c, r.w]);
  return utf8ToBytes(
    JSON.stringify([
      env.v,
      env.a,
      env.s,
      env.n,
      env.t,
      env.f,
      env.ik ?? "",
      env.kp ?? "",
      recipients,
      env.iv,
      env.c,
    ])
  );
}

/**
 * O envelope vai como `pq1.` + JSON puro, NAO em base64: todos os campos
 * internos ja sao base64url, e embrulhar o JSON de novo inflaria 33% sem
 * esconder nada.
 */
function encodeEnvelope(env: Envelope): string {
  return PQ_ENVELOPE_PREFIX + JSON.stringify(env);
}

function decodeEnvelope(content: string): Envelope {
  if (!isEncryptedContent(content)) {
    throw new Error("pq/session: conteudo nao e um envelope pq1");
  }
  const env = JSON.parse(content.slice(PQ_ENVELOPE_PREFIX.length)) as Envelope;

  if (
    !env ||
    (env.v !== 1 && env.v !== 2) ||
    typeof env.a !== "string" ||
    typeof env.s !== "string" ||
    typeof env.n !== "number" ||
    !Number.isInteger(env.n) ||
    env.n < 0 ||
    typeof env.f !== "string" ||
    typeof env.iv !== "string" ||
    typeof env.c !== "string" ||
    typeof env.g !== "string"
  ) {
    throw new Error("pq/session: envelope malformado");
  }
  if (env.a !== PQ_SUITE) {
    throw new Error(`pq/session: suite nao suportada (${env.a})`);
  }
  return env;
}

/** Reconhece conteudo cifrado. Barato: roda em toda mensagem renderizada. */
export function isEncryptedContent(content: unknown): boolean {
  return (
    typeof content === "string" &&
    content.startsWith(PQ_ENVELOPE_PREFIX) &&
    content.length > PQ_ENVELOPE_PREFIX.length + 40
  );
}

// -----------------------------------------------------------------------------
// SECTION: Cifragem
// -----------------------------------------------------------------------------

/**
 * Cifra `plaintext` para um conjunto de destinatarios.
 *
 * O proprio remetente e SEMPRE incluido como destinatario (com a sua chave
 * ML-KEM local), para conseguir reler o que enviou.
 */
export function encryptForRecipients(
  plaintext: string,
  recipients: PqRecipient[],
  identity: PqIdentity,
  userId: string
): string {
  assertUserId(userId, "session");
  if (typeof plaintext !== "string") {
    throw new Error("pq/session: plaintext deve ser string");
  }

  const byId = new Map<string, Uint8Array>();
  for (const r of recipients) {
    if (!r || !r.userId || !(r.kemPublicKey instanceof Uint8Array)) continue;
    if (r.kemPublicKey.length !== PQ_LENGTHS.kemPublicKey) {
      throw new Error(`pq/session: chave ML-KEM invalida para ${r.userId}`);
    }
    byId.set(r.userId, r.kemPublicKey);
  }
  byId.set(userId, identity.kemKeyPair.publicKey);

  if (byId.size === 0) throw new Error("pq/session: nenhum destinatario valido");

  // Material novo a cada mensagem. Nada aqui depende de estado anterior -
  // e isso que torna a mensagem legivel por si so.
  const sid = toB64url(randomBytes(SID_BYTES));
  const sidBytes = fromB64url(sid);
  const root = randomBytes(ROOT_BYTES);
  const counter = 0;

  const prk = sessionPrk(sidBytes, root);
  const mk = messageKey(prk, counter);
  const iv = randomBytes(PQ_LENGTHS.aeadNonce);
  const ciphertext = aeadEncrypt(mk, iv, utf8ToBytes(plaintext), messageAad(sid, counter, userId));
  wipe(mk);

  const base: Omit<Envelope, "g"> = {
    v: 2,
    a: PQ_SUITE,
    s: sid,
    n: counter,
    t: Date.now(),
    f: userId,
    ik: toB64url(identity.sigKeyPair.publicKey),
    r: Array.from(byId.entries()).map(([recipientId, kemPub]) => {
      const { ciphertext: kemCt, sharedSecret } = kemEncapsulate(kemPub);
      const { key, nonce } = wrapKeyAndNonce(sharedSecret, sidBytes, recipientId);
      const wrapped = aeadEncrypt(key, nonce, root, wrapAad(sid, recipientId));
      wipe(sharedSecret);
      wipe(key);
      return { u: recipientId, c: toB64url(kemCt), w: toB64url(wrapped) };
    }),
    iv: toB64url(iv),
    c: toB64url(ciphertext),
  };

  const signature = dsaSign(signingBytes(base), identity.sigKeyPair.privateKey);
  const envelope: Envelope = { ...base, g: toB64url(signature) };

  wipe(root);
  return encodeEnvelope(envelope);
}

/** Atalho 1:1. */
export function encryptForPeer(
  plaintext: string,
  peerId: string,
  peerKemPublicKey: Uint8Array,
  identity: PqIdentity,
  userId: string
): string {
  return encryptForRecipients(
    plaintext,
    [{ userId: peerId, kemPublicKey: peerKemPublicKey }],
    identity,
    userId
  );
}

// -----------------------------------------------------------------------------
// SECTION: Decifragem
// -----------------------------------------------------------------------------

/**
 * Cache de textos ja decifrados. A lista re-renderiza varias vezes por segundo
 * durante o scroll; sem isto cada render refaria a verificacao ML-DSA.
 */
const plaintextCache = new Map<string, string>();
const PLAINTEXT_CACHE_MAX = 2000;

function cacheKeyFor(env: Envelope): string {
  return `${env.s}|${env.n}|${env.c.slice(0, 24)}|${env.c.length}`;
}

function rememberPlaintext(key: string, value: string): string {
  if (plaintextCache.size >= PLAINTEXT_CACHE_MAX) {
    const oldest = plaintextCache.keys().next().value as string | undefined;
    if (oldest !== undefined) plaintextCache.delete(oldest);
  }
  plaintextCache.set(key, value);
  return value;
}

export function clearPlaintextCache(): void {
  plaintextCache.clear();
}

function verifySignature(
  env: Envelope,
  expectedSigPub: Uint8Array | null,
  peerId: string,
  userId: string
): void {
  const { g, ...rest } = env;
  const signature = fromB64url(g);

  let sigPub: Uint8Array | null = expectedSigPub;

  if (env.ik) {
    const embedded = fromB64url(env.ik);

    if (expectedSigPub && expectedSigPub.length > 0 && !constantTimeEqual(embedded, expectedSigPub)) {
      // A identidade do envelope difere da publicada. Duas explicacoes:
      // (a) a pessoa trocou de aparelho depois de mandar esta mensagem -
      //     legitimo, e a chave antiga esta fixada aqui de quando a lemos;
      // (b) alguem esta se passando por ela - a chave nunca foi vista.
      if (!isPinned(userId, peerId, env.ik)) {
        throw new Error(
          "pq/session: identidade do remetente nao confere com o bundle publicado"
        );
      }
    }
    sigPub = embedded;
  }

  if (!sigPub || sigPub.length !== PQ_LENGTHS.dsaPublicKey) {
    throw new Error("pq/session: sem chave de verificacao para o remetente");
  }
  if (!dsaVerify(signature, signingBytes(rest), sigPub)) {
    throw new Error("pq/session: assinatura ML-DSA invalida");
  }

  // So fixa depois de a assinatura fechar: nunca fixamos uma chave forjada.
  if (env.ik && peerId) pin(userId, peerId, env.ik);
}

/**
 * Recupera a raiz da mensagem.
 *
 * Caminho normal (v2): abrir o embrulho enderecado a esta conta.
 * Caminho legado (v1 sem `r`): a raiz vinha de uma sessao guardada.
 */
function resolveRoot(env: Envelope, identity: PqIdentity, userId: string): Uint8Array {
  const entries = (env.r ?? []).filter((r) => r && r.u === userId);

  for (const entry of entries) {
    try {
      const sidBytes = fromB64url(env.s);
      const sharedSecret = kemDecapsulate(fromB64url(entry.c), identity.kemKeyPair.privateKey);
      const { key, nonce } = wrapKeyAndNonce(sharedSecret, sidBytes, userId);
      const root = aeadDecrypt(key, nonce, fromB64url(entry.w), wrapAad(env.s, userId));
      wipe(sharedSecret);
      wipe(key);
      if (root.length === ROOT_BYTES) return root;
    } catch {
      // ML-KEM rejeita implicitamente: uma chave privada errada devolve um
      // segredo qualquer e o AEAD falha. Tenta a proxima entrada.
    }
  }

  // Envelope da v1: a raiz estava na sessao guardada localmente.
  const known = loadStore(userId).sessions[env.s];
  if (known) return fromB64url(known.root);

  if (entries.length > 0) {
    throw new Error(
      "pq/session: a copia enderecada a esta conta nao abriu - as chaves deste dispositivo mudaram desde o envio"
    );
  }
  throw new Error(
    "pq/session: mensagem do formato antigo cuja mensagem de abertura nao esta mais disponivel"
  );
}

function openEnvelope(
  env: Envelope,
  identity: PqIdentity,
  userId: string,
  expectedSigPub: Uint8Array | null,
  peerId: string
): string {
  verifySignature(env, expectedSigPub, peerId, userId);

  const root = resolveRoot(env, identity, userId);
  const prk = sessionPrk(fromB64url(env.s), root);
  const mk = messageKey(prk, env.n);

  try {
    return bytesToUtf8(
      aeadDecrypt(mk, fromB64url(env.iv), fromB64url(env.c), messageAad(env.s, env.n, env.f))
    );
  } finally {
    wipe(mk);
    wipe(root);
  }
}

/**
 * Decifra uma mensagem recebida.
 *
 * @param expectedSigPub chave ML-DSA do remetente vinda do bundle verificado.
 *   `null` e aceitavel quando o envelope traz a identidade embutida - a
 *   confianca fica limitada ao TOFU, com fixacao a partir da primeira leitura.
 */
export function decryptFromPeer(
  content: string,
  peerId: string,
  identity: PqIdentity,
  expectedSigPub: Uint8Array | null,
  userId: string
): string {
  assertUserId(userId, "session");
  const env = decodeEnvelope(content);
  const cacheKey = cacheKeyFor(env);
  const hit = plaintextCache.get(cacheKey);
  if (hit !== undefined) return hit;

  const sender = peerId || env.f;
  return rememberPlaintext(
    cacheKey,
    openEnvelope(env, identity, userId, expectedSigPub ?? null, sender)
  );
}

/**
 * Decifra uma mensagem que ESTA conta enviou. A verificacao e feita contra a
 * propria chave publica: se falhar, o envelope nao saiu daqui.
 */
export function decryptOwn(
  content: string,
  _peerId: string,
  identity: PqIdentity,
  userId: string
): string {
  assertUserId(userId, "session");
  const env = decodeEnvelope(content);
  const cacheKey = cacheKeyFor(env);
  const hit = plaintextCache.get(cacheKey);
  if (hit !== undefined) return hit;

  return rememberPlaintext(
    cacheKey,
    openEnvelope(env, identity, userId, identity.sigKeyPair.publicKey, userId)
  );
}

// -----------------------------------------------------------------------------
// SECTION: Introspeccao (usada pela UI de seguranca)
// -----------------------------------------------------------------------------

export function sessionStats(userId: string): {
  sessions: number;
  outbound: number;
  oldestAt: number | null;
} {
  const store = loadStore(userId);
  const ids = Object.keys(store.sessions);
  const oldest = ids.reduce<number | null>((acc, sid) => {
    const at = store.sessions[sid].createdAt ?? 0;
    return acc === null || at < acc ? at : acc;
  }, null);
  return { sessions: ids.length, outbound: Object.keys(store.outbound).length, oldestAt: oldest };
}

/** Exposto para diagnostico: quantas identidades temos fixadas por peer. */
export function pinnedPeerCount(userId: string): number {
  return Object.keys(loadPins(userId)).length;
}

/** Mantido por compatibilidade: a v2 nao grava sessoes novas. */
export { saveStore as __saveLegacySessionStore };
