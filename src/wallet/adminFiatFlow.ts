/**
 * Simulações Admin para fluxos fiat ↔ SPOT (MVP cliente; espelha futuro on/off-ramp).
 */

import type { WalletState, WalletResult } from './types';
import { appendLedger } from './ledger';

export function simulateFiatDeposit(
  state: WalletState,
  broCents: number,
  opts?: { note?: string },
): WalletResult {
  if (!Number.isFinite(broCents) || broCents <= 0) {
    return { ok: false, error: 'Valor em centavos de BRO deve ser > 0.', code: 'ADMIN_INVALID_AMOUNT' };
  }
  const now = new Date().toISOString();
  const refId = `fiat-dep-${Date.now()}`;
  let next: WalletState = { ...state, spotBroCents: state.spotBroCents + broCents };
  next = appendLedger(next, {
    userId: 'self',
    type: 'FIAT_DEPOSIT',
    currency: 'BRO',
    amount: broCents,
    status: 'confirmed',
    source: 'fiat_onramp_simulated',
    refId,
    createdAt: now,
    metadata: { note: opts?.note ?? '', admin: true },
  });
  return { ok: true, state: next };
}

export function simulateFiatWithdrawal(
  state: WalletState,
  broCents: number,
  opts?: { note?: string },
): WalletResult {
  if (!Number.isFinite(broCents) || broCents <= 0) {
    return { ok: false, error: 'Valor em centavos de BRO deve ser > 0.', code: 'ADMIN_INVALID_AMOUNT' };
  }
  if (state.spotBroCents < broCents) {
    return { ok: false, error: 'SPOT BRO insuficiente para o saque simulado.', code: 'INSUFFICIENT_SPOT_BRO' };
  }
  const now = new Date().toISOString();
  const refId = `fiat-wd-${Date.now()}`;
  let next: WalletState = { ...state, spotBroCents: state.spotBroCents - broCents };
  next = appendLedger(next, {
    userId: 'self',
    type: 'FIAT_WITHDRAWAL',
    currency: 'BRO',
    amount: -broCents,
    status: 'confirmed',
    source: 'fiat_offramp_simulated',
    refId,
    createdAt: now,
    metadata: { note: opts?.note ?? '', admin: true },
  });
  return { ok: true, state: next };
}
