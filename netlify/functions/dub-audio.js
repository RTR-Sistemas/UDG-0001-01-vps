/**
 * =============================================================================
 * File: netlify/functions/dub-audio.js
 * Purpose: Pipeline de dublagem de áudio do chat usando SOMENTE a voz do
 *          próprio usuário (clonagem de voz). Provedores em cadeia:
 *             1. ElevenLabs (Instant Voice Clone + TTS) — melhor qualidade;
 *             2. Fish Audio (modelo grátis s2.1-pro-free) — funciona no plano
 *                grátis/Free do ElevenLabs sem custo;
 *             3. free.ai (clone + TTS por chamada, ~500 tokens) — resgate
 *                quando ElevenLabs/Fish falharem (cotas/limites).
 *
 * Fluxo:
 *   1. Autentica o usuário (JWT) e garante a voz clonada dele (cria sob
 *      demanda a partir de `sampleAudioUrl`, salva em `user_voices`).
 *   2. ASR (Whisper via HuggingFace) → transcrição do áudio original.
 *   3. Tradução de TEXTO (Google gtx).
 *   4. TTS com a VOZ DO PRÓPRIO USUÁRIO (ElevenLabs, Fish ou free.ai).
 *
 * REGRA DE NEGÓCIO (obrigatória): NÃO existe fallback de voz sintética/Google.
 * Se a voz do usuário não estiver disponível, a dublagem falha com
 * VOICE_SAMPLE_REQUIRED e o cliente pede uma amostra de voz ao usuário.
 *
 * Requer env: ELEVENLABS_API_KEY (opcional), FISH_API_KEY (opcional),
 *             FREEAI_API_KEY (opcional),
 *             HUGGINGFACE_TOKEN (ou HUGGINGFACE_TOKEN_DUBLAGEM)
 * =============================================================================
 */
import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

const ELEVEN_API = 'https://api.elevenlabs.io/v1';
const FISH_API = 'https://api.fish.audio';
const FREEAI_API = 'https://api.free.ai';

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

function getFishKey() {
  return process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || '';
}

function getFreeAiKey() {
  return process.env.FREEAI_API_KEY || process.env.FREE_AI_API_KEY || '';
}

function getHfToken() {
  return process.env.HUGGINGFACE_TOKEN_DUBLAGEM || process.env.HUGGINGFACE_TOKEN || process.env.HF_API_TOKEN || '';
}

