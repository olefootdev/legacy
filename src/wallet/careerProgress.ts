/**
 * Career Progress — cliente Supabase.
 *
 * Plano de carreira "Cash Only" da OLEFOOT.
 * 1 BRO ganho em comissão = 1 ponto vitalício. Backend: migration 20260527000200.
 */

import { getSupabase } from '@/supabase/client';

export type CareerRank = 'rookie' | 'junior' | 'pro' | 'diretor' | 'campeao' | 'legend';

/**
 * iconName: nome do componente lucide-react usado pra renderizar.
 * O componente real (Sprout, Zap, Flame, Gem, Trophy, Crown) é mapeado
 * no consumer (página) — este módulo é client API puro, sem JSX/React.
 */
export type RankIconName = 'Sprout' | 'Zap' | 'Flame' | 'Gem' | 'Trophy' | 'Crown';

export interface RankDef {
  rank: CareerRank;
  thresholdPoints: number;
  bonusUsd: number;
  bonusCents: number;
  label: string;
  iconName: RankIconName;
  color: string;
}

/** Catálogo de ranks — fonte única para UI + lógica */
export const RANK_CATALOG: readonly RankDef[] = [
  { rank: 'rookie',  thresholdPoints: 0,      bonusUsd: 0,     bonusCents: 0,      label: 'Iniciante', iconName: 'Sprout', color: 'text-white/40' },
  { rank: 'junior',  thresholdPoints: 10000,  bonusUsd: 50,    bonusCents: 5000,   label: 'Júnior',    iconName: 'Zap',    color: 'text-cyan-300' },
  { rank: 'pro',     thresholdPoints: 50000,  bonusUsd: 250,   bonusCents: 25000,  label: 'Pro',       iconName: 'Flame',  color: 'text-amber-300' },
  { rank: 'diretor', thresholdPoints: 100000, bonusUsd: 500,   bonusCents: 50000,  label: 'Diretor',   iconName: 'Gem',    color: 'text-fuchsia-300' },
  { rank: 'campeao', thresholdPoints: 250000, bonusUsd: 2500,  bonusCents: 250000, label: 'Campeão',   iconName: 'Trophy', color: 'text-emerald-300' },
  { rank: 'legend',  thresholdPoints: 500000, bonusUsd: 5000,  bonusCents: 500000, label: 'Legend',    iconName: 'Crown',  color: 'text-neon-yellow' },
] as const;

export function getRankDef(rank: CareerRank): RankDef {
  return RANK_CATALOG.find((r) => r.rank === rank) ?? RANK_CATALOG[0]!;
}

export function getNextRankDef(rank: CareerRank): RankDef | null {
  const idx = RANK_CATALOG.findIndex((r) => r.rank === rank);
  if (idx === -1 || idx === RANK_CATALOG.length - 1) return null;
  return RANK_CATALOG[idx + 1] ?? null;
}

export interface CareerProgress {
  userId: string;
  lifetimePoints: number;
  currentRank: CareerRank;
  nextRank: CareerRank;
  nextRankThreshold: number;
  progressPct: number;
  totalCommissionsCents: number;
  unlockedRewards: Array<{ rank: CareerRank; amount_cents: number; claimed_at: string }>;
  pendingBonusCents: number;
}

export async function fetchMyCareerProgress(): Promise<CareerProgress | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc('get_my_career_progress');
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    userId: row.user_id,
    lifetimePoints: Number(row.lifetime_points ?? 0),
    currentRank: (row.current_rank ?? 'rookie') as CareerRank,
    nextRank: (row.next_rank ?? 'junior') as CareerRank,
    nextRankThreshold: Number(row.next_rank_threshold ?? 10000),
    progressPct: Number(row.progress_pct ?? 0),
    totalCommissionsCents: Number(row.total_commissions_cents ?? 0),
    unlockedRewards: Array.isArray(row.unlocked_rewards) ? row.unlocked_rewards : [],
    pendingBonusCents: Number(row.pending_bonus_cents ?? 0),
  };
}

/** Resgata bônus pendente (cria wallet_credit que será aplicado no próximo tick). */
export async function claimCareerBonus(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  const { data, error } = await sb.rpc('claim_career_bonus');
  if (error || data == null) return 0;
  return Number(data);
}

export interface LeaderboardEntry {
  displayName: string;
  clubShort: string | null;
  currentRank: CareerRank;
  lifetimePoints: number;
  rankPosition: number;
}

export async function fetchCareerLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('career_leaderboard', { p_limit: limit });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    displayName: row.display_name as string,
    clubShort: (row.club_short ?? null) as string | null,
    currentRank: (row.current_rank ?? 'rookie') as CareerRank,
    lifetimePoints: Number(row.lifetime_points ?? 0),
    rankPosition: Number(row.rank_position ?? 0),
  }));
}
