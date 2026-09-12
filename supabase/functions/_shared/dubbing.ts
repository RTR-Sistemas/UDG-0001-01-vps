/**
 * =============================================================================
 * File: supabase/functions/_shared/dubbing.ts
 * Purpose: Núcleo compartilhado do pipeline de dublagem de áudio do chat.
 *
 * Roda em Supabase Edge Functions (Deno) — funciona em QUALQUER hospedagem
 * (VPS Hostinger, Netlify, Vercel, APK), porque o front-end chama sempre
 * https://<projeto>.supabase.co/functions/v1/<funcao>.
 *
 * Pipeline:
 *   1. ASR      → transcreve o áudio (Whisper via Hugging Face)
 *   2. Traduzir → Google Translate (grátis) → MyMemory (fallback)
 *   3. TTS      → cascata de vozes, da melhor para a mais garantida:
 *        a) XTTS-v2  — clonagem da voz do usuário, ORÇAMENTO DE 3 SEGUNDOS
 *        b) Edresson / Coqui TTS-Portuguese — voz neural pt-BR própria
 *           (servidor configurável: VPS, Space do Hugging Face ou endpoint HTTP)
 *        c) ElevenLabs — só entra quando a chave tem permissão text_to_speech
 *        d) Amazon Polly via StreamElements — só com STREAMELEMENTS_JWT
 *        e) Google Translate TTS — último recurso, sempre disponível
 *
 * A ordem de (b) a (e) pode ser trocada sem novo deploy pela variável
 * `TTS_ORDER`. Provedor sem configuração é pulado na hora, custo zero.
 *
 * REGRA DE OURO (pedido do produto, 29/08/2026):
 *   "se a dublagem com a própria voz falhar após 3 segundos, faça a função com
 *    a outra voz."
 *   → A clonagem tem um DEADLINE DURO de 3s. E o provedor de retaguarda é
 *     disparado EM PARALELO com a clonagem, então esses 3 segundos NÃO são
 *     somados ao tempo total: quando o prazo estoura, a voz de retaguarda já
 *     está pronta (ou quase) e o usuário praticamente não espera nada a mais.
 * =============================================================================
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-application-name",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function preflight(): Response {
  return new Response("ok", { headers: CORS_HEADERS });
}

/** Lê uma variável de ambiente aceitando vários nomes (o primeiro que existir). */
export function env(...names: string[]): string {
  for (const name of names) {
    try {
      const value = Deno.env.get(name);
      if (value && value.trim()) return value.trim();
    } catch {
      /* Deno.env pode estar bloqueado em alguns runtimes */
    }
  }
  return "";
}

/** Token da Hugging Face, na ordem de preferência do projeto. */
export function getHfToken(): string {
  return env("HUGGINGFACE_TOKEN_DUBLAGEM", "HF_API_TOKEN", "HUGGINGFACE_TOKEN");
}

// ─────────────────────────────────────────────────────────────────────────────
// Idiomas
// ─────────────────────────────────────────────────────────────────────────────

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGE_INFO: Record<string, LanguageInfo> = {
  pt: { code: "pt", name: "Português", flag: "🇧🇷" },
  en: { code: "en", name: "Inglês", flag: "🇺🇸" },
  es: { code: "es", name: "Espanhol", flag: "🇪🇸" },
  fr: { code: "fr", name: "Francês", flag: "🇫🇷" },
  de: { code: "de", name: "Alemão", flag: "🇩🇪" },
  it: { code: "it", name: "Italiano", flag: "🇮🇹" },
  ru: { code: "ru", name: "Russo", flag: "🇷🇺" },
  ja: { code: "ja", name: "Japonês", flag: "🇯🇵" },
  zh: { code: "zh", name: "Chinês", flag: "🇨🇳" },
  ar: { code: "ar", name: "Árabe", flag: "🇸🇦" },
  hi: { code: "hi", name: "Hindi", flag: "🇮🇳" },
  ko: { code: "ko", name: "Coreano", flag: "🇰🇷" },
  nl: { code: "nl", name: "Holandês", flag: "🇳🇱" },
  tr: { code: "tr", name: "Turco", flag: "🇹🇷" },
  pl: { code: "pl", name: "Polonês", flag: "🇵🇱" },
};

