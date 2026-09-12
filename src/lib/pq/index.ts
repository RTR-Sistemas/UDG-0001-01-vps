/**
 * =============================================================================
 * File: src/lib/pq/index.ts
 * Purpose: API pública do subsistema pós-quântico da UndoinG.
 *
 * É esta a única superfície que o resto do aplicativo deve importar. Ela
 * esconde storage, cache de bundles, ratchet e formato de envelope, e — este é
 * o ponto central — nunca lança para dentro da interface: quem chama recebe
 * `null` (não deu para cifrar) ou o texto de erro padrão (não deu para
 * decifrar). Uma conversa nunca fica em branco por causa de um envelope ruim.
 *
 * ─── Política de degradação ─────────────────────────────────────────────────
 * Se o destinatário ainda não publicou chaves PQ válidas, `pqTryEncryptText`
 * devolve `null` e o chamador decide. Hoje o chat envia em texto puro nesse
 * caso (compatibilidade com contas antigas). Colocar `VITE_PQ_STRICT=true`
 * transforma isso em falha dura: nada sai sem criptografia.
 * =============================================================================
 */

import {
  PQ_LENGTHS,
  PQ_SUITE,
  fingerprint,
  fromB64url,
} from "./crypto";
import {
  clearIdentityData,
  clearPeerCache,
  clearPublishState,
  ensureIdentity,
  fetchPeerBundle,
  fetchPeerBundles,
  hasIdentity,
  identityFingerprint,
  peerFingerprint,
  peerSupportsPQ,
  publishIdentity,
  resetIdentityCaches,
  selfBinding,
  verifyKemBinding,
  PQ_PEER_TTL_MS,
} from "./identity";
import type { PqIdentity, PqPeerBundle, PqRawBundle } from "./identity";
import {
  PQ_ENVELOPE_PREFIX,
  PQ_SESSION_MAX_AGE_MS,
  PQ_SESSION_MAX_MSGS,
  clearPins,
  clearPlaintextCache,
  clearSessions,
  decryptFromPeer,
  decryptOwn,
  encryptForPeer,
  encryptForRecipients,
  isEncryptedContent,
  sessionStats,
  PQ_ENVELOPE_VERSION,
} from "./session";
import type { PqRecipient } from "./session";

// -----------------------------------------------------------------------------
// SECTION: Reexports
// -----------------------------------------------------------------------------

export type { PqIdentity, PqPeerBundle, PqRawBundle, PqRecipient };
export {
  PQ_SUITE,
  PQ_LENGTHS,
  PQ_ENVELOPE_PREFIX,
  PQ_SESSION_MAX_MSGS,
  PQ_SESSION_MAX_AGE_MS,
  PQ_ENVELOPE_VERSION,
  PQ_PEER_TTL_MS,
  ensureIdentity,
  hasIdentity,
  identityFingerprint,
  peerFingerprint,
  peerSupportsPQ,
  verifyKemBinding,
  fetchPeerBundle,
  fetchPeerBundles,
  resetIdentityCaches,
  isEncryptedContent,
  encryptForPeer,
  encryptForRecipients,
  decryptFromPeer,
  decryptOwn,
  sessionStats,
  fingerprint,
};

/** Texto exibido quando um envelope não pode ser aberto neste dispositivo. */
export const PQ_DECRYPT_ERROR_TEXT =
  "🔒 Mensagem cifrada antes de as chaves deste aparelho mudarem — não é possível abri-la aqui";

/** Modo estrito: nada é enviado em texto puro. Ligado por variável de ambiente. */
export const PQ_STRICT_MODE: boolean =
  String(
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PQ_STRICT ?? ""
  ).toLowerCase() === "true";

// -----------------------------------------------------------------------------
// SECTION: Ciclo de vida da identidade
// -----------------------------------------------------------------------------

/**
 * Garante que a conta tem identidade PQ neste dispositivo e que as chaves
 * públicas dela estão publicadas. Chamar no login e em qualquer tela que vá
 * cifrar. É idempotente e barata depois da primeira vez.
 */
export async function pqEnsureIdentityPublished(userId: string): Promise<PqIdentity> {
  const identity = ensureIdentity(userId);
  await publishIdentity(userId, identity);
  return identity;
}

/**
 * Limpeza de LOGOUT.
 *
 * Guarda a identidade deste dispositivo de propósito. Apagá-la a cada logout
 * gerava um par de chaves novo no login seguinte — e, como os contatos ainda
 * tinham a chave antiga em cache, tudo que chegasse na janela seguinte vinha
 * indecifrável, além de tornar ilegível a própria conversa anterior. Sair da
 * conta não pode custar o histórico.
 *
 * O que sai daqui é só o que é volátil: textos já decifrados em memória e
 * caches de rede.
 */
