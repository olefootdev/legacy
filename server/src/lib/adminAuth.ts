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
 * Default inclui as contas do fundador; override/adição via env ADMIN_EMAILS
 * (separado por vírgula). NOTA: `olefootdev@gmail.com` é o e-mail histórico mas
 * nunca teve conta de jogador criada — `trader4.tfxpro@gmail.com` é a conta real
 * usada no jogo, por isso entra no default (senão o painel barra o próprio dono).
 */
const ADMIN_EMAILS: Set<string> = new Set(
  [
    'olefootdev@gmail.com',
    'trader4.tfxpro@gmail.com',
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
 * Quem está agindo como admin, pra ficar ESCRITO no que ele cria ou revoga.
 * Chamar DEPOIS do `requireAdminToken`: aqui não se decide acesso, só se nomeia.
 * Pelo token do painel (sem sessão) volta 'token-admin'.
 */
export async function adminQuemAge(c: Context): Promise<string> {
  const info = await adminSessionInfo(c);
  if (info.email && ADMIN_EMAILS.has(info.email)) return info.email;
  return 'token-admin';
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

  // 3) Dev local sem token e sem sessão → libera. Exige NODE_ENV === 'development'
  //    EXPLÍCITO: a versão anterior era `!== 'production'`, que com a variável
  //    indefinida (o caso quando ninguém a configura) liberava tudo. Gate de
  //    admin tem que FALHAR FECHADO — sem NODE_ENV definido, nega.
  if (!expected && process.env.NODE_ENV === 'development') return null;

  // Diagnóstico preciso no 403 (só expõe o próprio e-mail do usuário + a razão).
  const detail = info.email
    ? `a conta logada (${info.email}) não está na lista de admins`
    : `não autenticado — ${info.reason}`;
  return c.json({ error: `Acesso de admin negado: ${detail}.` }, 403);
}

/**
 * Minutos desde a última AUTENTICAÇÃO de verdade da sessão do Bearer.
 *
 * Lê o `amr` do JWT — a hora de cada login real; refresh de token renova o
 * `iat` mas não mexe no `amr` (o mesmo relógio que o PIN da carteira usa no
 * SQL). O payload é decodificado sem conferir assinatura DE PROPÓSITO: quem
 * confere é o `requireAdminToken` logo antes, via `sb.auth.getUser(token)` —
 * aqui só se lê um campo de um token que já provou ser autêntico.
 */
function minutosDesdeLogin(c: Context): number | null {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const payloadB64 = token?.split('.')[1];
  if (!payloadB64) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      amr?: Array<{ timestamp?: number }>;
    };
    const ts = Math.max(0, ...(payload.amr ?? []).map((e) => Number(e?.timestamp) || 0));
    if (ts <= 0) return null;
    return (Date.now() / 1000 - ts) / 60;
  } catch {
    return null;
  }
}

/**
 * Gate das rotas de DINHEIRO (estorno, licenças, Vault): além de ser admin,
 * exige que o login seja recente. Uma sessão roubada do navegador de jogar
 * para de valer pra mover dinheiro depois da janela.
 *
 * O modo X-Admin-Token (automação) passa direto: o segredo é o fator.
 */
export async function requireAdminFresco(c: Context, maxMinutos = 30): Promise<Response | null> {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;

  const expected = configuredAdminToken();
  if (expected && c.req.header('X-Admin-Token')?.trim() === expected) return null;

  const min = minutosDesdeLogin(c);
  if (min == null && !expected && process.env.NODE_ENV === 'development') return null;
  if (min == null || min > maxMinutos) {
    return c.json({
      error: `Operação de dinheiro exige login recente: saia e entre na conta de novo (vale ${maxMinutos} min).`,
      motivo: 'login_antigo',
    }, 403);
  }
  return null;
}
