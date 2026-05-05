/**
 * /agents/fieldKnowledge/PositionTerritories.ts
 *
 * Territory definitions for all 11 positions in a 4-4-2.
 *
 * COORDINATE SYSTEM (matches /agents/positions/*):
 *   x: 0=home goal → 100=away goal  (depth)
 *   y: 0=left edge → 100=right edge (width)
 *
 * Home team attacks toward x=100.
 * Away territories are y-mirrored by FieldKnowledgeLoader.
 *
 * recoveryPoint: where the player returns when out of position.
 * softBoundaryRadius: how far outside primary zone before forced recovery.
 */

import type { PositionTerritory } from './FieldKnowledge';
import type { PositionId } from '../core/AgentTypes';

const TERRITORIES_HOME: Record<PositionId, PositionTerritory> = {

  GK: {
    positionId: 'GK',
    primaryZoneIds:  ['OWN_BOX'],
    supportZoneIds:  ['OWN_CENTER', 'OWN_LEFT_HALFSPACE', 'OWN_RIGHT_HALFSPACE'],
    forbiddenZoneIds: [
      'MID_LEFT_FLANK','MID_LEFT_HALFSPACE','MID_CENTER',
      'MID_RIGHT_HALFSPACE','MID_RIGHT_FLANK',
      'ATT_LEFT_FLANK','ATT_LEFT_HALFSPACE','ATT_CENTER',
      'ATT_RIGHT_HALFSPACE','ATT_RIGHT_FLANK','OPPONENT_BOX',
    ],
    recoveryPoint: { x: 3, y: 50 },
    softBoundaryRadius: 8,
  },

  LB: {
    positionId: 'LB',
    primaryZoneIds:  ['OWN_LEFT_FLANK'],
    supportZoneIds:  ['MID_LEFT_FLANK', 'ATT_LEFT_FLANK', 'OWN_LEFT_HALFSPACE'],
    forbiddenZoneIds: [
      'OWN_RIGHT_FLANK','OWN_RIGHT_HALFSPACE',
      'MID_RIGHT_FLANK','MID_RIGHT_HALFSPACE',
      'ATT_RIGHT_FLANK','ATT_RIGHT_HALFSPACE',
      'ATT_CENTER','OPPONENT_BOX',
    ],
    recoveryPoint: { x: 22, y: 15 },
    softBoundaryRadius: 28,
  },

  CB_L: {
    positionId: 'CB_L',
    primaryZoneIds:  ['OWN_LEFT_HALFSPACE', 'OWN_CENTER', 'OWN_BOX'],
    supportZoneIds:  ['MID_LEFT_HALFSPACE'],
    forbiddenZoneIds: [
      'ATT_LEFT_FLANK','ATT_LEFT_HALFSPACE','ATT_CENTER',
      'ATT_RIGHT_HALFSPACE','ATT_RIGHT_FLANK','OPPONENT_BOX',
      'MID_CENTER','MID_RIGHT_HALFSPACE','MID_RIGHT_FLANK',
    ],
    recoveryPoint: { x: 20, y: 35 },
    softBoundaryRadius: 15,
  },

  CB_R: {
    positionId: 'CB_R',
    primaryZoneIds:  ['OWN_RIGHT_HALFSPACE', 'OWN_CENTER', 'OWN_BOX'],
    supportZoneIds:  ['MID_RIGHT_HALFSPACE'],
    forbiddenZoneIds: [
      'ATT_LEFT_FLANK','ATT_LEFT_HALFSPACE','ATT_CENTER',
      'ATT_RIGHT_HALFSPACE','ATT_RIGHT_FLANK','OPPONENT_BOX',
      'MID_CENTER','MID_LEFT_HALFSPACE','MID_LEFT_FLANK',
    ],
    recoveryPoint: { x: 20, y: 65 },
    softBoundaryRadius: 15,
  },

  RB: {
    positionId: 'RB',
    primaryZoneIds:  ['OWN_RIGHT_FLANK'],
    supportZoneIds:  ['MID_RIGHT_FLANK', 'ATT_RIGHT_FLANK', 'OWN_RIGHT_HALFSPACE'],
    forbiddenZoneIds: [
      'OWN_LEFT_FLANK','OWN_LEFT_HALFSPACE',
      'MID_LEFT_FLANK','MID_LEFT_HALFSPACE',
      'ATT_LEFT_FLANK','ATT_LEFT_HALFSPACE',
      'ATT_CENTER','OPPONENT_BOX',
    ],
    recoveryPoint: { x: 22, y: 85 },
    softBoundaryRadius: 28,
  },

  LM: {
    positionId: 'LM',
    primaryZoneIds:  ['MID_LEFT_FLANK'],
    supportZoneIds:  ['OWN_LEFT_FLANK', 'ATT_LEFT_FLANK', 'MID_LEFT_HALFSPACE'],
    forbiddenZoneIds: [
      'OWN_RIGHT_FLANK','OWN_RIGHT_HALFSPACE',
      'MID_RIGHT_FLANK',
      'ATT_RIGHT_FLANK','ATT_RIGHT_HALFSPACE',
    ],
    recoveryPoint: { x: 44, y: 15 },
    softBoundaryRadius: 30,
  },

  CM_L: {
    positionId: 'CM_L',
    primaryZoneIds:  ['MID_LEFT_HALFSPACE', 'MID_CENTER'],
    supportZoneIds:  ['OWN_CENTER', 'OWN_LEFT_HALFSPACE', 'ATT_LEFT_HALFSPACE', 'ATT_CENTER'],
    forbiddenZoneIds: [
      'OWN_LEFT_FLANK','OWN_RIGHT_FLANK',
      'MID_RIGHT_FLANK',
      'ATT_RIGHT_FLANK',
    ],
    recoveryPoint: { x: 44, y: 38 },
    softBoundaryRadius: 32,
  },

  CM_R: {
    positionId: 'CM_R',
    primaryZoneIds:  ['MID_RIGHT_HALFSPACE', 'MID_CENTER'],
    supportZoneIds:  ['OWN_CENTER', 'OWN_RIGHT_HALFSPACE', 'ATT_RIGHT_HALFSPACE', 'ATT_CENTER'],
    forbiddenZoneIds: [
      'OWN_LEFT_FLANK','OWN_RIGHT_FLANK',
      'MID_LEFT_FLANK',
      'ATT_LEFT_FLANK',
    ],
    recoveryPoint: { x: 44, y: 62 },
    softBoundaryRadius: 32,
  },

  RM: {
    positionId: 'RM',
    primaryZoneIds:  ['MID_RIGHT_FLANK'],
    supportZoneIds:  ['OWN_RIGHT_FLANK', 'ATT_RIGHT_FLANK', 'MID_RIGHT_HALFSPACE'],
    forbiddenZoneIds: [
      'OWN_LEFT_FLANK','OWN_LEFT_HALFSPACE',
      'MID_LEFT_FLANK',
      'ATT_LEFT_FLANK','ATT_LEFT_HALFSPACE',
    ],
    recoveryPoint: { x: 44, y: 85 },
    softBoundaryRadius: 30,
  },

  ST_L: {
    positionId: 'ST_L',
    primaryZoneIds:  ['ATT_LEFT_HALFSPACE', 'ATT_CENTER', 'OPPONENT_BOX'],
    supportZoneIds:  ['MID_LEFT_HALFSPACE', 'MID_CENTER', 'ATT_LEFT_FLANK'],
    forbiddenZoneIds: [
      'OWN_BOX','OWN_LEFT_FLANK','OWN_LEFT_HALFSPACE',
      'OWN_CENTER','OWN_RIGHT_HALFSPACE','OWN_RIGHT_FLANK',
    ],
    recoveryPoint: { x: 70, y: 38 },
    softBoundaryRadius: 35,
  },

  ST_R: {
    positionId: 'ST_R',
    primaryZoneIds:  ['ATT_RIGHT_HALFSPACE', 'ATT_CENTER', 'OPPONENT_BOX'],
    supportZoneIds:  ['MID_RIGHT_HALFSPACE', 'MID_CENTER', 'ATT_RIGHT_FLANK'],
    forbiddenZoneIds: [
      'OWN_BOX','OWN_LEFT_FLANK','OWN_LEFT_HALFSPACE',
      'OWN_CENTER','OWN_RIGHT_HALFSPACE','OWN_RIGHT_FLANK',
    ],
    recoveryPoint: { x: 70, y: 62 },
    softBoundaryRadius: 35,
  },
};

function mirrorTerritory(t: PositionTerritory): PositionTerritory {
  return {
    ...t,
    // Away team: x is mirrored (attacks toward x=0)
    recoveryPoint: { x: 100 - t.recoveryPoint.x, y: t.recoveryPoint.y },
  };
}

export function getTerritory(positionId: PositionId, side: 'home' | 'away'): PositionTerritory {
  const base = TERRITORIES_HOME[positionId];
  return side === 'home' ? base : mirrorTerritory(base);
}

export { TERRITORIES_HOME };
