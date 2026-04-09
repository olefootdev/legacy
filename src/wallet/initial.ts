import type { WalletState } from './types';

export function createInitialWalletState(): WalletState {
  return {
    spotBroCents: 0,
    spotExpBalance: 0,
    olexpPositions: [],
    referralTree: [],
    referralCommissions: [],
    gatPositions: [],
    ledger: [],
    kycOlexpDone: false,
    sponsorId: null,
  };
}

/** Garante arrays válidos (saves legados / JSON manual podem corromper `ledger`). */
export function normalizeWalletState(input: Partial<WalletState> | null | undefined): WalletState {
  const base = createInitialWalletState();
  if (!input || typeof input !== 'object') return base;
  return {
    ...base,
    ...input,
    olexpPositions: Array.isArray(input.olexpPositions) ? input.olexpPositions : base.olexpPositions,
    referralTree: Array.isArray(input.referralTree) ? input.referralTree : base.referralTree,
    referralCommissions: Array.isArray(input.referralCommissions)
      ? input.referralCommissions
      : base.referralCommissions,
    gatPositions: Array.isArray(input.gatPositions) ? input.gatPositions : base.gatPositions,
    ledger: Array.isArray(input.ledger) ? input.ledger : base.ledger,
  };
}
