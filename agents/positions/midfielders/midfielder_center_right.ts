import type { ZoneConstraint } from '../../core/AgentTypes';

// CM_R: right center mid, mirror of CM_L.
export const CM_RIGHT_ZONE: ZoneConstraint = {
  baseZone: { x: 44, y: 62 },
  maxRoam: 32,
  bias: 'balanced',
};
