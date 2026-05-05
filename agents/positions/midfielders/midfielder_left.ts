import type { ZoneConstraint } from '../../core/AgentTypes';

// LM: left midfielder, wide, medium-high roam, balanced bias.
export const LM_ZONE: ZoneConstraint = {
  baseZone: { x: 44, y: 15 },
  maxRoam: 30,
  bias: 'balanced',
};
