import type { ZoneConstraint } from '../../core/AgentTypes';

// RM: right midfielder, wide, mirror of LM.
export const RM_ZONE: ZoneConstraint = {
  baseZone: { x: 44, y: 85 },
  maxRoam: 30,
  bias: 'balanced',
};
