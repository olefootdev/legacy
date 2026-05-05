import type { ZoneConstraint } from '../../core/AgentTypes';

// CB_L: left center back, stays in defensive third, low roam.
export const CB_LEFT_ZONE: ZoneConstraint = {
  baseZone: { x: 20, y: 35 },
  maxRoam: 15,
  bias: 'defensive',
};