async function fetchWithTimeout(url, options, timeout = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function raise(code, message) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

async function downloadSample(sampleAudioUrl) {
  const sampleRes = await fetchWithTimeout(sampleAudioUrl, {}, 30000);
  if (!sampleRes.ok) {
    raise('VOICE_SAMPLE_DOWNLOAD_FAILED', `Não foi possível baixar a amostra de voz (HTTP ${sampleRes.status}).`);
  }
  const sampleBuffer = Buffer.from(await sampleRes.arrayBuffer());
  if (sampleBuffer.length < 8000) {
    raise('VOICE_SAMPLE_TOO_SHORT', 'Amostra de voz muito curta. Grave pelo menos 3 segundos.');
  }
  return { buffer: sampleBuffer, type: sampleRes.headers.get('content-type') || 'audio/mpeg' };
}

// ─── VOZ DO USUÁRIO (banco) ──────────────────────────────────────────────────
async function getUserVoice(admin, userId) {
  const { data } = await admin
    .from('user_voices')
    .select('voice_id, provider, sample_audio_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.voice_id) return null;
  return {
    voiceId: data.voice_id,
    provider: data.provider || 'elevenlabs',
    sampleUrl: data.sample_audio_url || null,
  };
}

// ─── PROVEDOR 1: ElevenLabs Instant Voice Clone ───────────────────────────────
async function elevenCloneVoice(sampleAudioUrl) {
  const key = getElevenKey();
  if (!key) raise('ELEVENLABS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY não configurada.');

  const { buffer, type } = await downloadSample(sampleAudioUrl);

  const form = new FormData();
  form.append('name', `udg_voz_${Date.now()}`);
  form.append('files', new Blob([buffer], { type }), 'sample.mp3');
  form.append('remove_background_noise', 'true');

  const cloneRes = await fetchWithTimeout(`${ELEVEN_API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  }, 60000);

  const cloneBody = await cloneRes.text().catch(() => '');
  if (!cloneRes.ok) {
    console.error('[dub-audio] voices/add falhou:', cloneRes.status, cloneBody.substring(0, 300));
    if (cloneRes.status === 401 || cloneRes.status === 403 || cloneBody.includes('invalid_api_key')) {
      raise('ELEVENLABS_UNAUTHORIZED', 'Chave ElevenLabs inválida ou sem permissão para clonagem de voz.');
    }
    if (cloneBody.includes('instant_voice_cloning') || cloneBody.includes('paid_plan_required')) {
      raise('ELEVENLABS_PLAN_REQUIRED', 'Plano ElevenLabs não inclui clonagem (necessário Starter).');
    }
    raise('VOICE_CLONE_FAILED', `Clonagem de voz falhou (${cloneRes.status}): ${cloneBody.substring(0, 200)}`);
  }

  let voiceId = null;
  try { voiceId = JSON.parse(cloneBody).voice_id || null; } catch { /* ignore */ }
  if (!voiceId) raise('VOICE_CLONE_FAILED', 'ElevenLabs não retornou voice_id.');
  return voiceId;
}

// ─── PROVEDOR 2: Fish Audio (grátis, s2.1-pro-free) ──────────────────────────
async function fishCloneVoice(sampleAudioUrl) {
  const key = getFishKey();
  if (!key) raise('FISH_NOT_CONFIGURED', 'FISH_API_KEY não configurada.');

  const { buffer, type } = await downloadSample(sampleAudioUrl);

  const form = new FormData();
  form.append('type', 'tts');
  form.append('title', `udg_voz_${Date.now()}`);
  form.append('description', 'Voz do usuário do Undoing (dublagem de chat)');
  form.append('visibility', 'private');
  form.append('train_mode', 'fast');
  form.append('voices', new Blob([buffer], { type }), 'sample');

  const cloneRes = await fetchWithTimeout(`${FISH_API}/model`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  }, 90000);

  const cloneBody = await cloneRes.text().catch(() => '');
  if (!cloneRes.ok) {
    console.error('[dub-audio] Fish /model falhou:', cloneRes.status, cloneBody.substring(0, 300));
    if (cloneRes.status === 401 || cloneRes.status === 403) {
      raise('FISH_UNAUTHORIZED', 'Chave Fish Audio inválida ou sem permissão.');
    }
    if (cloneBody.toLowerCase().includes('payment') || cloneBody.toLowerCase().includes('quota') || cloneBody.toLowerCase().includes('limit')) {
      raise('FISH_LIMIT', 'Limite do plano grátis Fish Audio atingido.');
    }
    raise('VOICE_CLONE_FAILED', `Clonagem de voz falhou (${cloneRes.status}): ${cloneBody.substring(0, 200)}`);
  }

  let modelId = null;
  let state = null;
  try {
    const parsed = JSON.parse(cloneBody);
    modelId = parsed._id || parsed.id || null;
    state = parsed.state || null;
  } catch { /* ignore */ }
  if (!modelId) raise('VOICE_CLONE_FAILED', 'Fish Audio não retornou o id do modelo de voz.');

  // Aguarda o treinamento rápido concluir (instant clone)
  for (let i = 0; i < 8 && state && state !== 'trained' && state !== 'ready' && state !== 'active'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const stRes = await fetchWithTimeout(`${FISH_API}/model/${modelId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      }, 15000);
      if (stRes.ok) {
        const stParsed = await stRes.json().catch(() => null);
        state = stParsed?.state || stParsed?.status || state;
      }
    } catch { /* segue tentando */ }
  }

  console.log(`[dub-audio] Voz Fish clonada: ${modelId} (state=${state})`);
  return modelId;
}

