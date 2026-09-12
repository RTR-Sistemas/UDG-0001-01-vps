/**
 * =============================================================================
 * File: netlify/functions/translate-audio.js
 * Purpose: Pipeline UNIFICADO de tradução/dublagem de áudio.
 *          Substitui voice-clone-translate.js (envio) e dub-audio.js (recebimento).
 *
 * Fluxo único:
 *   1. Autentica usuário (JWT) → garante voz clonada em user_voices
 *   2. ASR (Whisper via HuggingFace) → transcrição + idioma detectado
 *   3. Tradução texto (Google Translate unofficial gtx)
 *   4. TTS com VOZ DO PRÓPRIO USUÁRIO (ElevenLabs → Fish → free.ai)
 *
 * REGRA: dublagem SÓ com voz do próprio usuário. Sem voz = VOICE_SAMPLE_REQUIRED.
 * =============================================================================
 */
import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

const ELEVEN_API = 'https://api.elevenlabs.io/v1';
const FISH_API = 'https://api.fish.audio';
const FREEAI_API = 'https://api.free.ai';

function getElevenKey() { return process.env.ELEVENLABS_API_KEY || ''; }
function getFishKey() { return process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || ''; }
function getFreeAiKey() { return process.env.FREEAI_API_KEY || process.env.FREE_AI_API_KEY || ''; }
function getHfToken() { return process.env.HUGGINGFACE_TOKEN_DUBLAGEM || process.env.HUGGINGFACE_TOKEN || process.env.HF_API_TOKEN || ''; }

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

function raise(code, message) { const err = new Error(message); err.code = code; throw err; }

async function downloadSample(sampleAudioUrl) {
  const sampleRes = await fetchWithTimeout(sampleAudioUrl, {}, 30000);
  if (!sampleRes.ok) raise('VOICE_SAMPLE_DOWNLOAD_FAILED', `Falha ao baixar amostra (HTTP ${sampleRes.status})`);
  const sampleBuffer = Buffer.from(await sampleRes.arrayBuffer());
  if (sampleBuffer.length < 8000) raise('VOICE_SAMPLE_TOO_SHORT', 'Amostra muito curta (mín. 3s).');
  return { buffer: sampleBuffer, type: sampleRes.headers.get('content-type') || 'audio/mpeg' };
}

// ─── Banco: user_voices ──────────────────────────────────────────────────────
async function getUserVoice(admin, userId) {
  const { data } = await admin.from('user_voices').select('voice_id, provider, sample_audio_url').eq('user_id', userId).maybeSingle();
  if (!data?.voice_id) return null;
  return { voiceId: data.voice_id, provider: data.provider || 'elevenlabs', sampleUrl: data.sample_audio_url || null };
}

// ─── Provedor 1: ElevenLabs ──────────────────────────────────────────────────
async function elevenCloneVoice(sampleAudioUrl) {
  const key = getElevenKey(); if (!key) raise('ELEVENLABS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY não configurada.');
  const { buffer, type } = await downloadSample(sampleAudioUrl);
  const form = new FormData();
  form.append('name', `udg_voz_${Date.now()}`);
  form.append('files', new Blob([buffer], { type }), 'sample.mp3');
  form.append('remove_background_noise', 'true');
  const cloneRes = await fetchWithTimeout(`${ELEVEN_API}/voices/add`, { method: 'POST', headers: { 'xi-api-key': key }, body: form }, 60000);
  const cloneBody = await cloneRes.text().catch(() => '');
  if (!cloneRes.ok) {
    if (cloneRes.status === 401 || cloneRes.status === 403 || cloneBody.includes('invalid_api_key')) raise('ELEVENLABS_UNAUTHORIZED', 'Chave ElevenLabs inválida/sem permissão.');
    if (cloneBody.includes('instant_voice_cloning') || cloneBody.includes('paid_plan_required')) raise('ELEVENLABS_PLAN_REQUIRED', 'Plano ElevenLabs não inclui clonagem (Starter+).');
    raise('VOICE_CLONE_FAILED', `Clonagem falhou (${cloneRes.status}): ${cloneBody.slice(0, 200)}`);
  }
  let voiceId = null; try { voiceId = JSON.parse(cloneBody).voice_id; } catch {}
  if (!voiceId) raise('VOICE_CLONE_FAILED', 'ElevenLabs não retornou voice_id.');
  return voiceId;
}

