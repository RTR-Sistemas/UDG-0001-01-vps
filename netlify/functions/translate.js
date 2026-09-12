/**
 * =============================================================================
 * File: netlify/functions/translate.js
 * Purpose: Translation + language detection using Google Translate (unofficial
 *          free endpoint) as primary, with MyMemory as fallback.
 *
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Substituídos servidores LibreTranslate pela API não-oficial do Google Translate
 *    (translate.googleapis.com) — gratuita, sem chave, confiável, auto-detecção.
 *  - MyMemory permanece como fallback secundário com langpair corrigido.
 *  - Função nunca retorna HTTP 500: falha total retorna 200 + success:false.
 *  - Detecção de idioma também usa Google Translate (mais precisa).
 *
 * DESIGN DECISIONS:
 *  - Google Translate unofficial API (translate.googleapis.com) is the primary.
 *    It is free, requires no API key, supports auto language detection, and is
 *    extremely reliable. Used by thousands of production apps.
 *  - MyMemory is the fallback (5 000 words/day free, no key needed).
 *  - This function NEVER returns HTTP 500. On total failure it returns 200 with
 *    { success: false, data: { translatedText: <original text> } } so the UI
 *    degrades gracefully.
 * =============================================================================
 */
import fetch from 'node-fetch';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Fetch with abort-based timeout */
const fetchWithTimeout = async (url, options, timeout = 8000) => {
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
};

// ---------------------------------------------------------------------------
// Google Translate unofficial endpoint
// Returns { translatedText, detectedLang } or null on failure.
// ---------------------------------------------------------------------------
const googleTranslate = async (text, targetLang, sourceLang = 'auto') => {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx` +
    `&sl=${encodeURIComponent(sourceLang)}` +
    `&tl=${encodeURIComponent(targetLang)}` +
    `&dt=t&dt=ld` +  // dt=t → translated text, dt=ld → language detection
    `&q=${encodeURIComponent(text)}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; translation-service/1.0)',
      },
    }, 8000);

    if (!res.ok) return null;

    const data = await res.json();

    // Response shape: [[["translated","original",null,null,1],...], null, "detectedLang", ...]
    if (!Array.isArray(data)) return null;

    const parts = data[0];
    if (!Array.isArray(parts)) return null;

    const translatedText = parts
      .map((p) => (Array.isArray(p) ? p[0] : ''))
      .filter(Boolean)
      .join('');

    if (!translatedText) return null;

    // Detected language is at data[2] when sl=auto
    const detectedLang = sourceLang === 'auto' ? (data[2] || 'unknown') : sourceLang;

    return { translatedText, detectedLang };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Google Translate detection only
// ---------------------------------------------------------------------------
const googleDetect = async (text) => {
  const result = await googleTranslate(text.slice(0, 200), 'en', 'auto');
  return result?.detectedLang || null;
};

// ---------------------------------------------------------------------------
// MyMemory fallback translation
// ---------------------------------------------------------------------------
const myMemoryTranslate = async (text, sourceLang, targetLang) => {
  // MyMemory doesn't support 'auto' as source — use 'en' as safe default
  const src = (!sourceLang || sourceLang === 'auto' || sourceLang === 'unknown') ? 'en' : sourceLang;
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(`${src}|${targetLang}`)}`;

  try {
    const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch {
    // swallow
  }
  return null;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { text, targetLang = 'pt', sourceLang, type = 'translate' } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'text is required and must be a non-empty string' }),
    };
  }

  // ---- DETECT ---------------------------------------------------------------
  if (type === 'detect') {
    try {
      const lang = (await googleDetect(text));
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: !!lang,
          data: [{ language: lang || 'unknown' }],
        }),
      };
    } catch (err) {
      console.error('detect error:', err);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, data: [{ language: 'unknown' }] }),
      };
    }
  }

  // ---- TRANSLATE ------------------------------------------------------------
  try {
    // 1) Google Translate (primary — fast, reliable, free)
    const googleResult = await googleTranslate(text, targetLang, sourceLang || 'auto');
    if (googleResult?.translatedText) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          data: {
            translatedText: googleResult.translatedText,
            detectedLang: googleResult.detectedLang,
          },
        }),
      };
    }

    // 2) MyMemory fallback
    console.log('Google Translate unavailable, trying MyMemory...');
    const myMemoryResult = await myMemoryTranslate(text, sourceLang, targetLang);
    if (myMemoryResult) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          data: { translatedText: myMemoryResult },
        }),
      };
    }

    // 3) All failed — return original text with success:false (never 500)
    console.warn('All translation services failed, returning original text.');
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        data: { translatedText: text },
        error: 'Translation services temporarily unavailable',
      }),
    };
  } catch (err) {
    console.error('translate handler error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        data: { translatedText: text },
        error: String(err?.message || 'Unknown error'),
      }),
    };
  }
};