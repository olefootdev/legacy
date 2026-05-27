/**
 * Cliente PvP — partidas assíncronas entre managers (Quick e Clássica).
 *
 * Fluxo:
 *   1. Cliente A termina uma partida → recordPvpMatchResult(...) persiste no
 *      banco e retorna o reward que A ganha.
 *   2. A despacha localmente WALLET_RECEIVE_PVP_REWARD pra creditar EXP.
 *   3. Quando o oponente B logar, fetchMyPendingPvpResults() retorna os
 *      resultados que ele ainda não coletou. Cliente B aplica reward local
 *      e chama claimPvpMatchResult(id) pra marcar coletado.
 */
import { getSupabase } from './client';

export type PvpMatchMode = 'quick' | 'classic';
export type PvpMatchOutcome = 'home_win' | 'away_win' | 'draw';

export interface PvpRecordResult {
  id: string;
  outcome: PvpMatchOutcome;
  homeExpReward: number;
  awayExpReward: number;
}

export interface PendingPvpResult {
  id: string;
  mode: PvpMatchMode;
  outcome: PvpMatchOutcome;
  homeScore: number;
  awayScore: number;
  awayExpReward: number;
  playedAt: string;
  opponentDisplayName: string | null;
  opponentClubName: string | null;
  opponentClubShort: string | null;
}

/**
 * Cliente A (home) grava o resultado da partida. Retorna deltas pra UI.
 * Se awayUserId não for um UUID (ex: bot), não chama nada e devolve null.
 */
export async function recordPvpMatchResult(input: {
  mode: PvpMatchMode;
  awayUserId: string;
  homeScore: number;
  awayScore: number;
  homeOverall?: number | null;
  awayOverall?: number | null;
}): Promise<PvpRecordResult | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Defensivo: oponente precisa ser UUID (manager real). Bots têm ids tipo 'bot-x'.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(input.awayUserId)) return null;

  const { data, error } = await sb.rpc('record_pvp_match_result', {
    p_mode: input.mode,
    p_away_user_id: input.awayUserId,
    p_home_score: Math.floor(input.homeScore),
    p_away_score: Math.floor(input.awayScore),
    p_home_overall: input.homeOverall ?? null,
    p_away_overall: input.awayOverall ?? null,
  });
  if (error) {
    console.warn('[pvpMatches] recordPvpMatchResult:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: String(row.id),
    outcome: row.outcome as PvpMatchOutcome,
    homeExpReward: Number(row.home_exp_reward ?? 0),
    awayExpReward: Number(row.away_exp_reward ?? 0),
  };
}

export async function fetchMyPendingPvpResults(): Promise<PendingPvpResult[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('fetch_my_pending_pvp_results');
  if (error) {
    console.warn('[pvpMatches] fetchMyPendingPvpResults:', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: {
    id: string;
    mode: string;
    outcome: string;
    home_score: number;
    away_score: number;
    away_exp_reward: number | string;
    played_at: string;
    opponent_display_name: string | null;
    opponent_club_name: string | null;
    opponent_club_short: string | null;
  }) => ({
    id: row.id,
    mode: row.mode as PvpMatchMode,
    outcome: row.outcome as PvpMatchOutcome,
    homeScore: row.home_score,
    awayScore: row.away_score,
    awayExpReward: Number(row.away_exp_reward ?? 0),
    playedAt: row.played_at,
    opponentDisplayName: row.opponent_display_name,
    opponentClubName: row.opponent_club_name,
    opponentClubShort: row.opponent_club_short,
  }));
}

export async function claimPvpMatchResult(id: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('claim_pvp_match_result', { p_id: id });
  if (error) {
    console.warn('[pvpMatches] claimPvpMatchResult:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}
