// Override permite que server/.env sobrescreva variáveis vazias do shell parent
// (ex: Claude Code dev env exporta ANTHROPIC_API_KEY="" pra sandbox).
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrfGuard, securityHeaders } from './lib/securityMiddleware.js';
import { bodyLimit } from './lib/inputGuards.js';
import { gameSpiritRoutes } from './routes/gameSpirit.js';
import { healthRoutes } from './routes/health.js';
import { quoteRoutes } from './routes/quote.js';
import { paymentsRoutes } from './routes/payments.js';
import { matchPlanRoutes } from './routes/matchPlan.js';
import { quickNarrateRoutes } from './routes/quickNarrate.js';
import { opponentRosterRoutes } from './routes/opponentRoster.js';
import { pinataMediaRoutes } from './routes/pinataMedia.js';
import { positionCoachRoutes } from './routes/positionCoach.js';
import { marketRoutes } from './routes/market.js';
import { marketOffersRoutes } from './routes/marketOffers.js';
import { squadMarketRoutes } from './routes/squadMarket.js';
import { academyRoutes } from './routes/academy.js';
import { academyAdminRoutes } from './routes/academyAdmin.js';
import { academyArtRoutes } from './routes/academyArt.js';
import { assistantRoutes } from './routes/assistant.js';
import { coachRoutes } from './routes/coach.js';
import { classicCoachRoutes } from './routes/classicCoach.js';
import { globalLeagueRoutes } from './routes/globalLeague.js';
import { adminRoutes } from './routes/admin.js';
import { adminPaymentsRoutes } from './routes/adminPayments.js';
import { telegramWebhookRoutes, telegramAdminRoutes, configurarNoBoot } from './routes/telegram.js';
import { ligarAgenda } from './lib/telegram/agenda.js';
import { adminLicencasRoutes } from './routes/adminLicencas.js';
import { adminExpansaoRoutes } from './routes/adminExpansao.js';
import { adminPresaleRoutes } from './routes/adminPresale.js';
import { adminSuporteRoutes } from './routes/adminSuporte.js';
import { revelaAdminRoutes } from './routes/revelaAdmin.js';
import { legendImportRoutes } from './routes/legendImport.js';
import { insightsRoutes } from './routes/insights.js';
import { solanaWalletRoutes } from './routes/solanaWallet.js';
import { vaultRoutes, vaultAdminRoutes } from './routes/vault.js';
import { cspReportRoutes } from './routes/cspReport.js';
import { getSupabaseAdmin } from './lib/supabaseAdmin.js';
import { presaleRoutes } from './routes/presale.js';
import { earningsRoutes } from './routes/earnings.js';
// Railway scheduler decomissionado em 2026-05-07. A Liga Global agora é
// gerenciada autonomamente pela Edge Function v7 do Supabase + pg_cron.
// Ver supabase/functions/global-league-tick/index.ts.

const app = new Hono();

/**
 * Retorna um matcher de origin: dado o Origin do request, devolve a string
 * autorizada (echo) ou null. Aceita lista CORS_ORIGIN separada por vírgulas
 * OU vírgulas + espaços OU newlines (Railway às vezes guarda multi-line).
 * Usar função (em vez de array) é mais robusto contra encoding do host.
 */
