/**
 * creditQuickPlan — crédito de progressão da Partida Rápida 2.0 (Fase D).
 *
 * PURO e determinístico (sem Date.now/Math.random) pra ser testável. Recebe um
 * RESULTADO já computado (placar, stats por jogador, leitura) e devolve as
 * fatias atualizadas (finance, players, playerHealth, streak), reusando os
 * MESMOS helpers do FINALIZE_MATCH legado — sem rodar o loop tick-by-tick.
 *
 * Manager IQ: a leitura de jogo (good/total) vira um multiplicador de
 * recompensa + XP extra — "ler bem o jogo faz o time evoluir mais".
 */

import type { PlayerEntity } from '@/entities/types';
import type { FinanceState } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { grantEarnedExp } from '@/systems/economy';
import { updateStreak } from '@/game/quickMatchStreak';
import { evaluatePerformanceBonuses, calculateTotalBonusRewards } from '@/match/quickPerformanceBonuses';
import {
  applyMatchPerformanceEvolution,
  clampPlayerToEvolutionCap,
  ensureMintOverall,
} from '@/entities/playerEvolution';
import { healthFromLegacyPlayer } from '@/systems/playerHealth/reducer';

export type MatchOutcome = 'win' | 'draw' | 'loss';

export interface QuickPlanStatRow {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  km: number;
  rating: number;
  shotsOn?: number;
}

export interface QuickPlanCreditInput {
  homeScore: number;
  awayScore: number;
  reading: { good: number; total: number };
  /** Stats por jogador da CASA (já com nota), id → linha. */
  homeStats: Record<string, QuickPlanStatRow>;
  /** Quem terminou em campo (recovery menor que o banco). */
  homeOnPitch: string[];
  /** Agregados pro bônus de performance. */
  agg: { shots: number; possessionHome: number; wasLosing: boolean };
  /** Vencedor da disputa de pênaltis quando o tempo normal empatou (nenhum
   *  jogo termina empatado) — vira V/D real pra streak/forma/economia. */
  shootoutWin?: 'home' | 'away';
}

export interface QuickPlanCreditState {
  finance: FinanceState;
  players: Record<string, PlayerEntity>;
  playerHealth: Record<string, PlayerHealth>;
  quickMatchStreak: { current: number; best: number; lastMatchWon: boolean; multiplier: number };
}

const POST_MATCH_BASE_RECOVERY = 12;
const POST_MATCH_BENCH_BONUS = 18;

/** Multiplicador da Leitura de Jogo (Manager IQ): 0/4 → 0.85x · 4/4 → ~1.18x. */
export function readingMultiplier(reading: { good: number; total: number }): number {
  if (!reading.total) return 1;
  const ratio = reading.good / reading.total;
  return Math.max(0.85, Math.min(1.18, 1 + (ratio - 0.5) * 0.36));
}

export interface QuickPlanCreditResult extends QuickPlanCreditState {
  oleGain: number;
  bonusNames: string[];
  readingMult: number;
}

export function computeQuickPlanCredit(
  state: QuickPlanCreditState,
  input: QuickPlanCreditInput,
): QuickPlanCreditResult {
  // Empate no tempo normal é decidido nos pênaltis (nenhum jogo empata).
  const drawOnScore = input.homeScore === input.awayScore;
  const homeWin = input.homeScore > input.awayScore || (drawOnScore && input.shootoutWin === 'home');
  const homeLoss = input.homeScore < input.awayScore || (drawOnScore && input.shootoutWin === 'away');
  const draw = !homeWin && !homeLoss;
  const outcome: MatchOutcome = homeWin ? 'win' : draw ? 'draw' : 'loss';

  // 1) Streak + multiplicador
  const quickMatchStreak = updateStreak(state.quickMatchStreak, homeWin);
  const streakMult = quickMatchStreak.multiplier;

  // 2) Bônus de performance
  const bonuses = evaluatePerformanceBonuses({
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    goalsAgainst: input.awayScore,
    possession: input.agg.possessionHome,
    shots: input.agg.shots,
    events: [],
    wasLosing: input.agg.wasLosing,
    won: homeWin,
  });
  const { ole: bonusOle, exp: bonusExp } = calculateTotalBonusRewards(bonuses);

  // 3) Economia (espelha o FINALIZE_MATCH) × streak × Manager IQ
  const readingMult = readingMultiplier(input.reading);
  const oleGainBase = 80 + input.homeScore * 35 + (homeWin ? 120 : 0);
  const oleGain = Math.max(0, Math.round((oleGainBase + bonusOle + bonusExp) * streakMult * readingMult));
  const finance = grantEarnedExp(state.finance, oleGain);

  // 4) Evolução dos titulares + XP extra por boa leitura
  const players = { ...state.players };
  const readingXp = Math.round(input.reading.good * 3); // ler bem evolui mais
  for (const [pid, stat] of Object.entries(input.homeStats)) {
    const pl = players[pid];
    if (!pl) continue;
    let next = applyMatchPerformanceEvolution(pl, stat, outcome, false);
    if (readingXp > 0) next = { ...next, evolutionXp: (next.evolutionXp ?? 0) + readingXp };
    players[pid] = clampPlayerToEvolutionCap(ensureMintOverall(next));
  }

  // 5) Recuperação de fadiga pós-jogo (FIX C): jogou recupera menos, banco mais.
  const playedSet = new Set(input.homeOnPitch);
  const playerHealth = { ...state.playerHealth };
  for (const [pid, p] of Object.entries(players)) {
    const cur = playerHealth[pid] ?? healthFromLegacyPlayer({
      id: pid, fatigue: p.fatigue, injuryRisk: p.injuryRisk, outForMatches: p.outForMatches,
    });
    const recovery = POST_MATCH_BASE_RECOVERY + (playedSet.has(pid) ? 0 : POST_MATCH_BENCH_BONUS);
    const nextFatigue = Math.max(0, p.fatigue - recovery);
    playerHealth[pid] = { ...cur, fatigue: nextFatigue, injuryRisk: p.injuryRisk, outForMatches: p.outForMatches, atRisk: nextFatigue >= 80 || p.injuryRisk >= 70 };
    players[pid] = { ...p, fatigue: nextFatigue };
  }

  return { finance, players, playerHealth, quickMatchStreak, oleGain, bonusNames: bonuses.map((b) => b.name), readingMult };
}
