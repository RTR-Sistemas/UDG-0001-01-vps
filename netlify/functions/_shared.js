import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

export const corsHeaders = (methods = 'GET, POST, OPTIONS') => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': methods,
  'Cache-Control': 'no-store',
});

export const createAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas');
  }

  const normalizedKey = String(supabaseServiceRoleKey || '').trim();
  const isSecretKey = normalizedKey.startsWith('sb_secret_');
  const isLegacyJwt = normalizedKey.split('.').length >= 3;

  if (!isSecretKey && !isLegacyJwt) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY inválida: use uma service_role legada ou uma secret key sb_secret_ do Supabase.');
  }

  if (isLegacyJwt) {
    const keyPayload = decodeJwtPayload(normalizedKey);
    const role = keyPayload?.role || keyPayload?.app_metadata?.role || null;
    if (role && role !== 'service_role') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY inválida: a JWT configurada não possui role service_role.');
    }
  }

  return createClient(supabaseUrl, normalizedKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: {
        apikey: normalizedKey,
        Authorization: `Bearer ${normalizedKey}`,
        'X-Client-Info': 'netlify-functions-admin',
      },
    },
  });
};

export const getBearerToken = (event) => {
  const authHeader = event?.headers?.authorization || event?.headers?.Authorization;
  const normalized = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!normalized || typeof normalized !== 'string') return null;
  const m = normalized.trim().match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
};

export const requireUser = async (event, supabaseAdmin) => {
  const token = getBearerToken(event);
  if (!token) return { ok: false, statusCode: 401, body: { error: 'Token ausente' } };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, statusCode: 401, body: { error: 'Token inválido ou expirado' } };
  }

  return { ok: true, user: data.user, token };
};

const base64UrlToBytes = (input) => {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = Buffer.from(normalized + padding, 'base64');
  return new Uint8Array(binary);
};

const bytesToBase64Url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export const getVapidConfig = () => ({
  publicKey: String(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || process.env.WEBPUSH_VAPID_PUBLIC_KEY || '').trim(),
  privateKey: String(process.env.VAPID_PRIVATE_KEY || process.env.WEBPUSH_VAPID_PRIVATE_KEY || '').trim(),
  subject: String(process.env.VAPID_SUBJECT || process.env.WEBPUSH_VAPID_SUBJECT || 'mailto:undoingapp@gmail.com').trim(),
});

export const validateVapidKeyPair = (publicKeyBase64url, privateKeyBase64url) => {
  if (!publicKeyBase64url || !privateKeyBase64url) {
    return { valid: false, reason: 'missing' };
  }

  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(base64UrlToBytes(privateKeyBase64url)));
    const derivedPublic = ecdh.getPublicKey();
    const providedPublic = Buffer.from(base64UrlToBytes(publicKeyBase64url));
    const valid = derivedPublic.equals(providedPublic);
    return {
      valid,
      reason: valid ? 'ok' : 'mismatch',
      derivedPublicKey: bytesToBase64Url(derivedPublic),
    };
  } catch (error) {
    return {
      valid: false,
      reason: 'invalid-format',
      error: error?.message || 'unknown',
    };
  }
};

export const vapidKeysToJWK = (publicKeyBase64url, privateKeyBase64url) => {
  if (!publicKeyBase64url || !privateKeyBase64url) {
    throw new Error('VAPID public/private keys ausentes para conversão JWK');
  }

  const pubBytes = base64UrlToBytes(publicKeyBase64url);
  const raw = pubBytes.length === 65 && pubBytes[0] === 4 ? pubBytes.slice(1) : pubBytes;
  if (raw.length !== 64) {
    throw new Error(`Chave pública VAPID inválida: tamanho ${raw.length} bytes`);
  }

  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(raw.slice(0, 32)),
    y: bytesToBase64Url(raw.slice(32, 64)),
    d: privateKeyBase64url,
  };
};

// ─── Firebase FCM HTTP v1 Helpers ────────────────────────────────────────────

// Cor roxa primária do sistema Undoing (usada em todas as notificações FCM)
const UNDOING_PURPLE = '#7C3AED';
const UNDOING_CHANNEL_ID = 'undoing_push_channel';

/**
 * Carrega o service account do Firebase a partir da variável de ambiente
 * FIREBASE_SERVICE_ACCOUNT_JSON (JSON stringificado).
 */
export const getFirebaseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada nas variáveis de ambiente da Netlify.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida: não é um JSON válido.');
  }
};

