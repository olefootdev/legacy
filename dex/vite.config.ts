/**
 * OLEWALLET — olefoot.ai, build separado do jogo.
 *
 * A separação é de ORIGEM, não de código. O alias `@` continua apontando pra
 * `src/` do jogo, então a derivação de chave, o cofre e o protocolo de conexão
 * são LIDOS de `src/wallet/seed/` — os mesmos arquivos que os self-tests
 * cobrem. Copiar cripto pra cá seria criar um segundo lugar pra mesma conta
 * divergir, e numa carteira divergência silenciosa é dinheiro perdido.
 *
 * O que NÃO vem junto: o store do jogo, as rotas dele, o painel admin, o motor
 * de partida. Esta origem carrega o mínimo — é ela que guarda o cofre, e todo
 * arquivo a mais aqui é superfície de ataque a mais.
 */
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(__dirname, '..');
const dexRoot = __dirname;

/**
 * Cabeçalhos da origem da carteira, gravados no build.
 *
 * `frame-ancestors 'none'` é o que importa: sem ele, um site qualquer põe a
 * OLEWALLET num iframe invisível por cima de um botão inocente e a pessoa
 * clica em "Assinar" achando que clicou em outra coisa. Contra uma tela cujo
 * único botão autoriza vínculo de carteira, clickjacking é o ataque óbvio.
 *
 * Vai como arquivo `_headers` porque é assim que o Cloudflare serve asset
 * estático — e porque esta origem não tem Worker de propósito.
 */
function cabecalhosDeSeguranca(destino: string, api: string) {
  /**
   * CSP de BLOQUEIO, não de relatório. Esta origem guarda o cofre da frase:
   * qualquer script de fora que rodasse aqui leria o cofre e esperaria a
   * senha. Então só roda o que sai do próprio build.
   *   · script, estilo e fonte: só 'self' (as fontes vêm do build, não do
   *     Google — era a única origem externa que a página carregava)
   *   · connect: só a API do jogo, que dá saldo e extrato
   *   · nada de form, base, objeto ou iframe
   * O QR é SVG montado pelo React, não HTML injetado: não precisa de
   * 'unsafe-inline' em lugar nenhum.
   */
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${new URL(api).origin}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return {
    name: 'olewallet-headers',
    closeBundle() {
      const conteudo = [
        '/*',
        '  X-Frame-Options: DENY',
        `  Content-Security-Policy: ${csp}`,
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  X-Content-Type-Options: nosniff',
        // ⚠️ `unsafe-none` (o padrão) É OBRIGATÓRIO AQUI, e não é descuido.
        //
        // Eu tinha posto `same-origin-allow-popups` lendo como "permito
        // popups". Significa quase o contrário do que este fluxo precisa: um
        // documento com QUALQUER COOP diferente de unsafe-none, quando aberto
        // por uma ORIGEM DIFERENTE, entra em outro grupo de contexto de
        // navegação e recebe `window.opener === null`. Como o jogo é
        // game.olefoot.ai e a carteira é dex.olefoot.ai — origens
        // diferentes —, o aperto de mão nunca podia começar, e a pessoa caía
        // em "não identifiquei quem pediu". Não deu pra pegar em dev: o
        // servidor do Vite não serve este arquivo.
        //
        // COOP defende de ataques entre janelas; aqui a janela CRUZADA é o
        // produto. O que protege esta tela é frame-ancestors + X-Frame-Options,
        // que continuam, mais o fato de a origem de quem pede vir do
        // `event.origin` e ser conferida contra lista fechada.
        '  Cross-Origin-Opener-Policy: unsafe-none',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(destino, '_headers'), conteudo);
    },
  };
}

export default defineConfig(() => {
  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

  return {
    plugins: [
      cloudflare({ configPath: path.join(dexRoot, 'wrangler.jsonc') }),
      react(),
      tailwindcss(),
      cabecalhosDeSeguranca(path.join(dexRoot, 'dist'),
        process.env.VITE_OLEFOOT_API_URL || 'https://legacy-production-de1e.up.railway.app'),
    ],
    root: dexRoot,
    envDir: repoRoot,
    // Cache próprio: sem isto o Vite da OLEWALLET e o do jogo disputam
    // `node_modules/.vite` quando os dois rodam juntos, e um invalida o
    // pré-bundle do outro ("504 Outdated Optimize Dep", tela branca).
    cacheDir: path.join(dexRoot, '.vite'),
    publicDir: path.join(repoRoot, 'public'),
    resolve: {
      alias: {
        '@': path.join(repoRoot, 'src'),
        '~dex': path.join(dexRoot, 'src'),
      },
      extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
    },
    server: { port: 5373, strictPort: false, host: 'localhost' },
    preview: { port: 4373 },
    build: {
      outDir: path.join(dexRoot, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@noble')) return 'cripto';
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/')) return 'react';
          },
        },
      },
    },
  };
});
