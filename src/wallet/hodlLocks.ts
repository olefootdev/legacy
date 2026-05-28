/**
 * HODL Locks — cliente Supabase.
 *
 * Lock OLEXP por 90 dias rendendo 0,25% ao dia (7,5%/mês).
 * Trava o saldo OLEXP do user, garante 1 Premium Card instantâneo e
 * entra no sorteio diário.
 *
 * Backend: ver migration 20260527000300_hodl_locks.sql
 */

import { getSupabase } from '@/supabase/client';

export type HodlCurrency = 'OLEXP' | 'BRO' | 'USDT';
export type HodlStatus = 'active' | 'matured' | 'cancelled';

export interface HodlLock {
  id: string;
  amountLocked: number;
  currency: HodlCurrency;
  rewardRateDaily: number;
  startDate: string;
  endDate: string;
  status: HodlStatus;
  totalRewardsPaid: number;
  daysRemaining: number;
  projectedTotalRewards: number;
}

export interface CreateLockResult {
  lockId: string;
  premiumCardId: string;
  endDate: string;
  newOlexpBalance: number;
}

export interface PremiumCardGrant {
  id: string;
  cardTier: 'premium' | 'rare' | 'legendary';
  source: string;
  cardMetadata: Record<string, unknown>;
  grantedAt: string;
  redeemedAt: string | null;
}

export async function createHodlLock(
  amount: number,
  currency: HodlCurrency = 'OLEXP',
): Promise<CreateLockResult | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc('create_hodl_lock', {
    p_amount: amount,
    p_currency: currency,
  });
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    lockId: row.lock_id,
    premiumCardId: row.premium_card_id,
    endDate: row.end_date,
    newOlexpBalance: Number(row.new_olexp_balance ?? 0),
  };
}

export interface HodlRewardEntry {
  paidForDate: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export async function fetchHodlRewardsForLock(lockId: string): Promise<HodlRewardEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_hodl_rewards_for_lock', { p_lock_id: lockId });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    paidForDate: row.paid_for_date as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    createdAt: row.created_at as string,
  }));
}

export interface LotteryDrawEntry {
  drawDate: string;
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  winnerClubShort: string | null;
  prizeType: 'premium_card' | 'rare_card' | 'legendary_card';
  eligibleCount: number;
}

export async function fetchRecentLotteryDraws(limit = 10): Promise<LotteryDrawEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_recent_lottery_draws', { p_limit: limit });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    drawDate: row.draw_date as string,
    winnerUserId: (row.winner_user_id ?? null) as string | null,
    winnerDisplayName: (row.winner_display_name ?? null) as string | null,
    winnerClubShort: (row.winner_club_short ?? null) as string | null,
    prizeType: (row.prize_type ?? 'premium_card') as 'premium_card' | 'rare_card' | 'legendary_card',
    eligibleCount: Number(row.eligible_count ?? 0),
  }));
}

export async function fetchMyHodlLocks(): Promise<HodlLock[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_my_hodl_locks');
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    amountLocked: Number(row.amount_locked),
    currency: row.currency as HodlCurrency,
    rewardRateDaily: Number(row.reward_rate_daily),
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    status: row.status as HodlStatus,
    totalRewardsPaid: Number(row.total_rewards_paid),
    daysRemaining: Number(row.days_remaining),
    projectedTotalRewards: Number(row.projected_total_rewards),
  }));
}

export async function fetchMyPremiumCards(onlyPending = true): Promise<PremiumCardGrant[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_my_premium_cards', {
    p_only_pending: onlyPending,
  });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    cardTier: (row.card_tier ?? 'premium') as 'premium' | 'rare' | 'legendary',
    source: row.source as string,
    cardMetadata: (row.card_metadata ?? {}) as Record<string, unknown>,
    grantedAt: row.granted_at as string,
    redeemedAt: (row.redeemed_at ?? null) as string | null,
  }));
}

export async function redeemPremiumCard(cardId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error } = await sb.rpc('redeem_premium_card', {
    p_card_id: cardId,
  });
  if (error) return false;
  return Boolean(data);
}

/**
 * Simulação local de rewards projetados (para mostrar antes do user travar).
 * 0,25% diário × 90 dias × principal.
 */
export function projectHodlRewards(amount: number, dailyRate = 0.0025, days = 90): {
  dailyReward: number;
  totalReward: number;
  monthlyRate: number;
} {
  return {
    dailyReward: amount * dailyRate,
    totalReward: amount * dailyRate * days,
    monthlyRate: dailyRate * 30,
  };
}