// Whisper às vezes devolve o nome do idioma por extenso, em inglês.
const LANGUAGE_ALIASES: Record<string, string> = {
  portuguese: "pt",
  "portuguese (brazil)": "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  english: "en",
  "en-us": "en",
  "en-gb": "en",
  spanish: "es",
  "es-es": "es",
  french: "fr",
  german: "de",
  italian: "it",
  russian: "ru",
  japanese: "ja",
  chinese: "zh",
  "zh-cn": "zh",
  "zh-tw": "zh",
  arabic: "ar",
  hindi: "hi",
  korean: "ko",
  dutch: "nl",
  turkish: "tr",
  polish: "pl",
};

/** Normaliza qualquer código/nome de idioma para o código ISO de 2 letras. */
export function normalizeLang(raw?: string | null): string {
  if (!raw) return "unknown";
  const key = String(raw).toLowerCase().trim();
  if (LANGUAGE_ALIASES[key]) return LANGUAGE_ALIASES[key];
  if (LANGUAGE_INFO[key]) return key;
  const short = key.split(/[-_]/)[0];
  if (LANGUAGE_INFO[short]) return short;
  return short || "unknown";
}

export function getLanguageInfo(raw?: string | null): LanguageInfo {
  const code = normalizeLang(raw);
  return (
    LANGUAGE_INFO[code] || {
      code,
      name: code === "unknown" ? "Desconhecido" : code.toUpperCase(),
      flag: "🌐",
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Prazo máximo para uma promessa. Se estourar, devolve `null` — NUNCA lança.
 * É isto que garante o corte de 3 segundos da clonagem de voz.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timer: number | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms) as unknown as number;
  });
  try {
    return await Promise.race([promise.catch(() => null), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Conversão em blocos: evita "Maximum call stack size exceeded" em áudios grandes.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Aceita "data:audio/webm;base64,AAA" ou apenas "AAA". */
export function parseDataUri(input: string): { mimeType: string; base64: string } {
  let mimeType = "audio/webm";
  let base64 = input;
  const match = /^data:([^;,]+)(;base64)?,/.exec(input);
  if (match) {
    mimeType = match[1];
    base64 = input.slice(match[0].length);
  } else if (input.includes(",")) {
    base64 = input.split(",")[1];
  }
  return { mimeType, base64: base64.replace(/\s/g, "") };
}

/**
 * Resolve uma "amostra de voz" que pode chegar de três formas:
 *   • data URI  ("data:audio/webm;base64,…")  → usa direto
 *   • base64 puro                              → usa direto
 *   • URL pública (Cloudinary/Supabase Storage) → baixa e converte
 * Devolve `null` quando não dá para usar (nunca lança).
 */
export async function resolveVoiceSample(
  sample: string | undefined | null,
  timeoutMs = 8000,
): Promise<string | null> {
  const raw = (sample || "").trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetchWithTimeout(raw, {}, timeoutMs);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Amostra minúscula não serve de referência para clonagem.
      if (bytes.length < 2000) return null;
      return bytesToBase64(bytes);
    } catch {
      return null;
    }
  }

  const { base64 } = parseDataUri(raw);
  // ~2 KB de base64 ≈ 1,5 KB de áudio: abaixo disso o XTTS rejeita.
  return base64.length > 2000 ? base64 : null;
}

/** Quebra o texto em pedaços respeitando pontuação (para as APIs de TTS). */
export function chunkText(text: string, maxLen: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return [clean];

  const parts = clean.match(/[^.!?;\n]+[.!?;\n]*/g) || [clean];
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if ((current + part).length > maxLen && current) {
      chunks.push(current.trim());
      current = "";
    }
    if (part.length > maxLen) {
      // Frase gigante sem pontuação: quebra por palavras.
      for (const word of part.split(" ")) {
        if ((current + " " + word).length > maxLen && current) {
          chunks.push(current.trim());
          current = "";
        }
        current += (current ? " " : "") + word;
      }
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 1 — ASR (transcrição) via Whisper / Hugging Face
// ─────────────────────────────────────────────────────────────────────────────

export interface Transcription {
  text: string;
  language: string;
}

const WHISPER_MODELS = [
  "openai/whisper-large-v3-turbo",
  "openai/whisper-small",
];

async function callWhisper(
  model: string,
  audio: Uint8Array,
  mimeType: string,
  hfToken: string,
): Promise<Response> {
  return await fetchWithTimeout(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": mimeType,
      },
      body: audio,
    },
    20000,
  );
}

export async function transcribeAudio(
  audio: Uint8Array,
  mimeType: string,
  hfToken: string,
): Promise<Transcription> {
  let lastError = "";

  for (const model of WHISPER_MODELS) {
    try {
      const res = await callWhisper(model, audio, mimeType, hfToken);

      if (res.ok) {
        const data = await res.json();
        if (data?.text && String(data.text).trim()) {
          return {
            text: String(data.text).trim(),
            language: normalizeLang(data.language),
          };
        }
        lastError = `${model} → resposta sem texto`;
      } else {
        lastError = `${model} → HTTP ${res.status}`;
        // 503 = modelo "acordando". Uma única espera curta, para não travar o usuário.
        if (res.status === 503) {
          await new Promise((r) => setTimeout(r, 3000));
          const retry = await callWhisper(model, audio, mimeType, hfToken);
          if (retry.ok) {
            const data = await retry.json();
            if (data?.text && String(data.text).trim()) {
              return {
                text: String(data.text).trim(),
                language: normalizeLang(data.language),
              };
            }
          } else {
            lastError = `${model} → HTTP ${retry.status} (após retry)`;
          }
        }
      }
    } catch (e) {
      lastError = `${model} → ${(e as Error).message}`;
    }
  }

  throw new Error(`ASR_FAILED: nenhum modelo de transcrição respondeu (${lastError}).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 2 — Tradução
// ─────────────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  text: string;
  detectedLang: string;
  provider: string;
}

/** Google Translate (endpoint público gratuito, sem chave). */
async function googleTranslate(
  text: string,
  targetLang: string,
  sourceLang = "auto",
): Promise<TranslationResult | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx` +
      `&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}` +
      `&dt=t&q=${encodeURIComponent(text)}`;

    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; undoing-dub/3.0)" } },
      8000,
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

    const translated = (data[0] as unknown[])
      .map((p) => (Array.isArray(p) ? p[0] : ""))
      .filter((v) => typeof v === "string")
      .join("");

    if (!translated.trim()) return null;

    return {
      text: translated,
      detectedLang: normalizeLang(typeof data[2] === "string" ? data[2] : sourceLang),
      provider: "google",
    };
  } catch {
    return null;
  }
}

