import type { ZoneConstraint } from '../../core/AgentTypes';

// RB: right fullback, mirror of LB.
export const RB_ZONE: ZoneConstraint = {
  baseZone: { x: 22, y: 85 },
  maxRoam: 28,
  bias: 'balanced',
};