// ─── Provedor 2: Fish Audio (grátis) ─────────────────────────────────────────
async function fishCloneVoice(sampleAudioUrl) {
  const key = getFishKey(); if (!key) raise('FISH_NOT_CONFIGURED', 'FISH_API_KEY não configurada.');
  const { buffer, type } = await downloadSample(sampleAudioUrl);
  const form = new FormData();
  form.append('type', 'tts'); form.append('title', `udg_voz_${Date.now()}`);
  form.append('description', 'Voz do usuário Undoing (dublagem chat)');
  form.append('visibility', 'private'); form.append('train_mode', 'fast');
  form.append('voices', new Blob([buffer], { type }), 'sample');
  const cloneRes = await fetchWithTimeout(`${FISH_API}/model`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }, 90000);
  const cloneBody = await cloneRes.text().catch(() => '');
  if (!cloneRes.ok) {
    if (cloneRes.status === 401 || cloneRes.status === 403) raise('FISH_UNAUTHORIZED', 'Chave Fish Audio inválida.');
    if (cloneBody.toLowerCase().includes('payment') || cloneBody.toLowerCase().includes('quota') || cloneBody.toLowerCase().includes('limit')) raise('FISH_LIMIT', 'Limite grátis Fish Audio atingido.');
    raise('VOICE_CLONE_FAILED', `Clonagem falhou (${cloneRes.status}): ${cloneBody.slice(0, 200)}`);
  }
  let modelId = null, state = null;
  try { const p = JSON.parse(cloneBody); modelId = p._id || p.id; state = p.state; } catch {}
  if (!modelId) raise('VOICE_CLONE_FAILED', 'Fish não retornou model_id.');
  for (let i = 0; i < 8 && state && !['trained','ready','active'].includes(state); i++) {
    await new Promise(r => setTimeout(r, 2000));
    try { const st = await fetchWithTimeout(`${FISH_API}/model/${modelId}`, { headers: { Authorization: `Bearer ${key}` } }, 15000); if (st.ok) { const sp = await st.json().catch(() => null); state = sp?.state || sp?.status || state; } } catch {}
  }
  return modelId;
}

