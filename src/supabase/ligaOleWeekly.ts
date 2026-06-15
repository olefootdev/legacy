/**
 * ligaOleWeekly.ts — Liga da Semana (leaderboard semanal compartilhado) +
 * notificação do nêmesis (cross-user). Tudo via RPC SECURITY DEFINER
 * (migration 20260615123000). Degrada em silêncio se o Supabase não estiver
 * configurado — a Liga Ole clássica (local) continua funcionando.
 */

import { getSupabase, isSupabaseConfigured } from '@/supabase/client';

export interface LigaOleWeeklyRow {
  rank: number;
  managerId: string;
  clubName: string;
  clubShort: string;
  reachedRound: number; // 0..4 (Fase de 32 → Final)
  isChampion: boolean;
}

/** Chave ISO da semana atual, ex.: '2026-W24'. Compartilhada por todos os managers. */
export function currentWeekKey(d: Date = new Date()): string {
  // ISO 8601: quinta-feira da semana define o ano; semana 1 contém a 1ª quinta.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0 = segunda
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // quinta desta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Registra/atualiza a campanha da semana (a RPC guarda a fase MAIS LONGE). */
export async function recordLigaOleWeeklyRun(args: {
  weekKey: string;
  reachedRound: number;
  isChampion: boolean;
  clubName: string;
  clubShort: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc('record_liga_ole_weekly_run', {
      p_week_key: args.weekKey,
      p_reached_round: Math.max(0, Math.min(4, Math.round(args.reachedRound))),
      p_is_champion: !!args.isChampion,
      p_club_name: args.clubName,
      p_club_short: args.clubShort,
    });
    if (error) { console.warn('[ligaOleWeekly] record failed', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[ligaOleWeekly] record threw', (e as Error).message);
    return false;
  }
}

/** Leaderboard da semana — quem chegou mais longe. */
export async function fetchLigaOleWeeklyLeaderboard(weekKey: string, limit = 50): Promise<LigaOleWeeklyRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.rpc('get_liga_ole_weekly_leaderboard', { p_week_key: weekKey, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => ({
      rank: Number(r.rank),
      managerId: String(r.manager_id),
      clubName: String(r.club_name ?? 'Clube'),
      clubShort: String(r.club_short ?? 'OLE'),
      reachedRound: Number(r.reached_round ?? 0),
      isChampion: Boolean(r.is_champion),
    }));
  } catch (e) {
    console.warn('[ligaOleWeekly] leaderboard threw', (e as Error).message);
    return [];
  }
}

/** O id do manager logado (auth.users.id) — pra destacar a própria linha no leaderboard. */
export async function currentManagerId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Notifica o manager derrotado pelo nêmesis (insere na inbox dele). */
export async function notifyLigaOleNemesis(args: {
  targetManagerId: string;
  winnerClub: string;
  round: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb || !args.targetManagerId) return false;
  try {
    const { error } = await sb.rpc('notify_liga_ole_nemesis', {
      p_target_manager_id: args.targetManagerId,
      p_winner_club: args.winnerClub,
      p_round: args.round,
    });
    if (error) { console.warn('[ligaOleWeekly] notify failed', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[ligaOleWeekly] notify threw', (e as Error).message);
    return false;
  }
}
