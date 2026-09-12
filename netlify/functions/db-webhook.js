/**
 * =============================================================================
 * File: netlify/functions/db-webhook.js
 * Purpose: Recebe webhooks do Supabase (INSERT em tabelas) e dispara
 *          notificações push via Web Push API padrão (PushForge/VAPID).
 * =============================================================================
 */

import { createAdminClient, corsHeaders, vapidKeysToJWK, getFirebaseServiceAccount, getGoogleAccessToken, sendFcmPushMessage } from './_shared.js';
import { buildPushHTTPRequest } from '@pushforge/builder';
import { timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(event) {
  const origin =
    event?.headers?.origin ||
    (event?.headers?.referer ? new URL(event.headers.referer).origin : null);

  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    origin ||
    'https://undoing.com.br'
  );
}

function safePreview(text, max = 80) {
  if (!text) return '';
  const t = String(text).trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function uniqStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(values) ? values : []) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function getHeader(event, name) {
  const key = Object.keys(event.headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? event.headers[key] : null;
}

// CORRECAO DE SEGURANCA (2026-08-28):
// Esta funcao lia o header e devolvia { ok: true } SEM NUNCA COMPARAR com o
// segredo — o endpoint ficava aberto a qualquer um. Como ele dispara push com
// texto e destinatario vindos do corpo da requisicao, dava para mandar
// notificacao para qualquer usuario se passando por qualquer remetente.
// Agora a comparacao existe, e e feita em tempo constante.
function timingSafeEquals(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  try {
    return nodeTimingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function verifyWebhookSecret(event) {
  const secret = process.env.SUPABASE_DB_WEBHOOK_SECRET;

  // Sem segredo configurado o endpoint fica aberto. Recusa por padrao.
  // Escape temporario: DB_WEBHOOK_ALLOW_INSECURE=true nas variaveis da Netlify.
  if (!secret) {
    if (String(process.env.DB_WEBHOOK_ALLOW_INSECURE || '').toLowerCase() === 'true') {
      console.warn('[db-webhook] DB_WEBHOOK_ALLOW_INSECURE=true: aceitando SEM validacao de segredo.');
      return { ok: true, reason: 'insecure-allowed' };
    }
    return { ok: false, reason: 'no-secret-configured' };
  }

  const provided =
    getHeader(event, 'X-Webhook-Secret') ||
    getHeader(event, 'X-Supabase-Event-Signature') ||
    getHeader(event, 'X-Supabase-Webhook-Secret');

  if (!provided) return { ok: false, reason: 'missing-secret-header' };
  if (!timingSafeEquals(provided, secret)) return { ok: false, reason: 'invalid-secret' };

  return { ok: true, reason: 'verified' };
}

// ---------------------------------------------------------------------------
// Filtro por preferências do usuário
// ---------------------------------------------------------------------------

async function filterByPreferences(supabaseAdmin, receiverIds, eventType) {
  if (!receiverIds?.length) return receiverIds;
  try {
    const { data: prefs, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id, push_enabled, messages, mentions, attention_calls, friend_requests, comments, posts')
      .in('user_id', receiverIds);

    if (error || !prefs?.length) return receiverIds;

    const byId = new Map(prefs.map((p) => [p.user_id, p]));
    return receiverIds.filter((id) => {
      const p = byId.get(id);
      if (!p) return true;
      if (p.push_enabled === false) return false;

      switch (eventType) {
        case 'message': return p.messages !== false;
        case 'mention': return p.mentions !== false;
        case 'attention_call': return p.attention_calls !== false;
        case 'friend_request': return p.friend_requests !== false;
        case 'comment': return p.comments !== false;
        case 'post': return p.posts !== false;
        default: return true;
      }
    });
  } catch {
    return receiverIds;
  }
}

// ---------------------------------------------------------------------------
// Envio via Web Push API padrão (PushForge/VAPID)
// ---------------------------------------------------------------------------

async function sendWebPush({ supabaseAdmin, receiverIds, title, message, url, data, iconUrl, badge }) {
  const ids = uniqStrings(receiverIds);
  if (!ids.length) return { ok: true, skipped: true, reason: 'no-receivers' };

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || process.env.WEBPUSH_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || process.env.WEBPUSH_VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || process.env.WEBPUSH_VAPID_SUBJECT || 'mailto:undoingapp@gmail.com';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[Push] ERRO: VAPID keys não configuradas!");
    return { ok: false, error: "Missing VAPID keys" };
  }

  // Busca subscriptions dos receptores (apenas ativas) — inclui fcm_token
  const { data: subscriptions, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, fcm_token, keys_p256dh, keys_auth, failure_count, updated_at, created_at, user_agent, platform, device_type')
    .in('user_id', ids)
    .eq('is_active', true);

  if (subErr) {
    console.error("[Push] Erro ao buscar subscriptions:", subErr);
    return { ok: false, error: subErr.message };
  }

  if (!subscriptions?.length) {
    console.log(`[Push] Nenhuma subscription para ${ids.length} usuários.`);
    return { ok: true, skipped: true, reason: 'no-subscriptions', total: 0 };
  }

  // Deduplica subscrições por dispositivo (evita envios duplos para o mesmo device)
  const deduped = dedupeSubscriptions(subscriptions);
  console.log(`[Push] Enviando para ${deduped.length} dispositivos deduplucados (${ids.length} usuários).`);

  // Payload da notificação – ícone é a foto do usuário que interagiu
  const pushPayloadObj = {
    title,
    body: message,
    icon: iconUrl,
    badge,
    url,
    data,
    tag: data?.tag || data?.eventType || 'notification',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  // Converte VAPID keys raw para JWK (formato exigido pelo @pushforge/builder v2)
  const privateJWK = vapidKeysToJWK(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // ── Prepara Firebase para FCM (APK Android) ──────────────────────────────
  let firebaseServiceAccount = null;
  let fcmAccessToken = null;
  try {
    firebaseServiceAccount = getFirebaseServiceAccount();
  } catch {
    // FCM não configurado — somente Web Push disponível
    console.warn('[Push Webhook] FIREBASE_SERVICE_ACCOUNT_JSON não configurada. FCM desabilitado no webhook.');
  }

  let sent = 0;
  let failed = 0;
  const expiredIds = [];

  for (const sub of deduped) {
    const isFcmSubscription = !!(sub.fcm_token || sub.endpoint?.startsWith('fcm://'));
    const fcmToken = sub.fcm_token || (sub.endpoint?.startsWith('fcm://') ? sub.endpoint.replace('fcm://', '') : null);

    // ── FCM path (APK Android) ────────────────────────────────────────────
    if (isFcmSubscription && fcmToken) {
      if (!firebaseServiceAccount) {
        console.warn('[Push Webhook] FCM subscription encontrada mas FIREBASE_SERVICE_ACCOUNT_JSON não configurada. Pulando.');
        failed += 1;
        continue;
      }
      try {
        if (!fcmAccessToken) {
          fcmAccessToken = await getGoogleAccessToken(firebaseServiceAccount);
        }
        await sendFcmPushMessage({
          fcmToken,
          notification: pushPayloadObj,
          projectId: firebaseServiceAccount.project_id,
          accessToken: fcmAccessToken,
        });
        sent++;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id);
      } catch (err) {
        console.error('[Push Webhook FCM] Falha ao enviar FCM:', fcmToken?.slice(0, 20), err?.message);
        failed++;
        if (err?.fcmExpired) {
          expiredIds.push(sub.id);
        } else {
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ last_failure_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: (sub.failure_count || 0) + 1 })
            .eq('id', sub.id);
        }
      }
      continue;
    }

    // ── Web Push path (browser / PWA) ─────────────────────────────────────
    try {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      const { headers: pushHeaders, body, endpoint } = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload: pushPayloadObj,
          adminContact: VAPID_SUBJECT,
          options: {
            ttl: 86400,
            urgency: data?.eventType === 'attention_call' ? 'high' : 'normal',
          },
        },
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: pushHeaders,
        body,
      });

      if (response.status === 201 || response.status === 200) {
        sent++;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id);
      } else if (response.status === 404 || response.status === 410) {
        console.log(`[Push] Subscription expirada (${response.status}):`, sub.endpoint.slice(0, 60));
        expiredIds.push(sub.id);
        failed++;
      } else {
        console.warn(`[Push] Falha (status ${response.status}):`, sub.endpoint.slice(0, 60));
        failed++;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_failure_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: (sub.failure_count || 0) + 1 })
          .eq('id', sub.id);
      }
    } catch (err) {
      console.error("[Push] Erro ao enviar:", err?.message || err);
      failed++;
    }
  }

  // Desativa subscriptions expiradas (não deleta, para manter histórico)
  if (expiredIds.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ is_active: false, disabled_at: new Date().toISOString(), disabled_reason: 'expired-endpoint', updated_at: new Date().toISOString() })
      .in('id', expiredIds)
      .then(() => console.log(`[Push] ${expiredIds.length} subscriptions expiradas desativadas.`))
      .catch((e) => console.error("[Push] Erro ao desativar:", e));
  }

  return { ok: true, sent, failed, total: deduped.length, rawTotal: subscriptions.length };
}

