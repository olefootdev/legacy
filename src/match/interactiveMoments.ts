/**
 * Sistema de Momentos Interativos — Fase 2 Core Gameplay #1
 * Permite ao jogador tomar decisões críticas em momentos-chave da partida.
 */

import type { PitchPlayerState } from '@/engine/types';

export type InteractiveMomentType = 'duel_1v1' | 'one_on_one' | 'free_kick_dangerous';

export interface InteractiveMomentOption {
  action: string;
  label: string;
  description: string;
  xG: number; // expected goal probability
  risk: number; // 0-1, chance of losing possession
  icon?: string;
}

export interface InteractiveMoment {
  id: string;
  type: InteractiveMomentType;
  minute: number;
  attacker: PitchPlayerState;
  defender?: PitchPlayerState;
  gkSkill?: number;
  distance?: number; // metros (para faltas)
  angle?: number; // graus (para faltas)
  options: InteractiveMomentOption[];
  timeWindowMs: number; // tempo para decidir
  startedAtMs: number;
}

/** Duelo 1v1 Atacante × Zagueiro */
export function createDuel1v1Moment(
  attacker: PitchPlayerState,
  defender: PitchPlayerState,
  minute: number,
): InteractiveMoment {
  const attackerDribble = attacker.attributes?.drible ?? 50;
  const attackerFinishing = attacker.attributes?.finalizacao ?? 50;
  const defenderMarking = defender.attributes?.marcacao ?? 50;
  const defenderSpeed = defender.attributes?.velocidade ?? 50;

  // Calcula xG baseado em atributos
  const dribbleXG = 0.25 + (attackerDribble - defenderSpeed) / 200;
  const shootXG = 0.18 + (attackerFinishing - defenderMarking) / 250;
  const passXG = 0.12;

  const dribbleRisk = 0.6 - (attackerDribble - defenderMarking) / 200;
  const shootRisk = 0.3;
  const passRisk = 0.1;

  return {
    id: `duel_${minute}_${Date.now()}`,
    type: 'duel_1v1',
    minute,
    attacker,
    defender,
    options: [
      {
        action: 'dribble',
        label: 'Driblar',
        description: `Tenta passar por ${defender.name}`,
        xG: Math.max(0.05, Math.min(0.45, dribbleXG)),
        risk: Math.max(0.3, Math.min(0.8, dribbleRisk)),
        icon: '🏃',
      },
      {
        action: 'shoot',
        label: 'Chutar',
        description: 'Finaliza de primeira',
        xG: Math.max(0.08, Math.min(0.35, shootXG)),
        risk: shootRisk,
        icon: '⚽',
      },
      {
        action: 'pass',
        label: 'Passar',
        description: 'Toca para companheiro livre',
        xG: passXG,
        risk: passRisk,
        icon: '🎯',
      },
    ],
    timeWindowMs: 4000,
    startedAtMs: Date.now(),
  };
}

/** Cara a cara com goleiro */
export function createOneOnOneMoment(
  shooter: PitchPlayerState,
  gkSkill: number,
  minute: number,
): InteractiveMoment {
  const shooterFinishing = shooter.attributes?.finalizacao ?? 50;
  const shooterTechnique = shooter.attributes?.tatico ?? 50;
  const shooterComposure = shooter.attributes?.mentalidade ?? 50;

  // Calcula xG baseado em atributos vs goleiro
  const finesseXG = 0.35 + (shooterTechnique - gkSkill) / 180 + (shooterComposure / 200);
  const powerXG = 0.30 + (shooterFinishing - gkSkill) / 200;
  const chipXG = 0.22 + (shooterTechnique - gkSkill) / 250;

  return {
    id: `one_on_one_${minute}_${Date.now()}`,
    type: 'one_on_one',
    minute,
    attacker: shooter,
    gkSkill,
    options: [
      {
        action: 'finesse',
        label: 'Colocado',
        description: 'Chute colocado no canto',
        xG: Math.max(0.15, Math.min(0.55, finesseXG)),
        risk: 0.25,
        icon: '🎯',
      },
      {
        action: 'power',
        label: 'Potência',
        description: 'Chute forte e rasteiro',
        xG: Math.max(0.12, Math.min(0.48, powerXG)),
        risk: 0.35,
        icon: '💥',
      },
      {
        action: 'chip',
        label: 'Cavadinha',
        description: 'Tenta cobrir o goleiro',
        xG: Math.max(0.08, Math.min(0.38, chipXG)),
        risk: 0.45,
        icon: '🌙',
      },
    ],
    timeWindowMs: 3500,
    startedAtMs: Date.now(),
  };
}

/** Falta perigosa — escolher batedor + tipo */
export function createFreeKickMoment(
  takers: PitchPlayerState[],
  distance: number,
  angle: number,
  minute: number,
): InteractiveMoment {
  // Ordena por finalização
  const sortedTakers = [...takers]
    .sort((a, b) => (b.attributes?.finalizacao ?? 0) - (a.attributes?.finalizacao ?? 0))
    .slice(0, 3);

  const bestTaker = sortedTakers[0]!;
  const takerFinishing = bestTaker.attributes?.finalizacao ?? 50;
  const takerTechnique = bestTaker.attributes?.tatico ?? 50;

  // xG baseado em distância e ângulo
  const distanceFactor = Math.max(0, 1 - (distance - 18) / 15); // melhor em 18m
  const angleFactor = Math.max(0.5, 1 - Math.abs(angle) / 45); // melhor frontal

  const directXG = 0.15 * distanceFactor * angleFactor + (takerFinishing / 200);
  const crossXG = 0.18 * angleFactor;

  return {
    id: `free_kick_${minute}_${Date.now()}`,
    type: 'free_kick_dangerous',
    minute,
    attacker: bestTaker,
    distance,
    angle,
    options: [
      {
        action: 'direct',
        label: 'Direto ao gol',
        description: `${bestTaker.name} cobra direto`,
        xG: Math.max(0.08, Math.min(0.35, directXG)),
        risk: 0.4,
        icon: '⚡',
      },
      {
        action: 'cross',
        label: 'Cruzamento',
        description: 'Bola na área para cabeçada',
        xG: Math.max(0.12, Math.min(0.28, crossXG)),
        risk: 0.25,
        icon: '🎯',
      },
      {
        action: 'short_pass',
        label: 'Toque curto',
        description: 'Tabela para abrir espaço',
        xG: 0.10,
        risk: 0.15,
        icon: '🔄',
      },
    ],
    timeWindowMs: 5000,
    startedAtMs: Date.now(),
  };
}

/** Detecta se deve criar momento interativo baseado no contexto */
export function shouldTriggerInteractiveMoment(
  ctx: {
    ballZone: 'def' | 'mid' | 'att';
    onBall?: PitchPlayerState;
    nearbyOpponentDist: number;
    minute: number;
    homeScore: number;
    awayScore: number;
  },
  lastInteractiveMomentMinute: number,
): InteractiveMomentType | null {
  // Cooldown: min 3 minutos entre momentos
  if (ctx.minute - lastInteractiveMomentMinute < 3) return null;

  // Só em zona de ataque
  if (ctx.ballZone !== 'att') return null;

  // Duelo 1v1: atacante isolado sob pressão (15% chance)
  if (ctx.nearbyOpponentDist < 8 && Math.random() < 0.15) {
    return 'duel_1v1';
  }

  // Cara a cara: muito próximo do gol (10% chance)
  if (ctx.onBall && Math.random() < 0.10) {
    return 'one_on_one';
  }

  return null;
}
