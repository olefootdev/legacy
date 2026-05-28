/**
 * Payments — integração Abacate Pay (PIX).
 *
 * Fluxo:
 *   1. Front chama POST /api/payments/pix/create com produto + dados do user
 *   2. Cria payment_intent no Supabase (security definer via auth.uid)
 *   3. Chama POST /v2/transparents/create no Abacate Pay
 *   4. Persiste brCode/brCodeBase64 no intent
 *   5. Retorna pro front: { intentId, brCode, brCodeBase64, expiresAt }
 *
 * O resto (confirmação) é via webhook → edge function payment-webhook.
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

const ABACATE_API_BASE = 'https://api.abacatepay.com/v2';

interface CreatePixBody {
  product_kind?: 'activation_pack' | 'card' | 'recharge';
  product_ref?: string;
  amount_cents?: number;
  customer?: {
    name?: string;
    email?: string;
    tax_id?: string; // CPF
    cellphone?: string;
  };
}

interface AbacateChargeResponse {
  data?: {
    id?: string;
    status?: string;
    brCode?: string;
    brCodeBase64?: string;
    amount?: number;
    expiresAt?: string;
    devMode?: boolean;
  };
  error?: string | null;
  success?: boolean;
}

async function resolveUser(authHeader: string | undefined): Promise<{ id: string; email?: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

function bracketsFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export const paymentsRoutes = new Hono();

/**
 * POST /api/payments/pix/create
 *
 * Body:
 *   product_kind: 'activation_pack' | 'card' | 'recharge'
 *   product_ref?: string (uuid do card, etc — null pra activation_pack)
 *   amount_cents: número (default 12500 = R$125 / activation pack)
 *   customer: { name, email, tax_id (CPF), cellphone }  ← TODOS obrigatórios pra Abacate
 */
