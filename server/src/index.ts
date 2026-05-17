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
import { matchRoutes } from './routes/matches.js';
import { pinataMediaRoutes } from './routes/pinataMedia.js';
import { positionCoachRoutes } from './routes/positionCoach.js';
import { narrativeMomentRoutes } from './routes/narrativeMoment.js';
import { marketRoutes } from './routes/market.js';
import { academyRoutes } from './routes/academy.js';
import { voiceRoutes } from './routes/voice.js';
import { assistantRoutes } from './routes/assistant.js';
import { coachRoutes } from './routes/coach.js';
import { classicCoachRoutes } from './routes/classicCoach.js';
import { globalLeagueRoutes } from './routes/globalLeague.js';
import { adminRoutes } from './routes/admin.js';
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

app.use('*', securityHeaders);
// Voice routes precisam de limite maior (áudio até 25MB)
app.use('/api/voice/transcribe', bodyLimit(26 * 1024 * 1024)); // 26 MB para áudio
app.use('*', bodyLimit(65_536)); // 64 KB máximo por request padrão
app.use('*', csrfGuard);

app.use(
  '*',
  cors({
    origin: buildOriginMatcher(),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Olefoot-Pinata-Upload-Token', 'X-Requested-With'],
  }),
);

app.route('/', healthRoutes);
app.route('/', matchRoutes);
app.route('/', gameSpiritRoutes);
app.route('/', pinataMediaRoutes);
app.route('/', positionCoachRoutes);
app.route('/', narrativeMomentRoutes);
app.route('/', marketRoutes);
app.route('/', academyRoutes);
app.route('/api/voice', voiceRoutes);
app.route('/api/assistant', assistantRoutes);
app.route('/api/coach', coachRoutes);
app.route('/api/classic', classicCoachRoutes);
app.route('/api/global-league', globalLeagueRoutes);
app.route('/api/admin', adminRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`[olefoot-server] listening on http://localhost:${port}`);
  getSupabaseAdmin(); // aciona validação de conectividade no startup
});
