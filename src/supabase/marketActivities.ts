/**
 * market_activities — Feed público de atividades do mercado.
 * Registra compras reais dos managers e expõe para o feed da Home.
 */

import { getSupabase } from '@/supabase/client';
import type { MarketActivity } from '@/market/socialTrade';

interface MarketActivityRow {
  id: string;
  type: string;
  manager_id: string | null;
  manager_name: string;
  club_name: string | null;
  player_name: string;
  player_ovr: number | null;
  player_pos: string | null;
  price_exp: number | null;
  created_at: string;
}

function rowToActivity(row: MarketActivityRow): MarketActivity {
  return {
    id: row.id,
    type: row.type as MarketActivity['type'],
    userId: row.manager_id ?? 'unknown',
    userName: row.club_name ?? row.manager_name,
    playerName: row.player_name,
    playerOvr: row.player_ovr ?? 0,
    playerPos: row.player_pos ?? '—',
    price: row.price_exp ?? 0,
    currency: 'EXP',
    timestamp: new Date(row.created_at),
    isAI: false,
  };
}

/** Busca as N atividades mais recentes do mercado. */
export async function fetchMarketActivities(limit = 10): Promise<MarketActivity[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('market_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[marketActivities] fetch failed:', error.message);
    return [];
  }
  return ((data ?? []) as MarketActivityRow[]).map(rowToActivity);
}

export interface RecordMarketActivityInput {
  type: 'purchase' | 'sale' | 'auction_won' | 'listing';
  managerId?: string | null;
  managerName: string;
  clubName?: string | null;
  playerName: string;
  playerOvr?: number;
  playerPos?: string;
  priceExp?: number;
}

/** Registra uma atividade de mercado (fire-and-forget). */
export async function recordMarketActivity(input: RecordMarketActivityInput): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('market_activities').insert({
    type: input.type,
    manager_id: input.managerId ?? null,
    manager_name: input.managerName,
    club_name: input.clubName ?? null,
    player_name: input.playerName,
    player_ovr: input.playerOvr ?? null,
    player_pos: input.playerPos ?? null,
    price_exp: input.priceExp ?? null,
  });
  if (error) {
    console.warn('[marketActivities] insert failed:', error.message);
  }
}
