/**
 * Helper para carregar skills de jogadores no match engine.
 *
 * Converte PlayerEntity.skills → PitchPlayerState.skillIds
 * e fornece lookup de behaviors ativos por contexto.
 */

import type { PlayerEntity } from '@/entities/types';
import type { PitchPlayerState } from '@/engine/types';
import type { CoachSkill, SkillBehavior } from './playbookV1';
import { getPlayerSkills } from './index';

/**
 * Carrega skillIds do PlayerEntity para o PitchPlayerState.
 * Chamado ao montar o pitch state inicial (LiveMatch, TacticalSimLoop).
 */
export function loadPlayerSkillsForPitch(
  player: PlayerEntity,
  pitchState: PitchPlayerState,
): PitchPlayerState {
  return {
    ...pitchState,
    skillIds: player.skills ?? [],
  };
}

/**
 * Retorna behaviors ativos para um jogador em um contexto específico.
 *
 * Filtra behaviors por:
 * - minSkillLevel (se definido, skill.level >= minSkillLevel)
 * - when DSL (ainda não implementado — Fase 3)
 *
 * Caller aplica os bias retornados ao score de decisão.
 */
export function getActiveBehaviors(
  pitchPlayer: PitchPlayerState,
  context: {
    teamHasBall: boolean;
    carrierIsMe: boolean;
    zone?: string;
    minute?: number;
  },
): SkillBehavior[] {
  if (!pitchPlayer.skillIds || pitchPlayer.skillIds.length === 0) return [];

  const skills = getPlayerSkills(pitchPlayer.skillIds);
  const behaviors: SkillBehavior[] = [];

  for (const skill of skills) {
    for (const behavior of skill.behaviors) {
      // Filtro 1: minSkillLevel
      if (behavior.minSkillLevel && skill.level < behavior.minSkillLevel) {
        continue;
      }

      // Filtro 2: when DSL (simplificado — Fase 3 terá parser completo)
      if (!evaluateWhenClause(behavior.when, context)) {
        continue;
      }

      behaviors.push(behavior);
    }
  }

  return behaviors;
}

/**
 * Avaliador simplificado do DSL `when` (Fase 1).
 *
 * Suporta apenas keywords básicas:
 * - team_has_ball, carrier_is_me, zone, minute
 *
 * Fase 3: parser completo com AND/OR/NOT, comparações, etc.
 */
function evaluateWhenClause(
  when: string,
  context: {
    teamHasBall: boolean;
    carrierIsMe: boolean;
    zone?: string;
    minute?: number;
  },
): boolean {
  const lower = when.toLowerCase();

  // team_has_ball
  if (lower.includes('team_has_ball') && !context.teamHasBall) return false;
  if (lower.includes('!team_has_ball') && context.teamHasBall) return false;

  // carrier_is_me
  if (lower.includes('carrier_is_me') && !context.carrierIsMe) return false;

  // zone (simplificado: exact match ou IN list)
  if (context.zone) {
    const zoneMatch = lower.match(/zone\s*(?:=|in)\s*\[?([^\]]+)\]?/);
    if (zoneMatch) {
      const zones = zoneMatch[1].split(',').map((z) => z.trim().replace(/['"]/g, ''));
      if (!zones.some((z) => context.zone?.toLowerCase().includes(z))) return false;
    }
  }

  // minute (simplificado: > < =)
  if (context.minute != null) {
    const minuteMatch = lower.match(/minute\s*([><]=?)\s*(\d+)/);
    if (minuteMatch) {
      const op = minuteMatch[1];
      const val = Number(minuteMatch[2]);
      if (op === '>' && context.minute <= val) return false;
      if (op === '>=' && context.minute < val) return false;
      if (op === '<' && context.minute >= val) return false;
      if (op === '<=' && context.minute > val) return false;
    }
  }

  return true;
}

/**
 * Aplica bias de behaviors ativos a um score base.
 *
 * Exemplo:
 * ```ts
 * const behaviors = getActiveBehaviors(player, context);
 * const finalScore = applyBehaviorBias(baseScore, behaviors, 'cross_accuracy');
 * ```
 */
export function applyBehaviorBias(
  baseScore: number,
  behaviors: SkillBehavior[],
  biasKey: string,
): number {
  let total = baseScore;
  for (const b of behaviors) {
    const bias = b.bias[biasKey];
    if (bias != null) {
      total += bias;
    }
  }
  return total;
}
