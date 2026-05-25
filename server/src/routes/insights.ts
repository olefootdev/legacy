/**
 * OLEFOOT PYTHON MODE — Proxy pro serviço Python /insights.
 *
 * O Hono recebe a request do browser, repassa pro FastAPI (Railway) com
 * o JWT do Supabase no header Authorization. O Python valida o token
 * e responde com analytics.
 *
 * Por que proxiar em vez de chamar direto do browser?
 *   - Centraliza CORS (não preciso configurar no Python)
 *   - Esconde URL interna do serviço Python
 *   - Permite caching server-side futuramente
 *   - Permite enriquecer com dados que só o Hono tem (OpenAI, GameSpirit)
 *
 * Variável de ambiente:
 *   OLEFOOT_INSIGHTS_URL — URL do FastAPI no Railway
 *                          (ex: https://olefoot-insights.up.railway.app)
 *   Se ausente, retorna 503.
 */
import { Hono } from 'hono';

export const insightsRoutes = new Hono();

const ALLOWED_CLUB_PATHS = new Set([
  'consequences',
  'summary',
  'squad-overview',
  'night-report',
]);

const ALLOWED_PLAYER_PATHS = new Set([
  'transparency',
]);

async function proxyToInsights(url: string, auth: string): Promise<Response> {
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Authorization: auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

insightsRoutes.get('/api/insights/club/:managerId/:endpoint', async (c) => {
  const baseUrl = process.env.OLEFOOT_INSIGHTS_URL;
  if (!baseUrl) {
    return c.json(
      { error: 'insights_service_unavailable', message: 'OLEFOOT_INSIGHTS_URL não configurada' },
      503,
    );
  }

  const { managerId, endpoint } = c.req.param();
  if (!ALLOWED_CLUB_PATHS.has(endpoint)) {
    return c.json({ error: 'invalid_endpoint', allowed: Array.from(ALLOWED_CLUB_PATHS) }, 400);
  }

  const auth = c.req.header('authorization');
  if (!auth) {
    return c.json({ error: 'missing_auth' }, 401);
  }

  const target = `${baseUrl.replace(/\/$/, '')}/club/${encodeURIComponent(managerId)}/${endpoint}`;

  try {
    return await proxyToInsights(target, auth);
  } catch (err) {
    console.warn('[insights proxy] club error:', err);
    return c.json(
      { error: 'upstream_failure', message: (err as Error).message },
      502,
    );
  }
});

insightsRoutes.get('/api/insights/player/:playerId/:endpoint', async (c) => {
  const baseUrl = process.env.OLEFOOT_INSIGHTS_URL;
  if (!baseUrl) {
    return c.json(
      { error: 'insights_service_unavailable', message: 'OLEFOOT_INSIGHTS_URL não configurada' },
      503,
    );
  }

  const { playerId, endpoint } = c.req.param();
  if (!ALLOWED_PLAYER_PATHS.has(endpoint)) {
    return c.json({ error: 'invalid_endpoint', allowed: Array.from(ALLOWED_PLAYER_PATHS) }, 400);
  }

  const auth = c.req.header('authorization');
  if (!auth) {
    return c.json({ error: 'missing_auth' }, 401);
  }

  const target = `${baseUrl.replace(/\/$/, '')}/player/${encodeURIComponent(playerId)}/${endpoint}`;

  try {
    return await proxyToInsights(target, auth);
  } catch (err) {
    console.warn('[insights proxy] player error:', err);
    return c.json(
      { error: 'upstream_failure', message: (err as Error).message },
      502,
    );
  }
});

/** Health check do upstream — diagnóstico rápido. */
insightsRoutes.get('/api/insights/health', async (c) => {
  const baseUrl = process.env.OLEFOOT_INSIGHTS_URL;
  if (!baseUrl) {
    return c.json({ ok: false, reason: 'OLEFOOT_INSIGHTS_URL não configurada' }, 503);
  }

  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const data = await resp.json();
    return c.json({ ok: true, upstream: data });
  } catch (err) {
    return c.json({ ok: false, reason: (err as Error).message }, 502);
  }
});
