/**
 * =============================================================================
 * File: src/lib/pq/crypto.ts
 * Purpose: Primitivas criptográficas pós-quânticas da UndoinG.
 *
 * Suíte (todos padronizados pelo NIST em 2024):
 *   - KEM ............ ML-KEM-768   (FIPS 203, ex-Kyber-768)   — nível 3
 *   - Assinatura ..... ML-DSA-65    (FIPS 204, ex-Dilithium-3) — nível 3
 *   - AEAD ........... AES-256-GCM  (FIPS 197 / SP 800-38D)
 *   - KDF ............ HKDF-SHA-256 (RFC 5869)
 *
 * Implementação: @noble/post-quantum, @noble/ciphers, @noble/hashes.
 * São bibliotecas auditadas, em JS puro, sem dependências nativas — rodam
 * igual no navegador, no Capacitor (Android) e no Node (testes/SSR).
 *
 * Regras deste arquivo:
 *   - Nenhuma função aqui faz I/O, rede ou acesso a storage. Só bytes.
 *   - Toda função é SÍNCRONA (WebCrypto é assíncrona; noble não é). Isso
 *     mantém o caminho de cifragem previsível dentro do React.
 *   - Nada de `any` silencioso: entradas inválidas lançam erro, nunca
 *     devolvem "vazio" — devolver vazio foi exatamente o bug que
 *     transformou este módulo em texto puro no passado.
 * =============================================================================
 */

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { gcm } from "@noble/ciphers/aes.js";
import { extract, expand } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandomBytes } from "@noble/hashes/utils.js";

// -----------------------------------------------------------------------------
// SECTION: Constantes da suíte
// -----------------------------------------------------------------------------

/** Identificador da suíte gravado em cada envelope. Muda se algum algoritmo mudar. */
export const PQ_SUITE = "MLKEM768-MLDSA65-AES256GCM-HKDFSHA256" as const;

export const PQ_LENGTHS = {
  kemPublicKey: 1184,
  kemSecretKey: 2400,
  kemCipherText: 1088,
  kemSharedSecret: 32,
  kemSeed: 64,
  dsaPublicKey: 1952,
  dsaSecretKey: 4032,
  dsaSignature: 3309,
  dsaSeed: 32,
  aeadKey: 32,
  aeadNonce: 12,
  aeadTag: 16,
} as const;

export type KeyPair = { publicKey: Uint8Array; privateKey: Uint8Array };

// -----------------------------------------------------------------------------
// SECTION: Utilitários de bytes
// -----------------------------------------------------------------------------

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

export function utf8ToBytes(text: string): Uint8Array {
  return TEXT_ENCODER.encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return TEXT_DECODER.decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error("pq/crypto: randomBytes exige um inteiro não-negativo");
  }
  return nobleRandomBytes(length);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Comparação em tempo constante. Usada em qualquer verificação de igualdade
 * que envolva material secreto ou público-mas-autenticado (fingerprints,
 * chaves declaradas vs. chaves do bundle). `a.length !== b.length` vaza só o
 * tamanho, que já é público em todos os nossos usos.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Zera um buffer sensível assim que ele deixa de ser necessário. */
export function wipe(bytes: Uint8Array | null | undefined): void {
  if (bytes && bytes.length) bytes.fill(0);
}

// -----------------------------------------------------------------------------
// SECTION: base64url (RFC 4648 §5, sem padding)
// -----------------------------------------------------------------------------

const B64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const B64URL_LOOKUP: Int16Array = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64URL_ALPHABET.length; i++) {
    table[B64URL_ALPHABET.charCodeAt(i)] = i;
  }
  // Aceita também o alfabeto base64 padrão na leitura (tolerância de entrada).
  table["+".charCodeAt(0)] = 62;
  table["/".charCodeAt(0)] = 63;
  return table;
})();

