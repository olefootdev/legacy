/**
 * Payments — integração Mercado Pago (PIX).
 *
 * Fluxo:
 *   1. Front chama POST /api/payments/pix/create com produto + dados do user
 *   2. Cria payment_intent no Supabase (security definer via auth.uid)
 *   3. Chama POST /v1/payments no Mercado Pago (payment_method_id='pix')
 *   4. Persiste brCode (qr_code copia-e-cola) + brCodeBase64 (QR PNG) no intent
 *   5. Retorna pro front: { intentId, brCode, brCodeBase64, expiresAt }
 *
 * O resto (confirmação) é via webhook → edge function payment-webhook.
 *
 * NOTA: a coluna payment_intents.abacate_id (nome legado) agora guarda o
 * payment id do Mercado Pago. As RPCs create/update/confirm continuam
 * agnósticas de provedor — só este arquivo e o webhook falam com o MP.
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { resolveCardCheckout } from '../lib/cardPricing.js';

const MP_API_BASE = 'https://api.mercadopago.com';

/** Pack de ativação — preço fixo de produto (R$125). */
const ACTIVATION_PACK_CENTS = 12_500;

/** Depósito mínimo (R$1). Recarga é 1:1 (paga R$X → recebe R$X em BRO). */
const RECHARGE_MIN_CENTS = 100;

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
  /** Metadata extra guardada na intent (ex: { player } pra entrega de card). */
  metadata?: Record<string, unknown>;
}

interface MpPaymentResponse {
  id?: number;
  status?: string;
  live_mode?: boolean;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;        // copia-e-cola (brCode)
      qr_code_base64?: string; // PNG base64
      ticket_url?: string;
    };
  };
  // Erros do MP vêm em { message, error, status, cause: [...] }
  message?: string;
  error?: string;
  cause?: Array<{ code?: string | number; description?: string }>;
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

/**
 * Formata uma Date no fuso de Brasília (-03:00, sem horário de verão desde 2019)
 * no padrão ISO-8601 com offset que o Mercado Pago exige em date_of_expiration.
 * Ex: 2026-07-03T20:00:00.000-03:00
 */
