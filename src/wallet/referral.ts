/**
 * Referral — indicações em 3 níveis, 5% por nível.
 * Só sobre ganho elegível (match reward, compra primária NFT).
 * Sem pirâmide: yield, referral, transfer e bônus NÃO geram comissão.
 */

import type {
  WalletState,
  WalletResult,
  ReferralCommission,
  ReferralLevel,
  ReferralSourceType,
  WalletCurrencyExt,
} from './types';
import { REFERRAL_RATE, REFERRAL_MAX_LEVELS, REFERRAL_ELIGIBLE_SOURCES } from './constants';
import { appendLedger } from './ledger';
import { normalizeReferralCode } from './referralCode';

/**
 * Registra o patrocinador (sponsor) do usuário pelo código de indicação (imutável depois de gravado).
 */
export function registerSponsor(
  state: WalletState,
  sponsorCodeInput: string,
  selfUserId: string = 'self',
): WalletResult {
  if (state.sponsorId) {
    return { ok: false, error: 'Patrocinador já definido.', code: 'REFERRAL_ALREADY_SET' };
  }
  const sponsorCode = normalizeReferralCode(sponsorCodeInput);
  if (!sponsorCode) {
    return {
      ok: false,
      error: 'Código de indicação inválido (3–5 letras ou números, sem caracteres especiais).',
      code: 'REFERRAL_INVALID_CODE',
    };
  }
  const myCode = state.myReferralCode ? normalizeReferralCode(state.myReferralCode) : null;
  if (myCode && sponsorCode === myCode) {
    return { ok: false, error: 'Não podes usar o teu próprio código de indicação.', code: 'REFERRAL_SELF' };
  }

  return {
    ok: true,
    state: {
      ...state,
      sponsorId: sponsorCode,
      referralTree: [
        ...state.referralTree,
        {
          userId: selfUserId,
          sponsorId: sponsorCode,
          level: 1,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
}

/**
 * Calcula comissão para um nível.
 */
export function calcReferralCommission(
  amountCents: number,
  _level: ReferralLevel,
): number {
  return Math.round(amountCents * REFERRAL_RATE);
}

/**
 * Verifica se o tipo de ganho é elegível para gerar comissão.
 */
export function isEligibleForReferral(source: string): boolean {
  return REFERRAL_ELIGIBLE_SOURCES.includes(source);
}

/** Resumo de comissões por tipo */
export function referralSummary(state: WalletState) {
  let oleGameTotal = 0;
  let nftTotal = 0;
  let oleGameCount = 0;
  let nftCount = 0;
  /** Comissões OLE/NFT em centavos BRO, por nível */
  const byLevelBroCents: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

  for (const c of state.referralCommissions) {
    if (c.status !== 'confirmed') continue;
    if (c.toUserId !== 'self') continue;

    if (c.sourceType === 'ole_game') {
      oleGameTotal += c.commissionAmount;
      oleGameCount++;
    } else {
      nftTotal += c.commissionAmount;
      nftCount++;
    }
    byLevelBroCents[c.level] = (byLevelBroCents[c.level] ?? 0) + c.commissionAmount;
  }

  const directReferrals = state.referralTree.filter((n) => n.sponsorId === 'self').length;

  return {
    oleGameTotal,
    nftTotal,
    oleGameCount,
    nftCount,
    byLevelBroCents,
    directReferrals,
  };
}