// ─── PROVEDOR 3: free.ai (clone + TTS por chamada, WAV) ─────────────────────
async function freeAiCloneAndTts(sampleAudioUrl, text) {
  const key = getFreeAiKey();
  if (!key) raise('FREEAI_NOT_CONFIGURED', 'FREEAI_API_KEY não configurada.');

  const { buffer, type } = await downloadSample(sampleAudioUrl);

  const form = new FormData();
  form.append('audio', new Blob([buffer], { type }), 'sample.mp3');
  form.append('text', text);
  form.append('model', 'qwen3-tts');

  const genRes = await fetchWithTimeout(`${FREEAI_API}/v1/voice/clone/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  }, 240000);

  const genBody = await genRes.text().catch(() => '');
  if (!genRes.ok) {
    console.error('[dub-audio] free.ai /v1/voice/clone/ falhou:', genRes.status, genBody.substring(0, 300));
    if (genRes.status === 401 || genRes.status === 403) {
      raise('FREEAI_UNAUTHORIZED', 'Chave free.ai inválida ou sem permissão.');
    }
    if (genRes.status === 402 || genBody.toLowerCase().includes('insufficient') || genBody.toLowerCase().includes('token')) {
      raise('FREEAI_LIMIT', 'Cota diária grátis do free.ai atingida.');
    }
    raise('TTS_FAILED', `Síntese de voz falhou (${genRes.status}).`);
  }

  let audioUrl = null;
  try {
    const parsed = JSON.parse(genBody);
    audioUrl = parsed.audio_url || parsed.url || null;
  } catch { /* ignore */ }
  if (!audioUrl) raise('TTS_FAILED', 'free.ai não retornou o áudio gerado.');

  // free.ai sempre devolve o áudio em WAV
  const audioRes = await fetchWithTimeout(audioUrl, {}, 90000);
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio do free.ai (HTTP ${audioRes.status})`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  if (audioBuffer.length < 1000) raise('TTS_FAILED', 'Áudio sintetizado vazio.');
  return { buffer: audioBuffer, mime: 'audio/wav' };
}

// ─── Cria a voz do usuário com cadeia de provedores ──────────────────────────
async function createUserVoice(admin, userId, sampleAudioUrl, forceProvider = null) {
  if (!sampleAudioUrl) {
    raise('VOICE_SAMPLE_REQUIRED', 'Amostra de voz do usuário é necessária para dublar com a voz dele.');
  }

  const providers = forceProvider ? [forceProvider] : (getElevenKey() ? ['elevenlabs', 'fish'] : ['fish']);
  let lastError = null;

  for (const provider of providers) {
    if (provider === 'fish' && !getFishKey()) continue;
    try {
      const voiceId = provider === 'elevenlabs'
        ? await elevenCloneVoice(sampleAudioUrl)
        : await fishCloneVoice(sampleAudioUrl);

      await admin.from('user_voices').upsert({
        user_id: userId,
        voice_id: voiceId,
        provider,
        sample_audio_url: sampleAudioUrl,
        updated_at: new Date().toISOString(),
      });
      console.log(`[dub-audio] Voz registrada p/ ${userId}: ${provider}/${voiceId}`);
      return { voiceId, provider, sampleUrl: sampleAudioUrl };
    } catch (e) {
      lastError = e;
      console.warn(`[dub-audio] Provedor ${provider} falhou para ${userId}:`, e.code, e.message);
    }
  }
  throw lastError;
}

// ─── STEP 1: Whisper ASR ─────────────────────────────────────────────────────
const ASR_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
];

function normalizeAsrMime(mimeType) {
  const raw = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (raw === 'video/webm' || raw === 'audio/webm' || raw === 'video/mp4' || raw === 'audio/mp4') return 'audio/webm';
  if (raw === 'audio/x-wav' || raw === 'audio/wav' || raw === 'audio/wave') return 'audio/wav';
  if (raw === 'audio/x-mpeg' || raw === 'audio/x-mpeg-3' || raw === 'audio/mpeg' || raw === 'audio/mp3') return 'audio/mpeg';
  if (raw === 'audio/ogg' || raw === 'audio/opus') return 'audio/ogg';
  if (raw === 'audio/x-flac' || raw === 'audio/flac') return 'audio/flac';
  if (raw === 'audio/m4a' || raw === 'audio/x-m4a') return 'audio/m4a';
  return 'audio/webm';
}

