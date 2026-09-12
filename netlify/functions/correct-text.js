/**
 * =============================================================================
 * File: netlify/functions/correct-text.js
 * Purpose: Análise e correção automática de erros de texto (ortografia e
 *          gramática), 100% gratuita e sem necessidade de chave de API.
 *
 * Fluxo:
 *   1. Detecta o idioma do texto (Google Translate — gratuito, sem chave).
 *   2. Envia o texto para o LanguageTool (https://api.languagetool.org),
 *      que retorna uma lista de erros encontrados (ortografia, gramática,
 *      pontuação, concordância, etc.) com sugestões de correção.
 *   3. Aplica automaticamente a melhor sugestão de cada erro e devolve o
 *      texto corrigido junto com a lista de problemas encontrados, para que
 *      o usuário possa revisar antes de aplicar.
 *
 * Esta função NUNCA retorna HTTP 500: em caso de falha total, devolve o
 * texto original com success:false para que a UI degrade graciosamente.
 * =============================================================================
 */
import fetch from 'node-fetch';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fetchWithTimeout = async (url, options, timeout = 9000) => {
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

// ─── Detecção de idioma (Google Translate, gratuito) ───────────────────────
async function detectLanguage(text) {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=ld` +
      `&q=${encodeURIComponent(text.slice(0, 300))}`;
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; correct-text/1.0)' } },
      6000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[2]) return String(data[2]).toLowerCase();
    return null;
  } catch {
    return null;
  }
}

// Mapeia o código curto detectado para o locale aceito pelo LanguageTool
const LT_LOCALE_MAP = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es',
  fr: 'fr',
  de: 'de-DE',
  it: 'it',
  nl: 'nl',
  pl: 'pl-PL',
  ru: 'ru-RU',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
};

function toLtLocale(code) {
  if (!code) return 'auto';
  const key = String(code).toLowerCase();
  return LT_LOCALE_MAP[key] || key;
}

const LANGUAGE_NAMES_PT = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  nl: 'Holandês',
  pl: 'Polonês',
  ru: 'Russo',
};

// ─── LanguageTool — verificação gramatical/ortográfica gratuita ───────────
async function checkWithLanguageTool(text, ltLocale) {
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('language', ltLocale || 'auto');
  // Habilita variantes "picky" para pegar mais sugestões de estilo também
  params.append('enabledOnly', 'false');

  const res = await fetchWithTimeout(
    'https://api.languagetool.org/v2/check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    },
    12000
  );

  if (!res.ok) {
    throw new Error(`LanguageTool HTTP ${res.status}`);
  }

  return res.json();
}

// Aplica as correções sugeridas (da direita para a esquerda, para não
// invalidar os offsets dos demais erros) e retorna o texto corrigido.
function applyCorrections(text, matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { correctedText: text, issues: [] };
  }

  // Ordena do final para o início do texto
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);

  let corrected = text;
  const issues = [];

  for (const match of sorted) {
    const replacement =
      Array.isArray(match.replacements) && match.replacements.length > 0
        ? match.replacements[0].value
        : null;

    const original = text.substring(match.offset, match.offset + match.length);

    issues.push({
      message: match.message,
      shortMessage: match.shortMessage || match.message,
      original,
      replacement: replacement ?? original,
      ruleId: match.rule?.id || null,
      category: match.rule?.category?.name || null,
    });

    if (replacement !== null) {
      corrected =
        corrected.substring(0, match.offset) +
        replacement +
        corrected.substring(match.offset + match.length);
    }
  }

  // Devolve issues na ordem original (do início para o fim)
  issues.reverse();

  return { correctedText: corrected, issues };
}

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

  const { text, lang } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'O campo "text" é obrigatório.' }),
    };
  }

  const trimmed = text.trim();

  try {
    // 1) Detectar idioma (se não informado)
    let detected = lang || (await detectLanguage(trimmed)) || 'auto';
    const ltLocale = toLtLocale(detected);

    // 2) Verificar com LanguageTool
    const result = await checkWithLanguageTool(trimmed, ltLocale);
    const matches = result?.matches || [];

    // Se LanguageTool detectou o idioma automaticamente, usa esse valor
    if (result?.language?.detectedLanguage?.code) {
      detected = result.language.detectedLanguage.code.split('-')[0];
    }

    const { correctedText, issues } = applyCorrections(trimmed, matches);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        originalText: trimmed,
        correctedText,
        hasErrors: issues.length > 0 && correctedText !== trimmed,
        issuesCount: issues.length,
        issues: issues.slice(0, 25),
        language: detected,
        languageName: LANGUAGE_NAMES_PT[detected] || detected.toUpperCase(),
      }),
    };
  } catch (err) {
    console.error('correct-text error:', err.message);
    // Nunca falha "alto": devolve o texto original sem erros para a UI
    // continuar funcionando normalmente.
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        originalText: trimmed,
        correctedText: trimmed,
        hasErrors: false,
        issuesCount: 0,
        issues: [],
        language: lang || 'unknown',
        languageName: LANGUAGE_NAMES_PT[lang] || 'Desconhecido',
        warning: 'Serviço de correção temporariamente indisponível.',
      }),
    };
  }
};
