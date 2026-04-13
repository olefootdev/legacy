/**
 * Envio de BRO no SPOT para outro utilizador identificado pelo código de indicação (MVP).
 * O crédito no destino fica para integração backend; aqui apenas débito + ledger local.
 */

import type { WalletState, WalletResult } from './types';
import { appendLedger } from './ledger';
import { normalizeReferralCode } from './referralCode';

export function transferBroByReferralCode(
  state: WalletState,
  recipientRaw: string,
  amountCents: number,
  now: string = new Date().toISOString(),
): WalletResult {
  const recipient = normalizeReferralCode(recipientRaw);
  if (!recipient) {
    return { ok: false, error: 'Código de destino inválido (3–5 letras ou números).', code: 'REFERRAL_INVALID_CODE' };
  }
  const mine = state.myReferralCode ? normalizeReferralCode(state.myReferralCode) : null;
  if (mine && recipient === mine) {
    return { ok: false, error: 'Não podes enviar BRO para o teu próprio código.', code: 'REFERRAL_SELF' };
  }
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return { ok: false, error: 'Valor inválido.', code: 'ADMIN_INVALID_AMOUNT' };
  }
  if (state.spotBroCents < amountCents) {
    return { ok: false, error: 'SPOT BRO insuficiente.', code: 'INSUFFICIENT_SPOT_BRO' };
  }

  const nextSpot = state.spotBroCents - amountCents;
  let next: WalletState = { ...state, spotBroCents: nextSpot };

  next = appendLedger(next, {
    userId: 'self',
    type: 'TRANSFER',
    currency: 'BRO',
    amount: -amountCents,
    status: 'confirmed',
    source: 'peer_by_referral_code',
    createdAt: now,
    metadata: { recipientReferralCode: recipient },
  });

  return { ok: true, state: next };
}
