/**
 * LIGA CLASSIC + FAST LIGA — leagues locais que somam pontos toda vez que
 * o manager joga uma partida no respectivo modo.
 *
 *   - liga 'classic' → modo CLASSIC (2D tático completo)
 *   - liga 'fast'    → modo QUICK (rápida)
 *
 * Pontuação: vitória 3, empate 1, derrota 0 (padrão Premier League).
 * Sem temporadas — é cumulativa enquanto o manager joga.
 */

export type LocalLeagueId = 'classic' | 'fast';
export type LocalLeagueResult = 'win' | 'draw' | 'loss';

export interface LocalLeagueStanding {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Últimas 5 partidas, mais recente no índice 0. */
  recentForm: Array<'W' | 'D' | 'L'>;
  bestStreak: number;
  currentStreak: number; // positivo = vitórias seguidas, 0 = empate/derrota
}

export interface LocalLeaguesState {
  classic: LocalLeagueStanding;
  fast: LocalLeagueStanding;
}

export function emptyLocalLeagueStanding(): LocalLeagueStanding {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    recentForm: [],
    bestStreak: 0,
    currentStreak: 0,
  };
}

export function emptyLocalLeaguesState(): LocalLeaguesState {
  return {
    classic: emptyLocalLeagueStanding(),
    fast: emptyLocalLeagueStanding(),
  };
}

export function applyResultToLocalLeague(
  prev: LocalLeagueStanding | undefined,
  result: LocalLeagueResult,
  goalsFor: number,
  goalsAgainst: number,
): LocalLeagueStanding {
  const s = prev ?? emptyLocalLeagueStanding();
  const points = result === 'win' ? 3 : result === 'draw' ? 1 : 0;
  const code: 'W' | 'D' | 'L' = result === 'win' ? 'W' : result === 'draw' ? 'D' : 'L';
  const currentStreak = result === 'win' ? s.currentStreak + 1 : 0;
  const bestStreak = Math.max(s.bestStreak, currentStreak);
  return {
    played: s.played + 1,
    wins: s.wins + (result === 'win' ? 1 : 0),
    draws: s.draws + (result === 'draw' ? 1 : 0),
    losses: s.losses + (result === 'loss' ? 1 : 0),
    goalsFor: s.goalsFor + Math.max(0, goalsFor),
    goalsAgainst: s.goalsAgainst + Math.max(0, goalsAgainst),
    points: s.points + points,
    recentForm: [code, ...s.recentForm].slice(0, 5),
    bestStreak,
    currentStreak,
  };
}

/** Soma de pontos pra ranking global "qual league mais forte?". */
export function totalLocalLeaguePoints(state: LocalLeaguesState | undefined): number {
  if (!state) return 0;
  return (state.classic?.points ?? 0) + (state.fast?.points ?? 0);
}
