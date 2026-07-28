/**
 * OLEFOOT REVELA — build separado, código compartilhado.
 *
 * REVELA é outro site (revela.olefoot.com), mas mora no mesmo repositório de
 * propósito: o alias `@` continua apontando pra `src/` do jogo, então cliente
 * Supabase, tipos de atributo, pesos de OVR e tokens de marca são LIDOS, nunca
 * copiados. Duplicar isso seria criar um segundo lugar pra mesma verdade
 * divergir — que é exatamente como o OVR da vitrine já divergiu uma vez.
 *
 * O que NÃO é compartilhado: o `src/game` (store do jogo), rotas e o design
 * system de produto. REVELA tem linguagem visual própria (pôster, sombra dura),
 * declarada em `src/revela.css`.
 */
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(__dirname, '..');
const revelaRoot = __dirname;

export default defineConfig(() => {
  // Mesmo .env do jogo: a anon key e a URL do Supabase são as mesmas.
  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

  return {
    plugins: [cloudflare({ configPath: path.join(revelaRoot, 'wrangler.jsonc') }), react(), tailwindcss()],
    root: revelaRoot,
    envDir: repoRoot,
    // Fontes e favicon vêm do mesmo /public do jogo — uma cópia só de Anton.
    publicDir: path.join(repoRoot, 'public'),
    resolve: {
      alias: {
        '@': path.join(repoRoot, 'src'),
        '~revela': path.join(revelaRoot, 'src'),
      },
      extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
    },
    server: {
      port: 5273,
      strictPort: false,
      host: 'localhost',
    },
    preview: { port: 4273 },
    build: {
      outDir: path.join(revelaRoot, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/')) return 'react';
          },
        },
      },
    },
  };
});