/** MyMemory — fallback. Exige um código de idioma de origem válido. */
async function myMemoryTranslate(
  text: string,
  targetLang: string,
  sourceLang: string,
): Promise<TranslationResult | null> {
  try {
    const source = sourceLang && sourceLang !== "unknown" && sourceLang !== "auto"
      ? sourceLang
      : "en";
    if (source === targetLang) return null;

    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}` +
      `&langpair=${encodeURIComponent(source)}|${encodeURIComponent(targetLang)}`;

    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;

    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (typeof translated !== "string" || !translated.trim()) return null;
    if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID)/i.test(translated)) return null;

    return { text: translated, detectedLang: source, provider: "mymemory" };
  } catch {
    return null;
  }
}

/**
 * Traduz o texto. Nunca "quebra" o pipeline por causa da tradução:
 * se o idioma de origem já for o de destino, devolve o texto original.
 */
export async function translateText(
  text: string,
  targetLang: string,
  knownSourceLang = "unknown",
): Promise<TranslationResult> {
  const source = normalizeLang(knownSourceLang);
  const target = normalizeLang(targetLang);

  // Mesmo idioma → não há o que traduzir.
  if (source !== "unknown" && source === target) {
    return { text, detectedLang: source, provider: "same-language" };
  }

  // Textos longos vão em pedaços, em paralelo.
  const chunks = chunkText(text, 1500);

  const google = await Promise.all(
    chunks.map((c) => googleTranslate(c, target, source === "unknown" ? "auto" : source)),
  );
  if (google.every((r) => r !== null)) {
    return {
      text: google.map((r) => r!.text).join(" "),
      detectedLang: google[0]!.detectedLang,
      provider: "google",
    };
  }

  const myMemory = await myMemoryTranslate(text, target, source);
  if (myMemory) return myMemory;

  // Última rede de segurança: devolve o original em vez de derrubar a dublagem.
  return { text, detectedLang: source, provider: "original" };
}

/** Detecta o idioma de um texto (usado quando o Whisper não informa). */
export async function detectLanguageFromText(text: string): Promise<string> {
  const result = await googleTranslate(text.slice(0, 300), "en", "auto");
  return result?.detectedLang || "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 3 — TTS (síntese de voz)
// ─────────────────────────────────────────────────────────────────────────────

export interface SynthesisResult {
  /** Áudio em base64 (sem prefixo data:). */
  audio: string;
  mimeType: string;
  /** cloned | edresson | human | google | elevenlabs */
  method: string;
  /** Nome da voz usada, quando aplicável (ex.: "Sua voz", "Camila"). */
  voice?: string;
  /** Provedor técnico que gerou o áudio (para diagnóstico). */
  provider?: string;
}

/** Junta vários MP3s em um só buffer (reprodução sequencial funciona bem). */
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function guessAudioMime(contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("wav")) return "audio/wav";
  if (ct.includes("ogg")) return "audio/ogg";
  if (ct.includes("webm")) return "audio/webm";
  return "audio/mpeg";
}

// ── (a) XTTS-v2 — clonagem da voz do usuário ────────────────────────────────

/**
 * XTTS-v2 pelo roteador de inferência da Hugging Face.
 * Modelo Coqui/Edresson: clona a voz a partir de um áudio de referência.
 * Só é chamado com DEADLINE curto (3s por padrão) — ver `synthesizeSpeech`.
 */
async function cloneVoiceTTS(
  text: string,
  referenceAudioBase64: string,
  lang: string,
  hfToken: string,
  timeoutMs: number,
): Promise<SynthesisResult | null> {
  if (!hfToken || !referenceAudioBase64) return null;

  const model = env("XTTS_HF_MODEL") || "coqui/XTTS-v2";

  try {
    const res = await fetchWithTimeout(
      `https://router.huggingface.co/hf-inference/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: { language: normalizeLang(lang), speaker_wav: referenceAudioBase64 },
        }),
      },
      timeoutMs,
    );

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!/audio|octet-stream/.test(contentType)) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1000) return null;

    return {
      audio: bytesToBase64(buf),
      mimeType: guessAudioMime(contentType),
      method: "cloned",
      voice: "Sua voz",
      provider: `hf:${model}`,
    };
  } catch {
    return null;
  }
}

