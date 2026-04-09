import type { ContextReading } from '@/playerDecision/types';
import type { DecisionContext } from '@/playerDecision/types';
import { getZoneTags, type TeamSide } from '@/match/fieldZones';
import { SHOOT_MAX_DIST_TO_GOAL_M, SHOOT_MIN_ZONE_TAGS } from '@/match/shootDecisionTuning';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';

/** Candidato a remate: último terço / área ou perto do golo; não goleiro. */
export function isShootMinEligible(
  self: AgentSnapshot,
  reading: ContextReading,
  ctx: Pick<DecisionContext, 'clockHalf'>,
): boolean {
  if (self.role === 'gk' || self.slotId === 'gol') return false;
  const half = ctx.clockHalf ?? 1;
  const tags = getZoneTags({ x: self.x, z: self.z }, { team: self.side as TeamSide, half });
  const inZone = SHOOT_MIN_ZONE_TAGS.some((t) => tags.includes(t));
  if (inZone) return true;
  if (reading.distToGoal <= SHOOT_MAX_DIST_TO_GOAL_M && reading.fieldZone !== 'own_box' && reading.fieldZone !== 'def_third') {
    return true;
  }
  return false;
}

/** Remate “duro” permitido sem canShoot estrito (resolver trata miss/save). */
export function isShootResolverEligible(
  self: AgentSnapshot,
  reading: ContextReading,
  ctx: Pick<DecisionContext, 'clockHalf' | 'shootBudgetForce' | 'offensiveStallShotBoost'>,
): boolean {
  if (!isShootMinEligible(self, reading, ctx)) return false;
  if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third') return false;
  if (ctx.shootBudgetForce || ctx.offensiveStallShotBoost) return true;
  if (reading.distToGoal <= SHOOT_MAX_DIST_TO_GOAL_M) return true;
  return false;
}

export function shouldCountShootCandidate(self: AgentSnapshot, reading: ContextReading, ctx: Pick<DecisionContext, 'clockHalf'>): boolean {
  return isShootMinEligible(self, reading, ctx) && self.role !== 'gk' && self.slotId !== 'gol';
}
