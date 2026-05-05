import type { ZoneConstraint } from '../../core/AgentTypes';

// GK: anchored to goal line, minimal roam, pure defensive bias.
// Base: x=3 (near home goal), y=50 (center width)
export const GK_ZONE: ZoneConstraint = {
  baseZone: { x: 3, y: 50 },
  maxRoam: 8,
  bias: 'defensive',
};
