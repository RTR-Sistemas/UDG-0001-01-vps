import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }

  const auth = await requireUser(event, supabaseAdmin);
  if (!auth.ok) return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing endpoint' }) };
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', auth.user.id);

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}
