/**
 * =============================================================================
 * Edge Function: voice-clone-translate   (alias: translate-audio)
 * Dublagem do áudio que o usuário acabou de GRAVAR (envio).
 *
 * Entrada (POST JSON):
 *   {
 *     audio: "data:audio/webm;base64,…",   ← obrigatório
 *     targetLang: "en",
 *     originalText?: "texto já reconhecido pelo navegador",
 *     sourceLang?: "pt",
 *     gender?: "female" | "male",
 *     tryClone?: boolean,                  ← padrão true
 *     useAudioAsSample?: boolean,          ← padrão true (é a voz de quem gravou)
 *     sampleAudioUrl?: string,             ← amostra de voz registrada (URL ou data URI)
 *     cloneTimeoutMs?: number              ← padrão 3000
 *   }
 *
 * Saída:
 *   { success, originalText, detectedLanguage, detectedLanguageInfo,
 *     translatedText, targetLang, targetLanguageInfo, audio, method, voice,
 *     voiceProvider, cloneAttempted, sameLanguage, elapsedMs, message }
 * =============================================================================
 */

import {
  CLONE_DEADLINE_MS,
  CORS_HEADERS,
  describeVoice,
  detectLanguageFromText,
  getHfToken,
  getLanguageInfo,
  json,
  normalizeLang,
  parseDataUri,
  preflight,
  base64ToBytes,
  resolveVoiceSample,
  synthesizeSpeech,
  transcribeAudio,
  translateText,
} from "../_shared/dubbing.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") {
    return json({ success: false, error: "METHOD", message: "Use POST." }, 405);
  }

  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      audio,
      targetLang = "en",
      originalText,
      sourceLang,
      gender = "female",
      tryClone = true,
      useAudioAsSample = true,
      sampleAudioUrl,
      cloneTimeoutMs,
    } = body as Record<string, unknown>;

    if (!audio || typeof audio !== "string") {
      return json(
        { success: false, error: "NO_AUDIO", message: 'O campo "audio" (base64) é obrigatório.' },
        400,
      );
    }

    const target = normalizeLang(String(targetLang)) || "en";
    const hfToken = getHfToken();

    const { mimeType, base64 } = parseDataUri(audio);

    // ── 1. Texto original ─────────────────────────────────────────────────
    // O navegador já reconhece a fala (Web Speech API) na maioria dos casos.
    // Quando vem preenchido, pulamos o Whisper e a dublagem fica instantânea.
    let text = typeof originalText === "string" ? originalText.trim() : "";
    let detected = normalizeLang(typeof sourceLang === "string" ? sourceLang : undefined);

    if (!text) {
      if (!hfToken) {
        return json({
          success: false,
          error: "NO_SPEECH",
          message:
            "Não consegui entender o que foi falado. Escreva o texto no campo abaixo e toque em Traduzir & Dublar.",
        });
      }
      try {
        const transcription = await transcribeAudio(base64ToBytes(base64), mimeType, hfToken);
        text = transcription.text;
        if (detected === "unknown") detected = transcription.language;
      } catch (_e) {
        return json({
          success: false,
          error: "NO_SPEECH",
          message:
            "Não consegui entender o que foi falado. Escreva o texto no campo abaixo e toque em Traduzir & Dublar.",
        });
      }
    }

    if (!text) {
      return json({
        success: false,
        error: "NO_SPEECH",
        message: "Não foi detectada nenhuma fala no áudio.",
      });
    }

    // ── 2. Idioma de origem ───────────────────────────────────────────────
    if (detected === "unknown") detected = await detectLanguageFromText(text);

    // ── 3. Tradução ───────────────────────────────────────────────────────
    const translation = await translateText(text, target, detected);
    if (detected === "unknown" && translation.detectedLang !== "unknown") {
      detected = translation.detectedLang;
    }

    // ── 4. Amostra de voz para a clonagem ─────────────────────────────────
    // Ordem: amostra registrada pelo usuário → a própria gravação (só quando
    // a voz do áudio É a do usuário, isto é, no envio).
    const wantsClone = tryClone !== false;
    let reference: string | null = null;
    if (wantsClone) {
      reference = await resolveVoiceSample(
        typeof sampleAudioUrl === "string" ? sampleAudioUrl : null,
      );
      if (!reference && useAudioAsSample !== false && base64.length > 2000) {
        reference = base64;
      }
    }

    // ── 5. Voz ────────────────────────────────────────────────────────────
    const synthesis = await synthesizeSpeech(translation.text, target, {
      referenceAudioBase64: reference || undefined,
      hfToken,
      gender: gender === "male" ? "male" : "female",
      tryClone: wantsClone && Boolean(reference),
      cloneTimeoutMs: Number(cloneTimeoutMs) > 0 ? Number(cloneTimeoutMs) : CLONE_DEADLINE_MS,
    });

    return json({
      success: true,
      originalText: text,
      detectedLanguage: getLanguageInfo(detected).code,
      detectedLanguageInfo: getLanguageInfo(detected),
      translatedText: translation.text,
      targetLang: target,
      targetLanguageInfo: getLanguageInfo(target),
      audio: `data:${synthesis.mimeType};base64,${synthesis.audio}`,
      method: synthesis.method,
      voice: synthesis.voice,
      voiceProvider: synthesis.provider,
      cloneAttempted: wantsClone && Boolean(reference),
      sameLanguage: translation.provider === "same-language",
      elapsedMs: Date.now() - startedAt,
      message: describeVoice(synthesis),
    });
  } catch (error) {
    const message = (error as Error)?.message || "Erro desconhecido.";
    console.error("voice-clone-translate:", message);
    return new Response(
      JSON.stringify({
        success: false,
        error: message.split(":")[0] || "UNKNOWN",
        message: message.startsWith("TTS_FAILED")
          ? "O serviço de voz não respondeu agora. Tente de novo em alguns segundos."
          : message,
        elapsedMs: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
