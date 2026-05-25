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

const ALLOWED_PATHS = new Set([
  'consequences',
  'summary',
  'night-report',
]);

insightsRoutes.get('/api/insights/club/:managerId/:endpoint', async (c) => {
  const baseUrl = process.env.OLEFOOT_INSIGHTS_URL;
  if (!baseUrl) {
    return c.json(
      { error: 'insights_service_unavailable', message: 'OLEFOOT_INSIGHTS_URL não configurada' },
      503,
    );
  }

  const { managerId, endpoint } = c.req.param();
  if (!ALLOWED_PATHS.has(endpoint)) {
    return c.json({ error: 'invalid_endpoint', allowed: Array.from(ALLOWED_PATHS) }, 400);
  }

  const auth = c.req.header('authorization');
  if (!auth) {
    return c.json({ error: 'missing_auth' }, 401);
  }

  const target = `${baseUrl.replace(/\/$/, '')}/club/${encodeURIComponent(managerId)}/${endpoint}`;

  try {
    const resp = await fetch(target, {
      method: 'GET',
      headers: {
        Authorization: auth,
        Accept: 'application/json',
      },
      // Timeout de 10s — analytics não pode prender UI
      signal: AbortSignal.timeout(10_000),
    });

    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    console.warn('[insights proxy] error:', err);
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
