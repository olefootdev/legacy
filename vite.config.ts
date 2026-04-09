import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  /** Proxy API-Football (api-sports): chave só no servidor de dev, não no bundle. */
  const apiFootballProxy: import('vite').ProxyOptions = {
    target: 'https://v3.football.api-sports.io',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api-football/, ''),
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        const key = env.API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY;
        if (key) proxyReq.setHeader('x-apisports-key', key);
      });
    },
  };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
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
            if (id.includes('@babylonjs')) return 'babylon';
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
