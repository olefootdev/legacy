import type { ZoneConstraint } from '../../core/AgentTypes';

// ST_R: right striker, mirror of ST_L.
export const ST_RIGHT_ZONE: ZoneConstraint = {
  baseZone: { x: 70, y: 62 },
  maxRoam: 35,
  bias: 'offensive',
};
