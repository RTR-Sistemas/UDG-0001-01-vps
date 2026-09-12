import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

async function countUnreadMessages(supabaseAdmin, userId) {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (membershipError) throw membershipError;
  const conversationIds = Array.from(new Set((memberships || []).map((row) => row.conversation_id).filter(Boolean)));
  if (!conversationIds.length) return 0;

  const { count, error } = await supabaseAdmin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .neq('user_id', userId)
    .is('viewed_at', null);

  if (error) throw error;
  return Number(count || 0);
}

async function exactCount(builder) {
  const { count, error } = await builder;
  if (error) throw error;
  return Number(count || 0);
}

export async function handler(event) {
  const headers = corsHeaders('GET, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }

  const auth = await requireUser(event, supabaseAdmin);
  if (!auth.ok) return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };

  try {
    const [notifications, mentions, attentionCalls, friendRequests, unreadMessages] = await Promise.all([
      exactCount(
        supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).eq('is_read', false)
      ),
      exactCount(
        supabaseAdmin.from('mentions').select('id', { count: 'exact', head: true }).eq('mentioned_user_id', auth.user.id).eq('is_read', false)
      ),
      exactCount(
        supabaseAdmin.from('attention_calls').select('id', { count: 'exact', head: true }).eq('receiver_id', auth.user.id).is('viewed_at', null)
      ),
      exactCount(
        supabaseAdmin.from('friend_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', auth.user.id).eq('status', 'pending')
      ),
      countUnreadMessages(supabaseAdmin, auth.user.id),
    ]);

    const count = notifications + mentions + attentionCalls + friendRequests + unreadMessages;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        count,
        breakdown: {
          notifications,
          mentions,
          attentionCalls,
          friendRequests,
          unreadMessages,
        },
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message || 'Erro ao calcular badge' }) };
  }
}
