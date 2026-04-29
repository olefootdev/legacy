/**
 * Liga OLEFOOT — competição assíncrona ranqueada (paralela à Liga LEGACY).
 *
 * Manager joga partidas livres entre rodadas LEGACY. Cada partida concluída:
 *  - atualiza rating ELO de ambos os managers
 *  - dá pontos ao leaderboard (3 W / 1 D / 0 L)
 *  - alimenta moral dos jogadores participantes
 *  - serve de "respiração" entre os "batimentos" da LEGACY
 */

export interface EloRating {
  managerId: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface OlefootLeaderboardRow {
  managerId: string;
  managerName: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  rating: number;
}

export interface OlefootMatchRecord {
  matchId: string;
  homeManagerId: string;
  awayManagerId: string;
  homeManagerName: string;
  awayManagerName: string;
  homeGoals: number;
  awayGoals: number;
  finishedAt: number;
  homeRatingBefore: number;
  awayRatingBefore: number;
  homeRatingDelta: number;
  awayRatingDelta: number;
}

export interface OlefootRankedState {
  /** Rating ELO por manager. */
  ratings: Record<string, EloRating>;
  /** Leaderboard derivado/cacheado (recomputado a cada match). */
  leaderboard: OlefootLeaderboardRow[];
  /** Histórico recente (cap em N). */
  recentMatches: OlefootMatchRecord[];
}

export const OLEFOOT_LEAGUE_CONSTANTS = {
  /** Rating ELO inicial. */
  INITIAL_RATING: 1200,
  /** K-factor (volatilidade do rating). */
  ELO_K_FACTOR: 32,
  /** Banda de matchmaking — diferença máxima de rating tolerada. */
  MATCHMAKING_BAND: 150,
  /** Cap do histórico recente. */
  RECENT_MATCHES_CAP: 50,
} as const;

export function createEmptyOlefootRankedState(): OlefootRankedState {
  return {
    ratings: {},
    leaderboard: [],
    recentMatches: [],
  };
}

export function createDefaultEloRating(managerId: string): EloRating {
  return {
    managerId,
    rating: OLEFOOT_LEAGUE_CONSTANTS.INITIAL_RATING,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
}
