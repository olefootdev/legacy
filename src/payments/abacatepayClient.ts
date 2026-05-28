/**
 * Abacate Pay client — wrapper das rotas Hono.
 *
 * Backend faz a chamada autenticada pra Abacate. Front nunca toca na API key.
 */

import { getSupabase } from '@/supabase/client';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

export type ProductKind = 'activation_pack' | 'card' | 'recharge';
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed';

export interface CreatePixInput {
  productKind: ProductKind;
  productRef?: string;
  amountCents: number;
  customer: {
    name: string;
    email: string;
    taxId: string; // CPF
    cellphone?: string;
  };
}

export interface CreatePixResult {
  ok: true;
  intentId: string;
  externalId: string;
  abacateId?: string;
  amountCents: number;
  brCode: string;
  brCodeBase64?: string;
  expiresAt?: string;
  status: string;
  devMode: boolean;
}

export interface CreatePixError {
  ok: false;
  error: string;
  step?: string;
}

async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

export async function createPixCharge(input: CreatePixInput): Promise<CreatePixResult | CreatePixError> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: 'unauthenticated' };

  const res = await fetch(`${API_BASE}/api/payments/pix/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      product_kind: input.productKind,
      product_ref: input.productRef ?? null,
      amount_cents: input.amountCents,
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        tax_id: input.customer.taxId,
        cellphone: input.customer.cellphone ?? '',
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.error ?? `http_${res.status}`, step: body.step };
  }

  return {
    ok: true,
    intentId: body.intent_id,
    externalId: body.external_id,
    abacateId: body.abacate_id,
    amountCents: body.amount_cents,
    brCode: body.br_code,
    brCodeBase64: body.br_code_base64,
    expiresAt: body.expires_at,
    status: body.status,
    devMode: !!body.dev_mode,
  };
}

export interface PaymentIntentStatus {
  id: string;
  status: PaymentStatus | string;
  amountCents: number;
  brCode: string | null;
  brCodeBase64: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  productKind: ProductKind | string;
  productRef: string | null;
  devMode: boolean;
}

export async function fetchPaymentStatus(intentId: string): Promise<PaymentIntentStatus | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/payments/${intentId}/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  if (!body.ok || !body.intent) return null;
  const r = body.intent;
  return {
    id: r.id,
    status: r.status,
    amountCents: Number(r.amount_cents ?? 0),
    brCode: r.br_code ?? null,
    brCodeBase64: r.br_code_base64 ?? null,
    expiresAt: r.expires_at ?? null,
    paidAt: r.paid_at ?? null,
    productKind: r.product_kind,
    productRef: r.product_ref ?? null,
    devMode: !!r.dev_mode,
  };
}

/** Validação de CPF — algoritmo padrão. Apenas formato (não consulta Receita). */
export function isValidCpf(cpfRaw: string): boolean {
  const cpf = (cpfRaw ?? '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // tudo igual

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9]!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]!, 10);
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
