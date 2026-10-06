import {cloudflare} from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

/** Raiz do projeto (vite.config na raiz) — evita `loadEnv(mode, '.')` quando o cwd não é a raiz. */
const rootDir = path.resolve(__dirname);

/**
 * Preload de env para quem lê `process.env` (plugins, wrangler) — SEM as chaves
 * `VITE_*`, de propósito.
 *
 * O Vite PRIORIZA `VITE_*` que já esteja em `process.env` sobre os arquivos
 * `.env`, porque assume que veio inline do deploy. Então injetar o `.env` aqui
 * fazia o `.env` cru vencer o `.env.development`: no dev local a Partida Rápida
 * chamava o backend de PRODUÇÃO (Railway) e dava "motor offline", sem jeito de
 * resolver reiniciando nem limpando cache. Quem manda nas `VITE_*` é o
 * `loadEnv` do Vite, com a ordem dele: `.env.[mode].local` > `.env.[mode]` >
 * `.env.local` > `.env` — e env inline de verdade continua vencendo todas.
 */
function preloadSemVite(arquivo: string, override: boolean): void {
  if (!fs.existsSync(arquivo)) return;
  for (const [chave, valor] of Object.entries(dotenv.parse(fs.readFileSync(arquivo)))) {
    if (chave.startsWith('VITE_')) continue;
    if (override || process.env[chave] === undefined) process.env[chave] = valor;
  }
}

export default defineConfig(() => {
  preloadSemVite(path.join(rootDir, '.env'), false);
  preloadSemVite(path.join(rootDir, '.env.local'), true);
  return {
    plugins: [cloudflare(), react(), tailwindcss()],
    root: rootDir,
    envDir: rootDir,
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
      },
      // Resolver .tsx/.ts antes de .js. Evita que artefatos compilados
      // (src/**/*.js não-rastreados gerados por tsc) sejam servidos no
      // lugar do source TS — produzia "Failed to parse source for import".
      extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
    },
    server: {
      // Porta padrão Vite (evita confusão com 5173 vs 3000). strictPort: false tenta a seguinte se ocupada.
      port: 5173,
      strictPort: false,
      // localhost evita falhas em ambientes onde listar interfaces (0.0.0.0) rebenta; para LAN: `npm run dev -- --host 0.0.0.0`
      host: 'localhost',
      watch: {
        ignored: [
          '**/.wrangler/**',
          '**/dist/**',
          '**/coverage/**',
          '**/playwright-report/**',
        ],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 4173,
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
