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
import { evaluatePerformanceBonuses, calculateTotalBonusRewards, type PerformanceBonus } from '@/match/quickPerformanceBonuses';
import type { MatchEventEntry } from '@/engine/types';
import {
  applyMatchPerformanceEvolution,
  clampPlayerToEvolutionCap,
  ensureMintOverall,
} from '@/entities/playerEvolution';
import { overallFromAttributes } from '@/entities/player';
import { healthFromLegacyPlayer } from '@/systems/playerHealth/reducer';

export type MatchOutcome = 'win' | 'draw' | 'loss';

export interface QuickPlanStatRow {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  km: number;
  rating: number;
  shotsOn?: number;
  /** Ponte #1: gols do jogador na partida — habilita o bônus de hat-trick. */
  goals?: number;
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

const MATCH_FATIGUE_COST = 20;   // quem jogou os 90' CANSA (fadiga sobe)
const POST_MATCH_RECOVERY = 18;  // quem ficou de fora/banco DESCANSA (fadiga cai)

/** Multiplicador da Leitura de Jogo (Manager IQ): 0/4 → 0.85x · 4/4 → ~1.18x. */
export function readingMultiplier(reading: { good: number; total: number }): number {
  if (!reading.total) return 1;
  const ratio = reading.good / reading.total;
  return Math.max(0.85, Math.min(1.18, 1 + (ratio - 0.5) * 0.36));
}

/** Delta de OVR de um jogador que atuou (pra mostrar "o time evoluiu"). */
export interface PlayerEvolutionDelta {
  id: string;
  name: string;
  pos: string;
  ovrBefore: number;
  ovrAfter: number;
  delta: number;
}

/** Resumo de evolução do time pós-partida — alimenta o painel do pós-jogo. */
export interface QuickPlanEvolutionSummary {
  /** Jogadores que SUBIRAM OVR, do maior salto pro menor. */
  risers: PlayerEvolutionDelta[];
  /** Soma dos deltas de OVR de quem atuou (pode ser negativa em jogo ruim). */
  teamDelta: number;
  /** OVR médio do XI titular antes e depois (1 casa). */
  teamOvrBefore: number;
  teamOvrAfter: number;
}

export interface QuickPlanCreditResult extends QuickPlanCreditState {
  oleGain: number;
  bonusNames: string[];
  /** Ponte #1: bônus completos (nome/ícone/recompensa) pro painel do pós-jogo. */
  bonuses: PerformanceBonus[];
  readingMult: number;
  evolution: QuickPlanEvolutionSummary;
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

  // 2) Bônus de performance.
  //    O motor Engaged não carrega MatchEventEntry[], mas o hat-trick só precisa
  //    de gols por jogador da casa — sintetizamos eventos mínimos a partir do
  //    placar individual (homeStats.goals) pra reativar o bônus sem reconstruir o
  //    histórico inteiro.
  const bonusEvents: MatchEventEntry[] = [];
  for (const [pid, stat] of Object.entries(input.homeStats)) {
    for (let g = 0; g < (stat.goals ?? 0); g++) {
      bonusEvents.push({ id: `synth-goal-${pid}-${g}`, kind: 'goal_home', minute: 0, text: '', playerId: pid });
    }
  }
  const bonuses = evaluatePerformanceBonuses({
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    goalsAgainst: input.awayScore,
    possession: input.agg.possessionHome,
    shots: input.agg.shots,
    events: bonusEvents,
    wasLosing: input.agg.wasLosing,
    won: homeWin,
  });
  const { ole: bonusOle, exp: bonusExp } = calculateTotalBonusRewards(bonuses);

  // 3) Economia (espelha o FINALIZE_MATCH) × streak × Manager IQ
  const readingMult = readingMultiplier(input.reading);
  const oleGainBase = 80 + input.homeScore * 35 + (homeWin ? 120 : 0);
  const oleGain = Math.max(0, Math.round((oleGainBase + bonusOle + bonusExp) * streakMult * readingMult));
  const finance = grantEarnedExp(state.finance, oleGain);

  // 4) Evolução dos titulares + XP extra por boa leitura.
  //    Captura o delta de OVR (antes × depois) pra MOSTRAR ao manager que o time
  //    melhorou — a evolução sempre persistiu, mas era invisível. Agora não é.
  const players = { ...state.players };
  const readingXp = Math.round(input.reading.good * 3); // ler bem evolui mais
  const deltas: PlayerEvolutionDelta[] = [];
  let teamBeforeSum = 0;
  let teamAfterSum = 0;
  let counted = 0;
  for (const [pid, stat] of Object.entries(input.homeStats)) {
    const pl = players[pid];
    if (!pl) continue;
    const ovrBefore = overallFromAttributes(pl.attrs, pl.pos);
    let next = applyMatchPerformanceEvolution(pl, stat, outcome, false);
    if (readingXp > 0) next = { ...next, evolutionXp: (next.evolutionXp ?? 0) + readingXp };
    const evolved = clampPlayerToEvolutionCap(ensureMintOverall(next));
    players[pid] = evolved;
    const ovrAfter = overallFromAttributes(evolved.attrs, evolved.pos);
    teamBeforeSum += ovrBefore;
    teamAfterSum += ovrAfter;
    counted += 1;
    if (ovrAfter !== ovrBefore) {
      deltas.push({ id: pid, name: pl.name, pos: pl.pos, ovrBefore, ovrAfter, delta: ovrAfter - ovrBefore });
    }
  }
  const evolution: QuickPlanEvolutionSummary = {
    risers: deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta),
    teamDelta: deltas.reduce((s, d) => s + d.delta, 0),
    teamOvrBefore: counted ? Math.round((teamBeforeSum / counted) * 10) / 10 : 0,
    teamOvrAfter: counted ? Math.round((teamAfterSum / counted) * 10) / 10 : 0,
  };

  // 5) Fadiga pós-jogo: quem JOGOU os 90' cansa (+custo); quem ficou de FORA
  //    descansa (−recuperação). É o que faz a fadiga existir e a rotação importar.
  const playedSet = new Set(input.homeOnPitch);
  const playerHealth = { ...state.playerHealth };
  for (const [pid, p] of Object.entries(players)) {
    const cur = playerHealth[pid] ?? healthFromLegacyPlayer({
      id: pid, fatigue: p.fatigue, injuryRisk: p.injuryRisk, outForMatches: p.outForMatches,
    });
    const fatigueDelta = playedSet.has(pid) ? MATCH_FATIGUE_COST : -POST_MATCH_RECOVERY;
    const nextFatigue = Math.max(0, Math.min(100, p.fatigue + fatigueDelta));
    playerHealth[pid] = { ...cur, fatigue: nextFatigue, injuryRisk: p.injuryRisk, outForMatches: p.outForMatches, atRisk: nextFatigue >= 80 || p.injuryRisk >= 70 };
    players[pid] = { ...p, fatigue: nextFatigue };
  }

  return { finance, players, playerHealth, quickMatchStreak, oleGain, bonusNames: bonuses.map((b) => b.name), bonuses, readingMult, evolution };
}
