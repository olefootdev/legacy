import type { ZoneConstraint } from '../../core/AgentTypes';

// CB_R: right center back, mirror of CB_L.
export const CB_RIGHT_ZONE: ZoneConstraint = {
  baseZone: { x: 20, y: 65 },
  maxRoam: 15,
  bias: 'defensive',
};
