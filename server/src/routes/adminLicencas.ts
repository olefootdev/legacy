import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { adminQuemAge, requireAdminFresco, requireAdminToken } from '../lib/adminAuth.js';

/**
 * Licenças de ativação da expansão — gerar, listar, revogar.
 *
 * A licença ativa a conta no plano de equiparação SEM compra: sem OLEFOOT, sem
 * OLEXP, sem receita. As regras estão no banco (migration
 * `20260930160000_expansao_licenca.sql`); aqui é só a porta de admin. As três
 * funções têm EXECUTE só pra service_role — o cliente resgata direto pelo RPC
 * `expansao_resgatar_licenca`, e é a única coisa que ele faz.
 *
 * 🔒 O código volta UMA vez, na resposta do POST. O banco guarda só o hash.
 */
export const adminLicencasRoutes = new Hono();

// Gate no router inteiro: rota nova aqui já nasce protegida.
adminLicencasRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

/** Erro do banco com prefixo conhecido vira 400 com a frase; o resto é 500. */
function erroDoBanco(msg: string): { status: 400 | 500; error: string } {
  const m = /LICENCA_[A-Z]+: (.*)/.exec(msg);
  return m ? { status: 400, error: m[1]! } : { status: 500, error: msg };
}

/** GET /api/admin/licencas — as mais recentes primeiro. */
adminLicencasRoutes.get('/licencas', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const { data, error } = await sb.rpc('expansao_licenca_listar', { p_limite: 500 });
  if (error) {
    console.error('[admin/licencas]', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data ?? []);
});

/**
 * POST /api/admin/licencas
 * { quantidade: 1..500, lote: string, patrocinador?: username, validadeDias?: number }
 * → { codigos: [{ licencaId, codigo }] }
 */
adminLicencasRoutes.post('/licencas', async (c) => {
  // 🔒 Dinheiro exige login RECENTE (P0 do raio-x 30/09): sessão roubada do
  // navegador de jogar não move dinheiro depois da janela.
  const fresco = await requireAdminFresco(c);
  if (fresco) return fresco;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  let body: { quantidade?: unknown; lote?: unknown; patrocinador?: unknown; validadeDias?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido' }, 400); }

  const quantidade = Number(body.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500) {
    return c.json({ error: 'Quantidade de 1 a 500.' }, 400);
  }
  const lote = typeof body.lote === 'string' ? body.lote.trim().slice(0, 80) : '';
  if (!lote) return c.json({ error: 'Dê um nome ao lote.' }, 400);

  let patrocinadorId: string | null = null;
  const patrocinador = typeof body.patrocinador === 'string' ? body.patrocinador.trim().replace(/^@/, '') : '';
  if (patrocinador) {
    const { data, error } = await sb.from('profiles').select('id').ilike('username', patrocinador).maybeSingle();
    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: `Não existe o usuário @${patrocinador}.` }, 400);
    patrocinadorId = data.id as string;
  }

  let expiraEm: string | null = null;
  if (body.validadeDias != null && body.validadeDias !== '') {
    const dias = Number(body.validadeDias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) {
      return c.json({ error: 'Validade de 1 a 3650 dias (ou em branco, sem validade).' }, 400);
    }
    expiraEm = new Date(Date.now() + dias * 86_400_000).toISOString();
  }

  const { data, error } = await sb.rpc('expansao_licenca_gerar', {
    p_quantidade: quantidade,
    p_lote: lote,
    p_patrocinador: patrocinadorId,
    p_expira_em: expiraEm,
    p_criada_por: await adminQuemAge(c),
  });
  if (error) {
    const e = erroDoBanco(error.message);
    if (e.status === 500) console.error('[admin/licencas POST]', error.message);
    return c.json({ error: e.error }, e.status);
  }
  const codigos = ((data ?? []) as { licenca_id: number; codigo: string }[])
    .map((r) => ({ licencaId: Number(r.licenca_id), codigo: r.codigo }));
  return c.json({ codigos });
});

/** POST /api/admin/licencas/:id/revogar { motivo? } */
adminLicencasRoutes.post('/licencas/:id/revogar', async (c) => {
  // 🔒 Dinheiro exige login RECENTE (P0 do raio-x 30/09): sessão roubada do
  // navegador de jogar não move dinheiro depois da janela.
  const fresco = await requireAdminFresco(c);
  if (fresco) return fresco;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'id inválido' }, 400);

  let motivo = '';
  try {
    const b = (await c.req.json()) as { motivo?: unknown };
    if (typeof b?.motivo === 'string') motivo = b.motivo.trim().slice(0, 200);
  } catch { /* corpo opcional */ }

  const { data, error } = await sb.rpc('expansao_licenca_revogar', {
    p_id: id, p_por: await adminQuemAge(c), p_motivo: motivo || null,
  });
  if (error) {
    const e = erroDoBanco(error.message);
    return c.json({ error: e.error }, e.status);
  }
  return c.json({ ok: data === true });
});
