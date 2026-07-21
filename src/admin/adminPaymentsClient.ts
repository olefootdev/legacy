/**
 * Client admin de pagamentos/estornos.
 * Header X-Admin-Token (localStorage) + Bearer da sessão Supabase — mesmo
 * padrão do academyAdminClient. Backend: server/src/routes/adminPayments.ts.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';

export interface AdminPaymentIntent {
  id: string;
  user_id: string;
  status: string;
  product_kind: string;
  product_ref: string | null;
  amount_cents: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface AdminPaymentRefund {
  id: string;
  intent_id: string;
  mp_payment_id: string | null;
  reason: string;
  amount_cents: number | null;
  auto_reversed: boolean;
  needs_manual: boolean;
  note: string | null;
  created_at: string;
}

export interface RefundResult {
  intent_id: string;
  status: string;
  commissions_reversed: number;
  credits_voided: number;
  needs_manual: boolean;
}

function adminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (
      localStorage.getItem('olefoot_global_league_admin_token') ??
      localStorage.getItem('olefoot.admin.token') ??
      ''
    ).trim();
  } catch {
    return '';
  }
}

async function headers(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const tok = adminToken();
  if (tok) h['X-Admin-Token'] = tok;
  try {
    const sb = getSupabase();
    const access = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (access) h['Authorization'] = `Bearer ${access}`;
  } catch {
    /* sessão indisponível */
  }
  return h;
}

async function fail(r: Response): Promise<never> {
  let msg = `HTTP ${r.status}`;
  try {
    const body = (await r.json()) as { error?: string };
    if (body?.error) msg = body.error;
  } catch {
    /* corpo não-JSON */
  }
  throw new Error(msg);
}

export async function fetchPaymentIntents(status?: string): Promise<AdminPaymentIntent[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const r = await fetch(`${olefootApiBase()}/api/admin/payments/intents${qs}`, {
    headers: await headers(),
  });
  if (!r.ok) return fail(r);
  return (await r.json()) as AdminPaymentIntent[];
}

export async function fetchPaymentRefunds(): Promise<AdminPaymentRefund[]> {
  const r = await fetch(`${olefootApiBase()}/api/admin/payments/refunds`, {
    headers: await headers(),
  });
  if (!r.ok) return fail(r);
  return (await r.json()) as AdminPaymentRefund[];
}

export async function refundPaymentIntent(intentId: string, reason?: string): Promise<RefundResult | null> {
  const r = await fetch(`${olefootApiBase()}/api/admin/payments/refund/${encodeURIComponent(intentId)}`, {
    method: 'POST',
    headers: await headers(true),
    body: JSON.stringify(reason ? { reason } : {}),
  });
  if (!r.ok) return fail(r);
  const body = (await r.json()) as { ok: boolean; result: RefundResult | null };
  return body.result;
}