// Deduplica subscriptions pelo dispositivo (mantém a mais recente por user+platform+device)
function normalizeDeviceSignature(row) {
  const platform = String(row?.platform || 'unknown').trim().toLowerCase();
  const deviceType = String(row?.device_type || 'unknown').trim().toLowerCase();
  const userAgent = String(row?.user_agent || '').trim().toLowerCase();
  if (!userAgent) return `${row?.user_id}::${platform}::${deviceType}::unknown-agent`;
  return `${row?.user_id}::${platform}::${deviceType}::ua:${userAgent}`;
}

function dedupeSubscriptions(rows) {
  const latestByDevice = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const signature = normalizeDeviceSignature(row);
    const currentTs = new Date(row?.updated_at || row?.created_at || 0).getTime() || 0;
    const existing = latestByDevice.get(signature);
    const existingTs = existing ? (new Date(existing.updated_at || existing.created_at || 0).getTime() || 0) : -1;
    if (!existing || currentTs >= existingTs) latestByDevice.set(signature, row);
  }
  return Array.from(latestByDevice.values());
}

// ---------------------------------------------------------------------------
// Handler principal do Webhook
// ---------------------------------------------------------------------------

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const check = verifyWebhookSecret(event);
  if (!check.ok) {
    console.error(`[db-webhook] recusado: ${check.reason}`);
    const status = check.reason === 'no-secret-configured' ? 503 : 401;
    return {
      statusCode: status,
      headers,
      body: JSON.stringify({
        error: check.reason === 'no-secret-configured' ? 'webhook_secret_not_configured' : 'unauthorized',
        message: check.reason === 'no-secret-configured'
          ? 'Defina SUPABASE_DB_WEBHOOK_SECRET nas variaveis da Netlify e o mesmo valor no header do webhook do Supabase.'
          : 'Segredo do webhook ausente ou invalido.',
      }),
    };
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const { type, table, schema, record } = payload || {};
  if (schema && schema !== 'public') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, reason: 'non-public-schema' }) };
  }

  // Apenas INSERTs geram push
  if (type !== 'INSERT') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, reason: 'not-insert' }) };
  }

  // Tabelas Mapeadas
  const ALLOWED_PUSH_TABLES = new Set(['messages', 'comments', 'attention_calls', 'posts', 'friend_requests', 'mentions']);
  if (!ALLOWED_PUSH_TABLES.has(table)) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, reason: 'table-not-handled', table }) };
  }

  const supabaseAdmin = createAdminClient();
  const baseUrl = getBaseUrl(event);
  const appBadgeUrl = `${baseUrl}/icons/icon-72.png`;

  try {
    let receiverIds = [];
    let eventType = null;
    let title = 'Notificação';
    let message = '';
    let url = `${baseUrl}/news`;
    let data = {};
    let imageUrl = null;

    // ---- 1. MESSAGES ----
    if (table === 'messages') {
      eventType = 'message';
      const msg = record;
      if (!msg?.id || !msg?.conversation_id || !msg?.user_id) throw new Error('Missing fields');

      let isGroup = true;
      try {
        const { data: conv } = await supabaseAdmin.from('conversations').select('is_group, max_participants').eq('id', msg.conversation_id).maybeSingle();
        if (conv && conv.is_group === false && (conv.max_participants ?? 2) <= 2) isGroup = false;
      } catch {}

      const { data: participants } = await supabaseAdmin.from('conversation_participants').select('user_id').eq('conversation_id', msg.conversation_id);
      
      receiverIds = (participants || []).map((p) => p.user_id).filter((id) => id && id !== msg.user_id);

      let senderName = 'Nova mensagem';
      let senderAvatar = null;
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', msg.user_id).maybeSingle();
        senderName = prof?.full_name || prof?.username || senderName;
        senderAvatar = prof?.avatar_url || null;
      } catch {}

      // Defesa em profundidade: além da flag `is_pq_encrypted`, olhamos o
      // prefixo do próprio conteúdo. Se a flag falhar por qualquer motivo
      // (linha antiga, cliente desatualizado), o envelope ainda não vaza para
      // dentro de uma notificação push.
      const looksEncrypted =
        msg.is_pq_encrypted === true ||
        (typeof msg.content === 'string' && msg.content.startsWith('pq1.'));

      const msgPreview = looksEncrypted
        ? '🔐 Mensagem criptografada'
        : (msg.content
          ? safePreview(msg.content)
          : '📎 Mídia recebida');

      title = isGroup ? `💬 ${senderName} (grupo)` : `💬 ${senderName}`;
      message = msgPreview;
      url = `${baseUrl}/messages?conversation=${msg.conversation_id}`;
      imageUrl = senderAvatar;
      data = { eventType, conversationId: msg.conversation_id, senderId: msg.user_id };
    }

    // ---- 2. MENTIONS ----
    if (table === 'mentions') {
      eventType = 'mention';
      const m = record;
      receiverIds = m?.mentioned_user_id ? [m.mentioned_user_id] : [];

      let actorName = 'Alguém';
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', m.user_id).maybeSingle();
        actorName = prof?.full_name || prof?.username || actorName;
        imageUrl = prof?.avatar_url || null;
      } catch {}

      title = `📢 ${actorName} mencionou você`;
      message = 'Toque para ver o que falaram sobre você.';
      url = (m?.content_type === 'message') ? `${baseUrl}/messages` : (`${baseUrl}/arena`);
      data = { eventType, mentionId: m.id };
    }

    // ---- 3. FRIEND REQUESTS ----
    if (table === 'friend_requests') {
      eventType = 'friend_request';
      const fr = record;
      if (fr?.status && String(fr.status) !== 'pending') return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true }) };
      
      receiverIds = fr?.receiver_id ? [fr.receiver_id] : [];
      let senderName = 'Um novo usuário';
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', fr.sender_id).maybeSingle();
        senderName = prof?.full_name || prof?.username || senderName;
        imageUrl = prof?.avatar_url || null;
      } catch {}

      title = `🤝 ${senderName} quer ser seu amigo`;
      message = 'Toque para aceitar o convite de amizade.';
      url = `${baseUrl}/news`;
      data = { eventType, friendRequestId: fr.id, senderId: fr.sender_id };
    }

    // ---- 4. ATTENTION CALLS ----
    if (table === 'attention_calls') {
      eventType = 'attention_call';
      const call = record;
      receiverIds = call?.receiver_id ? [call.receiver_id] : [];

      let senderName = 'Alguém';
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', call.sender_id).maybeSingle();
        senderName = prof?.full_name || prof?.username || senderName;
        imageUrl = prof?.avatar_url || null;
      } catch {}

      title = `🚨 ${senderName} chamou sua atenção!`;
      message = safePreview(call.message || 'Abra o app para responder.');
      url = `${baseUrl}/messages?conversation=${call.conversation_id || ''}`;
      data = { eventType, attentionCallId: call.id, senderId: call.sender_id };
    }

    // ---- 5. COMMENTS ----
    if (table === 'comments') {
      eventType = 'comment';
      const comment = record;
      const { data: post } = await supabaseAdmin.from('posts').select('user_id').eq('id', comment.post_id).maybeSingle();
      if (!post) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true }) };

      receiverIds = post.user_id && post.user_id !== comment.user_id ? [post.user_id] : [];

      let commenterName = 'Um fã';
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', comment.user_id).maybeSingle();
        commenterName = prof?.full_name || prof?.username || commenterName;
        imageUrl = prof?.avatar_url || null;
      } catch {}

      title = `💬 ${commenterName} comentou no seu post`;
      message = safePreview(comment.content || 'Toque para ver o comentário.');
      url = `${baseUrl}/arena`;
      data = { eventType, commentId: comment.id, postId: comment.post_id, senderId: comment.user_id };
    }

    // ---- 6. POSTS ----
    if (table === 'posts') {
      eventType = 'post';
      const post = record;

      const [{ data: followers }, { data: friendsA }, { data: friendsB }] = await Promise.all([
        supabaseAdmin.from('followers').select('follower_id').eq('following_id', post.user_id),
        supabaseAdmin.from('friendships').select('friend_id').eq('user_id', post.user_id),
        supabaseAdmin.from('friendships').select('user_id').eq('friend_id', post.user_id)
      ]);

      const ids = new Set();
      (followers || []).forEach((r) => r?.follower_id && ids.add(r.follower_id));
      (friendsA || []).forEach((r) => r?.friend_id && ids.add(r.friend_id));
      (friendsB || []).forEach((r) => r?.user_id && ids.add(r.user_id));
      ids.delete(post.user_id);
      receiverIds = Array.from(ids);

      let authorName = 'Seu contato';
      let authorAvatar = null;
      try {
        const { data: prof } = await supabaseAdmin.from('profiles').select('username, full_name, avatar_url').eq('id', post.user_id).maybeSingle();
        authorName = prof?.full_name || prof?.username || authorName;
        authorAvatar = prof?.avatar_url || null;
      } catch {}

      // Usa a foto do autor como ícone; se houver mídia no post, usa como imagem destacada
      imageUrl = authorAvatar;
      try {
        if (Array.isArray(post.media_urls) && post.media_urls[0]) {
          // imageUrl continua sendo o avatar; a mídia do post fica no corpo da notificação
        }
      } catch {}

      title = `🔥 ${authorName} postou na Arena`;
      message = safePreview(post.content || 'Venha ver o novo post.');
      url = `${baseUrl}/arena`;
      data = { eventType, postId: post.id, authorId: post.user_id };
    }

    if (!eventType) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true }) };

    // Filtrar por preferências e enviar via Web Push
    receiverIds = uniqStrings(receiverIds);
    receiverIds = await filterByPreferences(supabaseAdmin, receiverIds, eventType);
    receiverIds = uniqStrings(receiverIds);

    const result = await sendWebPush({
      supabaseAdmin,
      receiverIds,
      title,
      message,
      url,
      data,
      // Usa a foto do usuário como ícone principal; fallback para a logo do app
      iconUrl: imageUrl || `${baseUrl}/icon-192.png`,
      badge: appBadgeUrl,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, eventType, table, result }),
    };
  } catch (e) {
    console.error('db-webhook error', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e?.message || 'Erro' }),
    };
  }
}