export function pqSignOutCleanup(userId?: string): void {
  clearPeerCache();
  clearPlaintextCache();
  if (userId) clearPublishState(userId);
}

/**
 * Apagamento DEFINITIVO do material desta conta neste dispositivo.
 *
 * Destrói a chave privada: as conversas cifradas passadas deixam de ser
 * legíveis aqui, para sempre. Só deve ser chamada quando a pessoa pede
 * explicitamente ("esquecer as chaves deste aparelho").
 */
export function clearUserPqData(userId: string): void {
  clearIdentityData(userId);
  clearSessions(userId);
  clearPins(userId);
  clearPeerCache();
  clearPublishState(userId);
  clearPlaintextCache();
}

/** Impressão digital do peer a partir de um bundle cru (para a UI). */
export function pqPeerFingerprint(mldsaPubB64: string | null | undefined): string {
  return peerFingerprint(mldsaPubB64);
}

// -----------------------------------------------------------------------------
// SECTION: Cifragem de mensagens
// -----------------------------------------------------------------------------

/**
 * Tenta cifrar um texto para um peer 1:1.
 *
 * @returns o envelope `pq1.…`, ou `null` quando o peer não tem chaves PQ
 *          válidas publicadas (aí cabe ao chamador decidir o que fazer).
 */
export async function pqTryEncryptText(
  plaintext: string,
  peerId: string,
  identity: PqIdentity,
  userId: string
): Promise<string | null> {
  if (!plaintext || !peerId || !userId) return null;
  try {
    const bundle = await fetchPeerBundle(peerId);
    if (!bundle) {
      if (PQ_STRICT_MODE) {
        throw new Error(`pq: destinatário ${peerId} sem chaves pós-quânticas (modo estrito)`);
      }
      return null;
    }
    return encryptForPeer(plaintext, peerId, bundle.kemPublicKey, identity, userId);
  } catch (err) {
    if (PQ_STRICT_MODE) throw err;
    console.warn("[pq] falha ao cifrar — enviando sem PQ:", err);
    return null;
  }
}

/**
 * Versão para grupos: cifra para todos os membros que já publicaram chaves.
 *
 * @returns `null` se ALGUM membro estiver sem chaves. Cifrar só para parte do
 *          grupo daria a falsa impressão de conversa protegida enquanto uma
 *          pessoa continuaria recebendo nada — pior que assumir texto puro.
 */
