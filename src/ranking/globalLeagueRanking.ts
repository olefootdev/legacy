/**
 * globalLeagueRanking — ranking MUNDIAL real a partir dos times da Liga Global.
 *
 * A aba "Mundial" de /competicao/ranking lia de `WORLD_TEAMS = []` (mock nunca
 * populado) e por isso só mostrava o próprio clube. Os times reais que competem
 * (e são resetados a cada temporada) vivem em `globalLeagueMVP.teams`.
 *
 * Ordena por PONTOS HISTÓRICOS (all-time) — a métrica que SOBREVIVE aos resets
 * de temporada, então o ranking mundial é um placar de prestígio permanente
 * (a corrida da temporada corrente já aparece por divisão no /match/global).
 */

import type { GlobalTeam } from '@/match/globalLeagueMVP';

export interface GlobalRankingEntry {
  team: string;
  /** Pontos históricos (all-time) — score do ranking. */
  score: number;
  isMe: boolean;
  /** id do time na liga (estável) — usado em busca/favorito. */
  entryId: string;
  division?: number;
  allTimeWins?: number;
  allTimeCrowns?: number;
}

/**
 * Constrói o ranking mundial ordenado por pontos históricos.
 * `managerId` casa o "meu time" pelo mesmo critério do resto do app
 * (managerProfile.email ?? club.id → GlobalTeam.managerId).
 */
export function getGlobalLeagueRankingEntries(
  teams: GlobalTeam[] | undefined,
  managerId: string | undefined,
  myClubId: string,
): GlobalRankingEntry[] {
  if (!teams || teams.length === 0) return [];
  const rows: GlobalRankingEntry[] = teams.map((t) => ({
    team: t.clubName,
    score: t.allTimePoints ?? 0,
    isMe: (!!managerId && t.managerId === managerId) || t.id === myClubId,
    entryId: t.id,
    division: t.division,
    allTimeWins: t.allTimeWins,
    allTimeCrowns: t.allTimeCrowns,
  }));
  return rows.sort(
    (a, b) =>
      b.score - a.score ||
      (b.allTimeWins ?? 0) - (a.allTimeWins ?? 0) ||
      (b.allTimeCrowns ?? 0) - (a.allTimeCrowns ?? 0) ||
      a.team.localeCompare(b.team),
  );
}
