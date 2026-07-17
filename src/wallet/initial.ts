import type { WalletState } from './types';
import { generateRandomReferralCode, isValidReferralCode, normalizeReferralCode } from './referralCode';

export function createInitialWalletState(): WalletState {
  return {
    spotBroCents: 0,
    spotExpBalance: 0,
    referralCommissions: [],
    ledger: [],
    sponsorId: null,
    myReferralCode: generateRandomReferralCode(),
    referralTree: [],
  };
}

/**
 * Campos de OLEXP/GAT que ainda vivem em saves antigos no localStorage. O spread
 * de `input` os carregaria de volta pra dentro do estado; removemos na hidratação
 * pra que a wallet se limpe sozinha no primeiro boot pós-remoção (2026-07-16).
 */
const LEGACY_KEYS = ['olexpPositions', 'gatPositions', 'kycOlexpDone'] as const;

/** Garante arrays válidos (saves legados / JSON manual podem corromper `ledger`). */
export function normalizeWalletState(input: Partial<WalletState> | null | undefined): WalletState {
  const base = createInitialWalletState();
  if (!input || typeof input !== 'object') return base;
  let myReferralCode =
    typeof input.myReferralCode === 'string' && isValidReferralCode(input.myReferralCode)
      ? normalizeReferralCode(input.myReferralCode)!
      : null;
  if (!myReferralCode) {
    myReferralCode = generateRandomReferralCode();
  }
  const merged: WalletState = {
    ...base,
    ...input,
    referralTree: Array.isArray(input.referralTree) ? input.referralTree : base.referralTree,
    referralCommissions: Array.isArray(input.referralCommissions)
      ? input.referralCommissions
      : base.referralCommissions,
    ledger: Array.isArray(input.ledger) ? input.ledger : base.ledger,
    myReferralCode,
  };
  for (const k of LEGACY_KEYS) delete (merged as unknown as Record<string, unknown>)[k];
  return merged;
}
