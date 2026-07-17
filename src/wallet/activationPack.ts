/**
 * Activation Pack — Gate de entrada do Plano de Carreira ($25 USD).
 *
 * Sem pack ativo:
 *   - não recebe comissões 5-5-5%
 *   - não pode resgatar career bonus
 *   - comissões que SERIAM dele vão pra log de "lost" e aparecem como FOMO
 *
 * Backend: migration 20260527000400_activation_pack.sql
 */

import { getSupabase } from '@/supabase/client';

export const ACTIVATION_AMOUNT_CENTS = 2500; // $25 USD = 2500 cents BRO (parity)
export const ACTIVATION_AMOUNT_USD = 25;

export interface ActivationStatus {
  isActivated: boolean;
  activatedAt: string | null;
  expiresAt: string | null; // null = vitalício
  totalLostCommissionsCents: number;
  activationAmountCents: number;
}

export interface PurchaseResult {
  activationId: string;
  userId: string;
  amountCents: number;
  activatedAt: string;
}

export async function fetchMyActivationStatus(): Promise<ActivationStatus> {
  const sb = getSupabase();
  if (!sb) {
    return {
      isActivated: false,
      activatedAt: null,
      expiresAt: null,
      totalLostCommissionsCents: 0,
      activationAmountCents: ACTIVATION_AMOUNT_CENTS,
    };
  }

  const { data, error } = await sb.rpc('get_my_activation_status');
  if (error || !data) {
    return {
      isActivated: false,
      activatedAt: null,
      expiresAt: null,
      totalLostCommissionsCents: 0,
      activationAmountCents: ACTIVATION_AMOUNT_CENTS,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    isActivated: Boolean(row?.is_activated),
    activatedAt: (row?.activated_at ?? null) as string | null,
    expiresAt: (row?.expires_at ?? null) as string | null,
    totalLostCommissionsCents: Number(row?.total_lost_commissions_cents ?? 0),
    activationAmountCents: Number(row?.activation_amount_cents ?? ACTIVATION_AMOUNT_CENTS),
  };
}

/**
 * MVP: chamada após confirmação de pagamento.
 * Quando entrar gateway real (Pix/Stripe), o webhook chama esta RPC após
 * confirmar payment, idealmente passando wallet_credit_id de referência.
 */
export async function purchaseActivationPack(
  amountCents = ACTIVATION_AMOUNT_CENTS,
  walletCreditId?: string,
  source: 'purchase' | 'admin_grant' | 'promo' = 'purchase',
): Promise<PurchaseResult | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc('purchase_activation_pack', {
    p_amount_cents: amountCents,
    p_wallet_credit_id: walletCreditId ?? null,
    p_source: source,
  });
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    activationId: row.activation_id,
    userId: row.user_id,
    amountCents: Number(row.amount_cents),
    activatedAt: row.activated_at,
  };
}