paymentsRoutes.post('/api/payments/pix/create', rateLimit(10), async (c) => {
  const user = await resolveUser(c.req.header('Authorization'));
  if (!user) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const apiKey = process.env.ABACATE_API_KEY?.trim();
  if (!apiKey) {
    return c.json({ ok: false, error: 'ABACATE_API_KEY não configurado no servidor.' }, 503);
  }

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<CreatePixBody>().catch(() => ({} as CreatePixBody));

  const productKind = body.product_kind;
  if (!productKind || !['activation_pack', 'card', 'recharge'].includes(productKind)) {
    return c.json({ ok: false, error: 'product_kind inválido' }, 400);
  }

  const amountCents = Math.floor(Number(body.amount_cents) || 0);
  if (amountCents < 100) {
    return c.json({ ok: false, error: 'amount_cents mínimo de 100 (R$1).' }, 400);
  }

  // Customer obrigatório por decisão de produto (CPF antes do checkout)
  const customer = body.customer;
  if (!customer?.name || !customer?.email || !customer?.tax_id) {
    return c.json({ ok: false, error: 'Dados do pagador obrigatórios (name, email, CPF).' }, 400);
  }

  // 1. Cria payment_intent server-side
  // (impersona o user via JWT pra que auth.uid() funcione nos RPCs security definer)
  const userToken = c.req.header('Authorization')!.slice('Bearer '.length).trim();
  const sbAsUser = sb.auth.setSession({ access_token: userToken, refresh_token: '' });
  // NOTE: setSession é assíncrono no v2 — não esperamos pq depois usamos RPC com session header

  // Usar fetch direto pra Supabase com o JWT do user:
  const projectUrl = process.env.SUPABASE_URL!;

  const rpcCreateRes = await fetch(`${projectUrl}/rest/v1/rpc/create_payment_intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      p_product_kind: productKind,
      p_product_ref: body.product_ref ?? null,
      p_amount_cents: amountCents,
      p_customer_name: customer.name,
      p_customer_email: customer.email,
      p_customer_tax_id: customer.tax_id,
      p_customer_cellphone: customer.cellphone ?? null,
      p_metadata: { source: 'olefoot_app' },
    }),
  });

  if (!rpcCreateRes.ok) {
    const txt = await rpcCreateRes.text();
    return c.json({ ok: false, step: 'create_intent', error: txt }, 500);
  }
  const rpcCreateData = (await rpcCreateRes.json()) as Array<{
    intent_id: string;
    external_id: string;
    amount_cents: number;
  }>;
  const intent = Array.isArray(rpcCreateData) ? rpcCreateData[0] : (rpcCreateData as any);
  if (!intent?.intent_id) {
    return c.json({ ok: false, step: 'create_intent', error: 'empty rpc response' }, 500);
  }

  // 2. Chama Abacate Pay
  try {
    const abacateRes = await fetch(`${ABACATE_API_BASE}/transparents/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: amountCents,
          expiresIn: 3600, // 1 hora
          externalId: intent.external_id,
          description: productKind === 'activation_pack'
            ? 'Ativação Olefoot Plano de Carreira'
            : `Olefoot · ${productKind}`,
          customer: {
            name: customer.name,
            email: customer.email,
            taxId: customer.tax_id,
            cellphone: customer.cellphone ?? '',
          },
          metadata: {
            intent_id: intent.intent_id,
            product_kind: productKind,
            product_ref: body.product_ref ?? null,
            user_id: user.id,
          },
        },
      }),
    });

    if (!abacateRes.ok) {
      const txt = await abacateRes.text();
      return c.json({ ok: false, step: 'abacate_create', status: abacateRes.status, error: txt }, 502);
    }

    const abacate = (await abacateRes.json()) as AbacateChargeResponse;
    if (!abacate.success || !abacate.data?.brCode) {
      return c.json({
        ok: false,
        step: 'abacate_create',
        error: abacate.error ?? 'sem brCode na resposta',
      }, 502);
    }

    // 3. Atualiza intent com dados da Abacate
    await fetch(`${projectUrl}/rest/v1/rpc/update_payment_intent_charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        p_intent_id: intent.intent_id,
        p_abacate_id: abacate.data.id ?? null,
        p_br_code: abacate.data.brCode,
        p_br_code_base64: abacate.data.brCodeBase64 ?? null,
        p_expires_at: abacate.data.expiresAt ?? null,
        p_dev_mode: abacate.data.devMode ?? false,
      }),
    });

    return c.json({
      ok: true,
      intent_id: intent.intent_id,
      external_id: intent.external_id,
      abacate_id: abacate.data.id,
      amount_cents: amountCents,
      br_code: abacate.data.brCode,
      br_code_base64: abacate.data.brCodeBase64,
      expires_at: abacate.data.expiresAt,
      status: abacate.data.status ?? 'PENDING',
      dev_mode: abacate.data.devMode ?? false,
    });
  } catch (e) {
    return c.json({ ok: false, step: 'abacate_create', error: bracketsFromError(e) }, 502);
  }
});

/**
 * GET /api/payments/:intentId/status
 *
 * Fallback de polling caso webhook atrase. Consulta Supabase (não chama Abacate
 * em todo poll pra evitar rate limit). Frontend usa este endpoint.
 */
paymentsRoutes.get('/api/payments/:intentId/status', rateLimit(60), async (c) => {
  const user = await resolveUser(c.req.header('Authorization'));
  if (!user) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const intentId = c.req.param('intentId');
  if (!intentId) return c.json({ ok: false, error: 'intent_id obrigatório' }, 400);

  const userToken = c.req.header('Authorization')!.slice('Bearer '.length).trim();
  const projectUrl = process.env.SUPABASE_URL!;

  const res = await fetch(`${projectUrl}/rest/v1/rpc/get_my_payment_intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ p_intent_id: intentId }),
  });

  if (!res.ok) {
    return c.json({ ok: false, error: await res.text() }, 500);
  }

  const data = (await res.json()) as Array<Record<string, unknown>>;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return c.json({ ok: false, error: 'not_found' }, 404);

  return c.json({ ok: true, intent: row });
});
