import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { PossessionSide } from '@/engine/types';

/** Seconds until compaction factor fully decays after possession loss. */
export const TRANSITION_COMPACTION_DECAY_SEC = 3;
/** Max normalized shift toward own goal (fraction of distance to goal line). */
export const COMPACTION_SHIFT_MAX = 0.15;
/** Extra pull for players near the central corridor (Z). */
export const CENTRAL_CORRIDOR_COMPACTION_BONUS = 1.3;

/**
 * Pull slot targets toward own goal after losing possession (retorno dinâmico).
 * Mutates and returns the same map for chaining.
 */
export function applyTransitionCompactionToSlots(
  slots: Map<string, { x: number; z: number }>,
  side: PossessionSide,
  factor: number,
): Map<string, { x: number; z: number }> {
  if (factor <= 0.001) return slots;
  const ownGoalX = side === 'home' ? 0 : FIELD_LENGTH;
  const midZ = FIELD_WIDTH / 2;

  for (const [slot, pos] of slots) {
    const central = Math.abs(pos.z - midZ) < 9 ? CENTRAL_CORRIDOR_COMPACTION_BONUS : 1;
    const t = Math.min(1, factor * COMPACTION_SHIFT_MAX * central);
    const nx = pos.x + (ownGoalX - pos.x) * t;
    slots.set(slot, {
      x: Math.min(FIELD_LENGTH - 2, Math.max(2, nx)),
      z: pos.z,
    });
  }
  return slots;
}
