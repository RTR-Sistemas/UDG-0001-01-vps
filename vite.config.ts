/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { pwaOptions } from "./vite-pwa.config";

// -----------------------------------------------------------------------------
// ATUALIZADO EM 06/09/2026 — saída da Netlify.
// O proxy de desenvolvimento agora aponta /api para o runtime de funções do
// projeto (deploy/server.mjs, porta 8788) — o mesmo processo que roda no VPS.
// Para desenvolver com as funções ativas, abra um segundo terminal e rode:
//     node --import tsx DEPLOY/server.mjs
// O caminho antigo /.netlify/functions continua mapeado só para não quebrar
// nada que ainda não tenha sido migrado; pode ser removido quando quiser.
// -----------------------------------------------------------------------------

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
      "/.netlify/functions": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA(pwaOptions),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
