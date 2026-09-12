import type { CapacitorConfig } from '@capacitor/cli';

// -----------------------------------------------------------------------------
// CORRIGIDO EM 06/09/2026
//   `cleartext: true` foi REMOVIDO. Ele autorizava o aplicativo Android a fazer
//   requisições em HTTP sem TLS — o que permite a um invasor na mesma rede ler e
//   alterar o tráfego. Nada no UndoinG precisa disso: o site, o Supabase, o
//   Cloudinary e a Agora são todos HTTPS.
//   `androidScheme: 'https'` garante que a WebView trate o conteúdo local como
//   origem segura (necessário para service worker, câmera, microfone e push).
// -----------------------------------------------------------------------------

const config: CapacitorConfig = {
  appId: 'com.udoing.app',
  appName: 'Undoing',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    // ATENÇÃO — DECISÃO PENDENTE (ver CORRECOES_APLICADAS_2026-09-06.md, item 2):
    // este endereço define para onde TODO aplicativo Android instalado aponta.
    // Você indicou que a produção real é o VPS (udgservidor.online), mas o APK
    // aponta para undoing.com.br. Se os dois não servirem exatamente o mesmo
    // build e as mesmas funções, os usuários do app veem um sistema diferente
    // do da web. Confirme o domínio definitivo e ajuste aqui antes de gerar o
    // próximo APK.
    url: 'https://undoing.com.br',
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound'],
    },
  },
};

export default config;