/**
 * Implementação própria em vez de `btoa`/`Buffer`: `btoa` não existe em todos
 * os runtimes (workers antigos, Node sem globals) e `Buffer` não existe no
 * navegador. Esta versão é isomórfica e não aloca strings intermediárias.
 */
export function toB64url(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("pq/crypto: toB64url exige Uint8Array");
  }
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64URL_ALPHABET[(n >>> 18) & 63] +
      B64URL_ALPHABET[(n >>> 12) & 63] +
      B64URL_ALPHABET[(n >>> 6) & 63] +
      B64URL_ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64URL_ALPHABET[(n >>> 18) & 63] + B64URL_ALPHABET[(n >>> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64URL_ALPHABET[(n >>> 18) & 63] +
      B64URL_ALPHABET[(n >>> 12) & 63] +
      B64URL_ALPHABET[(n >>> 6) & 63];
  }
  return out;
}

export function fromB64url(text: string): Uint8Array {
  if (typeof text !== "string") {
    throw new Error("pq/crypto: fromB64url exige string");
  }
  // Remove padding e espaços; o resto tem que ser alfabeto válido.
  let clean = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "=" || c === "\n" || c === "\r" || c === " ") continue;
    if (B64URL_LOOKUP[text.charCodeAt(i)] < 0) {
      throw new Error("pq/crypto: base64url inválido");
    }
    clean += c;
  }
  const len = clean.length;
  if (len % 4 === 1) throw new Error("pq/crypto: base64url de tamanho impossível");

  const outLength = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLength);
  let outIndex = 0;
  let acc = 0;
  let accBits = 0;
  for (let i = 0; i < len; i++) {
    acc = (acc << 6) | B64URL_LOOKUP[clean.charCodeAt(i)];
    accBits += 6;
    if (accBits >= 8) {
      accBits -= 8;
      out[outIndex++] = (acc >>> accBits) & 0xff;
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// SECTION: HKDF-SHA-256 (RFC 5869)
// -----------------------------------------------------------------------------

export function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  return extract(sha256, ikm, salt);
}

export function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0 || length > 8160) {
    throw new Error("pq/crypto: comprimento HKDF inválido");
  }
  return expand(sha256, prk, info, length);
}

/** Atalho extract+expand para quando não há necessidade de reaproveitar o PRK. */
export function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Uint8Array {
  return hkdfExpand(hkdfExtract(salt, ikm), info, length);
}

// -----------------------------------------------------------------------------
// SECTION: AEAD — AES-256-GCM
// -----------------------------------------------------------------------------

function assertAeadParams(key: Uint8Array, nonce: Uint8Array) {
  if (key.length !== PQ_LENGTHS.aeadKey) {
    throw new Error(`pq/crypto: chave AEAD deve ter ${PQ_LENGTHS.aeadKey} bytes`);
  }
  if (nonce.length !== PQ_LENGTHS.aeadNonce) {
    throw new Error(`pq/crypto: nonce AEAD deve ter ${PQ_LENGTHS.aeadNonce} bytes`);
  }
}

/**
 * Cifra `plaintext` com AES-256-GCM. O tag de 16 bytes vai anexado ao final do
 * texto cifrado (formato padrão do noble e do WebCrypto).
 *
 * `aad` (dados autenticados mas não cifrados) amarra o texto cifrado ao seu
 * contexto — sessão, contador e remetente. Sem isso, um atacante poderia
 * mover um envelope válido para outra conversa.
 */
export function aeadEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array
): Uint8Array {
  assertAeadParams(key, nonce);
  return gcm(key, nonce, aad).encrypt(plaintext);
}

/** Decifra e verifica o tag. Lança se o texto cifrado ou o AAD foram adulterados. */
export function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array
): Uint8Array {
  assertAeadParams(key, nonce);
  if (ciphertext.length < PQ_LENGTHS.aeadTag) {
    throw new Error("pq/crypto: texto cifrado menor que o tag GCM");
  }
  return gcm(key, nonce, aad).decrypt(ciphertext);
}