// ── (b) Edresson / Coqui TTS-Portuguese — a "voz da casa" ───────────────────

/**
 * Voz neural pt-BR do projeto TTS-Portuguese (Edresson Casanova) rodando em
 * Coqui TTS. Como esse modelo NÃO é servido pela API pública da Hugging Face
 * (o repositório do Edresson só publica modelos de ASR lá), ele precisa de um
 * endpoint próprio. Este provedor aceita três formatos de servidor:
 *
 *   1. API JSON simples  (recomendado — ver deploy/edresson-tts/)
 *      POST <url>  { text, language, speaker_wav? }
 *      → devolve bytes de áudio OU { audio: "<base64>", mimeType }
 *
 *   2. Coqui TTS server oficial (`tts-server`)
 *      GET  <url>/api/tts?text=...&language_id=pt
 *
 *   3. Space do Hugging Face com Gradio (URL contendo ".hf.space")
 *      POST <url>/gradio_api/call/<fn>  →  GET do evento (SSE)
 *
 * Configuração (secrets da Edge Function):
 *   EDRESSON_TTS_URL    — endereço do servidor (obrigatório para ligar)
 *   EDRESSON_TTS_TOKEN  — opcional, vira "Authorization: Bearer …"
 *   EDRESSON_TTS_FN     — nome da função Gradio (padrão: "predict")
 *   EDRESSON_TTS_TIMEOUT_MS — padrão 12000
 *
 * Quando `EDRESSON_TTS_URL` não está configurado o provedor é PULADO na hora,
 * sem custo nenhum de latência — a cascata segue para as vozes da Polly.
 */
