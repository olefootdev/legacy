/**
 * Leaderboard das ligas locais (Classic / Fast) — lê o slice `local_leagues`
 * persistido em `manager_game_state` e ranqueia por pontos.
 *
 * Escala: o jogo está abrindo agora; um SELECT * com cap em 200 rows é
 * suficiente. Se passar de mil managers, denormalizar pra tabela própria.
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { LocalLeagueId, LocalLeaguesState } from '@/match/localLeagues';

export interface LocalLeaderboardEntry {
  userId: string;
  managerName: string | null;
  clubName: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export async function fetchLocalLeagueLeaderboard(
  league: LocalLeagueId,
  limit = 50,
): Promise<LocalLeaderboardEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('manager_game_state')
    .select('user_id, local_leagues')
    .not('local_leagues', 'is', null)
    .limit(200);

  if (error) {
    console.warn('[localLeaguesRanking] fetch falhou:', error.message);
    return [];
  }

  const entries: LocalLeaderboardEntry[] = [];
  for (const row of data ?? []) {
    const ll = row.local_leagues as LocalLeaguesState | null;
    const standing = ll?.[league];
    if (!standing || standing.played === 0) continue;
    entries.push({
      userId: String(row.user_id),
      managerName: null,
      clubName: null,
      played: standing.played,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      goalDifference: standing.goalsFor - standing.goalsAgainst,
      points: standing.points,
    });
  }

  // Tie-breakers padrão FIFA: pontos > saldo > gols feitos > menos jogos
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.played - b.played;
  });

  // Enriquecer com nome do clube/manager (best-effort)
  const userIds = entries.slice(0, limit).map((e) => e.userId);
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, manager_first_name, club_name')
      .in('id', userIds);
    const profileMap = new Map<string, { name: string | null; club: string | null }>();
    for (const p of profiles ?? []) {
      const pr = p as Record<string, unknown>;
      profileMap.set(String(pr.id), {
        name: (pr.manager_first_name as string) ?? null,
        club: (pr.club_name as string) ?? null,
      });
    }
    for (const e of entries) {
      const pr = profileMap.get(e.userId);
      if (pr) {
        e.managerName = pr.name;
        e.clubName = pr.club;
      }
    }
  }

  return entries.slice(0, limit);
}
