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
async function adminSessionInfo(c: Context): Promise<{ email: string | null; reason: string }> {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return { email: null, reason: 'sem Bearer (não logado neste dispositivo?)' };
  const sb = getSupabaseAdmin();
  if (!sb) return { email: null, reason: 'servidor sem service role (SUPABASE_SERVICE_ROLE_KEY/SUPABASE_URL)' };
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error) return { email: null, reason: `sessão inválida/expirada: ${error.message}` };
    if (!data.user?.email) return { email: null, reason: 'sessão sem e-mail' };
    return { email: data.user.email.toLowerCase(), reason: 'ok' };
  } catch (e) {
    return { email: null, reason: `erro ao validar sessão: ${e instanceof Error ? e.message : 'desconhecido'}` };
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
  const info = await adminSessionInfo(c);
  if (info.email && ADMIN_EMAILS.has(info.email)) return null;

  // 3) Dev local sem token configurado e sem sessão admin → libera (como antes).
  if (!expected && process.env.NODE_ENV !== 'production') return null;

  // Diagnóstico preciso no 403 (só expõe o próprio e-mail do usuário + a razão).
  const detail = info.email
    ? `a conta logada (${info.email}) não está na lista de admins`
    : `não autenticado — ${info.reason}`;
  return c.json({ error: `Acesso de admin negado: ${detail}.` }, 403);
}
