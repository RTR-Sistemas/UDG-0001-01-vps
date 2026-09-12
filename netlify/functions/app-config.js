export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify({
      vapidPublicKeyConfigured: Boolean(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || process.env.WEBPUSH_VAPID_PUBLIC_KEY),
      pushProvider: 'native-web-push',
    }),
  };
};
