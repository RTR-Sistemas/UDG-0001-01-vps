/**
 * =============================================================================
 * detect-translate.js
 * Detecta o idioma + traduz em uma chamada (Google Translate unofficial,
 * sem chave — mesmo backend do translate.js).
 *
 * Body: { text, targetLanguage }
 * =============================================================================
 */
import { corsHeaders } from './_shared.js';

const GT = 'https://translate.googleapis.com/translate_a/single';

async function googleTranslate(text, target) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: target,
    dt: 't',
    q: text,
  });
  const res = await fetch(`${GT}?${params.toString()}`, {
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`translate_api_error_${res.status}: ${t.slice(0, 150)}`);
  }
  const data = await res.json();
  const translated = Array.isArray(data?.[0]) ? data[0].map((seg) => seg?.[0] || '').join('') : '';
  const sourceLang = data?.[2] || 'auto';
  return { translated, source_language: sourceLang };
}

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const text = String(body.text || '').slice(0, 5000);
  const target = String(body.targetLanguage || body.target || 'pt').slice(0, 10);
  if (!text.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'text_required' }) };
  }

  try {
    const result = await googleTranslate(text, target);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('[detect-translate] erro:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ error: err?.message || 'translate_error' }) };
  }
}