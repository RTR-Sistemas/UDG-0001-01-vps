/**
 * =============================================================================
 * File: netlify/functions/voice-clone-translate.js
 * Purpose: Pipeline de tradução de voz usado no fluxo de ENVIO (MessageInput):
 *          gravação do usuário + dublagem com a VOZ DO PRÓPRIO USUÁRIO.
 *          Provedores em cadeia: ElevenLabs → Fish Audio (grátis) →
 *          free.ai (resgate por chamada).
 *
 * REGRA DE NEGÓCIO (obrigatória): dublagem SOMENTE com a voz do próprio usuário.
 * Não existe fallback de voz Google/MMS. Se não houver voz ou amostra, retorna
 * VOICE_SAMPLE_REQUIRED.
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const getElevenKey = () => process.env.ELEVENLABS_API_KEY || '';
const getFishKey = () => process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || '';
const getFreeAiKey = () => process.env.FREEAI_API_KEY || process.env.FREE_AI_API_KEY || '';
const getHfToken = () => process.env.HUGGINGFACE_TOKEN_DUBLAGEM || process.env.HUGGINGFACE_TOKEN || process.env.HF_API_TOKEN || '';

async function fetchWithTimeout(url, options, timeout = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
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
    if (sampleRes.status === 401 || sampleRes.status === 403) {
      raise('CLOUDINARY_AUTH_FAILED', 'Não foi possível acessar a amostra de voz (acesso negado).');
    }
    raise('VOICE_SAMPLE_DOWNLOAD_FAILED', `Não foi possível baixar a amostra de voz (HTTP ${sampleRes.status}).`);
  }
  const sampleBuffer = Buffer.from(await sampleRes.arrayBuffer());
  if (sampleBuffer.length < 8000) {
    raise('VOICE_SAMPLE_TOO_SHORT', 'Amostra de voz muito curta. Grave pelo menos 3 segundos.');
  }
  return { buffer: sampleBuffer, type: sampleRes.headers.get('content-type') || 'audio/mpeg' };
}

// ─── PROVEDOR 1: ElevenLabs ──────────────────────────────────────────────────
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
    console.error('[voice-clone-translate] voices/add falhou:', cloneRes.status, cloneBody.substring(0, 300));
    if (cloneRes.status === 401 || cloneRes.status === 403 || cloneBody.includes('invalid_api_key')) {
      raise('ELEVENLABS_UNAUTHORIZED', 'Chave ElevenLabs inválida ou sem permissão de clonagem.');
    }
    if (cloneBody.includes('instant_voice_cloning') || cloneBody.includes('paid_plan_required')) {
      raise('ELEVENLABS_PLAN_REQUIRED', 'Plano ElevenLabs não inclui clonagem (necessário Starter).');
    }
    raise('VOICE_CLONE_FAILED', `Clonagem de voz falhou (${cloneRes.status}).`);
  }
  let voiceId = null;
  try { voiceId = JSON.parse(cloneBody).voice_id || null; } catch { /* ignore */ }
  if (!voiceId) raise('VOICE_CLONE_FAILED', 'ElevenLabs não retornou voice_id.');
  return voiceId;
}

