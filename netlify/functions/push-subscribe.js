import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

function normalizeDeviceSignature({ platform, userAgent, deviceType }) {
  const normalizedPlatform = String(platform || 'unknown').trim().toLowerCase() || 'unknown';
  const normalizedUserAgent = String(userAgent || '').trim().toLowerCase();
  const normalizedDeviceType = String(deviceType || 'unknown').trim().toLowerCase() || 'unknown';

  if (!normalizedUserAgent) {
    return `${normalizedPlatform}::${normalizedDeviceType}::unknown-agent`;
  }

  return `${normalizedPlatform}::${normalizedDeviceType}::${normalizedUserAgent}`;
}

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

  const sub = body?.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const expirationTime = sub?.expirationTime ?? null;
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const authKey = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  const platform = typeof body?.platform === 'string' ? body.platform.trim() : 'unknown';
  const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.trim() : '';
  const appContext = body?.appContext === 'pwa' ? 'pwa' : 'web';
  const deviceType = ['desktop', 'mobile', 'tablet', 'unknown'].includes(body?.deviceType) ? body.deviceType : 'unknown';

  if (!endpoint || !p256dh || !authKey) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing subscription fields' }) };
  }

  const payload = {
    user_id: auth.user.id,
    endpoint,
    expiration_time: expirationTime ? new Date(expirationTime).toISOString() : null,
    keys_p256dh: p256dh,
    keys_auth: authKey,
    subscription_json: sub,
    user_agent: userAgent || null,
    device_type: deviceType,
    platform,
    app_context: appContext,
    is_active: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    disabled_at: null,
    disabled_reason: null,
  };

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (error) {
    const message = /row-level security/i.test(error.message || '')
      ? 'Falha ao salvar a subscription: a função não conseguiu usar uma credencial administrativa válida do Supabase. Verifique SUPABASE_SERVICE_ROLE_KEY na Netlify.'
      : error.message;
    return { statusCode: 500, headers, body: JSON.stringify({ error: message }) };
  }

  const currentSignature = normalizeDeviceSignature({ platform, userAgent, deviceType });

  const { data: activeRows } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, platform, user_agent, device_type')
    .eq('user_id', auth.user.id)
    .eq('is_active', true);

  const rowsToDisable = (activeRows || [])
    .filter((row) => row.endpoint !== endpoint)
    .filter((row) => {
      const rowSignature = normalizeDeviceSignature({
        platform: row.platform,
        userAgent: row.user_agent,
        deviceType: row.device_type,
      });

      if (rowSignature === currentSignature) return true;

      const samePlatform = String(row.platform || '').trim().toLowerCase() === String(platform || '').trim().toLowerCase();
      const sameDeviceType = String(row.device_type || '').trim().toLowerCase() === String(deviceType || '').trim().toLowerCase();
      const rowUserAgent = String(row.user_agent || '').trim();
      return samePlatform && sameDeviceType && !rowUserAgent;
    })
    .map((row) => row.id);

  if (rowsToDisable.length) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_reason: 'replaced-by-new-subscription',
        updated_at: new Date().toISOString(),
      })
      .in('id', rowsToDisable);
  }

  await supabaseAdmin
    .from('notification_preferences')
    .upsert({
      user_id: auth.user.id,
      push_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}
