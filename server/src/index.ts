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
import { paymentsRoutes } from './routes/payments.js';
import { matchRoutes } from './routes/matches.js';
import { pinataMediaRoutes } from './routes/pinataMedia.js';
import { positionCoachRoutes } from './routes/positionCoach.js';
import { narrativeMomentRoutes } from './routes/narrativeMoment.js';
import { marketRoutes } from './routes/market.js';
import { academyRoutes } from './routes/academy.js';
import { academyArtRoutes } from './routes/academyArt.js';
import { voiceRoutes } from './routes/voice.js';
import { assistantRoutes } from './routes/assistant.js';
import { coachRoutes } from './routes/coach.js';
import { classicCoachRoutes } from './routes/classicCoach.js';
import { globalLeagueRoutes } from './routes/globalLeague.js';
import { adminRoutes } from './routes/admin.js';
import { legendImportRoutes } from './routes/legendImport.js';
import { insightsRoutes } from './routes/insights.js';
import { getSupabaseAdmin } from './lib/supabaseAdmin.js';
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
    list = ['http://localhost:5173', 'http://localhost:5180'];
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
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Olefoot-Pinata-Upload-Token', 'X-Requested-With'],
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
app.use('/api/voice/transcribe', bodyLimit(26 * 1024 * 1024));        // áudio
app.use('/api/media/pinata/upload', bodyLimit(10 * 1024 * 1024));     // imagem genesis
app.use('/api/academy/upload-selfie', bodyLimit(10 * 1024 * 1024));   // selfie manager (modo concierge)
app.use('/api/academy/generate-portrait', bodyLimit(10 * 1024 * 1024)); // selfie + camisa + bg (modo auto)
app.use('/api/academy/upload-admin-image', bodyLimit(10 * 1024 * 1024)); // arte final do admin (portrait | promo)

app.use('*', csrfGuard);

app.route('/', healthRoutes);
app.route('/', paymentsRoutes);
app.route('/', matchRoutes);
app.route('/', gameSpiritRoutes);
app.route('/', pinataMediaRoutes);
app.route('/', positionCoachRoutes);
app.route('/', narrativeMomentRoutes);
app.route('/', marketRoutes);
app.route('/', academyRoutes);
app.route('/', academyArtRoutes);
app.route('/api/voice', voiceRoutes);
app.route('/api/assistant', assistantRoutes);
app.route('/api/coach', coachRoutes);
app.route('/api/classic', classicCoachRoutes);
app.route('/api/global-league', globalLeagueRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin', legendImportRoutes);
// OLEFOOT PYTHON MODE — proxy pro serviço FastAPI /insights
app.route('/', insightsRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
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
🚀 📧 Contact: exp@olefoot.com
🚀 ===================================================================
  `);
  getSupabaseAdmin(); // aciona validação de conectividade no startup
});
