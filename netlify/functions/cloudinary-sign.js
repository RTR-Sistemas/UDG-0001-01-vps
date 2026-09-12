import crypto from 'crypto';
import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

// -----------------------------------------------------------------------------
// A5-SENTINEL: Rate limiting em memória para prevenir abuso de assinatura
// Limite: 10 assinaturas por usuário a cada 60 segundos
// Nota: eficaz em warm-starts; cold starts reiniciam o map (aceitável)
// -----------------------------------------------------------------------------
const rateLimitMap = new Map(); // userId -> { count, windowStart }
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 segundos

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Nova janela
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Limpeza periódica do map para evitar memory leak em funções long-lived
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, val] of rateLimitMap.entries()) {
    if (val.windowStart < cutoff) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000); // a cada 5 minutos

// -----------------------------------------------------------------------------

function sha1Signature(params, apiSecret) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();

  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    const baseFolder = (process.env.CLOUDINARY_DEFAULT_FOLDER || 'Galeria_UndoinG').trim();

    if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            'Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET e CLOUDINARY_UPLOAD_PRESET no Netlify.',
        }),
      };
    }

    // Autenticação via JWT do Supabase (Bearer)
    const supabaseAdmin = createAdminClient();
    const auth = await requireUser(event, supabaseAdmin);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
    }

    // A5-SENTINEL: Rate limit por usuário autenticado
    const rl = checkRateLimit(auth.user.id);
    if (!rl.allowed) {
      return {
        statusCode: 429,
        headers: {
          ...headers,
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + rl.retryAfter),
        },
        body: JSON.stringify({ error: `Muitas solicitações de upload. Tente novamente em ${rl.retryAfter}s.` }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const timestamp = Math.floor(Date.now() / 1000);

    // Sanitiza subpastas: permite multi-nível e evita ".." / "//" / caracteres estranhos.
    const sanitizeFolder = (raw) => {
      const input = String(raw || '').replace(/\\/g, '/').trim();
      const parts = input
        .split('/')
        .map((p) => p.trim())
        .filter((p) => p && p !== '.' && p !== '..')
        .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, '_'));
      return parts.join('/');
    };

    const requested = typeof body.folder === 'string' && body.folder.trim() ? sanitizeFolder(body.folder) : '';
    const folder = requested ? `${baseFolder}/${requested}` : baseFolder;
    const public_id = typeof body.public_id === 'string' && body.public_id.trim() ? body.public_id.trim() : undefined;

    // Parâmetros que serão enviados no upload (precisam entrar na assinatura)
    const paramsToSign = {
      timestamp,
      folder,
      upload_preset: uploadPreset,
      public_id,
    };

    const signature = sha1Signature(paramsToSign, apiSecret);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(rl.remaining),
      },
      body: JSON.stringify({
        cloudName,
        apiKey,
        uploadPreset,
        folder,
        timestamp,
        signature,
      }),
    };
  } catch (e) {
    console.error('cloudinary-sign error', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
}


// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------
