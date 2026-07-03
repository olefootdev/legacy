// deno-lint-ignore-file no-explicit-any
// Olefoot — payment-reconcile
//
// Rede de segurança contra webhook perdido: varre payment_intents ainda
// 'pending' e pergunta ao Mercado Pago o status real. Se aprovado (com valor
// batendo) → confirma (entrega o produto). Vencidos sem pagamento → 'expired'.
//
// Acionada pelo pg_cron (ver migration payment_reconcile_cron). Deploy COM
// verify_jwt (default) — só o cron, com service role, chama.
//
// Idempotente: confirm_payment_intent é re-entrante (status=paid → no-op).
//
// Secrets (Supabase → Edge Functions): MP_ACCESS_TOKEN.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MP_API_BASE = 'https://api.mercadopago.com';
const LOOKBACK_HOURS = 72;   // não mexe em intents muito antigas
const BATCH_LIMIT = 50;      // teto por execução

interface MpPayment {
  id?: number;
  status?: string;
  transaction_amount?: number;
  external_reference?: string | null;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';
  if (!accessToken) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_MP_ACCESS_TOKEN' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const nowMs = Date.now();

  // Intents ainda pendentes, recentes (janela de lookback).
  const { data: intents, error } = await supabase
    .from('payment_intents')
    .select('id, external_id, abacate_id, amount_cents, expires_at, status')
    .eq('status', 'pending')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return new Response(JSON.stringify({ ok: false, step: 'select', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let confirmed = 0;
  let expired = 0;
  let mismatched = 0;
  let stillPending = 0;
  const errors: string[] = [];

  for (const intent of intents ?? []) {
    try {
      // 1. Acha o pagamento no MP: pelo id salvo, senão busca por external_reference.
      let payment: MpPayment | null = null;

      if (intent.abacate_id) {
        const r = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(intent.abacate_id)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (r.ok) payment = (await r.json().catch(() => null)) as MpPayment | null;
      }

      if (!payment && intent.external_id) {
        const url = `${MP_API_BASE}/v1/payments/search?external_reference=${encodeURIComponent(intent.external_id)}&sort=date_created&criteria=desc`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (r.ok) {
          const body = (await r.json().catch(() => null)) as { results?: MpPayment[] } | null;
          payment = body?.results?.[0] ?? null;
        }
      }

      // 2. Decide.
      if (payment?.status === 'approved') {
        const paidCents = Math.round((payment.transaction_amount ?? 0) * 100);
        if (paidCents !== intent.amount_cents) {
          mismatched++;
          errors.push(`amount_mismatch:${intent.id}:paid=${paidCents}:exp=${intent.amount_cents}`);
          continue;
        }
        const mpId = payment.id != null ? String(payment.id) : intent.abacate_id;
        const { error: confErr } = await supabase.rpc('confirm_payment_intent', {
          p_intent_id: intent.id,
          p_abacate_id: mpId,
        });
        if (confErr) {
          errors.push(`confirm_failed:${intent.id}:${confErr.message}`);
        } else {
          confirmed++;
        }
        continue;
      }

      // 3. Não aprovado + vencido → marca expirado (limpa a fila de pending).
      if (intent.expires_at && new Date(intent.expires_at).getTime() < nowMs) {
        const { error: expErr } = await supabase
          .from('payment_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', intent.id)
          .eq('status', 'pending');
        if (!expErr) expired++;
        continue;
      }

      stillPending++;
    } catch (e) {
      errors.push(`exception:${intent.id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: intents?.length ?? 0,
      confirmed,
      expired,
      mismatched,
      stillPending,
      errors: errors.slice(0, 20),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