async function transcribeAudio(audioBuffer, mimeType, hfToken) {
  const normalizedMime = normalizeAsrMime(mimeType);
  let lastError = null;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const model of ASR_MODELS) {
      try {
        const res = await fetchWithTimeout(
          `https://router.huggingface.co/hf-inference/models/${model}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': normalizedMime,
            },
            body: audioBuffer,
          },
          30000
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.text && data.text.trim()) {
            return { text: data.text, language: data.language || 'unknown' };
          }
        } else if (res.status === 503) {
          // cold start — espera breve e tenta próximo modelo
          const errJson = await res.json().catch(() => null);
          const wait = Math.min(Number(errJson?.estimated_time) || 4, 8);
          await new Promise((r) => setTimeout(r, wait * 1000));
        } else {
          lastError = `HTTP ${res.status}: ${(await res.text().catch(() => '')).substring(0, 120)}`;
          if (res.status >= 500 || res.status === 429) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      } catch (e) {
        lastError = e.message;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  raise('ASR_FAILED', `Transcrição falhou: ${lastError || 'modelos indisponíveis'}`);
}

// ─── STEP 2: tradução de texto (sem voz) ─────────────────────────────────────
async function translateText(text, targetLang) {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ld&q=${encodeURIComponent(text.slice(0, 4000))}`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; udg-dub/1.0)' },
    }, 12000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((p) => (Array.isArray(p) ? p[0] : '')).filter(Boolean).join('');
        const source = typeof data[2] === 'string' ? data[2] : 'auto';
        if (translated) return { translated, source };
      }
    }
  } catch (e) {
    console.warn('[dub-audio] Google gtx falhou:', e.message);
  }
  raise('TRANSLATION_FAILED', 'Serviço de tradução indisponível.');
}

// ─── STEP 3: TTS COM A VOZ DO USUÁRIO (ElevenLabs / Fish) ────────────────────
async function elevenTts(voiceId, text) {
  const key = getElevenKey();
  if (!key) raise('ELEVENLABS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY não configurada.');

  const res = await fetchWithTimeout(`${ELEVEN_API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
      },
    }),
  }, 90000);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[dub-audio] TTS ElevenLabs falhou:', res.status, body.substring(0, 300));
    if (res.status === 401 || res.status === 403) raise('ELEVENLABS_UNAUTHORIZED', 'Chave ElevenLabs sem permissão de TTS.');
    raise('TTS_FAILED', `Síntese de voz falhou (${res.status}).`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1000) raise('TTS_FAILED', 'Áudio sintetizado vazio.');
  return buffer;
}

async function fishTts(voiceId, text) {
  const key = getFishKey();
  if (!key) raise('FISH_NOT_CONFIGURED', 'FISH_API_KEY não configurada.');

  const res = await fetchWithTimeout(`${FISH_API}/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      model: 's2.1-pro-free',
    },
    body: JSON.stringify({ text, reference_id: voiceId, format: 'mp3' }),
  }, 90000);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[dub-audio] TTS Fish falhou:', res.status, body.substring(0, 300));
    if (res.status === 401 || res.status === 403) raise('FISH_UNAUTHORIZED', 'Chave Fish Audio inválida ou sem permissão.');
    if (res.status === 402 || body.toLowerCase().includes('payment')) {
      raise('FISH_LIMIT', 'Limite do plano grátis Fish Audio atingido.');
    }
    if (res.status === 429) raise('TTS_FAILED', 'Limite de geração temporário. Tente novamente em instantes.');
    raise('TTS_FAILED', `Síntese de voz falhou (${res.status}).`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1000) raise('TTS_FAILED', 'Áudio sintetizado vazio.');
  return buffer;
}

async function ttsWithVoice(provider, voiceId, text, sampleAudioUrl = null) {
  if (provider === 'fish') {
    return { buffer: await fishTts(voiceId, text), mime: 'audio/mpeg' };
  }
  if (provider === 'freeai') {
    if (!sampleAudioUrl) {
      raise('VOICE_SAMPLE_REQUIRED', 'Amostra de voz necessária para dublar via free.ai.');
    }
    return freeAiCloneAndTts(sampleAudioUrl, text);
  }
  return { buffer: await elevenTts(voiceId, text), mime: 'audio/mpeg' };
}

