/**
 * push-register-fcm.js
 * Endpoint para registrar tokens FCM de dispositivos Android (APK Capacitor).
 * Funciona em paralelo com push-subscribe.js (Web Push VAPID) sem conflitos.
 */
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

  const fcmToken = typeof body?.fcmToken === 'string' ? body.fcmToken.trim() : '';
  const platform = typeof body?.platform === 'string' ? body.platform.trim().toLowerCase() : 'android';
  const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.trim() : '';
  const deviceType = ['desktop', 'mobile', 'tablet', 'unknown'].includes(body?.deviceType)
    ? body.deviceType
    : 'mobile';

  if (!fcmToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fcmToken' }) };
  }

  // Usa o prefixo fcm:// como endpoint único para diferenciar de Web Push subscriptions
  const endpoint = `fcm://${fcmToken}`;

  const payload = {
    user_id: auth.user.id,
    endpoint,
    fcm_token: fcmToken,
    expiration_time: null,
    // Web Push keys ficam vazios — apenas FCM token é usado para envio
    keys_p256dh: '',
    keys_auth: '',
    subscription_json: null,
    user_agent: userAgent || null,
    device_type: deviceType,
    platform,
    app_context: 'apk',
    is_active: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    disabled_at: null,
    disabled_reason: null,
  };

  // Upsert baseado no endpoint (único) — atualiza se já existir
  const { error: upsertError } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (upsertError) {
    console.error('[FCM Register] Erro ao salvar token FCM:', upsertError);
    return { statusCode: 500, headers, body: JSON.stringify({ error: upsertError.message }) };
  }

  // Desativa tokens FCM antigos do mesmo usuário (exceto o atual)
  const { data: activeRows } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, fcm_token')
    .eq('user_id', auth.user.id)
    .eq('app_context', 'apk')
    .eq('is_active', true);

  const rowsToDisable = (activeRows || [])
    .filter((row) => row.endpoint !== endpoint)
    .map((row) => row.id);

  if (rowsToDisable.length) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_reason: 'replaced-by-new-fcm-token',
        updated_at: new Date().toISOString(),
      })
      .in('id', rowsToDisable);
  }

  // Garante que push_enabled = true nas preferências do usuário
  await supabaseAdmin
    .from('notification_preferences')
    .upsert({
      user_id: auth.user.id,
      push_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}
