/**
 * Sistema de Ranking Competitivo para Partida Rápida
 *
 * Modo Competitivo:
 * - Vitória: +3 pontos
 * - Empate: +1 ponto
 * - Derrota: 0 pontos
 *
 * Pontos vão para o ranking global do jogador.
 */

export interface CompetitiveRankingState {
  /** Pontos totais acumulados */
  points: number;
  /** Total de partidas jogadas no modo competitivo */
  matchesPlayed: number;
  /** Vitórias */
  wins: number;
  /** Empates */
  draws: number;
  /** Derrotas */
  losses: number;
  /** Gols marcados */
  goalsFor: number;
  /** Gols sofridos */
  goalsAgainst: number;
  /** Melhor sequência de vitórias */
  bestWinStreak: number;
  /** Sequência atual de vitórias */
  currentWinStreak: number;
  /** Histórico recente (últimos 10 jogos) */
  recentForm: Array<'W' | 'D' | 'L'>;
}

export function createInitialCompetitiveRanking(): CompetitiveRankingState {
  return {
    points: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    bestWinStreak: 0,
    currentWinStreak: 0,
    recentForm: [],
  };
}

export function updateCompetitiveRanking(
  current: CompetitiveRankingState,
  homeScore: number,
  awayScore: number,
): CompetitiveRankingState {
  const isWin = homeScore > awayScore;
  const isDraw = homeScore === awayScore;
  const isLoss = homeScore < awayScore;

  let pointsGained = 0;
  let result: 'W' | 'D' | 'L' = 'L';

  if (isWin) {
    pointsGained = 3;
    result = 'W';
  } else if (isDraw) {
    pointsGained = 1;
    result = 'D';
  }

  const newWinStreak = isWin ? current.currentWinStreak + 1 : 0;
  const newBestStreak = Math.max(current.bestWinStreak, newWinStreak);

  // Manter apenas últimos 10 jogos no histórico
  const newRecentForm = [...current.recentForm, result].slice(-10);

  return {
    points: current.points + pointsGained,
    matchesPlayed: current.matchesPlayed + 1,
    wins: current.wins + (isWin ? 1 : 0),
    draws: current.draws + (isDraw ? 1 : 0),
    losses: current.losses + (isLoss ? 1 : 0),
    goalsFor: current.goalsFor + homeScore,
    goalsAgainst: current.goalsAgainst + awayScore,
    bestWinStreak: newBestStreak,
    currentWinStreak: newWinStreak,
    recentForm: newRecentForm,
  };
}

export function getCompetitiveRankingStats(state: CompetitiveRankingState) {
  const winRate = state.matchesPlayed > 0
    ? Math.round((state.wins / state.matchesPlayed) * 100)
    : 0;

  const goalDifference = state.goalsFor - state.goalsAgainst;

  const avgPointsPerMatch = state.matchesPlayed > 0
    ? (state.points / state.matchesPlayed).toFixed(2)
    : '0.00';

  return {
    winRate,
    goalDifference,
    avgPointsPerMatch,
  };
}
