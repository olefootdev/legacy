/**
 * /agents/fieldKnowledge/FieldZones.ts
 *
 * Named coordinate zones derived from real field geometry.
 * All values are normalized (0–100).
 *
 * COORDINATE SYSTEM — matches /agents/positions/* (source of truth):
 *   x: 0=home goal → 100=away goal   (depth / attacking direction)
 *   y: 0=left edge → 100=right edge  (width)
 *
 * Home team attacks toward x=100.
 *
 * Horizontal thirds (x-axis, depth):
 *   Defensive third:  x  0 → 33
 *   Middle third:     x 33 → 66
 *   Attacking third:  x 66 → 100
 *
 * Vertical corridors (y-axis, width):
 *   Left corridor:       y  0 → 25
 *   Left half-space:     y 25 → 40
 *   Central corridor:    y 40 → 60
 *   Right half-space:    y 60 → 75
 *   Right corridor:      y 75 → 100
 *
 * Penalty areas (IFAB-derived):
 *   N_BOX_DEPTH  ≈ 15.71  (16.5m / 105m × 100)
 *   N_BOX_HALF_W ≈ 14.82  (20.16m / 68m × 50)
 *   Own box:  x 0 → N_BOX_DEPTH,  y (50-N_BOX_HALF_W) → (50+N_BOX_HALF_W)
 *   Opp box:  x (100-N_BOX_DEPTH) → 100, same y range
 */

import {
  N_BOX_DEPTH,
  N_BOX_HALF_W,
} from '../../src/tactical/fieldGeometry';
import type { FieldZone } from './FieldKnowledge';

// ── Thresholds ────────────────────────────────────────────────────────────────

// Depth (x) thirds
const DEF_THIRD_X_MAX = 33;
const MID_THIRD_X_MIN = 33;
const MID_THIRD_X_MAX = 66;
const ATT_THIRD_X_MIN = 66;

// Width (y) corridors
const LEFT_CORR_Y_MAX  = 25;
const LEFT_HS_Y_MIN    = 25;
const LEFT_HS_Y_MAX    = 40;
const CENTRAL_Y_MIN    = 40;
const CENTRAL_Y_MAX    = 60;
const RIGHT_HS_Y_MIN   = 60;
const RIGHT_HS_Y_MAX   = 75;
const RIGHT_CORR_Y_MIN = 75;

// Penalty box (IFAB-derived)
const BOX_Y_MIN     = 50 - N_BOX_HALF_W;   // ≈ 35.18
const BOX_Y_MAX     = 50 + N_BOX_HALF_W;   // ≈ 64.82
const OWN_BOX_X_MAX = N_BOX_DEPTH;         // ≈ 15.71
const OPP_BOX_X_MIN = 100 - N_BOX_DEPTH;   // ≈ 84.29

// ── Zone factory ──────────────────────────────────────────────────────────────

function zone(
  id: string, name: string,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
): FieldZone {
  return {
    id, name, xMin, xMax, yMin, yMax,
    center: { x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 },
  };
}

// ── Zone catalog ──────────────────────────────────────────────────────────────