export async function pqTryEncryptForGroup(
  plaintext: string,
  memberIds: string[],
  identity: PqIdentity,
  userId: string
): Promise<string | null> {
  const others = Array.from(new Set(memberIds)).filter((id) => id && id !== userId);
  if (!plaintext || others.length === 0) return null;

  try {
    const bundles = await fetchPeerBundles(others);
    const missing = others.filter((id) => !bundles.has(id));
    if (missing.length > 0) {
      if (PQ_STRICT_MODE) {
        throw new Error(`pq: ${missing.length} membro(s) do grupo sem chaves pós-quânticas`);
      }
      return null;
    }
    const recipients: PqRecipient[] = others.map((id) => ({
      userId: id,
      kemPublicKey: (bundles.get(id) as PqPeerBundle).kemPublicKey,
    }));
    return encryptForRecipients(plaintext, recipients, identity, userId);
  } catch (err) {
    if (PQ_STRICT_MODE) throw err;
    console.warn("[pq] falha ao cifrar para o grupo — enviando sem PQ:", err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// SECTION: Decifragem de mensagens
// -----------------------------------------------------------------------------

/**
 * Decifra o conteúdo de uma mensagem vinda do banco.
 *
 * Conteúdo que não for envelope volta intacto — as conversas antigas em texto
 * puro continuam legíveis. Envelope que não abre vira `PQ_DECRYPT_ERROR_TEXT`,
 * nunca uma exceção que quebre o render.
 */
export async function pqDecryptMessageContent(
  content: string,
  peerId: string,
  isOwn: boolean,
  identity: PqIdentity,
  userId: string
): Promise<string> {
  if (!isEncryptedContent(content)) return content;

  try {
    if (isOwn) {
      return decryptOwn(content, peerId, identity, userId);
    }
    // Chave de verificação vem do bundle publicado — nunca só do envelope.
    const bundle = peerId ? await fetchPeerBundle(peerId) : null;
    return decryptFromPeer(content, peerId, identity, bundle?.sigPublicKey ?? null, userId);
  } catch (first) {
    // O bundle em cache pode estar velho (a pessoa acabou de trocar de
    // aparelho). Vale uma segunda tentativa com os dados frescos antes de
    // desistir; sem isso a conversa ficaria ilegível por até 10 minutos.
    if (!isOwn && peerId) {
      try {
        const fresh = await fetchPeerBundle(peerId, true);
        return decryptFromPeer(content, peerId, identity, fresh?.sigPublicKey ?? null, userId);
      } catch {
        /* cai no aviso abaixo */
      }
    }
    console.warn("[pq] não foi possível decifrar a mensagem:", first);
    return PQ_DECRYPT_ERROR_TEXT;
  }
}

/**
 * Decifra um lote de mensagens de uma vez, buscando cada bundle uma única vez.
 * É o caminho usado pela tela de conversa ao carregar o histórico.
 */
export async function pqDecryptBatch<T extends { content?: string | null; user_id?: string | null }>(
  rows: T[],
  identity: PqIdentity,
  userId: string
): Promise<T[]> {
  if (!rows || rows.length === 0) return rows;

  const senderIds = new Set<string>();
  for (const row of rows) {
    if (isEncryptedContent(row.content) && row.user_id && row.user_id !== userId) {
      senderIds.add(row.user_id);
    }
  }
  const bundles = senderIds.size > 0 ? await fetchPeerBundles(Array.from(senderIds)) : new Map();

  const out = rows.map((row) => {
    if (!isEncryptedContent(row.content)) return row;
    const isOwn = row.user_id === userId;
    try {
      const plaintext = isOwn
        ? decryptOwn(row.content as string, "", identity, userId)
        : decryptFromPeer(
            row.content as string,
            row.user_id as string,
            identity,
            (bundles.get(row.user_id as string) as PqPeerBundle | undefined)?.sigPublicKey ?? null,
            userId
          );
      return { ...row, content: plaintext };
    } catch {
      return { ...row, content: PQ_DECRYPT_ERROR_TEXT, __pqFailed: true } as T & {
        __pqFailed?: boolean;
      };
    }
  });

  // Se algo falhou, uma única recarga forçada dos bundles pode resolver
  // (o peer trocou de aparelho e o cache ficou velho). Uma tentativa só.
  const falharam = out.filter((r) => (r as { __pqFailed?: boolean }).__pqFailed);
  if (falharam.length === 0) return out;

  const idsParaRecarregar = Array.from(
    new Set(
      falharam
        .map((r) => (r as { user_id?: string | null }).user_id)
        .filter((id): id is string => !!id && id !== userId)
    )
  );
  if (idsParaRecarregar.length === 0) return out.map(stripFlag);

  for (const id of idsParaRecarregar) {
    try {
      await fetchPeerBundle(id, true);
    } catch {
      /* segue com o que der */
    }
  }

  return out.map((row, i) => {
    if (!(row as { __pqFailed?: boolean }).__pqFailed) return stripFlag(row);
    const original = rows[i];
    try {
      const plaintext = decryptFromPeer(
        original.content as string,
        original.user_id as string,
        identity,
        null,
        userId
      );
      return { ...original, content: plaintext };
    } catch (err) {
      console.warn("[pq] mensagem não decifrada no lote:", err);
      return stripFlag(row);
    }
  });
}

// -----------------------------------------------------------------------------
// SECTION: Diagnóstico para a UI de segurança
// -----------------------------------------------------------------------------

/** Remove a marca interna antes de devolver a linha para a interface. */
function stripFlag<T>(row: T): T {
  const { __pqFailed, ...rest } = row as T & { __pqFailed?: boolean };
  void __pqFailed;
  return rest as T;
}

export type PqStatus = {
  suite: string;
  hasIdentity: boolean;
  fingerprint: string;
  strict: boolean;
  sessions: number;
  keySizes: { kemPublicKey: number; dsaPublicKey: number; signature: number };
};

export function pqStatus(userId: string): PqStatus {
  const identity = ensureIdentity(userId);
  const stats = sessionStats(userId);
  return {
    suite: PQ_SUITE,
    hasIdentity: hasIdentity(userId),
    fingerprint: identityFingerprint(identity),
    strict: PQ_STRICT_MODE,
    sessions: stats.sessions,
    keySizes: {
      kemPublicKey: PQ_LENGTHS.kemPublicKey,
      dsaPublicKey: PQ_LENGTHS.dsaPublicKey,
      signature: PQ_LENGTHS.dsaSignature,
    },
  };
}

/** Exposto para a tela de verificação: a assinatura de binding da própria conta. */
export function pqSelfBinding(identity: PqIdentity): Uint8Array {
  return selfBinding(identity);
}

/** Conveniência: fingerprint a partir de bytes crus de chave pública. */
export function pqFingerprintFromB64(pubB64: string): string {
  try {
    return fingerprint(fromB64url(pubB64));
  } catch {
    return "—";
  }
}
