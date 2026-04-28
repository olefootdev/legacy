import {cloudflare} from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import {defineConfig} from 'vite';

/** Raiz do projeto (vite.config na raiz) — evita `loadEnv(mode, '.')` quando o cwd não é a raiz. */
const rootDir = path.resolve(__dirname);

export default defineConfig(() => {
  dotenv.config({ path: path.join(rootDir, '.env') });
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });
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
