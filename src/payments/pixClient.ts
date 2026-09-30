/**
 * PIX client — wrapper das rotas Hono (provedor: Mercado Pago).
 *
 * Backend faz a chamada autenticada ao provedor. Front nunca toca no token.
 * O campo `abacateId` é o payment id do Mercado Pago (nome legado mantido
 * pra não quebrar a coluna payment_intents.abacate_id).
 */

import { getSupabase } from '@/supabase/client';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

export type ProductKind = 'card' | 'recharge' | 'presale_pack';
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed';

export interface CreatePixInput {
  productKind: ProductKind;
  productRef?: string;
  /**
   * Reais, em centavos. Só o DEPÓSITO é dirigido por este valor. Em card e em
   * pré-venda o servidor ignora o que vier aqui e calcula o dele.
   */
  amountCents: number;
  /**
   * Pré-venda: quantos DÓLARES, em centavos. É a única coisa que a tela decide
   * — quantos tokens isso dá e quanto custa em reais sai do servidor.
   */
  usdCents?: number;
  /**
   * Pré-venda: 'ativacao_3x' = pack próprio de $10 + 1 conta-satélite de $10
   * em cada time. É INTENÇÃO: todo número (e as contas) sai do servidor.
   */
  plano?: 'ativacao_3x';
  customer: {
    name: string;
    email: string;
    taxId: string; // CPF
    cellphone?: string;
  };
  /** Guardado na intent (ex: { player } pra entrega de card via webhook). */
  metadata?: Record<string, unknown>;
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
  /** O que este Pix entrega, com a cotação já congelada pelo servidor. */
  entrega?: EntregaDoPix;
}

/**
 * O que o servidor se comprometeu a entregar quando este Pix for pago. Vem de
 * `payment_intents.server_data` — é o mesmo número que a confirmação vai usar.
 */
export interface EntregaDoPix {
  /** Depósito: centavos de BRO. 1806 = 18,06 BRO. */
  broCents?: number;
  /** Pré-venda: OLEFOOT em token inteiro. */
  olefoot?: bigint;
  /** Pré-venda: o valor do pack, em centavos de dólar. */
  usdCents?: number;
  /** Ativação 3×: quantas contas-satélite este Pix cria (1 por time). */
  satelites?: number;
}

function lerEntrega(bruta: unknown): EntregaDoPix | undefined {
  if (!bruta || typeof bruta !== 'object') return undefined;
  const e = bruta as {
    recarga?: { bro_cents?: string };
    presale?: { tokens_entregues?: string; usd_cents?: number };
    ativacao_3x?: { satelites?: unknown[] };
  };
  if (e.recarga?.bro_cents) {
    const n = Number(e.recarga.bro_cents);
    return Number.isFinite(n) ? { broCents: n } : undefined;
  }
  if (e.presale?.tokens_entregues) {
    try {
      // O servidor manda na menor unidade (9 casas); a tela fala em token inteiro.
      return {
        olefoot: BigInt(e.presale.tokens_entregues) / 10n ** 9n,
        usdCents: Number(e.presale.usd_cents ?? 0),
        ...(Array.isArray(e.ativacao_3x?.satelites) && e.ativacao_3x.satelites.length > 0
          ? { satelites: e.ativacao_3x.satelites.length } : {}),
      };
    } catch { return undefined; }
  }
  return undefined;
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
      ...(input.usdCents != null ? { usd_cents: input.usdCents } : {}),
      ...(input.plano ? { plano: input.plano } : {}),
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        tax_id: input.customer.taxId,
        cellphone: input.customer.cellphone ?? '',
      },
      ...(input.metadata ? { metadata: input.metadata } : {}),
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
    entrega: lerEntrega(body.entrega),
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
