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

/**
 * Registra o patrocinador (sponsor) do usuário.
 */
export function registerSponsor(
  state: WalletState,
  sponsorId: string,
  selfUserId: string = 'self',
): WalletResult {
  if (state.sponsorId) {
    return { ok: false, error: 'Patrocinador já definido.', code: 'REFERRAL_ALREADY_SET' };
  }
  if (sponsorId === selfUserId) {
    return { ok: false, error: 'Não pode ser seu próprio patrocinador.', code: 'REFERRAL_SELF' };
  }

  return {
    ok: true,
    state: {
      ...state,
      sponsorId,
      referralTree: [
        ...state.referralTree,
        { userId: selfUserId, sponsorId, level: 1, createdAt: new Date().toISOString() },
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

/**
 * Aplica comissões de referral em cadeia (até 3 níveis) para um ganho elegível.
 * Percorre a árvore: quem indicou o sourceUserId → nível 1,
 * quem indicou o nível 1 → nível 2, etc.
 *
 * Na simulação local, a árvore é pequena (mock).
 * No backend real, cada nível resolve via DB lookup.
 */
export function applyReferralCredits(
  state: WalletState,
  sourceUserId: string,
  amountCents: number,
  sourceType: ReferralSourceType,
  currency: WalletCurrencyExt = 'BRO',
  now: string = new Date().toISOString(),
): WalletState {
  let next = { ...state };
  let currentUserId = sourceUserId;

  for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
    const node = next.referralTree.find((n) => n.userId === currentUserId);
    if (!node) break;

    const sponsorId = node.sponsorId;
    const commission = calcReferralCommission(amountCents, level as ReferralLevel);
    if (commission <= 0) break;

    const commEntry: ReferralCommission = {
      id: `ref-${Date.now()}-${level}-${Math.random().toString(36).slice(2, 6)}`,
      fromUserId: sourceUserId,
      toUserId: sponsorId,
      level: level as ReferralLevel,
      sourceType,
      sourceAmount: amountCents,
      commissionAmount: commission,
      currency,
      status: 'confirmed',
      createdAt: now,
    };

    next = {
      ...next,
      referralCommissions: [...next.referralCommissions, commEntry],
    };

    const ledgerType = sourceType === 'nft_primary' ? 'REFERRAL_NFT' as const : 'REFERRAL_OLE_GAME' as const;

    if (sponsorId === 'self') {
      next = { ...next, spotBroCents: next.spotBroCents + commission };
    }

    next = appendLedger(next, {
      userId: sponsorId,
      type: ledgerType,
      currency,
      amount: commission,
      status: 'confirmed',
      source: `referral_l${level}`,
      refId: commEntry.id,
      createdAt: now,
      metadata: { fromUser: sourceUserId, level, sourceType },
    });

    currentUserId = sponsorId;
  }

  return next;
}

/** Resumo de comissões por tipo */
export function referralSummary(state: WalletState) {
  let oleGameTotal = 0;
  let nftTotal = 0;
  let oleGameCount = 0;
  let nftCount = 0;
  const byLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

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
    byLevel[c.level] = (byLevel[c.level] ?? 0) + c.commissionAmount;
  }

  const directReferrals = state.referralTree.filter((n) => n.sponsorId === 'self').length;

  return { oleGameTotal, nftTotal, oleGameCount, nftCount, byLevel, directReferrals };
}
