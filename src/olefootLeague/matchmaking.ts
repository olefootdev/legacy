import type { EloRating } from './types';
import { OLEFOOT_LEAGUE_CONSTANTS } from './types';

/**
 * Encontra um oponente dentro da banda de rating do manager.
 * Retorna null se nenhum candidato estiver na banda.
 *
 * Estratégia: prefere oponente mais próximo do rating; em caso de empate, menos partidas jogadas.
 */
export function findOpponent(
  myManagerId: string,
  myRating: number,
  candidates: EloRating[],
  bandOverride?: number,
): EloRating | null {
  const band = bandOverride ?? OLEFOOT_LEAGUE_CONSTANTS.MATCHMAKING_BAND;
  const eligible = candidates.filter(
    (c) => c.managerId !== myManagerId && Math.abs(c.rating - myRating) <= band,
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const da = Math.abs(a.rating - myRating);
    const db = Math.abs(b.rating - myRating);
    if (da !== db) return da - db;
    return a.matchesPlayed - b.matchesPlayed;
  });
  return eligible[0];
}

/**
 * Verifica se manager está LIBERADO para buscar partida OLEFOOT.
 * Bloqueado quando LEGACY está em fase `lock` ou `live`.
 */
export function canMatchmake(legacyLocked: boolean): boolean {
  return !legacyLocked;
}