async function edressonTTS(
  text: string,
  lang: string,
  referenceAudioBase64?: string,
): Promise<SynthesisResult | null> {
  const base = env("EDRESSON_TTS_URL", "COQUI_TTS_URL", "XTTS_SERVER_URL");
  if (!base) return null;

  const token = env("EDRESSON_TTS_TOKEN", "COQUI_TTS_TOKEN");
  const timeoutMs = Number(env("EDRESSON_TTS_TIMEOUT_MS")) || 12000;
  const language = normalizeLang(lang);
  const url = base.replace(/\/$/, "");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    // ── Formato 3: Space do Hugging Face (Gradio) ──────────────────────────
    if (/\.hf\.space/i.test(url) || /\/gradio_api\//i.test(url)) {
      return await gradioSpaceTTS(url, text, language, referenceAudioBase64, headers, timeoutMs);
    }

    // ── Formato 2: Coqui tts-server oficial ────────────────────────────────
    if (/\/api\/tts$/i.test(url)) {
      const res = await fetchWithTimeout(
        `${url}?text=${encodeURIComponent(text)}&language_id=${encodeURIComponent(language)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        timeoutMs,
      );
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 1000) return null;
      return {
        audio: bytesToBase64(buf),
        mimeType: guessAudioMime(res.headers.get("content-type")),
        method: "edresson",
        voice: "Voz Edresson (pt-BR)",
        provider: "coqui-tts-server",
      };
    }

    // ── Formato 1: API JSON própria (deploy/edresson-tts) ──────────────────
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          language,
          ...(referenceAudioBase64 ? { speaker_wav: referenceAudioBase64 } : {}),
        }),
      },
      timeoutMs,
    );
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      const audio = typeof data?.audio === "string"
        ? data.audio
        : typeof data?.audioBase64 === "string"
        ? data.audioBase64
        : "";
      if (!audio) return null;
      const { mimeType, base64 } = parseDataUri(audio);
      if (base64.length < 1000) return null;
      return {
        audio: base64,
        mimeType: typeof data?.mimeType === "string" ? data.mimeType : mimeType,
        method: "edresson",
        voice: typeof data?.voice === "string" ? data.voice : "Voz Edresson (pt-BR)",
        provider: "edresson-http",
      };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1000) return null;
    return {
      audio: bytesToBase64(buf),
      mimeType: guessAudioMime(contentType),
      method: "edresson",
      voice: "Voz Edresson (pt-BR)",
      provider: "edresson-http",
    };
  } catch {
    return null;
  }
}

/** Chamada a um Space do Hugging Face que expõe a API do Gradio (2 passos). */
async function gradioSpaceTTS(
  url: string,
  text: string,
  language: string,
  referenceAudioBase64: string | undefined,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<SynthesisResult | null> {
  const fn = env("EDRESSON_TTS_FN") || "predict";
  const callUrl = /\/gradio_api\//i.test(url)
    ? url
    : `${url}/gradio_api/call/${fn}`;

  const payload: unknown[] = referenceAudioBase64
    ? [text, language, `data:audio/wav;base64,${referenceAudioBase64}`]
    : [text, language];

  const start = await fetchWithTimeout(
    callUrl,
    { method: "POST", headers, body: JSON.stringify({ data: payload }) },
    Math.min(timeoutMs, 10000),
  );
  if (!start.ok) return null;

  const started = await start.json().catch(() => null);
  const eventId = started?.event_id;
  if (!eventId) return null;

  const eventRes = await fetchWithTimeout(`${callUrl}/${eventId}`, { headers }, timeoutMs);
  if (!eventRes.ok) return null;

  // O Gradio devolve SSE: linhas "event: complete" + "data: [...]".
  const body = await eventRes.text();
  const dataLine = body
    .split("\n")
    .reverse()
    .find((line) => line.startsWith("data:") && line.includes("http"));
  if (!dataLine) return null;

  const fileUrl = /(https?:\/\/[^"\\\s]+)/.exec(dataLine)?.[1];
  if (!fileUrl) return null;

  const audioRes = await fetchWithTimeout(fileUrl, {}, timeoutMs);
  if (!audioRes.ok) return null;
  const buf = new Uint8Array(await audioRes.arrayBuffer());
  if (buf.length < 1000) return null;

  return {
    audio: bytesToBase64(buf),
    mimeType: guessAudioMime(audioRes.headers.get("content-type")),
    method: "edresson",
    voice: "Voz Edresson (pt-BR)",
    provider: "gradio-space",
  };
}

// ── (c) ElevenLabs — melhor qualidade, quando a chave tiver permissão ───────

/**
 * Vozes ElevenLabs por idioma (modelo `eleven_multilingual_v2`, 29 idiomas).
 */
const ELEVENLABS_VOICES: Record<string, { female: string; male: string }> = {
  pt: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  en: { female: "cgSgspJ2msm6clMCkdW9", male: "pNInz6obpgDQGcFmaJgB" },
  es: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  fr: { female: "FGY2WhTYpPnrIDTdsKH5", male: "JBFqnCBsd6RMkjVDRZzb" },
  de: { female: "Xb7hH8MSUJpSbSDYk0k2", male: "onwK4e9ZLuTAKqWW03F9" },
  it: { female: "XrExE9yKIg1WjnnlVkGX", male: "iP95p4xoKVk53GoZ742B" },
  ja: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  ko: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  zh: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  ar: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  hi: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  nl: { female: "hpp4J3VqNfWAUOO0d1Us", male: "bIHbv24MWmeRgasZH58o" },
  tr: { female: "EXAVITQu4vr4xnSDxMaL", male: "CwhRBWXzGAHq8TQ4Fs17" },
  pl: { female: "pFZP5JQG7iQjIQuC4Bku", male: "pqHfZKP75CvOlQylNhV4" },
};

/**
 * Enquanto a instância estiver quente, lembra que a chave do ElevenLabs foi
 * recusada (permissão ausente ou cota estourada). Evita gastar 1-2 s por
 * mensagem batendo em uma porta que já sabemos estar fechada.
 */
let elevenLabsBlockedUntil = 0;

/** Motivo do último bloqueio — aparece no diagnóstico. */
let elevenLabsBlockReason = "";

async function elevenLabsTTS(
  text: string,
  lang: string,
  gender: "female" | "male",
): Promise<SynthesisResult | null> {
  const apiKey = env("ELEVENLABS_API_KEY");
  if (!apiKey) return null;
  if (Date.now() < elevenLabsBlockedUntil) return null;

  const code = normalizeLang(lang);
  const voices = ELEVENLABS_VOICES[code] || ELEVENLABS_VOICES.en;
  const voiceId = gender === "male" ? voices.male : voices.female;
  const timeoutMs = Number(env("ELEVENLABS_TIMEOUT_MS")) || 15000;

  try {
    const chunks = chunkText(text, 4800);
    const buffers: Uint8Array[] = [];

    for (const chunk of chunks) {
      const res = await fetchWithTimeout(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: chunk,
            model_id: env("ELEVENLABS_MODEL") || "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.4,
              use_speaker_boost: true,
            },
          }),
        },
        timeoutMs,
      );

      if (!res.ok) {
        // 401 = chave sem permissão `text_to_speech`; 429 = cota do mês.
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          elevenLabsBlockedUntil = Date.now() + 10 * 60 * 1000;
          elevenLabsBlockReason = `HTTP ${res.status}`;
          try {
            const detail = await res.json();
            elevenLabsBlockReason =
              detail?.detail?.message || detail?.detail?.status || elevenLabsBlockReason;
          } catch { /* corpo não-JSON */ }
          console.warn("elevenlabs desativado por 10 min:", elevenLabsBlockReason);
        }
        return null;
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 500) return null;
      buffers.push(buf);
    }

    if (!buffers.length) return null;
    return {
      audio: bytesToBase64(concatBytes(buffers)),
      mimeType: "audio/mpeg",
      method: "elevenlabs",
      voice: `ElevenLabs ${gender === "male" ? "masculina" : "feminina"}`,
      provider: "elevenlabs",
    };
  } catch {
    return null;
  }
}

// ── (d) Vozes humanas da Amazon Polly (via StreamElements) ──────────────────

/**
 * Vozes neurais com nome próprio e entonação natural.
 *
 * ATENÇÃO (verificado em 29/08/2026): a API pública da StreamElements passou a
 * exigir chave — responde `401 {"error":"Unauthorized","message":"No API key
 * was found"}` para qualquer chamada anônima. Por isso este provedor só é
 * tentado quando existe `STREAMELEMENTS_JWT` nos secrets; sem ele seriam ~1 s
 * de falha garantida em CADA mensagem de voz.
 */
const HUMAN_VOICES: Record<string, { female: string[]; male: string[] }> = {
  pt: { female: ["Camila", "Vitoria", "Ines"], male: ["Ricardo", "Cristiano"] },
  en: { female: ["Joanna", "Amy", "Salli", "Kimberly"], male: ["Matthew", "Brian", "Joey"] },
  es: { female: ["Lucia", "Conchita", "Penelope"], male: ["Enrique", "Miguel"] },
  fr: { female: ["Lea", "Celine"], male: ["Mathieu"] },
  de: { female: ["Vicki", "Marlene"], male: ["Hans"] },
  it: { female: ["Bianca", "Carla"], male: ["Giorgio"] },
  ru: { female: ["Tatyana"], male: ["Maxim"] },
  ja: { female: ["Mizuki"], male: ["Takumi"] },
  ko: { female: ["Seoyeon"], male: ["Seoyeon"] },
  zh: { female: ["Zhiyu"], male: ["Zhiyu"] },
  ar: { female: ["Zeina"], male: ["Zeina"] },
  hi: { female: ["Aditi"], male: ["Aditi"] },
  nl: { female: ["Lotte"], male: ["Ruben"] },
  tr: { female: ["Filiz"], male: ["Filiz"] },
  pl: { female: ["Ewa", "Maja"], male: ["Jacek", "Jan"] },
};

export function pickHumanVoice(lang: string, gender: "female" | "male" = "female"): string | null {
  const set = HUMAN_VOICES[normalizeLang(lang)];
  if (!set) return null;
  const list = set[gender]?.length ? set[gender] : set.female;
  return list[0] || null;
}

async function humanVoiceTTS(
  text: string,
  lang: string,
  gender: "female" | "male",
): Promise<SynthesisResult | null> {
  const jwt = env("STREAMELEMENTS_JWT", "POLLY_JWT");
  if (!jwt) return null; // sem chave a API devolve 401 — nem vale a tentativa

  const voice = pickHumanVoice(lang, gender);
  if (!voice) return null;

  try {
    const chunks = chunkText(text, 480);
    const buffers: Uint8Array[] = [];

    for (const chunk of chunks) {
      const url =
        `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}` +
        `&text=${encodeURIComponent(chunk)}`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; undoing-dub/3.0)",
            Authorization: `Bearer ${jwt}`,
          },
        },
        12000,
      );
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 200) return null;
      buffers.push(buf);
    }

    if (!buffers.length) return null;
    return {
      audio: bytesToBase64(concatBytes(buffers)),
      mimeType: "audio/mpeg",
      method: "human",
      voice,
      provider: "streamelements-polly",
    };
  } catch {
    return null;
  }
}