/**
 * Gera um JWT assinado com a chave privada da service account para autenticar
 * com a Google OAuth2 Token API (necessário para FCM HTTP v1).
 */
const generateServiceAccountJwt = (serviceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  return `${signingInput}.${signature}`;
};

/**
 * Troca o JWT da service account por um access_token OAuth2 do Google.
 * Usado para autenticar chamadas à FCM HTTP v1 API.
 */
export const getGoogleAccessToken = async (serviceAccount) => {
  const jwt = generateServiceAccountJwt(serviceAccount);
  const tokenUrl = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao obter Google OAuth2 access token: ${text}`);
  }

  const data = await response.json();
  return String(data.access_token || '');
};

/**
 * Envia uma notificação push via FCM HTTP v1 API para um token FCM específico.
 *
 * Design aprimorado:
 *  - Fundo/tint roxo (#7C3AED) — identidade visual Undoing
 *  - Canal `undoing_push_channel` com prioridade HIGH e luz LED roxa
 *  - Vibração e som padrão habilitados
 *  - Suporte a imagem (bigPicture) e ícone grande (avatar do remetente)
 *  - Dados extras no payload `data` para navegação deep-link ao toque
 */
export const sendFcmPushMessage = async ({ fcmToken, notification, projectId, accessToken }) => {
  // Converte todos os campos de data para string (obrigatório pelo FCM HTTP v1)
  const messageData = {};
  if (notification?.data && typeof notification.data === 'object') {
    for (const [k, v] of Object.entries(notification.data)) {
      if (v !== null && v !== undefined) {
        messageData[k] = String(v);
      }
    }
  }
  // Garante que a URL de navegação está no data para deep-link
  if (notification?.url) messageData.url = String(notification.url);
  if (notification?.tag) messageData.tag = String(notification.tag);
  if (notification?.icon) messageData.icon = String(notification.icon);

  // Determina se há imagem para a notificação expandida
  const hasImage = typeof notification?.image === 'string' && notification.image.startsWith('http');
  // Usa avatar do remetente como ícone grande (se disponível)
  const largeIcon = typeof notification?.icon === 'string' && notification.icon.startsWith('http')
    ? notification.icon
    : undefined;

  const message = {
    message: {
      token: fcmToken,

      // ── Título e corpo padrão ──────────────────────────────────────────────
      notification: {
        title: notification?.title || 'Undoing',
        body: notification?.body || 'Você recebeu uma nova notificação.',
        ...(hasImage ? { image: notification.image } : {}),
      },

      // ── Configuração Android (FCM HTTP v1) ────────────────────────────────
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        collapse_key: notification?.tag || undefined,
        notification: {
          // Canal definido no AndroidManifest e criado programaticamente pelo app
          channel_id: UNDOING_CHANNEL_ID,

          // Cor do tint do ícone e LED de notificação — roxo Undoing
          color: UNDOING_PURPLE,

          // Usa ícone padrão configurado no AndroidManifest.xml

          // Ícone grande (avatar do remetente)
          ...(largeIcon ? { image: largeIcon } : {}),

          // Imagem expandida (BigPicture)
          ...(hasImage ? { image: notification.image } : {}),

          // Som e vibração
          sound: 'default',
          default_sound: true,
          default_vibrate_timings: false,
          vibrate_timings: ['0s', '0.3s', '0.15s', '0.3s', '0.15s', '0.3s'],

          // Prioridade visual — aparece no topo mesmo com DND
          notification_priority: 'PRIORITY_HIGH',
          visibility: 'PUBLIC',

          // Badge de contagem
          notification_count: notification?.data?.badgeCount
            ? Number(notification.data.badgeCount) || 0
            : undefined,

          // Tag para agrupamento (evita spam de notificações duplicadas)
          tag: notification?.tag || undefined,
        },
      },

      // ── Payload de dados para deep-link e lógica client ───────────────────
      data: messageData,
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    const code = parsed?.error?.status || parsed?.error?.code || response.status;
    const msg = parsed?.error?.message || text;

    // Token inválido/expirado → sinaliza para desativar no DB
    if (code === 'UNREGISTERED' || code === 404 || response.status === 404) {
      const err = new Error(`FCM token expirado: ${msg}`);
      err.fcmExpired = true;
      throw err;
    }
    throw new Error(`FCM HTTP v1 falhou (${code}): ${msg}`);
  }

  return response.json();
};
