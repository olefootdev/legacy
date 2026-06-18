import type { Context } from 'hono';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const ADMIN_TOKEN_ENV_KEYS = [
  'GLOBAL_LEAGUE_ADMIN_TOKEN',
  'ADMIN_API_TOKEN',
  'OLEFOOT_ADMIN_TOKEN',
] as const;

function configuredAdminToken(): string | null {
  for (const key of ADMIN_TOKEN_ENV_KEYS) {
    const token = process.env[key]?.trim();
    if (token) return token;
  }
  return null;
}

/**
 * E-mails autorizados a agir como admin via login do OLEFOOT (sessão Supabase).
 * Default inclui o fundador; override/adição via env ADMIN_EMAILS (separado por vírgula).
 */
const ADMIN_EMAILS: Set<string> = new Set(
  [
    'olefootdev@gmail.com',
    ...(process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ].map((e) => e.toLowerCase()),
);

/** Resolve o e-mail do usuário a partir do Bearer token (sessão Supabase). */
async function adminEmailFromSession(c: Context): Promise<string | null> {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return data.user.email.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Gate de admin. Aceita DOIS modos:
 *   1) Header X-Admin-Token == segredo configurado (legado / painel Global).
 *   2) Sessão Supabase de um admin (login do OLEFOOT) cujo e-mail está em ADMIN_EMAILS.
 *      → sem necessidade de token manual em nenhum dispositivo.
 *
 * Retorna `null` se autorizado, ou uma Response de erro caso contrário.
 * Async porque a validação da sessão consulta o Supabase.
 */
export async function requireAdminToken(c: Context): Promise<Response | null> {
  // 1) Token header
  const expected = configuredAdminToken();
  if (expected) {
    const provided = c.req.header('X-Admin-Token')?.trim();
    if (provided && provided === expected) return null;
  }

  // 2) Sessão de admin (login OLEFOOT)
  const email = await adminEmailFromSession(c);
  if (email && ADMIN_EMAILS.has(email)) return null;

  // 3) Dev local sem token configurado e sem sessão admin → libera (como antes).
  if (!expected && process.env.NODE_ENV !== 'production') return null;

  return c.json({ error: 'Acesso de admin negado: token inválido ou conta sem permissão.' }, 403);
}