// -----------------------------------------------------------------------------
// SECTION: KEM — ML-KEM-768 (FIPS 203)
// -----------------------------------------------------------------------------

/**
 * Gera um par de chaves ML-KEM-768. Passando `seed` (64 bytes) a geração é
 * determinística — é assim que a identidade é reconstruída a partir do que
 * está guardado no dispositivo, sem precisar persistir 2400 bytes de chave
 * privada.
 */
export function kemKeygen(seed?: Uint8Array): KeyPair {
  if (seed && seed.length !== PQ_LENGTHS.kemSeed) {
    throw new Error(`pq/crypto: seed ML-KEM deve ter ${PQ_LENGTHS.kemSeed} bytes`);
  }
  const kp = seed ? ml_kem768.keygen(seed) : ml_kem768.keygen();
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export function kemEncapsulate(publicKey: Uint8Array): {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
} {
  if (publicKey.length !== PQ_LENGTHS.kemPublicKey) {
    throw new Error(
      `pq/crypto: chave pública ML-KEM deve ter ${PQ_LENGTHS.kemPublicKey} bytes (recebido ${publicKey.length})`
    );
  }
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
  return { ciphertext: cipherText, sharedSecret };
}

export function kemDecapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Uint8Array {
  if (ciphertext.length !== PQ_LENGTHS.kemCipherText) {
    throw new Error(
      `pq/crypto: ciphertext ML-KEM deve ter ${PQ_LENGTHS.kemCipherText} bytes (recebido ${ciphertext.length})`
    );
  }
  if (privateKey.length !== PQ_LENGTHS.kemSecretKey) {
    throw new Error(`pq/crypto: chave privada ML-KEM deve ter ${PQ_LENGTHS.kemSecretKey} bytes`);
  }
  return ml_kem768.decapsulate(ciphertext, privateKey);
}

// -----------------------------------------------------------------------------
// SECTION: Assinatura — ML-DSA-65 (FIPS 204)
// -----------------------------------------------------------------------------

export function dsaKeygen(seed?: Uint8Array): KeyPair {
  if (seed && seed.length !== PQ_LENGTHS.dsaSeed) {
    throw new Error(`pq/crypto: seed ML-DSA deve ter ${PQ_LENGTHS.dsaSeed} bytes`);
  }
  const kp = seed ? ml_dsa65.keygen(seed) : ml_dsa65.keygen();
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export function dsaSign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== PQ_LENGTHS.dsaSecretKey) {
    throw new Error(`pq/crypto: chave privada ML-DSA deve ter ${PQ_LENGTHS.dsaSecretKey} bytes`);
  }
  return ml_dsa65.sign(message, privateKey);
}

/**
 * Verifica uma assinatura ML-DSA-65.
 *
 * Devolve `false` — nunca lança — para qualquer entrada malformada. Quem chama
 * SEMPRE trata `false` como falha fatal; devolver booleano evita que um
 * envelope corrompido derrube o render de uma conversa inteira.
 */
export function dsaVerify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    if (signature.length !== PQ_LENGTHS.dsaSignature) return false;
    if (publicKey.length !== PQ_LENGTHS.dsaPublicKey) return false;
    return ml_dsa65.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// SECTION: Fingerprint legível por humanos
// -----------------------------------------------------------------------------

/**
 * Impressão digital curta de uma chave pública, para verificação fora de banda
 * ("leia os 8 blocos em voz alta e confira se batem"). SHA-256 truncado em 160
 * bits, em grupos de 4 hex — mesmo padrão de UX do Signal/WhatsApp.
 */
export function fingerprint(publicKey: Uint8Array): string {
  const digest = sha256(publicKey);
  const hex = Array.from(digest.slice(0, 20))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return (hex.match(/.{4}/g) || []).join(" ").toUpperCase();
}
