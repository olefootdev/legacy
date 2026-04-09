import type { PastResult } from '@/entities/types';

export interface LeagueSeasonState {
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export function createInitialLeagueSeason(): LeagueSeasonState {
  return { played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 };
}

/** Atualiza contagem da liga após uma partida oficial (casa). */
export function applyResultToLeagueSeason(
  season: LeagueSeasonState,
  result: Pick<PastResult, 'scoreHome' | 'scoreAway' | 'result'>,
): LeagueSeasonState {
  const { scoreHome, scoreAway, result: r } = result;
  let points = season.points;
  if (r === 'win') points += 3;
  else if (r === 'draw') points += 1;
  return {
    played: season.played + 1,
    points,
    goalsFor: season.goalsFor + scoreHome,
    goalsAgainst: season.goalsAgainst + scoreAway,
  };
}
