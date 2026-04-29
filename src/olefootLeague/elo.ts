import { OLEFOOT_LEAGUE_CONSTANTS } from './types';

/**
 * Atualiza ratings ELO após uma partida.
 * Result: 1 = home venceu, 0.5 = empate, 0 = away venceu.
 */
export function updateElo(
  homeRating: number,
  awayRating: number,
  homeScore: 1 | 0.5 | 0,
): { newHome: number; newAway: number; deltaHome: number; deltaAway: number } {
  const K = OLEFOOT_LEAGUE_CONSTANTS.ELO_K_FACTOR;
  const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
  const expectedAway = 1 - expectedHome;
  const awayScore = (1 - homeScore) as 1 | 0.5 | 0;
  const deltaHome = Math.round(K * (homeScore - expectedHome));
  const deltaAway = Math.round(K * (awayScore - expectedAway));
  return {
    newHome: homeRating + deltaHome,
    newAway: awayRating + deltaAway,
    deltaHome,
    deltaAway,
  };
}

/** Converte placar em score ELO 1/0.5/0 do ponto de vista do mandante. */
export function scoreFromGoals(homeGoals: number, awayGoals: number): 1 | 0.5 | 0 {
  if (homeGoals > awayGoals) return 1;
  if (homeGoals < awayGoals) return 0;
  return 0.5;
}