// ── (d) Google Translate TTS — último recurso ───────────────────────────────

async function googleTTS(text: string, lang: string): Promise<SynthesisResult | null> {
  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    ja: "ja-JP",
    ru: "ru-RU",
    zh: "zh-CN",
    ko: "ko-KR",
    ar: "ar",
    hi: "hi-IN",
    nl: "nl-NL",
    tr: "tr-TR",
    pl: "pl-PL",
  };
  const code = normalizeLang(lang);
  const tl = localeMap[code] || code;

  try {
    // O endpoint do Google aceita no máximo ~200 caracteres por chamada.
    const chunks = chunkText(text, 190);
    const buffers: Uint8Array[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
        `&tl=${encodeURIComponent(tl)}&total=${chunks.length}&idx=${i}` +
        `&textlen=${chunks[i].length}&q=${encodeURIComponent(chunks[i])}`;
      const res = await fetchWithTimeout(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; undoing-dub/3.0)" } },
        12000,
      );
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 200) return null;
      buffers.push(buf);
    }

    if (!buffers.length) return null;
    return {
      audio: bytesToBase64(concatBytes(buffers)),
      mimeType: "audio/mpeg",
      method: "google",
      voice: "Voz Google",
      provider: "google-translate-tts",
    };
  } catch {
    return null;
  }
}

