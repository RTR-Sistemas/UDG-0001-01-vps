/**
 * =============================================================================
 * Edge Function: huggingface-dubbing
 * Dublagem de um áudio JÁ ENVIADO (mensagem recebida no chat).
 *
 * Entrada (POST JSON):
 *   {
 *     audioUrl: "https://…",              ← obrigatório
 *     targetLang: "pt",
 *     gender?: "female" | "male",
 *     tryClone?: boolean,                 ← padrão false
 *     sampleAudioUrl?: string,            ← amostra da voz de QUEM OUVE
 *     cloneTimeoutMs?: number             ← padrão 3000
 *   }
 *
 * IMPORTANTE: a voz do áudio recebido é de OUTRA pessoa — ela nunca serve de
 * amostra de clonagem. A única referência aceita aqui é `sampleAudioUrl`,
 * a voz que o próprio usuário registrou.
 *
 * Saída (compatível com o front-end atual):
 *   { status: "completed", originalText, translatedText, sourceLang,
 *     audioBase64, audioMimeType, method, voice, voiceProvider }
 * =============================================================================
 */

import {
  CLONE_DEADLINE_MS,
  detectLanguageFromText,
  getHfToken,
  getLanguageInfo,
  json,
  normalizeLang,
  preflight,
  fetchWithTimeout,
  resolveVoiceSample,
  synthesizeSpeech,
  transcribeAudio,
  translateText,
} from "../_shared/dubbing.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") {
    return json({ status: "error", error: "Use POST." }, 405);
  }

  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      audioUrl,
      targetLang = "pt",
      gender = "female",
      tryClone = false,
      sampleAudioUrl,
      cloneTimeoutMs,
    } = body as Record<string, unknown>;

    if (!audioUrl || typeof audioUrl !== "string") {
      return json({ status: "error", error: "audioUrl é obrigatório." }, 400);
    }

    const target = normalizeLang(String(targetLang)) || "pt";
    const hfToken = getHfToken();

    // ── 1. Baixar o áudio original ────────────────────────────────────────
    const audioRes = await fetchWithTimeout(audioUrl, {}, 20000);
    if (!audioRes.ok) {
      return json({ status: "error", error: `Não foi possível baixar o áudio (HTTP ${audioRes.status}).` }, 200);
    }
    const mimeType = audioRes.headers.get("content-type")?.split(";")[0] || "audio/webm";
    const audioBytes = new Uint8Array(await audioRes.arrayBuffer());

    // ── 2. Transcrever ────────────────────────────────────────────────────
    if (!hfToken) {
      return json({ status: "error", error: "Transcrição indisponível: token da Hugging Face não configurado." }, 200);
    }

    let transcription;
    try {
      transcription = await transcribeAudio(audioBytes, mimeType, hfToken);
    } catch (_e) {
      return json({ status: "error", error: "Não consegui entender a fala deste áudio." }, 200);
    }

    let sourceLang = transcription.language;
    if (sourceLang === "unknown") sourceLang = await detectLanguageFromText(transcription.text);

    // ── 3. Traduzir ───────────────────────────────────────────────────────
    const translation = await translateText(transcription.text, target, sourceLang);
    if (sourceLang === "unknown") sourceLang = translation.detectedLang;

    const sameLanguage = normalizeLang(sourceLang) === target;

    // ── 4. Gerar a voz (só quando os idiomas são diferentes) ──────────────
    let audioBase64: string | null = null;
    let audioMimeType = "audio/mpeg";
    let method = "none";
    let voice: string | undefined;
    let voiceProvider: string | undefined;

    if (!sameLanguage) {
      // A amostra NUNCA é o áudio recebido (voz de terceiro).
      const reference = tryClone === true
        ? await resolveVoiceSample(typeof sampleAudioUrl === "string" ? sampleAudioUrl : null)
        : null;

      try {
        const synthesis = await synthesizeSpeech(translation.text, target, {
          referenceAudioBase64: reference || undefined,
          hfToken,
          gender: gender === "male" ? "male" : "female",
          tryClone: Boolean(reference),
          cloneTimeoutMs: Number(cloneTimeoutMs) > 0 ? Number(cloneTimeoutMs) : CLONE_DEADLINE_MS,
        });
        audioBase64 = synthesis.audio;
        audioMimeType = synthesis.mimeType;
        method = synthesis.method;
        voice = synthesis.voice;
        voiceProvider = synthesis.provider;
      } catch (_e) {
        // Sem voz: o front-end ainda mostra a transcrição e a tradução.
      }
    }

    return json({
      status: "completed",
      originalText: transcription.text,
      translatedText: translation.text,
      sourceLang: getLanguageInfo(sourceLang).code,
      sourceLanguageInfo: getLanguageInfo(sourceLang),
      targetLang: target,
      targetLanguageInfo: getLanguageInfo(target),
      sameLanguage,
      audioBase64,
      audioMimeType,
      method,
      voice,
      voiceProvider,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = (error as Error)?.message || "Erro desconhecido.";
    console.error("huggingface-dubbing:", message);
    return json({ status: "error", error: message }, 200);
  }
});