function toMpExpiry(d: Date): string {
  const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000); // wall clock -03:00
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}` +
    `.${p(shifted.getUTCMilliseconds(), 3)}-03:00`
  );
}

/** Quebra "João da Silva" em { first: 'João', last: 'da Silva' } pro payer do MP. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? full, last: parts[0] ?? full };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

export const paymentsRoutes = new Hono();

/**
 * POST /api/payments/pix/create
 *
 * Body:
 *   product_kind: 'activation_pack' | 'card' | 'recharge'
 *   product_ref?: string (uuid do card, etc — null pra activation_pack)
 *   amount_cents: número (default 12500 = R$125 / activation pack)
 *   customer: { name, email, tax_id (CPF), cellphone }  ← name/email/CPF obrigatórios
 */
paymentsRoutes.post('/api/payments/pix/create', rateLimit(10), async (c) => {
  const user = await resolveUser(c.req.header('Authorization'));
  if (!user) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return c.json({ ok: false, error: 'MP_ACCESS_TOKEN não configurado no servidor.' }, 503);
  }

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<CreatePixBody>().catch(() => ({} as CreatePixBody));

  const productKind = body.product_kind;
  if (!productKind || !['activation_pack', 'card', 'recharge'].includes(productKind)) {
    return c.json({ ok: false, error: 'product_kind inválido' }, 400);
  }

  // Customer obrigatório por decisão de produto (CPF antes do checkout)
  const customer = body.customer;
  if (!customer?.name || !customer?.email || !customer?.tax_id) {
    return c.json({ ok: false, error: 'Dados do pagador obrigatórios (name, email, CPF).' }, 400);
  }

  // ─── Valor e metadata AUTORITATIVOS por produto ──────────────────────────
  // confirm_payment_intent credita o split sobre amount_cents e entrega
  // metadata->'player' no plantel — os dois precisam sair do servidor, não do
  // body. Só a recarga é legitimamente dirigida pelo cliente (é 1:1).
  const clientMetadata = body.metadata ?? {};
  let amountCents: number;
  let metadata: Record<string, unknown> = { source: 'olefoot_app', ...clientMetadata };

  if (productKind === 'card') {
    const resolved = await resolveCardCheckout({
      sb,
      productRef: body.product_ref,
      clientPlayer: (clientMetadata as Record<string, unknown>).player,
    });
    if (!resolved.ok) {
      return c.json({ ok: false, step: 'card_checkout', error: resolved.error }, resolved.status);
    }
    amountCents = resolved.checkout.amountCents;
    metadata = { ...metadata, player: resolved.checkout.player };
  } else if (productKind === 'activation_pack') {
    amountCents = ACTIVATION_PACK_CENTS;
  } else {
    amountCents = Math.floor(Number(body.amount_cents) || 0);
    if (amountCents < RECHARGE_MIN_CENTS) {
      return c.json({ ok: false, error: 'amount_cents mínimo de 100 (R$1).' }, 400);
    }
  }

  // 1. Cria payment_intent server-side
  // (impersona o user via JWT pra que auth.uid() funcione nos RPCs security definer)
  const userToken = c.req.header('Authorization')!.slice('Bearer '.length).trim();
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
      p_metadata: metadata,
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

  // 2. Chama Mercado Pago — POST /v1/payments com payment_method_id='pix'
  try {
    const taxId = customer.tax_id.replace(/\D/g, '');
    const { first, last } = splitName(customer.name);
    const expiresAt = toMpExpiry(new Date(Date.now() + 60 * 60 * 1000)); // 1 hora
    // Webhook opcional por-pagamento (também dá pra configurar no painel MP).
    const notificationUrl = process.env.MP_WEBHOOK_URL?.trim() || undefined;

    const mpRes = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        // Idempotência do lado do MP: mesma intent nunca gera cobrança dupla.
        'X-Idempotency-Key': intent.external_id,
      },
      body: JSON.stringify({
        transaction_amount: Number((amountCents / 100).toFixed(2)), // reais decimais
        description: productKind === 'activation_pack'
          ? 'Ativação Olefoot Plano de Carreira'
          : `Olefoot · ${productKind}`,
        payment_method_id: 'pix',
        external_reference: intent.external_id,
        date_of_expiration: expiresAt,
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        payer: {
          email: customer.email,
          first_name: first,
          last_name: last,
          identification: { type: 'CPF', number: taxId },
        },
        metadata: {
          intent_id: intent.intent_id,
          product_kind: productKind,
          product_ref: body.product_ref ?? null,
          user_id: user.id,
        },
      }),
    });

    const mp = (await mpRes.json().catch(() => ({}))) as MpPaymentResponse;

    if (!mpRes.ok) {
      const causeDesc = Array.isArray(mp.cause) && mp.cause.length
        ? mp.cause.map((x) => x.description).filter(Boolean).join('; ')
        : undefined;
      return c.json({
        ok: false,
        step: 'mp_create',
        status: mpRes.status,
        error: causeDesc ?? mp.message ?? mp.error ?? 'falha ao criar pagamento',
      }, 502);
    }

    const txData = mp.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) {
      return c.json({
        ok: false,
        step: 'mp_create',
        error: mp.message ?? 'sem qr_code na resposta do Mercado Pago',
      }, 502);
    }

    const mpId = mp.id != null ? String(mp.id) : null;
    const devMode = mp.live_mode === false; // credencial de teste → sandbox

    // 3. Atualiza intent com dados do Mercado Pago (reusa colunas legadas)
    await fetch(`${projectUrl}/rest/v1/rpc/update_payment_intent_charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        p_intent_id: intent.intent_id,
        p_abacate_id: mpId, // ← guarda o payment id do MP
        p_br_code: txData.qr_code,
        p_br_code_base64: txData.qr_code_base64 ?? null,
        p_expires_at: mp.date_of_expiration ?? expiresAt,
        p_dev_mode: devMode,
      }),
    });

    return c.json({
      ok: true,
      intent_id: intent.intent_id,
      external_id: intent.external_id,
      abacate_id: mpId,
      amount_cents: amountCents,
      br_code: txData.qr_code,
      br_code_base64: txData.qr_code_base64,
      expires_at: mp.date_of_expiration ?? expiresAt,
      status: mp.status ?? 'pending',
      dev_mode: devMode,
    });
  } catch (e) {
    return c.json({ ok: false, step: 'mp_create', error: bracketsFromError(e) }, 502);
  }
});

/**
 * GET /api/payments/:intentId/status
 *
 * Fallback de polling caso webhook atrase. Consulta Supabase (não chama Mercado
 * Pago em todo poll pra evitar rate limit). Frontend usa este endpoint.
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
