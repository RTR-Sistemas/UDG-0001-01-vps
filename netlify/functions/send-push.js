import { buildPushHTTPRequest } from '@pushforge/builder';
import { corsHeaders, createAdminClient, getFirebaseServiceAccount, getGoogleAccessToken, getVapidConfig, requireUser, sendFcmPushMessage, validateVapidKeyPair, vapidKeysToJWK } from './_shared.js';

const PUSH_EVENT_TYPES = new Set([
  'message',
  'mention',
  'attention_call',
  'friend_request',
  'comment',
  'post',
  'community_post',
  'community_member_join',
  'reply',
  'test',
]);

function uniqStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function safePreview(text, max = 80) {
  if (!text) return '';
  const normalized = String(text).trim().replace(/\s+/g, ' ');
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

function normalizeDeviceSignature(row) {
  const platform = String(row?.platform || 'unknown').trim().toLowerCase() || 'unknown';
  const deviceType = String(row?.device_type || 'unknown').trim().toLowerCase() || 'unknown';
  const userAgent = String(row?.user_agent || '').trim().toLowerCase();

  if (!userAgent) {
    return `${row?.user_id || 'unknown'}::${platform}::${deviceType}::unknown-agent`;
  }

  return `${row?.user_id || 'unknown'}::${platform}::${deviceType}::ua:${userAgent}`;
}

function dedupeSubscriptions(rows) {
  const latestByDevice = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const signature = normalizeDeviceSignature(row);
    const currentTs = new Date(row?.updated_at || row?.created_at || 0).getTime() || 0;
    const existing = latestByDevice.get(signature);
    const existingTs = existing ? (new Date(existing.updated_at || existing.created_at || 0).getTime() || 0) : -1;

    if (!existing || currentTs >= existingTs) {
      latestByDevice.set(signature, row);
    }
  }

  return Array.from(latestByDevice.values());
}

function getBaseUrl(event) {
  const origin =
    event?.headers?.origin ||
    (event?.headers?.referer ? new URL(event.headers.referer).origin : null);

  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    origin ||
    'https://undoing.com.br'
  );
}