// ── Cascata ─────────────────────────────────────────────────────────────────

export interface SynthesizeOptions {
  /** Áudio de referência em base64 (sem "data:"), usado para clonar a voz. */
  referenceAudioBase64?: string;
  hfToken?: string;
  gender?: "female" | "male";
  /** Se false, pula a tentativa de clonagem (mais rápido ainda). */
  tryClone?: boolean;
  /**
   * Prazo da clonagem antes de cair para a voz de retaguarda.
   * Padrão: 3000 ms (regra de produto de 29/08/2026).
   */
  cloneTimeoutMs?: number;
}

/** Prazo padrão da clonagem: 3 segundos. */
export const CLONE_DEADLINE_MS = Number(env("CLONE_DEADLINE_MS")) || 3000;

/**
 * Ordem da voz de retaguarda. Pode ser trocada sem novo deploy pela variável
 * `TTS_ORDER` (ex.: "elevenlabs,edresson,polly,google").
 *
 * Padrão pensado assim:
 *   edresson   → servidor próprio, ilimitado e sem custo → primeiro quando existir
 *   elevenlabs → melhor qualidade, mas a cota do plano free é pequena
 *   polly      → só funciona com STREAMELEMENTS_JWT
 *   google     → sempre disponível, é a rede de segurança
 */
const DEFAULT_TTS_ORDER = ["edresson", "elevenlabs", "polly", "google"];

function getTtsOrder(): string[] {
  const raw = env("TTS_ORDER");
  if (!raw) return DEFAULT_TTS_ORDER;
  const list = raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  // "google" é a rede de segurança: entra no fim mesmo se esquecerem dele.
  if (!list.includes("google")) list.push("google");
  return list;
}

