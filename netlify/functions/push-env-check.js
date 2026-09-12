import { getVapidConfig, validateVapidKeyPair } from './_shared.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

export const handler = async () => {
  const has = (key) => Boolean((process.env[key] || '').trim());
  const vapid = getVapidConfig();
  const vapidCheck = validateVapidKeyPair(vapid.publicKey, vapid.privateKey);

  return json(200, {
    VAPID_PUBLIC_KEY: has('VAPID_PUBLIC_KEY') || has('VITE_VAPID_PUBLIC_KEY'),
    VAPID_PRIVATE_KEY: has('VAPID_PRIVATE_KEY') || has('WEBPUSH_VAPID_PRIVATE_KEY'),
    VAPID_SUBJECT: has('VAPID_SUBJECT') || has('WEBPUSH_VAPID_SUBJECT'),
    VAPID_PAIR_VALID: vapidCheck.valid,
    VAPID_PAIR_REASON: vapidCheck.reason,
    SUPABASE_URL: has('SUPABASE_URL') || has('VITE_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY') || has('VITE_SUPABASE_SERVICE_ROLE_KEY'),
    NODE_VERSION: process.version,
    provider: 'native-web-push',
  });
};
