/**
 * =============================================================================
 * Edge Function: dubbing-health
 * Diagnóstico da dublagem — diz, em uma chamada, QUAL provedor de voz está de
 * pé, quanto cada um demora e o que está faltando configurar.
 *
 * Uso:
 *   GET  /functions/v1/dubbing-health
 *   GET  /functions/v1/dubbing-health?text=Bom%20dia&lang=pt
 *   POST /functions/v1/dubbing-health   { "text": "...", "lang": "pt" }
 *
 * Saída resumida:
 *   {
 *     ok: true,
 *     config: { huggingFaceToken, edressonUrl, cloneDeadlineMs, ... },
 *     providers: [ { name, ok, ms, bytes, detail } ],
 *     recommendation: "..."
 *   }
 * =============================================================================
 */

import {
  fetchWithTimeout,
  getHfToken,
  json,
  normalizeLang,
  preflight,
  synthesizeSpeech,
  translateText,
  ttsProviderStatus,
} from "../_shared/dubbing.ts";

interface Probe {
  name: string;
  ok: boolean;
  ms: number;
  bytes?: number;
  detail?: string;
}

async function timed(name: string, run: () => Promise<Probe>): Promise<Probe> {
  const t0 = Date.now();
  try {
    const result = await run();
    return { ...result, ms: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t0, detail: (e as Error).message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();

  let text = "Bom dia, este é um teste de voz do UndoinG.";
  let lang = "pt";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.text === "string" && body.text.trim()) text = body.text.trim();
      if (typeof body?.lang === "string") lang = body.lang;
    } else {
      const url = new URL(req.url);
      text = url.searchParams.get("text") || text;
      lang = url.searchParams.get("lang") || lang;
    }
  } catch {
    /* mantém os padrões */
  }

  const target = normalizeLang(lang) || "pt";
  const hfToken = getHfToken();
  const config = ttsProviderStatus();

  const probes: Probe[] = [];

  // 1. Token da Hugging Face
  probes.push(
    await timed("huggingface-token", async () => {
      if (!hfToken) {
        return { name: "huggingface-token", ok: false, ms: 0, detail: "HUGGINGFACE_TOKEN_DUBLAGEM não configurado" };
      }
      const res = await fetchWithTimeout(
        "https://huggingface.co/api/whoami-v2",
        { headers: { Authorization: `Bearer ${hfToken}` } },
        10000,
      );
      const body = await res.text();
      return {
        name: "huggingface-token",
        ok: res.ok,
        ms: 0,
        detail: res.ok ? body.slice(0, 120) : `HTTP ${res.status}: ${body.slice(0, 160)}`,
      };
    }),
  );

  // 2. Tradução
  probes.push(
    await timed("translate", async () => {
      const r = await translateText("bom dia", "en", "pt");
      return { name: "translate", ok: Boolean(r.text), ms: 0, detail: `${r.provider}: ${r.text}` };
    }),
  );

  // 3. Voz de retaguarda (Edresson → Polly → Google), SEM clonagem
  probes.push(
    await timed("voz-de-retaguarda", async () => {
      const s = await synthesizeSpeech(text, target, { tryClone: false });
      return {
        name: "voz-de-retaguarda",
        ok: true,
        ms: 0,
        bytes: s.audio.length,
        detail: `${s.method} / ${s.voice || "-"} / ${s.provider || "-"}`,
      };
    }),
  );

  // 4. Servidor Edresson/Coqui, quando configurado
  if (config.edressonUrl) {
    probes.push(
      await timed("edresson-servidor", async () => {
        const res = await fetchWithTimeout(String(config.edressonUrl), {}, 10000);
        return {
          name: "edresson-servidor",
          ok: res.status < 500,
          ms: 0,
          detail: `HTTP ${res.status} ${res.headers.get("content-type") || ""}`,
        };
      }),
    );
  }

  // 5. ElevenLabs — a chave existe? tem permissão de text_to_speech?
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY") || "";
  probes.push(
    await timed("elevenlabs", async () => {
      if (!elevenKey) {
        return { name: "elevenlabs", ok: false, ms: 0, detail: "ELEVENLABS_API_KEY não configurada" };
      }
      const res = await fetchWithTimeout(
        "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL",
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text: "teste", model_id: "eleven_multilingual_v2" }),
        },
        20000,
      );
      if (res.ok) {
        const bytes = (await res.arrayBuffer()).byteLength;
        return { name: "elevenlabs", ok: bytes > 500, ms: 0, bytes, detail: "chave OK" };
      }
      const body = (await res.text()).slice(0, 200);
      return {
        name: "elevenlabs",
        ok: false,
        ms: 0,
        detail: `HTTP ${res.status}: ${body}`,
      };
    }),
  );

  // 6. StreamElements/Polly — a API pública passou a exigir chave
  probes.push(
    await timed("polly-streamelements", async () => {
      const jwt = Deno.env.get("STREAMELEMENTS_JWT") || Deno.env.get("POLLY_JWT") || "";
      const res = await fetchWithTimeout(
        "https://api.streamelements.com/kappa/v2/speech?voice=Camila&text=teste",
        { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
        12000,
      );
      const ct = res.headers.get("content-type") || "";
      const detail = ct.includes("json") ? (await res.text()).slice(0, 160) : `${ct}`;
      return {
        name: "polly-streamelements",
        ok: res.ok && !ct.includes("json"),
        ms: 0,
        detail: `HTTP ${res.status} ${detail}`,
      };
    }),
  );

  const backup = probes.find((p) => p.name === "voz-de-retaguarda");
  const eleven = probes.find((p) => p.name === "elevenlabs");

  const recommendation = !hfToken
    ? "Configure HUGGINGFACE_TOKEN_DUBLAGEM nos secrets para habilitar a transcrição (Whisper) e a clonagem."
    : eleven && !eleven.ok && elevenKey && eleven.detail?.includes("text_to_speech")
    ? "A chave do ElevenLabs existe mas não tem a permissão 'text_to_speech'. Gere uma chave nova em elevenlabs.io → Profile → API Keys marcando essa permissão e atualize ELEVENLABS_API_KEY. É o caminho mais rápido para uma voz realmente natural."
    : !config.edressonUrl && !eleven?.ok
    ? "Hoje a dublagem está saindo na voz do Google. Para uma voz natural: (a) publique deploy/edresson-tts e configure EDRESSON_TTS_URL, ou (b) corrija a permissão da chave do ElevenLabs."
    : backup?.ok
    ? "Tudo certo: há pelo menos uma voz funcionando."
    : "Nenhuma voz respondeu — verifique a saída de rede da Edge Function.";

  return json({
    ok: Boolean(backup?.ok),
    config,
    providers: probes,
    recommendation,
    checkedAt: new Date().toISOString(),
  });
});
