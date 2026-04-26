import 'dotenv/config';
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
import { voiceRoutes } from './routes/voice.js';
import { assistantRoutes } from './routes/assistant.js';
import { getSupabaseAdmin } from './lib/supabaseAdmin.js';

const app = new Hono();

function corsOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);

    // Validar que são URLs válidas
    for (const origin of list) {
      try {
        new URL(origin);
      } catch {
        console.error(`[olefoot-server] FATAL: CORS_ORIGIN inválido: ${origin}`);
        process.exit(1);
      }
    }

    return list.length === 1 ? list[0]! : list;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[olefoot-server] FATAL: CORS_ORIGIN não definido em produção. A encerrar.');
    process.exit(1);
  }
  return ['http://localhost:5173', 'http://localhost:5180'];
}

app.use('*', securityHeaders);
// Voice routes precisam de limite maior (áudio até 25MB)
app.use('/api/voice/transcribe', bodyLimit(26 * 1024 * 1024)); // 26 MB para áudio
app.use('*', bodyLimit(65_536)); // 64 KB máximo por request padrão
app.use('*', csrfGuard);

app.use(
  '*',
  cors({
    origin: corsOrigins(),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Olefoot-Pinata-Upload-Token'],
  }),
);

app.route('/', healthRoutes);
app.route('/', matchRoutes);
app.route('/', gameSpiritRoutes);
app.route('/', pinataMediaRoutes);
app.route('/', positionCoachRoutes);
app.route('/', narrativeMomentRoutes);
app.route('/', marketRoutes);
app.route('/api/voice', voiceRoutes);
app.route('/api/assistant', assistantRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`[olefoot-server] listening on http://localhost:${port}`);
  getSupabaseAdmin(); // aciona validação de conectividade no startup
});