/** Voz de retaguarda, na ordem configurada. Nunca lança. */
async function fallbackVoice(
  text: string,
  targetLang: string,
  gender: "female" | "male",
  referenceAudioBase64?: string,
): Promise<SynthesisResult | null> {
  for (const provider of getTtsOrder()) {
    let result: SynthesisResult | null = null;
    switch (provider) {
      case "edresson":
      case "coqui":
        result = await edressonTTS(text, targetLang, referenceAudioBase64);
        break;
      case "elevenlabs":
        result = await elevenLabsTTS(text, targetLang, gender);
        break;
      case "polly":
      case "streamelements":
      case "human":
        result = await humanVoiceTTS(text, targetLang, gender);
        break;
      case "google":
        result = await googleTTS(text, targetLang);
        break;
      default:
        result = null;
    }
    if (result) return result;
  }
  return null;
}

/**
 * Gera o áudio dublado.
 *
 * Ordem: XTTS-v2 (clonagem, deadline de 3s) → Edresson/Coqui → Polly → Google.
 *
 * O provedor de retaguarda começa a trabalhar AO MESMO TEMPO que a clonagem.
 * Assim, quando os 3 segundos estouram, a voz alternativa já está pronta e o
 * usuário não paga o preço da tentativa frustrada. Só lança erro se
 * absolutamente nenhuma opção funcionar.
 */
export async function synthesizeSpeech(
  text: string,
  targetLang: string,
  options: SynthesizeOptions = {},
): Promise<SynthesisResult> {
  const {
    referenceAudioBase64,
    hfToken,
    gender = "female",
    tryClone = true,
    cloneTimeoutMs = CLONE_DEADLINE_MS,
  } = options;

  const wantsClone = Boolean(tryClone && hfToken && referenceAudioBase64);

  if (wantsClone) {
    // Retaguarda em paralelo: os 3s da clonagem não viram espera extra.
    const backupPromise = fallbackVoice(text, targetLang, gender, referenceAudioBase64)
      .catch(() => null);

    const cloned = await withDeadline(
      cloneVoiceTTS(text, referenceAudioBase64!, targetLang, hfToken!, cloneTimeoutMs),
      cloneTimeoutMs,
    );

    if (cloned) {
      // A clonagem venceu. A retaguarda é descartada em silêncio.
      backupPromise.catch(() => null);
      return cloned;
    }

    const backup = await backupPromise;
    if (backup) return backup;

    // A retaguarda paralela falhou (rede instável no momento do disparo).
    // Uma segunda tentativa em série ainda pode salvar a dublagem.
    const retry = await fallbackVoice(text, targetLang, gender, referenceAudioBase64);
    if (retry) return retry;

    throw new Error("TTS_FAILED: nenhum serviço de voz respondeu.");
  }

  const voice = await fallbackVoice(text, targetLang, gender, referenceAudioBase64);
  if (voice) return voice;

  throw new Error("TTS_FAILED: nenhum serviço de voz respondeu.");
}

/** Mensagem amigável descrevendo a voz usada. */
export function describeVoice(result: SynthesisResult): string {
  switch (result.method) {
    case "cloned":
      return "Dublado com a sua própria voz.";
    case "edresson":
      return `Dublado com a ${result.voice || "voz Edresson (pt-BR)"}.`;
    case "elevenlabs":
      return "Dublado com voz neural ElevenLabs.";
    case "human":
      return `Dublado com a voz humana ${result.voice}.`;
    default:
      return "Dublado com voz sintetizada.";
  }
}

/** Diagnóstico: quais provedores de voz estão configurados neste ambiente. */
export function ttsProviderStatus(): Record<string, unknown> {
  return {
    cloneDeadlineMs: CLONE_DEADLINE_MS,
    ordem: getTtsOrder(),
    huggingFaceToken: Boolean(getHfToken()),
    xttsModel: env("XTTS_HF_MODEL") || "coqui/XTTS-v2",
    edressonUrl: env("EDRESSON_TTS_URL", "COQUI_TTS_URL", "XTTS_SERVER_URL") || null,
    edressonToken: Boolean(env("EDRESSON_TTS_TOKEN", "COQUI_TTS_TOKEN")),
    elevenLabsKey: Boolean(env("ELEVENLABS_API_KEY")),
    elevenLabsBloqueado: Date.now() < elevenLabsBlockedUntil ? elevenLabsBlockReason : false,
    // A API pública da StreamElements passou a exigir chave (401 sem ela).
    streamElementsJwt: Boolean(env("STREAMELEMENTS_JWT", "POLLY_JWT")),
    googleTts: true,
  };
}