export const FIELD_ZONES: Record<string, FieldZone> = {

  OWN_BOX: zone('OWN_BOX', 'Own Penalty Box',
    0, OWN_BOX_X_MAX, BOX_Y_MIN, BOX_Y_MAX),

  OWN_LEFT_FLANK: zone('OWN_LEFT_FLANK', 'Defensive Left Flank',
    0, DEF_THIRD_X_MAX, 0, LEFT_CORR_Y_MAX),

  OWN_LEFT_HALFSPACE: zone('OWN_LEFT_HALFSPACE', 'Defensive Left Half-Space',
    0, DEF_THIRD_X_MAX, LEFT_HS_Y_MIN, LEFT_HS_Y_MAX),

  OWN_CENTER: zone('OWN_CENTER', 'Defensive Center',
    0, DEF_THIRD_X_MAX, CENTRAL_Y_MIN, CENTRAL_Y_MAX),

  OWN_RIGHT_HALFSPACE: zone('OWN_RIGHT_HALFSPACE', 'Defensive Right Half-Space',
    0, DEF_THIRD_X_MAX, RIGHT_HS_Y_MIN, RIGHT_HS_Y_MAX),

  OWN_RIGHT_FLANK: zone('OWN_RIGHT_FLANK', 'Defensive Right Flank',
    0, DEF_THIRD_X_MAX, RIGHT_CORR_Y_MIN, 100),

  MID_LEFT_FLANK: zone('MID_LEFT_FLANK', 'Middle Left Flank',
    MID_THIRD_X_MIN, MID_THIRD_X_MAX, 0, LEFT_CORR_Y_MAX),

  MID_LEFT_HALFSPACE: zone('MID_LEFT_HALFSPACE', 'Middle Left Half-Space',
    MID_THIRD_X_MIN, MID_THIRD_X_MAX, LEFT_HS_Y_MIN, LEFT_HS_Y_MAX),

  MID_CENTER: zone('MID_CENTER', 'Middle Center',
    MID_THIRD_X_MIN, MID_THIRD_X_MAX, CENTRAL_Y_MIN, CENTRAL_Y_MAX),

  MID_RIGHT_HALFSPACE: zone('MID_RIGHT_HALFSPACE', 'Middle Right Half-Space',
    MID_THIRD_X_MIN, MID_THIRD_X_MAX, RIGHT_HS_Y_MIN, RIGHT_HS_Y_MAX),

  MID_RIGHT_FLANK: zone('MID_RIGHT_FLANK', 'Middle Right Flank',
    MID_THIRD_X_MIN, MID_THIRD_X_MAX, RIGHT_CORR_Y_MIN, 100),

  ATT_LEFT_FLANK: zone('ATT_LEFT_FLANK', 'Attacking Left Flank',
    ATT_THIRD_X_MIN, 100, 0, LEFT_CORR_Y_MAX),

  ATT_LEFT_HALFSPACE: zone('ATT_LEFT_HALFSPACE', 'Attacking Left Half-Space',
    ATT_THIRD_X_MIN, 100, LEFT_HS_Y_MIN, LEFT_HS_Y_MAX),

  ATT_CENTER: zone('ATT_CENTER', 'Attacking Center',
    ATT_THIRD_X_MIN, 100, CENTRAL_Y_MIN, CENTRAL_Y_MAX),

  ATT_RIGHT_HALFSPACE: zone('ATT_RIGHT_HALFSPACE', 'Attacking Right Half-Space',
    ATT_THIRD_X_MIN, 100, RIGHT_HS_Y_MIN, RIGHT_HS_Y_MAX),

  ATT_RIGHT_FLANK: zone('ATT_RIGHT_FLANK', 'Attacking Right Flank',
    ATT_THIRD_X_MIN, 100, RIGHT_CORR_Y_MIN, 100),

  OPPONENT_BOX: zone('OPPONENT_BOX', 'Opponent Penalty Box',
    OPP_BOX_X_MIN, 100, BOX_Y_MIN, BOX_Y_MAX),
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns the zone id for a point.
 * x=depth (0=home goal, 100=away goal), y=width (0=left, 100=right)
 */
export function getZoneIdForPoint(x: number, y: number): string {
  // Penalty boxes first
  if (y >= BOX_Y_MIN && y <= BOX_Y_MAX) {
    if (x <= OWN_BOX_X_MAX) return 'OWN_BOX';
    if (x >= OPP_BOX_X_MIN) return 'OPPONENT_BOX';
  }

  const third = x < DEF_THIRD_X_MAX ? 'OWN'
              : x < ATT_THIRD_X_MIN  ? 'MID'
              : 'ATT';

  const corridor = y < LEFT_CORR_Y_MAX  ? 'LEFT_FLANK'
                 : y < LEFT_HS_Y_MAX    ? 'LEFT_HALFSPACE'
                 : y < CENTRAL_Y_MAX    ? 'CENTER'
                 : y < RIGHT_HS_Y_MAX   ? 'RIGHT_HALFSPACE'
                 : 'RIGHT_FLANK';

  return `${third}_${corridor}`;
}

export function getZone(id: string): FieldZone | undefined {
  return FIELD_ZONES[id];
}

export function isPointInZone(x: number, y: number, zoneId: string): boolean {
  const z = FIELD_ZONES[zoneId];
  if (!z) return false;
  return x >= z.xMin && x <= z.xMax && y >= z.yMin && y <= z.yMax;
}
