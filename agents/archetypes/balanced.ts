import type { ArchetypeId } from '../core/AgentTypes';

// Archetype modifiers shift thresholds and speeds — they never change the
// decision logic itself. All values are multipliers around 1.0 (neutral).
export interface ArchetypeModifiers {
  reachBias:  number; // multiplier on NEAR_BALL threshold
  attackBias: number; // multiplier on CLOSE_TO_GOAL threshold
  speedBias:  number; // multiplier on movement speed
  holdBias:   number; // multiplier on HOLD_POSITION preference (>1 = holds more)
}

const ARCHETYPES: Record<ArchetypeId, ArchetypeModifiers> = {
  defensive:  { reachBias: 0.8, attackBias: 0.7, speedBias: 0.9, holdBias: 1.4 },
  balanced:   { reachBias: 1.0, attackBias: 1.0, speedBias: 1.0, holdBias: 1.0 },
  offensive:  { reachBias: 1.2, attackBias: 1.3, speedBias: 1.1, holdBias: 0.7 },
  aggressive: { reachBias: 1.3, attackBias: 1.2, speedBias: 1.3, holdBias: 0.6 },
};

export function getArchetypeModifiers(id: ArchetypeId): ArchetypeModifiers {
  return ARCHETYPES[id];
}
