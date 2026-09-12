import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

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
  if (!auth.ok) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        pushEnabled: true,
        subscriptionCount: 0,
        authenticated: false,
      }),
    };
  }

  const [{ data: pref }, { count, error: countError }] = await Promise.all([
    supabaseAdmin
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('is_active', true),
  ]);

  if (countError) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: countError.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      pushEnabled: pref?.push_enabled !== false,
      subscriptionCount: count || 0,
    }),
  };
}
