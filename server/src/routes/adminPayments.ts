import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

/**
 * Rotas admin de pagamentos — lista de intents + estorno manual.
 *
 * O estorno chama a RPC `reverse_payment_intent` (service role; a RPC tem
 * EXECUTE revogado de anon/authenticated). A RPC é idempotente, reverte
 * comissões/créditos não coletados e registra a auditoria em
 * `payment_refunds` (inclusive a flag needs_manual pra clawback manual).
 */
export const adminPaymentsRoutes = new Hono();

/**
 * GATE DE ADMIN EM TUDO DESTE ROUTER — como middleware, rota nova neste
 * arquivo já nasce protegida (mesmo padrão de admin.ts; comentário não é
 * evidência, o guard roda antes de qualquer handler).
 */
adminPaymentsRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/payments/intents?status=paid
 * Intents recentes (default: todas; ?status filtra). Limite 100.
 */
adminPaymentsRoutes.get('/payments/intents', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const status = c.req.query('status');
  let q = sb
    .from('payment_intents')
    .select(
      'id, user_id, status, product_kind, product_ref, amount_cents, currency, customer_name, customer_email, created_at, paid_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'todas') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('[admin/payments/intents]', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data ?? []);
});

/**
 * GET /api/admin/payments/refunds
 * Estornos registrados (payment_refunds). Limite 100.
 */
adminPaymentsRoutes.get('/payments/refunds', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb
    .from('payment_refunds')
    .select('id, intent_id, mp_payment_id, reason, amount_cents, auto_reversed, needs_manual, note, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin/payments/refunds]', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data ?? []);
});

/**
 * POST /api/admin/payments/refund/:intentId  { reason? }
 * Executa reverse_payment_intent. Retorna o resultado da RPC
 * (status, comissões revertidas, créditos anulados, needs_manual).
 */
adminPaymentsRoutes.post('/payments/refund/:intentId', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const intentId = c.req.param('intentId');
  if (!UUID_RE.test(intentId)) return c.json({ error: 'intentId inválido' }, 400);

  let reason = 'admin_refund';
  try {
    const body = (await c.req.json()) as { reason?: unknown };
    if (typeof body?.reason === 'string' && body.reason.trim()) {
      reason = body.reason.trim().slice(0, 200);
    }
  } catch {
    /* body opcional */
  }

  const { data, error } = await sb.rpc('reverse_payment_intent', {
    p_intent_id: intentId,
    p_mp_payment_id: null,
    p_reason: reason,
  });

  if (error) {
    console.error('[admin/payments/refund]', error.message);
    return c.json({ error: error.message }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return c.json({ ok: true, result: row ?? null });
});