// ─── PROVEDOR 2: Fish Audio (grátis) ─────────────────────────────────────────
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
    console.error('[voice-clone-translate] Fish /model falhou:', cloneRes.status, cloneBody.substring(0, 300));
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
    console.error('[voice-clone-translate] free.ai /v1/voice/clone/ falhou:', genRes.status, genBody.substring(0, 300));
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

  const audioRes = await fetchWithTimeout(audioUrl, {}, 90000);
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio do free.ai (HTTP ${audioRes.status})`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  if (audioBuffer.length < 1000) raise('TTS_FAILED', 'Áudio sintetizado vazio.');
  return { buffer: audioBuffer, mime: 'audio/wav' };
}

async function createUserVoice(admin, userId, sampleAudioUrl, forceProvider = null) {
  if (!sampleAudioUrl) {
    raise('VOICE_SAMPLE_REQUIRED', 'Amostra de voz necessária para dublar com a sua voz. Registre uma amostra de voz.');
  }

  const providers = forceProvider ? [forceProvider] : (getElevenKey() ? ['elevenlabs', 'fish'] : ['fish']);
  let lastError = null;

  for (const provider of providers) {
    if (provider === 'fish' && !getFishKey()) continue;
    try {
      const voiceId = provider === 'elevenlabs'
        ? await elevenCloneVoice(sampleAudioUrl)
        : await fishCloneVoice(sampleAudioUrl);

      await admin.from('user_voices').upsert(
        {
          user_id: userId,
          voice_id: voiceId,
          provider,
          sample_audio_url: sampleAudioUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      console.log(`[voice-clone-translate] Voz registrada p/ ${userId}: ${provider}/${voiceId}`);
      return { voiceId, provider, sampleUrl: sampleAudioUrl };
    } catch (e) {
      lastError = e;
      console.warn(`[voice-clone-translate] Provedor ${provider} falhou:`, e.code, e.message);
    }
  }
  throw lastError;
}

async function getUserVoice(supabaseAdmin, userId) {
  const { data: row } = await supabaseAdmin
    .from('user_voices')
    .select('voice_id, provider, sample_audio_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (!row?.voice_id) return null;
  return {
    voiceId: row.voice_id,
    provider: row.provider || 'elevenlabs',
    sampleUrl: row.sample_audio_url || null,
  };
}

// ─── STEP 1: Whisper ASR ────────────────────────────────────────────────────
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
        const response = await fetchWithTimeout(
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

        if (response.ok) {
          const result = await response.json();
          if (result && result.text && result.text.trim()) {
            return { text: result.text, language: result.language || 'unknown' };
          }
        } else if (response.status === 503) {
          const errJson = await response.json().catch(() => null);
          const wait = Math.min(Number(errJson?.estimated_time) || 4, 8);
          await new Promise((r) => setTimeout(r, wait * 1000));
        } else {
          lastError = `HTTP ${response.status}: ${(await response.text().catch(() => '')).substring(0, 120)}`;
          if (response.status >= 500 || response.status === 429) {
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

// ─── STEP 2: tradução de texto (sem voz) ────────────────────────────────────
async function translateText(text, targetLang) {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ld&q=${encodeURIComponent(text.slice(0, 4000))}`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; udg-clone/1.0)' },
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
    console.warn('[voice-clone-translate] Google gtx falhou:', e.message);
  }
  raise('TRANSLATION_FAILED', 'Serviço de tradução indisponível.');
}

