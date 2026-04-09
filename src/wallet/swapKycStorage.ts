/**
 * SWAP — identidade MVP (cliente). Espelha `WalletState.hasCompletedSwapKyc` / `kycProfile`.
 * TODO: backend + LGPD.
 */

import type { WalletKycProfile, WalletState } from './types';

export const SWAP_KYC_STORAGE_KEY = 'olefoot-wallet-swap-kyc';

export interface SwapKycStored {
  hasCompletedSwapKyc?: boolean;
  kycProfile?: WalletKycProfile;
}

export function readSwapKycFromStorage(): SwapKycStored | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SWAP_KYC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwapKycStored;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSwapKycToStorage(data: SwapKycStored): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SWAP_KYC_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

/** Injeta dados persistidos no browser no agregado wallet (hydrate). */
export function mergeSwapKycIntoWallet(wallet: WalletState): WalletState {
  const stored = readSwapKycFromStorage();
  if (!stored) return wallet;
  return {
    ...wallet,
    hasCompletedSwapKyc: stored.hasCompletedSwapKyc ?? wallet.hasCompletedSwapKyc,
    kycProfile: stored.kycProfile ?? wallet.kycProfile,
  };
}
