import { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  injectRegister: 'auto',
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'sounds/*'],
  manifest: {
    name: 'Undoing — A rede social que desbloqueia o mundo',
    short_name: 'Undoing',
    description: 'Comunidades, chat em tempo real, chamadas de voz e vídeo e selo dourado para os 100 primeiros membros.',
    start_url: '/',
    scope: '/',
    id: '/',
    theme_color: '#7C3AED',
    background_color: '#1A1626',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'fullscreen'],
    prefer_related_applications: false,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: 'icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' }
    ],
    orientation: 'portrait'
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,mp4}'],
    globIgnores: ['build.json', '**/!(abertura_final).mp4', '**/*.webm'],
    maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
  },
  workbox: {
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname === '/build.json',
        handler: 'NetworkOnly',
      },
      // A5-SENTINEL: Cloudinary vídeos/mídia → NetworkOnly
      // Range requests (streaming de vídeo) são incompatíveis com Cache API
      // → causa ERR_CACHE_OPERATION_NOT_SUPPORTED se tentar cachear
      {
        urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/,
        handler: 'NetworkOnly',
      },
      // Funções Netlify não devem ser cacheadas
      {
        urlPattern: /^\/.netlify\/functions\/.*/,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'supabase-storage',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
    ],
  },
  devOptions: {
    enabled: true,
    type: 'module',
    navigateFallback: 'index.html',
  },
};
