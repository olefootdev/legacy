/**
 * Tabela única de compatibilidade Skill × Zona + multiplicador zonal.
 *
 * Toda skill consulta o mesmo motor — sem inconsistência por handler. Padrão
 * de uso (em shoot/pass/cross/etc.):
 *
 *   const z = aw.ballZoneInfo;
 *   if (!isSkillCompatibleWithZone('SHOOT', z)) return { triggerChance: 0 };
 *   const mult = zoneMultiplierForSkill('SHOOT', z, aw);
 *   triggerChance = baseTriggerChance * mult;
 */

import {
  isBox,
  isFinalThird,
  isCreationZone,
  isHalfspace,
  isWing,
  isPressZone,
  isBuildUpZone,
  isDefThird,
  isMidThird,
  type ZoneInfo,
} from '@/match/spatialZones';
import { biasFor } from '@/smartfield/decision';
import type { AwarenessContext } from '@/smartfield/awareness';

export type SkillType =
  | 'SHOOT'
  | 'DRIBBLE'
  | 'CROSS'
  | 'HEADER'
  | 'PASS'
  | 'PRESS'
  | 'BUILD_UP'
  | 'DEFEND'
  | 'FREEKICK'
  | 'SAVE';

const SKILL_ZONE_COMPAT: Record<SkillType, (z: ZoneInfo) => boolean> = {
  SHOOT: (z) => isBox(z) || isFinalThird(z) || isCreationZone(z),
  DRIBBLE: (z) => isCreationZone(z) || isHalfspace(z) || isFinalThird(z),
  CROSS: (z) => isWing(z) && !isDefThird(z),
  HEADER: (z) => isBox(z),
  PASS: (z) => !isBox(z),
  PRESS: (z) => isPressZone(z),
  BUILD_UP: (z) => isBuildUpZone(z),
  DEFEND: (z) => isDefThird(z) || isMidThird(z),
  FREEKICK: (z) => isFinalThird(z) || isCreationZone(z),
  SAVE: (z) => isDefThird(z),
};

export function isSkillCompatibleWithZone(type: SkillType, z: ZoneInfo): boolean {
  return SKILL_ZONE_COMPAT[type](z);
}

export function zoneMultiplierForSkill(
  type: SkillType,
  z: ZoneInfo,
  aw: AwarenessContext,
): number {
  const b = biasFor(z);
  let m = 1.0;
  if (type === 'SHOOT') m += b.shoot ?? 0;
  if (type === 'DRIBBLE') m += b.dribble ?? 0;
  if (type === 'CROSS') m += b.cross ?? 0;
  if (isHalfspace(z)) m += (b.halfspace ?? 0) * 0.5;
  if (aw.pressureLevel < 0.3) m += 0.15;
  if (aw.pressureLevel > 0.7) m -= 0.25;
  return Math.max(0.1, m);
}