// ─── Provedor 3: free.ai (clone + TTS por chamada) ───────────────────────────
async function freeAiCloneAndTts(sampleAudioUrl, text) {
  const key = getFreeAiKey(); if (!key) raise('FREEAI_NOT_CONFIGURED', 'FREEAI_API_KEY não configurada.');
  const { buffer, type } = await downloadSample(sampleAudioUrl);
  const form = new FormData();
  form.append('audio', new Blob([buffer], { type }), 'sample.mp3');
  form.append('text', text); form.append('model', 'qwen3-tts');
  const genRes = await fetchWithTimeout(`${FREEAI_API}/v1/voice/clone/`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }, 240000);
  const genBody = await genRes.text().catch(() => '');
  if (!genRes.ok) {
    if (genRes.status === 401 || genRes.status === 403) raise('FREEAI_UNAUTHORIZED', 'Chave free.ai inválida.');
    if (genRes.status === 402 || genBody.toLowerCase().includes('insufficient') || genBody.toLowerCase().includes('token')) raise('FREEAI_LIMIT', 'Cota grátis free.ai atingida.');
    raise('TTS_FAILED', `Síntese falhou (${genRes.status}).`);
  }
  let audioUrl = null; try { audioUrl = JSON.parse(genBody).audio_url || JSON.parse(genBody).url; } catch {}
  if (!audioUrl) raise('TTS_FAILED', 'free.ai não retornou áudio.');
  const audioRes = await fetchWithTimeout(audioUrl, {}, 90000);
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio free.ai (HTTP ${audioRes.status})`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  if (audioBuffer.length < 1000) raise('TTS_FAILED', 'Áudio vazio.');
  return { buffer: audioBuffer, mime: 'audio/wav' };
}

// ─── Cria/garante voz do usuário (cadeia Eleven → Fish → free.ai) ────────────
async function ensureUserVoice(admin, userId, sampleAudioUrl, forceProvider = null) {
  if (!sampleAudioUrl) raise('VOICE_SAMPLE_REQUIRED', 'Amostra de voz necessária para dublar com sua voz.');
  const providers = forceProvider ? [forceProvider] : (getElevenKey() ? ['elevenlabs', 'fish'] : ['fish']);
  let lastError = null;
  for (const provider of providers) {
    if (provider === 'fish' && !getFishKey()) continue;
    try {
      const voiceId = provider === 'elevenlabs' ? await elevenCloneVoice(sampleAudioUrl) : await fishCloneVoice(sampleAudioUrl);
      await admin.from('user_voices').upsert({ user_id: userId, voice_id: voiceId, provider, sample_audio_url: sampleAudioUrl, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      console.log(`[translate-audio] Voz registrada ${userId}: ${provider}/${voiceId}`);
      return { voiceId, provider, sampleUrl: sampleAudioUrl };
    } catch (e) { lastError = e; console.warn(`[translate-audio] ${provider} falhou:`, e.code, e.message); }
  }
  throw lastError;
}

// ─── ASR: Whisper ────────────────────────────────────────────────────────────
const ASR_MODELS = ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'];
function normalizeAsrMime(mime) {
  const raw = String(mime || '').toLowerCase().split(';')[0].trim();
  if (['video/webm','audio/webm','video/mp4','audio/mp4'].includes(raw)) return 'audio/webm';
  if (['audio/x-wav','audio/wav','audio/wave'].includes(raw)) return 'audio/wav';
  if (['audio/x-mpeg','audio/x-mpeg-3','audio/mpeg','audio/mp3'].includes(raw)) return 'audio/mpeg';
  if (['audio/ogg','audio/opus'].includes(raw)) return 'audio/ogg';
  if (['audio/x-flac','audio/flac'].includes(raw)) return 'audio/flac';
  if (['audio/m4a','audio/x-m4a'].includes(raw)) return 'audio/m4a';
  return 'audio/webm';
}
async function transcribeAudio(audioBuffer, mimeType, hfToken) {
  const normalizedMime = normalizeAsrMime(mimeType);
  let lastError = null;
  for (let pass = 0; pass < 2; pass++) {
    for (const model of ASR_MODELS) {
      try {
        const res = await fetchWithTimeout(`https://router.huggingface.co/hf-inference/models/${model}`, { method: 'POST', headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': normalizedMime }, body: audioBuffer }, 30000);
        if (res.ok) { const data = await res.json(); if (data?.text?.trim()) return { text: data.text, language: data.language || 'unknown' }; }
        else if (res.status === 503) { const ej = await res.json().catch(() => null); await new Promise(r => setTimeout(r, Math.min(Number(ej?.estimated_time) || 4, 8) * 1000)); }
        else { lastError = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`; if (res.status >= 500 || res.status === 429) await new Promise(r => setTimeout(r, 1500)); }
      } catch (e) { lastError = e.message; await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  raise('ASR_FAILED', `Transcrição falhou: ${lastError || 'modelos indisponíveis'}`);
}

// ─── Tradução texto (Google gtx) ─────────────────────────────────────────────
async function translateText(text, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ld&q=${encodeURIComponent(text.slice(0, 4000))}`;
    const res = await fetchWithTimeout(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; udg-translate/1.0)' } }, 12000);
    if (res.ok) { const data = await res.json(); if (Array.isArray(data) && Array.isArray(data[0])) { const translated = data[0].map(p => Array.isArray(p) ? p[0] : '').filter(Boolean).join(''); const source = typeof data[2] === 'string' ? data[2] : 'auto'; if (translated) return { translated, source }; } }
  } catch (e) { console.warn('[translate-audio] Google gtx falhou:', e.message); }
  // Fallback: MyMemory (grátis, sem chave). Mantém a dublagem viva se o gtx cair/limitar.
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${encodeURIComponent(`en|${targetLang}`)}`;
    const res = await fetchWithTimeout(url, { method: 'GET' }, 12000);
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (translated) return { translated, source: 'auto' };
    }
  } catch (e) { console.warn('[translate-audio] MyMemory falhou:', e.message); }
  raise('TRANSLATION_FAILED', 'Serviço de tradução indisponível.');
}

// ─── TTS com voz do usuário ──────────────────────────────────────────────────
async function elevenTts(voiceId, text) {
  const key = getElevenKey(); if (!key) raise('ELEVENLABS_NOT_CONFIGURED', 'ELEVENLABS_API_KEY não configurada.');
  const res = await fetchWithTimeout(`${ELEVEN_API}/text-to-speech/${voiceId}`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 } }) }, 90000);
  if (!res.ok) { const body = await res.text().catch(() => ''); if (res.status === 401 || res.status === 403) raise('ELEVENLABS_UNAUTHORIZED', 'Chave ElevenLabs sem permissão TTS.'); raise('TTS_FAILED', `Síntese falhou (${res.status}).`); }
  const buffer = Buffer.from(await res.arrayBuffer()); if (buffer.length < 1000) raise('TTS_FAILED', 'Áudio vazio.'); return buffer;
}
async function fishTts(voiceId, text) {
  const key = getFishKey(); if (!key) raise('FISH_NOT_CONFIGURED', 'FISH_API_KEY não configurada.');
  const res = await fetchWithTimeout(`${FISH_API}/v1/tts`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's2.1-pro-free' }, body: JSON.stringify({ text, reference_id: voiceId, format: 'mp3' }) }, 90000);
  if (!res.ok) { const body = await res.text().catch(() => ''); if (res.status === 401 || res.status === 403) raise('FISH_UNAUTHORIZED', 'Chave Fish inválida.'); if (res.status === 402 || body.toLowerCase().includes('payment')) raise('FISH_LIMIT', 'Limite grátis Fish atingido.'); if (res.status === 429) raise('TTS_FAILED', 'Limite temporário, tente depois.'); raise('TTS_FAILED', `Síntese falhou (${res.status}).`); }
  const buffer = Buffer.from(await res.arrayBuffer()); if (buffer.length < 1000) raise('TTS_FAILED', 'Áudio vazio.'); return buffer;
}
async function ttsWithVoice(provider, voiceId, text, sampleAudioUrl = null) {
  if (provider === 'fish') return { buffer: await fishTts(voiceId, text), mime: 'audio/mpeg' };
  if (provider === 'freeai') { if (!sampleAudioUrl) raise('VOICE_SAMPLE_REQUIRED', 'Amostra necessária para free.ai.'); return freeAiCloneAndTts(sampleAudioUrl, text); }
  return { buffer: await elevenTts(voiceId, text), mime: 'audio/mpeg' };
}

// ═══════════════════════════════════════════════════════════════════════════════
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };

  let admin; try { admin = createAdminClient(); } catch (e) { return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'BACKEND_NOT_CONFIGURED', message: e.message }) }; }
  const auth = await requireUser(event, admin); if (!auth.ok) return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'not_authenticated' }) };

  let body; try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'invalid_json' }) }; }

  const { audio, audioUrl, targetLang = 'pt', originalText, sampleAudioUrl, voiceId: providedVoiceId, providerOverride } = body;
  const hasAudioBlob = !!audio; const hasAudioUrl = !!audioUrl;
  if (!hasAudioBlob && !hasAudioUrl) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'audio (base64) ou audioUrl é obrigatório.' }) };

  const hfToken = getHfToken(); if (!hfToken) return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'HUGGINGFACE_TOKEN não configurado.' }) };

  const fail = (code, message) => { console.error(`[translate-audio] ${code}: ${message}`); return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: false, error: code, message }) }; };

  try {
    // 0) Voz do usuário
    let userVoice = null; let sampleSrc = sampleAudioUrl;
    if (providedVoiceId) { userVoice = { voiceId: providedVoiceId, provider: getElevenKey() ? 'elevenlabs' : 'fish', sampleUrl: sampleAudioUrl }; }
    else if (providerOverride === 'freeai' && sampleSrc) { userVoice = { voiceId: null, provider: 'freeai', sampleUrl: sampleSrc }; }
    else if (providerOverride === 'fish' || providerOverride === 'elevenlabs') { userVoice = await ensureUserVoice(admin, auth.user.id, sampleAudioUrl, providerOverride); sampleSrc = userVoice.sampleUrl; }
    else { userVoice = await getUserVoice(admin, auth.user.id); }

    if (!userVoice) {
      try { userVoice = await ensureUserVoice(admin, auth.user.id, sampleAudioUrl); sampleSrc = userVoice.sampleUrl; }
      catch (cloneErr) { console.warn(`[translate-audio] Clonagem falhou ${auth.user.id}:`, cloneErr.code, cloneErr.message); if (getFreeAiKey() && sampleSrc) userVoice = { voiceId: null, provider: 'freeai', sampleUrl: sampleSrc }; else throw cloneErr; }
    }
    let { voiceId, provider } = userVoice;

    // 1) Áudio original
    let audioBuffer, mimeType;
    if (hasAudioBlob) {
      let mime = 'audio/webm'; const mm = audio.match(/^data:([^;]+);/); if (mm) mime = mm[1];
      let b64 = audio; if (audio.includes(';base64,')) b64 = audio.split(';base64,')[1]; else if (audio.includes(',')) b64 = audio.split(',')[1];
      audioBuffer = Buffer.from(b64, 'base64'); mimeType = mime;
    } else {
      const ar = await fetchWithTimeout(audioUrl, {}, 30000); if (!ar.ok) throw new Error(`Falha ao baixar áudio (HTTP ${ar.status})`);
      audioBuffer = Buffer.from(await ar.arrayBuffer()); mimeType = ar.headers.get('content-type') || (audioUrl.includes('.webm') ? 'audio/webm' : 'audio/mpeg');
    }

    // 2) ASR (pula se originalText fornecido)
    let transcription = { text: originalText, language: 'unknown' };
    // CORRECAO DE DIAGNOSTICO: o catch abaixo engolia o erro real do ASR e
    // zerava o texto, entao QUALQUER falha do Whisper (token sem permissao,
    // modelo frio, 429, rede) chegava ao usuario como "nao detectamos fala" —
    // apontando para o lado errado. Agora o motivo real e preservado.
    let asrError = null;
    if (!transcription.text?.trim()) {
      try { transcription = await transcribeAudio(audioBuffer, mimeType, hfToken); }
      catch (e) { console.warn('[translate-audio] ASR falhou:', e.code, e.message); asrError = e; transcription = { text: null }; }
    }
    if (!transcription.text?.trim()) {
      if (asrError) return fail(asrError.code || 'ASR_FAILED', asrError.message || 'Falha ao transcrever o áudio.');
      return fail('NO_SPEECH', 'Não foi possível detectar fala no áudio.');
    }

    // 3) Tradução
    const { translated, source } = await translateText(transcription.text, targetLang);

    // 4) TTS com voz do usuário (fallback em cadeia)
    let ttsBuffer, ttsMime = 'audio/mpeg';
    try { const tts = await ttsWithVoice(provider, voiceId, translated, sampleSrc); ttsBuffer = tts.buffer; ttsMime = tts.mime; }
    catch (ttsErr) {
      const altProvider = provider === 'fish' ? 'elevenlabs' : (provider === 'elevenlabs' ? 'fish' : null);
      const altKey = altProvider === 'fish' ? getFishKey() : getElevenKey(); let retried = false;
      if (altProvider && altKey && altProvider !== provider) {
        try { const altVoice = await ensureUserVoice(admin, auth.user.id, sampleSrc, altProvider); provider = altVoice.provider; voiceId = altVoice.voiceId; const tts = await ttsWithVoice(provider, voiceId, translated, sampleSrc); ttsBuffer = tts.buffer; ttsMime = tts.mime; retried = true; } catch (altErr) { console.warn(`[translate-audio] Fallback ${altProvider} falhou:`, altErr.code, altErr.message); }
      }
      if (!retried && getFreeAiKey() && sampleSrc) { console.warn(`[translate-audio] Tentando free.ai p/ ${auth.user.id}`); const tts = await freeAiCloneAndTts(sampleSrc, translated); provider = 'freeai'; voiceId = null; ttsBuffer = tts.buffer; ttsMime = tts.mime; retried = true; }
      if (!retried) throw ttsErr;
    }

    const methodLabel = provider === 'fish' ? 'fish_own_voice' : provider === 'freeai' ? 'freeai_own_voice' : 'elevenlabs_own_voice';
    const methodMsg = provider === 'fish' ? 'Áudio traduzido com sua voz (Fish Audio, grátis).' : provider === 'freeai' ? 'Áudio traduzido com sua voz (free.ai, grátis).' : 'Áudio traduzido com sua voz (ElevenLabs).';

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, status: 'completed', originalText: transcription.text, detectedLanguage: source, translatedText: translated, targetLang, audio: `data:${ttsMime};base64,${ttsBuffer.toString('base64')}`, audioBase64: ttsBuffer.toString('base64'), mimeType: ttsMime, method: methodLabel, message: methodMsg }) };
  } catch (err) { return fail(err.code || 'TRANSLATE_AUDIO_FAILED', err.message || 'Erro na tradução/dublagem.'); }
};