import type { AdminLeagueConfig, LeagueStandingRow } from '@/match/adminLeagues';
import { sortStandings } from '@/match/adminLeagues';

export function patchStandingsAfterResult(
  leagues: AdminLeagueConfig[],
  leagueId: string,
  homeTeamId: string,
  awayTeamId: string,
  scoreHome: number,
  scoreAway: number,
): AdminLeagueConfig[] {
  return leagues.map((lg) => {
    if (lg.id !== leagueId) return lg;
    const standings = lg.standings.map((r) => ({ ...r }));
    const hi = standings.findIndex((r) => r.teamId === homeTeamId);
    const ai = standings.findIndex((r) => r.teamId === awayTeamId);
    if (hi < 0 || ai < 0) return lg;
    const h = standings[hi]!;
    const a = standings[ai]!;
    let hp = h.points;
    let ap = a.points;
    if (scoreHome > scoreAway) hp += 3;
    else if (scoreHome < scoreAway) ap += 3;
    else {
      hp += 1;
      ap += 1;
    }
    standings[hi] = {
      ...h,
      played: h.played + 1,
      points: hp,
      goalsFor: h.goalsFor + scoreHome,
      goalsAgainst: h.goalsAgainst + scoreAway,
    };
    standings[ai] = {
      ...a,
      played: a.played + 1,
      points: ap,
      goalsFor: a.goalsFor + scoreAway,
      goalsAgainst: a.goalsAgainst + scoreHome,
    };
    return { ...lg, standings: sortStandings(standings) };
  });
}

export function standingRowByTeamId(league: AdminLeagueConfig, teamId: string): LeagueStandingRow | undefined {
  return league.standings.find((r) => r.teamId === teamId);
}

/** Simulação leve para jogos sem o manager (IA × IA). */
export function simAiVersusAi(home: LeagueStandingRow, away: LeagueStandingRow): { scoreHome: number; scoreAway: number } {
  const dh = home.points * 0.15 + home.goalsFor * 0.08 + home.played * 0.02;
  const da = away.points * 0.15 + away.goalsFor * 0.08 + away.played * 0.02;
  const edge = dh - da + (Math.random() * 5 - 2.5);
  if (edge > 1.4) {
    const sh = 2 + Math.floor(Math.random() * 2);
    const sa = Math.min(sh - 1, Math.floor(Math.random() * 2));
    return { scoreHome: sh, scoreAway: Math.max(0, sa) };
  }
  if (edge < -1.4) {
    const sa = 2 + Math.floor(Math.random() * 2);
    const sh = Math.min(sa - 1, Math.floor(Math.random() * 2));
    return { scoreHome: Math.max(0, sh), scoreAway: sa };
  }
  const g = Math.floor(Math.random() * 3);
  return { scoreHome: g, scoreAway: g };
}

export function syntheticOpponentStrength(teamId: string): number {
  let h = 0;
  for (let i = 0; i < teamId.length; i++) {
    h = (h + teamId.charCodeAt(i) * (i + 3)) % 151;
  }
  return 68 + (h % 18);
}
