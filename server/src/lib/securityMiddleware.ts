import type { Context, Next } from 'hono';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(/[,\n\r]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5180'];

function isAllowedOrigin(origin: string): boolean {
  const allowed = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEV_ORIGINS;
  return allowed.includes(origin);
}

/**
 * CSRF: rejeita POSTs cross-origin sem Origin válida.
 * Browsers sempre enviam Origin em cross-origin requests; fetch de mesmo site envia-a também.
 */
export async function csrfGuard(c: Context, next: Next) {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next();
  }
  const origin = c.req.header('origin');

  // Rejeitar se não houver Origin (browsers sempre enviam em cross-origin)
  if (!origin) {
    return c.json({ error: 'Forbidden: missing origin' }, 403);
  }

  if (isAllowedOrigin(origin)) {
    return next();
  }

  return c.json({ error: 'Forbidden' }, 403);
}

/**
 * Security headers para todas as respostas.
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (c.req.url.startsWith('https://')) {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // CSP restritiva para a API — sem renderização de HTML, então podemos ser estritos
  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );
}
