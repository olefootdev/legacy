/**
 * TeamIntentResolver — Resolve intenção coletiva do time
 *
 * Calcula a intenção tática do time baseado em:
 * - Placar
 * - Tempo de jogo
 * - Posse de bola
 * - Força relativa
 * - Eventos recentes
 * - Fadiga coletiva
 */

import type { TeamIntent, MatchState } from './types';

export interface TeamIntentContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  /** Força relativa do time 0-100 */
  teamStrength: number;
  /** Força do adversário 0-100 */
  opponentStrength: number;
  /** Fadiga média do time 0-100 */
  averageFatigue: number;
  /** Momentum -1 a +1 */
  momentum?: number;
  /** Gols sofridos nos últimos 10 minutos */
  recentGoalsConceded?: number;
}

/**
 * Resolve intenção coletiva do time
 */
export function resolveTeamIntent(ctx: TeamIntentContext): TeamIntent {
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  const timeRemaining = 90 - ctx.minute;
  const strengthDiff = ctx.teamStrength - ctx.opponentStrength;
  const isLate = ctx.minute > 75;
  const isVeryLate = ctx.minute > 85;
  const isTired = ctx.averageFatigue > 70;

  // ─────────────────────────────────────────────────────────────
  // PROTECT RESULT (ganhando e quer segurar)
  // ─────────────────────────────────────────────────────────────
  if (scoreDiff > 0) {
    // Ganhando de 1: proteger só no final
    if (scoreDiff === 1 && isVeryLate) {
      return 'protect_result';
    }
    // Ganhando de 2+: proteger a partir dos 75'
    if (scoreDiff >= 2 && isLate) {
      return 'protect_result';
    }
    // Ganhando mas muito cansado: reorganizar
    if (isTired && ctx.minute > 60) {
      return 'reorganize';
    }
    // Ganhando e forte: controlar o jogo
    if (strengthDiff > 10) {
      return 'control_game';
    }
    // Ganhando mas adversário forte: pressionar alto
    return 'press_high';
  }

  // ─────────────────────────────────────────────────────────────
  // SEEK DRAW (perdendo de pouco e tempo acabando)
  // ─────────────────────────────────────────────────────────────
  if (scoreDiff === -1 && isVeryLate) {
    return 'seek_draw';
  }

  // ─────────────────────────────────────────────────────────────
  // ACCELERATE ATTACK (perdendo e precisa de gol)
  // ─────────────────────────────────────────────────────────────
  if (scoreDiff < 0) {
    // Perdendo de 2+ ou perdendo no final: acelerar
    if (scoreDiff <= -2 || (scoreDiff === -1 && isLate)) {
      return 'accelerate_attack';
    }
    // Perdendo de 1 no meio do jogo: pressionar alto
    if (scoreDiff === -1 && !isLate) {
      return 'press_high';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // REORGANIZE (cansado ou levou gol recente)
  // ─────────────────────────────────────────────────────────────
  if (isTired && ctx.minute > 60) {
    return 'reorganize';
  }
  if (ctx.recentGoalsConceded && ctx.recentGoalsConceded > 0) {
    return 'reorganize';
  }

  // ─────────────────────────────────────────────────────────────
  // PRESS HIGH (momentum positivo ou adversário fraco)
  // ─────────────────────────────────────────────────────────────
  if (ctx.momentum && ctx.momentum > 0.3) {
    return 'press_high';
  }
  if (strengthDiff > 15) {
    return 'press_high';
  }

  // ─────────────────────────────────────────────────────────────
  // CONTROL GAME (padrão: empate ou vantagem pequena)
  // ─────────────────────────────────────────────────────────────
  return 'control_game';
}

/**
 * Retorna bias de decisão baseado na intenção do time
 */
export function getTeamIntentBias(intent: TeamIntent): Record<string, number> {
  switch (intent) {
    case 'control_game':
      return {
        pass_safe: +0.10,
        pass_progressive: +0.08,
        carry: +0.05,
        shoot: -0.05,
        clearance: -0.08,
      };

    case 'press_high':
      return {
        pass_progressive: +0.15,
        carry: +0.10,
        shoot: +0.08,
        pass_safe: -0.05,
        off_ball_press: +0.20,
      };

    case 'protect_result':
      return {
        pass_safe: +0.20,
        clearance: +0.15,
        pass_progressive: -0.10,
        shoot: -0.15,
        carry: -0.10,
        off_ball_hold_position: +0.20,
      };

    case 'seek_draw':
      return {
        pass_progressive: +0.12,
        shoot: +0.18,
        carry: +0.08,
        pass_safe: -0.08,
        clearance: -0.12,
      };

    case 'accelerate_attack':
      return {
        shoot: +0.25,
        pass_progressive: +0.15,
        carry: +0.12,
        pass_safe: -0.15,
        clearance: -0.20,
        off_ball_attack_space: +0.25,
      };

    case 'reorganize':
      return {
        pass_safe: +0.15,
        clearance: +0.10,
        pass_progressive: -0.08,
        shoot: -0.12,
        carry: -0.05,
        off_ball_hold_position: +0.15,
      };

    default:
      return {};
  }
}

/**
 * Descrição da intenção para UI/debug
 */
export function getTeamIntentDescription(intent: TeamIntent): string {
  switch (intent) {
    case 'control_game':
      return 'Controlar o jogo com posse';
    case 'press_high':
      return 'Pressionar alto e buscar o gol';
    case 'protect_result':
      return 'Proteger o resultado';
    case 'seek_draw':
      return 'Buscar o empate';
    case 'accelerate_attack':
      return 'Acelerar o ataque';
    case 'reorganize':
      return 'Reorganizar a defesa';
    default:
      return 'Intenção desconhecida';
  }
}