// ─── STEP 3: TTS com a voz do usuário ────────────────────────────────────────
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
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
    }),
  }, 90000);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[voice-clone-translate] TTS ElevenLabs falhou:', res.status, body.substring(0, 300));
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
    console.error('[voice-clone-translate] TTS Fish falhou:', res.status, body.substring(0, 300));
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
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const fail = (code, message) => {
    console.error(`[voice-clone-translate] ${code}: ${message}`);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, error: code, message }) };
  };

  try {
    const supabaseAdmin = createAdminClient();
    const auth = await requireUser(event, supabaseAdmin);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, headers: CORS_HEADERS, body: JSON.stringify(auth.body) };
    }
    const userId = auth.user.id;

    const { audio, targetLang = 'pt', originalText, sampleAudioUrl, voiceId } = JSON.parse(event.body || '{}');

    if (!audio) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Campo "audio" (base64) é obrigatório.' }) };
    }

    // 0) Voz: usa voiceId fornecido, senão a voz salva do usuário, senão clona a
    //    partir da amostra (ElevenLabs → Fish → free.ai por chamada).
    let userVoice = null;
    let sampleSrc = sampleAudioUrl;

    if (voiceId) {
      userVoice = { voiceId, provider: getElevenKey() ? 'elevenlabs' : 'fish', sampleUrl: sampleAudioUrl };
    } else {
      userVoice = await getUserVoice(supabaseAdmin, userId);
      if (!userVoice) {
        try {
          userVoice = await createUserVoice(supabaseAdmin, userId, sampleAudioUrl);
        } catch (cloneErr) {
          console.warn(`[voice-clone-translate] Clonagem Eleven/Fish falhou p/ ${userId}:`, cloneErr.code, cloneErr.message);
          if (getFreeAiKey() && sampleAudioUrl) {
            userVoice = { voiceId: null, provider: 'freeai', sampleUrl: sampleAudioUrl };
          } else {
            throw cloneErr;
          }
        }
      }
    }
    let { voiceId: finalVoiceId, provider } = userVoice;
    sampleSrc = sampleAudioUrl || userVoice.sampleUrl || null;

    const hfToken = getHfToken();
    if (!hfToken) return fail('HF_NOT_CONFIGURED', 'HUGGINGFACE_TOKEN não configurado.');

    // Extrai mimeType e limpa base64
    let mimeType = 'audio/webm';
    const mimeMatch = audio.match(/^data:([^;]+);/);
    if (mimeMatch) mimeType = mimeMatch[1];
    let audioBase64Clean = audio;
    if (audio.includes(';base64,')) audioBase64Clean = audio.split(';base64,')[1];
    else if (audio.includes(',')) audioBase64Clean = audio.split(',')[1];
    const audioBuffer = Buffer.from(audioBase64Clean, 'base64');

    // 1) Transcrição (pula se o cliente já forneceu o texto)
    let transcription = { text: originalText, language: 'unknown' };
    if (!transcription.text || transcription.text.trim().length === 0) {
      try {
        transcription = await transcribeAudio(audioBuffer, mimeType, hfToken);
      } catch (e) {
        console.warn('[voice-clone-translate] ASR falhou:', e.message);
        transcription = { text: null };
      }
    }

    if (!transcription.text || transcription.text.trim().length === 0) {
      return fail('NO_SPEECH', 'Não foi possível detectar fala no áudio.');
    }

    // 2) Tradução
    const { translated, source } = await translateText(transcription.text, targetLang);

    // 3) TTS com a voz do usuário (fallback em cadeia: voo salvo → outro
    //    provedor persistente → free.ai por chamada)
    let ttsBuffer;
    let ttsMime = 'audio/mpeg';
    try {
      const tts = await ttsWithVoice(provider, finalVoiceId, translated, sampleSrc);
      ttsBuffer = tts.buffer;
      ttsMime = tts.mime;
    } catch (ttsErr) {
      const altProvider = provider === 'fish' ? 'elevenlabs' : (provider === 'elevenlabs' ? 'fish' : null);
      const altKey = altProvider === 'fish' ? getFishKey() : getElevenKey();
      let retried = false;

      if (altProvider && altKey && altProvider !== provider) {
        try {
          const altVoice = await createUserVoice(supabaseAdmin, userId, sampleSrc, altProvider);
          provider = altVoice.provider;
          finalVoiceId = altVoice.voiceId;
          const tts = await ttsWithVoice(provider, finalVoiceId, translated, sampleSrc);
          ttsBuffer = tts.buffer;
          ttsMime = tts.mime;
          retried = true;
        } catch (altErr) {
          console.warn(`[voice-clone-translate] Fallback ${altProvider} falhou:`, altErr.code, altErr.message);
        }
      }

      if (!retried && getFreeAiKey() && sampleSrc) {
        console.warn(`[voice-clone-translate] Tentando free.ai por chamada p/ ${userId}`);
        const tts = await freeAiCloneAndTts(sampleSrc, translated);
        provider = 'freeai';
        finalVoiceId = null;
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
      ? 'Áudio traduzido com a sua voz (Fish Audio, grátis).'
      : provider === 'freeai'
        ? 'Áudio traduzido com a sua voz (free.ai, grátis).'
        : 'Áudio traduzido com a sua voz (ElevenLabs).';

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        originalText: transcription.text,
        detectedLanguage: source,
        translatedText: translated,
        targetLang,
        audio: `data:${ttsMime};base64,${ttsBuffer.toString('base64')}`,
        method: methodLabel,
        message: methodMsg,
      }),
    };
  } catch (error) {
    return fail(error.code || 'UNKNOWN', error.message || 'Erro na dublagem.');
  }
};