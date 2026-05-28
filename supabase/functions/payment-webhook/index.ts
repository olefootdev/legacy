// deno-lint-ignore-file no-explicit-any
// Olefoot — payment-webhook
//
// Recebe webhooks da Abacate Pay (https://docs.abacatepay.com/pages/webhooks).
// Valida HMAC-SHA256 via header X-Webhook-Signature.
// Idempotência via payment_webhooks_log.event_id UNIQUE.
//
// Evento crítico: transparent.completed → chama confirm_payment_intent RPC.
//
// IMPORTANTE: deploy com verify_jwt: false — webhook é público.
// Secret HMAC vive em env var ABACATE_WEBHOOK_SECRET (Supabase dashboard).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Chave pública HMAC da AbacatePay (a mesma pra todos clientes — não é segredo).
// Conforme https://docs.abacatepay.com/pages/webhooks
const ABACATE_PUBLIC_HMAC_KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

interface AbacateWebhookPayload {
  id: string;            // event id (log_abc123...)
  event: string;         // ex: 'transparent.completed'
  apiVersion: number;
  devMode: boolean;
  data: {
    // Estrutura real do Abacate v2:
    // data.transparent.{id, externalId, status, metadata.intent_id}
    transparent?: {
      id?: string;
      externalId?: string | null;
      status?: string;
      amount?: number;
      metadata?: Record<string, unknown>;
      [k: string]: any;
    };
    customer?: Record<string, any>;
    [k: string]: any;
  };
}

async function computeHmac(secret: string, body: string): Promise<{ base64: string; hex: string }> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return { base64, hex };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-webhook-signature') ?? '';
  // Usa a chave pública hardcoded (não o secret do webhook — esse é outro mecanismo).
  const secret = ABACATE_PUBLIC_HMAC_KEY;

  // 1. Valida assinatura HMAC
  let signatureValid = false;
  let signatureDebug = '';
  if (secret) {
    try {
      const { base64, hex } = await computeHmac(secret, rawBody);
      // Tenta base64 primeiro (doc Abacate), depois hex como fallback
      if (timingSafeEqual(base64, signatureHeader)) {
        signatureValid = true;
      } else if (timingSafeEqual(hex, signatureHeader)) {
        signatureValid = true;
      } else {
        signatureDebug = `mismatch base64_prefix=${base64.slice(0, 10)} hex_prefix=${hex.slice(0, 10)} received_prefix=${signatureHeader.slice(0, 10)} body_len=${rawBody.length}`;
        console.warn('[payment-webhook]', signatureDebug);
      }
    } catch (e) {
      console.error('hmac error', e);
      signatureDebug = `hmac_error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // 2. Parse payload
  let payload: AbacateWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AbacateWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Loga (idempotência via UNIQUE event_id)
  const { error: logErr } = await supabase
    .from('payment_webhooks_log')
    .insert({
      event_id: payload.id,
      event_type: payload.event,
      raw_payload: payload as any,
      signature_header: signatureHeader,
      signature_valid: signatureValid,
    });

  if (logErr) {
    // Se for duplicate (UNIQUE event_id), retorna 200 — idempotência
    if (logErr.code === '23505') {
      return new Response(
        JSON.stringify({ ok: true, step: 'duplicate_event', eventId: payload.id }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ ok: false, step: 'log_insert', error: logErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Se assinatura inválida e há secret configurado → recusa
  //    EXCEÇÃO: payload.devMode === true bypassa HMAC (sandbox Abacate só envia
  //    devMode=true quando key sandbox criou a charge — em produção sempre false).
  const isDevMode = payload.devMode === true;
  if (secret && !signatureValid && !isDevMode) {
    await supabase
      .from('payment_webhooks_log')
      .update({ error_message: `invalid_signature ${signatureDebug}` })
      .eq('event_id', payload.id);

    return new Response(JSON.stringify({ ok: false, error: 'invalid_signature', debug: signatureDebug }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (secret && !signatureValid && isDevMode) {
    console.warn('[payment-webhook] dev_mode_bypass — accepting despite HMAC mismatch', signatureDebug);
  }

  // 5. Processa evento
  let intentId: string | null = null;
  let processedAt: string | null = null;
  let errorMessage: string | null = null;

  if (payload.event === 'transparent.completed') {
    const transparent = payload.data?.transparent ?? {};
    const externalId = transparent.externalId ?? null;
    const abacateId = transparent.id ?? null;
    const status = transparent.status ?? null;
    const intentIdFromMetadata = (transparent.metadata as Record<string, unknown> | undefined)?.intent_id as string | undefined;

    if (status !== 'PAID' && status !== 'APPROVED' && status !== 'COMPLETE') {
      errorMessage = `status_not_paid: ${status}`;
    } else {
      // Estratégia em cascata pra achar o intent:
      // 1. metadata.intent_id (mais confiável — vem do que enviamos)
      // 2. externalId (fallback se metadata não veio)
      // 3. abacate_id (último recurso, busca pelo charge id salvo no UPDATE)
      let intent: { id: string; status: string; user_id: string } | null = null;

      if (intentIdFromMetadata) {
        const { data } = await supabase
          .from('payment_intents')
          .select('id, status, user_id')
          .eq('id', intentIdFromMetadata)
          .maybeSingle();
        if (data) intent = data;
      }

      if (!intent && externalId) {
        const { data } = await supabase
          .from('payment_intents')
          .select('id, status, user_id')
          .eq('external_id', externalId)
          .maybeSingle();
        if (data) intent = data;
      }

      if (!intent && abacateId) {
        const { data } = await supabase
          .from('payment_intents')
          .select('id, status, user_id')
          .eq('abacate_id', abacateId)
          .maybeSingle();
        if (data) intent = data;
      }

      if (!intent) {
        errorMessage = `intent_not_found:metadata=${intentIdFromMetadata}|ext=${externalId}|abacate=${abacateId}`;
      } else {
        intentId = intent.id;
        const { error: confirmErr } = await supabase.rpc('confirm_payment_intent', {
          p_intent_id: intent.id,
          p_abacate_id: abacateId ?? null,
        });
        if (confirmErr) {
          errorMessage = `confirm_rpc_failed: ${confirmErr.message}`;
        } else {
          processedAt = new Date().toISOString();
        }
      }
    }
  } else {
    // Outros eventos (refund/dispute/cancel) ficam aqui pra futuras fases
    processedAt = new Date().toISOString(); // marca como recebido mas não-acionado
  }

  // 6. Atualiza log
  await supabase
    .from('payment_webhooks_log')
    .update({
      intent_id: intentId,
      processed_at: processedAt,
      error_message: errorMessage,
    })
    .eq('event_id', payload.id);

  return new Response(
    JSON.stringify({
      ok: !errorMessage,
      step: 'webhook_processed',
      event: payload.event,
      intentId,
      error: errorMessage,
    }),
    {
      status: errorMessage ? 422 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
