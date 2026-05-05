import type { ZoneConstraint } from '../../core/AgentTypes';

// LB: left fullback, medium roam, overlaps wide when attacking.
export const LB_ZONE: ZoneConstraint = {
  baseZone: { x: 22, y: 15 },
  maxRoam: 28,
  bias: 'balanced',
};