async function getProfileSummary(supabaseAdmin, userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

async function filterByPreferences(supabaseAdmin, receiverIds, eventType) {
  if (!receiverIds.length) return receiverIds;

  const { data: prefs, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id, push_enabled, messages, mentions, attention_calls, friend_requests, comments, posts')
    .in('user_id', receiverIds);

  if (error || !prefs?.length) return receiverIds;

  const prefsByUser = new Map(prefs.map((item) => [item.user_id, item]));
  return receiverIds.filter((userId) => {
    const pref = prefsByUser.get(userId);
    if (!pref) return true;
    if (pref.push_enabled === false) return false;

    switch (eventType) {
      case 'message':
        return pref.messages !== false;
      case 'mention':
        return pref.mentions !== false;
      case 'attention_call':
        return pref.attention_calls !== false;
      case 'friend_request':
        return pref.friend_requests !== false;
      case 'comment':
        return pref.comments !== false;
      case 'post':
      case 'community_post':
      case 'community_member_join':
        return pref.posts !== false;
      default:
        return true;
    }
  });
}

async function countBadgeForUser(supabaseAdmin, userId) {
  const exactCount = async (query) => {
    const { count, error } = await query;
    if (error) throw error;
    return Number(count || 0);
  };

  const [notifications, mentions, attentionCalls, friendRequests, memberships] = await Promise.all([
    exactCount(supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)),
    exactCount(supabaseAdmin.from('mentions').select('id', { count: 'exact', head: true }).eq('mentioned_user_id', userId).eq('is_read', false)),
    exactCount(supabaseAdmin.from('attention_calls').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).is('viewed_at', null)),
    exactCount(supabaseAdmin.from('friend_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'pending')),
    supabaseAdmin.from('conversation_participants').select('conversation_id').eq('user_id', userId),
  ]);

  let unreadMessages = 0;
  if (!memberships.error) {
    const conversationIds = uniqStrings((memberships.data || []).map((row) => row.conversation_id));
    if (conversationIds.length) {
      unreadMessages = await exactCount(
        supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .neq('user_id', userId)
          .is('viewed_at', null)
      );
    }
  }

  return notifications + mentions + attentionCalls + friendRequests + unreadMessages;
}

export async function sendWebPush({ supabaseAdmin, receiverIds, notification }) {
  const ids = uniqStrings(receiverIds);
  if (!ids.length) return { ok: true, skipped: true, reason: 'no-receivers' };

  const { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject } = getVapidConfig();
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas');
  }

  const pairValidation = validateVapidKeyPair(vapidPublicKey, vapidPrivateKey);
  if (!pairValidation.valid) {
    throw new Error(`As chaves VAPID configuradas não formam o mesmo par (${pairValidation.reason}). Atualize VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY na Netlify.`);
  }

  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, fcm_token, keys_p256dh, keys_auth, failure_count, user_agent, platform, app_context, device_type, updated_at, created_at')
    .in('user_id', ids)
    .eq('is_active', true);

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  if (!subscriptions?.length) {
    return { ok: true, skipped: true, reason: 'no-subscriptions', total: 0 };
  }

  const subscriptionsToSend = dedupeSubscriptions(subscriptions);

  const privateJWK = vapidKeysToJWK(vapidPublicKey, vapidPrivateKey);
  let sent = 0;
  let failed = 0;
  const expiredIds = [];
  const perUserBadge = new Map();

  // Carrega service account Firebase (para FCM) — ignora erro se não configurado
  let firebaseServiceAccount = null;
  let fcmAccessToken = null;
  try {
    firebaseServiceAccount = getFirebaseServiceAccount();
  } catch {
    // FCM não configurado — somente Web Push disponível (sem APK)
    console.warn('[Push] FIREBASE_SERVICE_ACCOUNT_JSON não configurada. FCM desabilitado.');
  }

  for (const userId of ids) {
    try {
      perUserBadge.set(userId, await countBadgeForUser(supabaseAdmin, userId));
    } catch {
      perUserBadge.set(userId, 0);
    }
  }

  for (const subscriptionRow of subscriptionsToSend) {
    const isFcmSubscription = !!(subscriptionRow.fcm_token || subscriptionRow.endpoint?.startsWith('fcm://'));
    const fcmToken = subscriptionRow.fcm_token || (subscriptionRow.endpoint?.startsWith('fcm://') ? subscriptionRow.endpoint.replace('fcm://', '') : null);

    // ── FCM path (APK Android) ──────────────────────────────────────────────
    if (isFcmSubscription && fcmToken) {
      if (!firebaseServiceAccount) {
        console.warn('[Push] FCM subscription encontrada mas FIREBASE_SERVICE_ACCOUNT_JSON não configurada. Pulando.');
        failed += 1;
        continue;
      }
      try {
        // Obtém access token uma vez por invocação e reutiliza
        if (!fcmAccessToken) {
          fcmAccessToken = await getGoogleAccessToken(firebaseServiceAccount);
        }

        const payload = {
          ...notification,
          data: {
            ...(notification?.data || {}),
            badgeCount: String(perUserBadge.get(subscriptionRow.user_id) || 0),
          },
          android: {
            notification: {
              color: '#8B5CF6', // Purple color
              icon: 'ic_stat_name', // Needs to be generated in Android Studio
            }
          }
        };

        await sendFcmPushMessage({
          fcmToken,
          notification: payload,
          projectId: firebaseServiceAccount.project_id,
          accessToken: fcmAccessToken,
        });

        sent += 1;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', subscriptionRow.id);
      } catch (error) {
        console.error('[Push FCM] Falha ao enviar FCM para token:', fcmToken?.slice(0, 20), error?.message);
        failed += 1;
        if (error?.fcmExpired) {
          expiredIds.push(subscriptionRow.id);
        } else {
          await supabaseAdmin
            .from('push_subscriptions')
            .update({
              last_failure_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              failure_count: Number(subscriptionRow.failure_count || 0) + 1,
            })
            .eq('id', subscriptionRow.id);
        }
      }
      continue;
    }

    // ── Web Push path (browser / PWA) ───────────────────────────────────────
    try {
      const subscription = {
        endpoint: subscriptionRow.endpoint,
        keys: {
          p256dh: subscriptionRow.keys_p256dh,
          auth: subscriptionRow.keys_auth,
        },
      };

      const payload = {
        ...notification,
        data: {
          ...(notification?.data || {}),
          badgeCount: Number(perUserBadge.get(subscriptionRow.user_id) || 0),
        },
      };

      const request = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload,
          adminContact: vapidSubject,
          options: {
            ttl: 86400,
            urgency: notification?.data?.eventType === 'attention_call' ? 'high' : 'normal',
          },
        },
      });

      const response = await fetch(request.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });

      if (response.status === 200 || response.status === 201) {
        sent += 1;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', subscriptionRow.id);
        continue;
      }

      if (response.status === 404 || response.status === 410) {
        expiredIds.push(subscriptionRow.id);
      }

      failed += 1;
      await supabaseAdmin
        .from('push_subscriptions')
        .update({
          last_failure_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          failure_count: Number(subscriptionRow.failure_count || 0) + 1,
        })
        .eq('id', subscriptionRow.id);
    } catch (error) {
      console.error('[Push] Falha ao enviar para endpoint:', subscriptionRow.endpoint, error);
      failed += 1;
      await supabaseAdmin
        .from('push_subscriptions')
        .update({
          last_failure_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          failure_count: Number(subscriptionRow.failure_count || 0) + 1,
        })
        .eq('id', subscriptionRow.id);
    }
  }

  if (expiredIds.length) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ is_active: false, disabled_at: new Date().toISOString(), disabled_reason: 'expired-endpoint', updated_at: new Date().toISOString() })
      .in('id', expiredIds);
  }

  return { ok: true, sent, failed, total: subscriptionsToSend.length, rawTotal: subscriptions.length };
}