function buildOriginMatcher(): (origin: string) => string | null {
  const raw = process.env.CORS_ORIGIN?.trim();
  let list: string[];

  if (raw) {
    list = raw
      .split(/[,\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const origin of list) {
      try {
        new URL(origin);
      } catch {
        console.error(`[olefoot-server] FATAL: CORS_ORIGIN entry inválida: ${JSON.stringify(origin)}`);
        process.exit(1);
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error('[olefoot-server] FATAL: CORS_ORIGIN não definido em produção. A encerrar.');
      process.exit(1);
    }
    // 5173 jogo · 5180 (legado) · 5273 REVELA · 5373 OLEWALLET.
    // Sem a porta da carteira aqui, o Extrato e o saldo falham em dev com
    // "não consegui falar com a Solana" — que é erro de CORS disfarçado de
    // erro de rede, e leva meia hora pra descobrir.
    list = [
      'http://localhost:5173',
      'http://localhost:5180',
      'http://localhost:5273',
      'http://localhost:5373',
      'http://localhost:4373',
    ];
  }

  console.log(`[olefoot-server] CORS allow-list (${list.length}): ${list.join(' | ')}`);

  const set = new Set(list);
  return (origin: string) => (set.has(origin) ? origin : null);
}

// CORS PRIMEIRO — qualquer 4xx/5xx posterior precisa de CORS headers
// (caso contrário o browser bloqueia com "Load failed" sem mostrar o erro real).
app.use(
  '*',
  cors({
    origin: buildOriginMatcher(),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Olefoot-Pinata-Upload-Token', 'X-Requested-With', 'X-Olefoot-Idioma'],
  }),
);

app.use('*', securityHeaders);

// bodyLimit POR ROTA (não global). Hono executa todos os middlewares que
// matcham — se tivermos um '*' bodyLimit pequeno, ele bate em TUDO mesmo
// que rotas específicas tenham seus limites próprios maiores. Por isso
// fazemos rota-a-rota:
//
//  - Rotas com upload de mídia: limite explícito (10-26 MB)
//  - Rotas JSON normais: sem bodyLimit (validação no handler; payloads
//    típicos ficam abaixo de 4 KB; Cloudflare/Railway têm limites de
//    infra acima disso pra DoS)
app.use('/api/media/pinata/upload', bodyLimit(10 * 1024 * 1024));     // imagem genesis
app.use('/api/academy/upload-selfie', bodyLimit(10 * 1024 * 1024));   // selfie manager (modo concierge)
app.use('/api/academy/generate-portrait', bodyLimit(10 * 1024 * 1024)); // selfie + camisa + bg (modo auto)
app.use('/api/academy/upload-admin-image', bodyLimit(10 * 1024 * 1024)); // arte final do admin (portrait | promo)

// Relatório de CSP ANTES do csrfGuard: o navegador manda o relatório sozinho,
// às vezes sem Origin, e a rota só agrega diretiva/origem/caminho (ver
// routes/cspReport.ts). Registrada antes, o handler responde e o guard não roda.
app.use('/api/csp-report', bodyLimit(32 * 1024));
app.route('/', cspReportRoutes);

// Webhook do Telegram também ANTES do csrfGuard: quem chama é o servidor do
// Telegram, sem Origin. A autenticação é o segredo no header (routes/telegram.ts).
app.use('/api/telegram/webhook', bodyLimit(256 * 1024));
app.route('/', telegramWebhookRoutes);

app.use('*', csrfGuard);

app.route('/', healthRoutes);
app.route('/', quoteRoutes);
app.route('/', paymentsRoutes);
app.route('/', presaleRoutes);   // leitura da pré-venda (compra é pelo Pix acima)
app.route('/', matchPlanRoutes);
app.route('/', quickNarrateRoutes);
app.route('/', opponentRosterRoutes);
app.route('/', gameSpiritRoutes);
app.route('/', pinataMediaRoutes);
app.route('/', positionCoachRoutes);
app.route('/', marketRoutes);
app.route('/', marketOffersRoutes);
app.route('/', squadMarketRoutes);  // mercado de elenco em OLEFOOT (sessão do jogador)
app.route('/', solanaWalletRoutes);
app.route('/', earningsRoutes);    // regras de Vault, Produção e Stake (públicas)
app.route('/', vaultRoutes);       // leitura do Vault (sessão do jogador)
app.route('/', vaultAdminRoutes);  // escrita do Vault (gate de admin no próprio router)
app.route('/', academyRoutes);
app.route('/', academyAdminRoutes);
app.route('/', academyArtRoutes);
app.route('/api/assistant', assistantRoutes);
app.route('/api/coach', coachRoutes);
app.route('/api/classic', classicCoachRoutes);
app.route('/api/global-league', globalLeagueRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin', adminPaymentsRoutes);
app.route('/api/admin', telegramAdminRoutes); // bot do Telegram: configurar + postar (gate no router)
app.route('/api/admin', adminLicencasRoutes); // licenças da expansão (gate no próprio router)
app.route('/api/admin', adminExpansaoRoutes); // ciclos, árvore, satélites, prêmios e claims (gate no router)
app.route('/api/admin', adminPresaleRoutes);  // torneira e vitrine da pré-venda (gate no router)
app.route('/api/admin', adminSuporteRoutes);  // PIN travado e vendas de card (gate no router)
app.route('/api/revela-admin', revelaAdminRoutes);
app.route('/api/admin', legendImportRoutes);
// OLEFOOT PYTHON MODE — proxy pro serviço FastAPI /insights
app.route('/', insightsRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  ligarAgenda();
  void configurarNoBoot();
  console.log(`[olefoot-server] listening on http://localhost:${port}`);
  console.log(`
🚀 ===================================================================
🚀 Hey Hacker 👋
🚀
🚀 I know you understand much more than me about game development.
🚀 If you find this message, it's because I'm not an expert — just one
🚀 football lover trying to launch a game to back us to the best
🚀 moment of our lives.
🚀
🚀 Please, contact me to share vulnerabilities.
🚀 We are open and truly believe in the power of community.
🚀
🚀 I created this game by myself using AI tools just to share my IDEA
🚀 as a nice MVP. Let's Play Together! ⚽
🚀
🚀 📧 Contact: contact@olefoot.ai
🚀 ===================================================================
  `);
  getSupabaseAdmin(); // aciona validação de conectividade no startup
});