// ═════════════════════════════════════════════════════════════════════════════
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'BACKEND_NOT_CONFIGURED', message: e.message }) };
  }

  const auth = await requireUser(event, admin);
  if (!auth.ok) return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'not_authenticated' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const { audioUrl, targetLang = 'pt', sampleAudioUrl, providerOverride } = body;
  if (!audioUrl) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'audioUrl é obrigatório.' }) };
  }

  const hfToken = getHfToken();
  if (!hfToken) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'HUGGINGFACE_TOKEN não configurado.' }) };
  }

  const fail = (code, message) => {
    console.error(`[dub-audio] ${code}: ${message}`);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: false, error: code, message }) };
  };

  try {
    // 0) Voz do usuário (usa existente ou clona com cadeia de provedores)
    let userVoice = null;

    // providerOverride: força um provedor específico (p/ testes e resgate manual)
    if (providerOverride === 'freeai' && sampleAudioUrl) {
      userVoice = { voiceId: null, provider: 'freeai', sampleUrl: sampleAudioUrl };
    } else if (providerOverride === 'fish' || providerOverride === 'elevenlabs') {
      userVoice = await createUserVoice(admin, auth.user.id, sampleAudioUrl, providerOverride);
    } else {
      userVoice = await getUserVoice(admin, auth.user.id);
    }

    // 0b) Se a voz salva não der certo no TTS, precisa da amostra p/ re-clonar
    let sampleSrc = sampleAudioUrl || userVoice?.sampleUrl || null;

    if (!userVoice) {
      try {
        userVoice = await createUserVoice(admin, auth.user.id, sampleAudioUrl);
        sampleSrc = userVoice.sampleUrl || sampleAudioUrl;
      } catch (cloneErr) {
        console.warn(`[dub-audio] Clonagem Eleven/Fish falhou p/ ${auth.user.id}:`, cloneErr.code, cloneErr.message);
        // Resgate: free.ai clona + sintetiza por chamada (sem precisar de voz salva)
        if (getFreeAiKey() && sampleSrc) {
          userVoice = { voiceId: null, provider: 'freeai', sampleUrl: sampleSrc };
        } else {
          throw cloneErr;
        }
      }
    }
    let { voiceId, provider } = userVoice;

    // 1) Baixa o áudio original da mensagem
    const audioRes = await fetchWithTimeout(audioUrl, {}, 30000);
    if (!audioRes.ok) throw new Error(`Falha ao baixar áudio original (HTTP ${audioRes.status})`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const mimeType = audioRes.headers.get('content-type') || (audioUrl.includes('.webm') ? 'audio/webm' : 'audio/mpeg');

    // 2) ASR
    const { text: originalText } = await transcribeAudio(audioBuffer, mimeType, hfToken);

    // 3) Tradução
    const { translated, source } = await translateText(originalText, targetLang);

    // 4) TTS com a voz do usuário (fallback em cadeia: voo salvo → outro
    //    provedor persistente → free.ai por chamada)
    let ttsBuffer;
    let ttsMime = 'audio/mpeg';
    try {
      const tts = await ttsWithVoice(provider, voiceId, translated, sampleSrc);
      ttsBuffer = tts.buffer;
      ttsMime = tts.mime;
    } catch (ttsErr) {
      const altProvider = provider === 'fish' ? 'elevenlabs' : (provider === 'elevenlabs' ? 'fish' : null);
      const altKey = altProvider === 'fish' ? getFishKey() : getElevenKey();
      let retried = false;

      if (altProvider && altKey && altProvider !== provider) {
        try {
          const altVoice = await createUserVoice(admin, auth.user.id, sampleSrc, altProvider);
          provider = altVoice.provider;
          voiceId = altVoice.voiceId;
          const tts = await ttsWithVoice(provider, voiceId, translated, sampleSrc);
          ttsBuffer = tts.buffer;
          ttsMime = tts.mime;
          retried = true;
        } catch (altErr) {
          console.warn(`[dub-audio] Fallback ${altProvider} falhou:`, altErr.code, altErr.message);
        }
      }

      if (!retried && getFreeAiKey() && sampleSrc) {
        console.warn(`[dub-audio] Tentando free.ai por chamada p/ ${auth.user.id}`);
        const tts = await freeAiCloneAndTts(sampleSrc, translated);
        provider = 'freeai';
        voiceId = null;
        ttsBuffer = tts.buffer;
        ttsMime = tts.mime;
        retried = true;
      }

      if (!retried) throw ttsErr;
    }

    const methodLabel = provider === 'fish' ? 'fish_own_voice'
      : provider === 'freeai' ? 'freeai_own_voice'
      : 'elevenlabs_own_voice';
    const methodMsg = provider === 'fish'
      ? 'Áudio dublado com a sua voz (Fish Audio, grátis).'
      : provider === 'freeai'
        ? 'Áudio dublado com a sua voz (free.ai, grátis).'
        : 'Áudio dublado com a sua voz (ElevenLabs).';

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        status: 'completed',
        originalText,
        sourceLang: source,
        translatedText: translated,
        audioBase64: ttsBuffer.toString('base64'),
        mimeType: ttsMime,
        method: methodLabel,
        message: methodMsg,
      }),
    };
  } catch (err) {
    const code = err.code || 'DUB_FAILED';
    return fail(code, err.message || 'Erro na dublagem.');
  }
};