async function buildNotificationPayload({ supabaseAdmin, actorUserId, eventType, payload, baseUrl }) {
  const appIconUrl = `${baseUrl}/icon-192.png`;
  const defaultUrl = `${baseUrl}/news`;

  if (eventType === 'test') {
    return {
      receiverIds: [actorUserId],
      notification: {
        title: 'Notificação Ligada.',
        body: 'Notificação Ligada.',
        icon: appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url: defaultUrl,
        tag: 'push:test',
        data: { eventType: 'test', url: defaultUrl },
      },
    };
  }

  if (eventType === 'message') {
    const messageId = payload?.messageId;
    if (!messageId) throw new Error('Missing messageId');

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, user_id, content, media_urls, is_pq_encrypted')
      .eq('id', messageId)
      .maybeSingle();
    if (error) throw error;
    if (!message) throw new Error('Message not found');
    // SEGURANCA: so o autor da mensagem pode disparar a notificacao dela.
    // Sem esta checagem, qualquer usuario autenticado podia passar o id de uma
    // mensagem alheia e provocar push nos participantes daquela conversa.
    if (message.user_id !== actorUserId) throw new Error('Not allowed for this message');

    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id, is_group, name')
      .eq('id', message.conversation_id)
      .maybeSingle();

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id);
    if (participantsError) throw participantsError;

    const receiverIds = uniqStrings((participants || []).map((row) => row.user_id)).filter((userId) => userId !== message.user_id);
    const sender = await getProfileSummary(supabaseAdmin, message.user_id);
    const senderName = sender?.full_name || sender?.username || 'Nova mensagem';
    const isGroup = Boolean(conversation?.is_group);
    const preview = message.is_pq_encrypted
      ? '🔐 Mensagem criptografada'
      : (message.content
        ? safePreview(message.content)
        : Array.isArray(message.media_urls) && message.media_urls.length
          ? '📎 Arquivo enviado'
          : 'Você recebeu uma nova mensagem.');
    const url = `${baseUrl}/messages?conversation=${encodeURIComponent(message.conversation_id)}`;

    return {
      receiverIds,
      notification: {
        title: isGroup ? `💬 ${conversation?.name || 'Grupo'}` : `💬 ${senderName}`,
        body: isGroup ? `${senderName}: ${preview}` : preview,
        icon: sender?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `message:${message.conversation_id}`,
        data: {
          eventType: 'message',
          messageId: message.id,
          conversationId: message.conversation_id,
          senderId: message.user_id,
          url,
        },
      },
    };
  }

  if (eventType === 'mention') {
    const mentionId = payload?.mentionId;
    if (!mentionId) throw new Error('Missing mentionId');

    const { data: mention, error } = await supabaseAdmin
      .from('mentions')
      .select('id, user_id, mentioned_user_id, content_type, content_id')
      .eq('id', mentionId)
      .maybeSingle();
    if (error) throw error;
    if (!mention) throw new Error('Mention not found');

    const actor = await getProfileSummary(supabaseAdmin, mention.user_id);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = mention.content_type === 'message' ? `${baseUrl}/messages` : `${baseUrl}/arena`;

    return {
      receiverIds: mention.mentioned_user_id ? [mention.mentioned_user_id] : [],
      notification: {
        title: `📢 ${actorName} mencionou você`,
        body: 'Toque para ver a menção.',
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `mention:${mention.id}`,
        data: {
          eventType: 'mention',
          mentionId: mention.id,
          contentType: mention.content_type,
          contentId: mention.content_id,
          url,
        },
      },
    };
  }

  if (eventType === 'attention_call') {
    const attentionCallId = payload?.attentionCallId;
    if (!attentionCallId) throw new Error('Missing attentionCallId');

    const { data: call, error } = await supabaseAdmin
      .from('attention_calls')
      .select('id, sender_id, receiver_id, message')
      .eq('id', attentionCallId)
      .maybeSingle();
    if (error) throw error;
    if (!call) throw new Error('Attention call not found');

    const actor = await getProfileSummary(supabaseAdmin, call.sender_id);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = `${baseUrl}/messages`;

    return {
      receiverIds: call.receiver_id ? [call.receiver_id] : [],
      notification: {
        title: `🚨 ${actorName} chamou sua atenção`,
        body: safePreview(call.message || 'Abra o app para responder.'),
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `attention:${call.id}`,
        vibrate: [300, 150, 300, 150, 300],
        data: {
          eventType: 'attention_call',
          attentionCallId: call.id,
          senderId: call.sender_id,
          url,
        },
      },
    };
  }

  if (eventType === 'friend_request') {
    const friendRequestId = payload?.friendRequestId;
    if (!friendRequestId) throw new Error('Missing friendRequestId');

    const { data: request, error } = await supabaseAdmin
      .from('friend_requests')
      .select('id, sender_id, receiver_id')
      .eq('id', friendRequestId)
      .maybeSingle();
    if (error) throw error;
    if (!request) throw new Error('Friend request not found');

    const actor = await getProfileSummary(supabaseAdmin, request.sender_id);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = `${baseUrl}/profile/${request.sender_id}`;

    return {
      receiverIds: request.receiver_id ? [request.receiver_id] : [],
      notification: {
        title: `🤝 ${actorName} enviou um pedido`,
        body: 'Toque para ver e responder ao convite.',
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `friend-request:${request.id}`,
        data: {
          eventType: 'friend_request',
          friendRequestId: request.id,
          senderId: request.sender_id,
          url,
        },
      },
    };
  }

  if (eventType === 'comment') {
    const commentId = payload?.commentId;
    if (!commentId) throw new Error('Missing commentId');

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .select('id, post_id, user_id, content')
      .eq('id', commentId)
      .maybeSingle();
    if (error) throw error;
    if (!comment) throw new Error('Comment not found');

    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, user_id')
      .eq('id', comment.post_id)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) throw new Error('Post not found');

    const actor = await getProfileSummary(supabaseAdmin, comment.user_id);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = `${baseUrl}/arena`;

    return {
      receiverIds: post.user_id && post.user_id !== comment.user_id ? [post.user_id] : [],
      notification: {
        title: `💬 ${actorName} comentou no seu post`,
        body: safePreview(comment.content || 'Abra para ver o comentário.'),
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `comment:${comment.id}`,
        data: {
          eventType: 'comment',
          commentId: comment.id,
          postId: comment.post_id,
          senderId: comment.user_id,
          url,
        },
      },
    };
  }

  if (eventType === 'post') {
    const postId = payload?.postId;
    if (!postId) throw new Error('Missing postId');

    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .select('id, user_id, content')
      .eq('id', postId)
      .maybeSingle();
    if (error) throw error;
    if (!post) throw new Error('Post not found');

    const { data: followers } = await supabaseAdmin.from('followers').select('follower_id').eq('following_id', post.user_id);
    const { data: friendsA } = await supabaseAdmin.from('friendships').select('friend_id').eq('user_id', post.user_id);
    const { data: friendsB } = await supabaseAdmin.from('friendships').select('user_id').eq('friend_id', post.user_id);

    const receiverIds = uniqStrings([
      ...(followers || []).map((row) => row.follower_id),
      ...(friendsA || []).map((row) => row.friend_id),
      ...(friendsB || []).map((row) => row.user_id),
    ]).filter((userId) => userId !== post.user_id);

    const actor = await getProfileSummary(supabaseAdmin, post.user_id);
    const actorName = actor?.full_name || actor?.username || 'Seu amigo';
    const url = `${baseUrl}/arena`;

    return {
      receiverIds,
      notification: {
        title: `🔥 ${actorName} postou na Arena`,
        body: safePreview(post.content || 'Abra para ver a publicação.'),
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `post:${post.id}`,
        data: {
          eventType: 'post',
          postId: post.id,
          authorId: post.user_id,
          url,
        },
      },
    };
  }

  if (eventType === 'community_post') {
    const communityId = payload?.communityId;
    const authorId = payload?.authorId;
    if (!communityId || !authorId) throw new Error('Missing communityId or authorId');

    const { data: members, error } = await supabaseAdmin.from('community_members').select('user_id').eq('community_id', communityId);
    if (error) throw error;

    const actor = await getProfileSummary(supabaseAdmin, authorId);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = `${baseUrl}/communities`;

    return {
      receiverIds: uniqStrings((members || []).map((row) => row.user_id)).filter((userId) => userId !== authorId),
      notification: {
        title: '💬 Nova publicação na comunidade',
        body: `${actorName} publicou algo novo.`,
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `community-post:${communityId}`,
        data: {
          eventType: 'community_post',
          communityId,
          authorId,
          url,
        },
      },
    };
  }

  if (eventType === 'community_member_join') {
    const communityId = payload?.communityId;
    const userId = payload?.userId;
    if (!communityId || !userId) throw new Error('Missing communityId or userId');

    const { data: community, error } = await supabaseAdmin
      .from('communities')
      .select('id, name, created_by')
      .eq('id', communityId)
      .maybeSingle();
    if (error) throw error;
    if (!community) throw new Error('Community not found');

    const actor = await getProfileSummary(supabaseAdmin, userId);
    const actorName = actor?.full_name || actor?.username || 'Novo membro';
    const url = `${baseUrl}/communities`;

    return {
      receiverIds: community.created_by && community.created_by !== userId ? [community.created_by] : [],
      notification: {
        title: '🎉 Novo membro na comunidade',
        body: `${actorName} entrou em ${community.name}.`,
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `community-member:${communityId}`,
        data: {
          eventType: 'community_member_join',
          communityId,
          userId,
          url,
        },
      },
    };
  }

  if (eventType === 'reply') {
    const replyMessageId = payload?.replyMessageId;
    const originalMessageId = payload?.originalMessageId;
    const authorId = payload?.authorId;
    const targetUserId = payload?.targetUserId;
    if (!replyMessageId || !originalMessageId || !authorId) throw new Error('Missing reply payload');
    // SEGURANCA: o autor da resposta e sempre quem esta chamando. Antes vinha do
    // corpo da requisicao, o que permitia forjar "Fulano respondeu voce".
    if (authorId !== actorUserId) throw new Error('Not allowed for this reply');

    const actor = await getProfileSummary(supabaseAdmin, authorId);
    const actorName = actor?.full_name || actor?.username || 'Alguém';
    const url = `${baseUrl}/messages`;

    return {
      receiverIds: targetUserId ? [targetUserId] : [],
      notification: {
        title: `↩️ ${actorName} respondeu você`,
        body: 'Toque para abrir a conversa.',
        icon: actor?.avatar_url || appIconUrl,
        badge: `${baseUrl}/icons/icon-72.png`,
        url,
        tag: `reply:${replyMessageId}`,
        data: {
          eventType: 'reply',
          replyMessageId,
          originalMessageId,
          authorId,
          url,
        },
      },
    };
  }

  throw new Error(`Unsupported eventType: ${eventType}`);
}

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const supabaseAdmin = createAdminClient();
  const auth = await requireUser(event, supabaseAdmin);
  if (!auth.ok) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const eventType = payload?.eventType;
  if (!PUSH_EVENT_TYPES.has(eventType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported eventType' }) };
  }

  try {
    const baseUrl = getBaseUrl(event);
    const built = await buildNotificationPayload({
      supabaseAdmin,
      actorUserId: auth.user.id,
      eventType,
      payload,
      baseUrl,
    });

    const receiverIds = await filterByPreferences(supabaseAdmin, uniqStrings(built.receiverIds), eventType);
    const result = await sendWebPush({
      supabaseAdmin,
      receiverIds,
      notification: built.notification,
    });

    return {
      statusCode: 200,
      headers,
      // SEGURANCA: nao devolver `receiverIds` — expunha ao chamador a lista de
      // participantes da conversa / seguidores do autor. So a contagem basta.
      body: JSON.stringify({ ok: true, eventType, receiverCount: receiverIds.length, result }),
    };
  } catch (error) {
    console.error('send-push error', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error?.message || 'Unknown error' }),
    };
  }
}
