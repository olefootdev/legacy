import type { ZoneConstraint } from '../../core/AgentTypes';

// CM_L: left center mid, box-to-box, balanced.
export const CM_LEFT_ZONE: ZoneConstraint = {
  baseZone: { x: 44, y: 38 },
  maxRoam: 32,
  bias: 'balanced',
};
