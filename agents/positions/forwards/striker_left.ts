import type { ZoneConstraint } from '../../core/AgentTypes';

// ST_L: left striker, high roam, offensive bias, hunts goal.
export const ST_LEFT_ZONE: ZoneConstraint = {
  baseZone: { x: 70, y: 38 },
  maxRoam: 35,
  bias: 'offensive',
};
