// deno-lint-ignore-file no-explicit-any
// Olefoot — payment-webhook
//
// Recebe webhooks do Mercado Pago (https://www.mercadopago.com.br/developers
//   → Notifications → Webhooks).
// Valida a assinatura HMAC-SHA256 via header X-Signature + X-Request-Id.
// Idempotência via payment_webhooks_log.event_id UNIQUE.
//
// Fluxo: o webhook do MP é "magro" — só traz data.id (id do pagamento). Pra
// saber o status real fazemos GET /v1/payments/{id} com o access token.
// Quando status='approved' → chama confirm_payment_intent RPC.
//
// IMPORTANTE: deploy com verify_jwt: false — webhook é público.
// Segredos (Supabase dashboard → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN     — pra consultar o pagamento
//   MP_WEBHOOK_SECRET   — a "chave secreta" da assinatura (painel MP → Webhooks)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MP_API_BASE = 'https://api.mercadopago.com';

interface MpWebhookBody {
  id?: number | string;          // id da notificação
  type?: string;                 // 'payment'
  action?: string;               // 'payment.created' | 'payment.updated'
  live_mode?: boolean;
  date_created?: string;
  data?: { id?: string };        // id do recurso (pagamento)
  [k: string]: any;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Extrai { ts, v1 } do header x-signature: "ts=1704908010,v1=abcdef..." */
function parseSignatureHeader(header: string): { ts: string; v1: string } {
  let ts = '';
  let v1 = '';
  for (const part of header.split(',')) {
    const [k, val] = part.split('=');
    const key = (k ?? '').trim();
    if (key === 'ts') ts = (val ?? '').trim();
    else if (key === 'v1') v1 = (val ?? '').trim();
  }
  return { ts, v1 };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const rawBody = await req.text();

  let body: MpWebhookBody;
  try {
    body = JSON.parse(rawBody) as MpWebhookBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // O id do recurso (pagamento) usado no manifesto da assinatura vem do query
  // param data.id (fallback pro corpo). MP normaliza alfanuméricos p/ minúsculo.
  const dataIdRaw = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : '');
  const dataId = dataIdRaw ? dataIdRaw.toLowerCase() : '';
  const notificationType = url.searchParams.get('type') ?? body.type ?? '';

  // ── 1. Valida assinatura HMAC (obrigatória — sem exceções) ──────────────
  const secret = Deno.env.get('MP_WEBHOOK_SECRET') ?? '';
  const signatureHeader = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  let signatureValid = false;
  let signatureDebug = '';

  if (!secret) {
    signatureDebug = 'missing_MP_WEBHOOK_SECRET';
  } else {
    const { ts, v1 } = parseSignatureHeader(signatureHeader);
    if (!ts || !v1) {
      signatureDebug = `malformed_signature header_prefix=${signatureHeader.slice(0, 12)}`;
    } else {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      try {
        const expected = await hmacHex(secret, manifest);
        signatureValid = timingSafeEqual(expected, v1);
        if (!signatureValid) {
          signatureDebug = `mismatch expected_prefix=${expected.slice(0, 10)} v1_prefix=${v1.slice(0, 10)} dataId=${dataId}`;
        }
      } catch (e) {
        signatureDebug = `hmac_error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }

  // id de evento pra idempotência: notificação + recurso (retries repetem os dois)
  const eventId = `${body.id ?? 'noid'}:${dataId || 'nodata'}`;

  // ── 2. Loga (idempotência via UNIQUE event_id) ──────────────────────────
  const { error: logErr } = await supabase
    .from('payment_webhooks_log')
    .insert({
      event_id: eventId,
      event_type: body.action ?? notificationType ?? 'unknown',
      raw_payload: body as any,
      signature_header: signatureHeader,
      signature_valid: signatureValid,
    });

  if (logErr) {
    if (logErr.code === '23505') {
      // Duplicate → idempotência. 200 pra o MP parar de reenviar.
      return new Response(
        JSON.stringify({ ok: true, step: 'duplicate_event', eventId }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ ok: false, step: 'log_insert', error: logErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Assinatura inválida → recusa (sem bypass) ────────────────────────
  if (!signatureValid) {
    await supabase
      .from('payment_webhooks_log')
      .update({ error_message: `invalid_signature ${signatureDebug}` })
      .eq('event_id', eventId);

    console.warn('[payment-webhook] invalid_signature', signatureDebug);
    return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 4. Processa evento de pagamento ─────────────────────────────────────
  let intentId: string | null = null;
  let processedAt: string | null = null;
  let errorMessage: string | null = null;

  const isPaymentEvent = notificationType === 'payment' || (body.action ?? '').startsWith('payment');

  if (isPaymentEvent && dataIdRaw) {
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';
    if (!accessToken) {
      errorMessage = 'missing_MP_ACCESS_TOKEN';
    } else {
      // GET /v1/payments/{id} — fonte da verdade do status.
      const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(dataIdRaw)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mpRes.ok) {
        errorMessage = `mp_fetch_failed:${mpRes.status}`;
      } else {
        const payment = (await mpRes.json().catch(() => ({}))) as {
          id?: number;
          status?: string;
          transaction_amount?: number;      // valor em reais
          external_reference?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        const status = payment.status ?? null;

        if (status !== 'approved') {
          // pending / in_process / rejected / cancelled — nada a fazer ainda.
          // NÃO é erro: a aprovação chega depois como outra notificação
          // (payment.updated). Marca como recebido (200) pra o MP não reenviar.
          processedAt = new Date().toISOString();
        } else {
          const externalRef = payment.external_reference ?? null;
          const intentFromMeta = (payment.metadata as Record<string, unknown> | undefined)?.intent_id as string | undefined;
          const mpPaymentId = payment.id != null ? String(payment.id) : dataIdRaw;

          // Acha a intent: external_reference (= external_id) → metadata.intent_id → abacate_id
          let intent: { id: string; status: string; user_id: string; amount_cents: number } | null = null;

          if (externalRef) {
            const { data } = await supabase
              .from('payment_intents')
              .select('id, status, user_id, amount_cents')
              .eq('external_id', externalRef)
              .maybeSingle();
            if (data) intent = data;
          }
          if (!intent && intentFromMeta) {
            const { data } = await supabase
              .from('payment_intents')
              .select('id, status, user_id, amount_cents')
              .eq('id', intentFromMeta)
              .maybeSingle();
            if (data) intent = data;
          }
          if (!intent) {
            const { data } = await supabase
              .from('payment_intents')
              .select('id, status, user_id, amount_cents')
              .eq('abacate_id', mpPaymentId)
              .maybeSingle();
            if (data) intent = data;
          }

          if (!intent) {
            errorMessage = `intent_not_found:ext=${externalRef}|meta=${intentFromMeta}|mp=${mpPaymentId}`;
          } else {
            // Confere o VALOR pago vs o pedido — bloqueia pagamento parcial/adulterado
            // creditando o produto cheio. transaction_amount vem em reais.
            const paidCents = Math.round((payment.transaction_amount ?? 0) * 100);
            if (paidCents !== intent.amount_cents) {
              intentId = intent.id;
              errorMessage = `amount_mismatch:paid=${paidCents}|expected=${intent.amount_cents}`;
            } else {
              intentId = intent.id;
              const { error: confirmErr } = await supabase.rpc('confirm_payment_intent', {
                p_intent_id: intent.id,
                p_abacate_id: mpPaymentId,
              });
              if (confirmErr) {
                errorMessage = `confirm_rpc_failed: ${confirmErr.message}`;
              } else {
                processedAt = new Date().toISOString();
              }
            }
          }
        }
      }
    }
  } else {
    // Outros tópicos (merchant_order, etc) — recebido mas não-acionado.
    processedAt = new Date().toISOString();
  }

  // ── 5. Atualiza log ─────────────────────────────────────────────────────
  await supabase
    .from('payment_webhooks_log')
    .update({
      intent_id: intentId,
      processed_at: processedAt,
      error_message: errorMessage,
    })
    .eq('event_id', eventId);

  return new Response(
    JSON.stringify({
      ok: !errorMessage,
      step: 'webhook_processed',
      type: notificationType,
      intentId,
      error: errorMessage,
    }),
    {
      status: errorMessage ? 422 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
