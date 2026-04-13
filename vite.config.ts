import {cloudflare} from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/** Raiz do projeto (vite.config na raiz) — evita `loadEnv(mode, '.')` quando o cwd não é a raiz. */
const rootDir = path.resolve(__dirname);

/** Aspas em `.env` (`KEY="abc"`) entram no valor; a API rejeita o header. */
function normalizeApiFootballKey(raw: string | undefined): string {
  if (raw === undefined || raw === null) return '';
  let t = String(raw).trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export default defineConfig(({mode}) => {
  dotenv.config({ path: path.join(rootDir, '.env') });
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });
  const env = loadEnv(mode, rootDir, '');
  const apiFootballKeyLive =
    normalizeApiFootballKey(process.env.API_FOOTBALL_KEY) ||
    normalizeApiFootballKey(process.env.VITE_API_FOOTBALL_KEY) ||
    normalizeApiFootballKey(env.API_FOOTBALL_KEY) ||
    normalizeApiFootballKey(env.VITE_API_FOOTBALL_KEY) ||
    '';
  const apiFootballKeyConfigured = Boolean(apiFootballKeyLive);
  /** Proxy API-Football (api-sports): chave só no servidor de dev, não no bundle. */
  const apiFootballProxy: import('vite').ProxyOptions = {
    target: 'https://v3.football.api-sports.io',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api-football/, ''),
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        if (apiFootballKeyLive) proxyReq.setHeader('x-apisports-key', apiFootballKeyLive);
      });
    },
  };
  return {
    plugins: [cloudflare(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      /** Sincronizado com .env em build/dev — o browser não vê a chave, só se existe (para UI/proxy). */
      __OLEFOOT_API_FOOTBALL_KEY_SET__: JSON.stringify(apiFootballKeyConfigured),
    },
    root: rootDir,
    envDir: rootDir,
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
      },
    },
    server: {
      // Porta padrão Vite (evita confusão com 5173 vs 3000). strictPort: false tenta a seguinte se ocupada.
      port: 5173,
      strictPort: false,
      // localhost evita falhas em ambientes onde listar interfaces (0.0.0.0) rebenta; para LAN: `npm run dev -- --host 0.0.0.0`
      host: 'localhost',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api-football': apiFootballProxy,
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api-football': apiFootballProxy,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('yuka')) return 'yuka';
            if (id.includes('motion')) return 'motion';
            if (id.includes('lucide-react')) return 'lucide';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@google/genai')) return 'genai';
            if (id.includes('react-router')) return 'router';
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/')) return 'react';
          },
        },
      },
      chunkSizeWarningLimit: 5500,
    },
  };
});
