/**
 * 4.8 — Tactical Adaptation
 * Intra-match adaptation: tracks possession loss zones and adjusts shape anchors.
 */

export interface ZoneLossRecord {
  zone: string; // e.g. 'left_flank', 'center', 'right_flank'
  count: number;
  lastAt: number; // simTime
}

export interface TacticalAdaptationState {
  side: 'home' | 'away';
  zoneLosses: ZoneLossRecord[];
  /** Anchor adjustment to add to ShapeModifiers */
  anchorAdjustment: { widthMod: number; depthMod: number };
}

export function createTacticalAdaptationState(
  side: 'home' | 'away',
): TacticalAdaptationState {
  return {
    side,
    zoneLosses: [],
    anchorAdjustment: { widthMod: 0, depthMod: 0 },
  };
}

export function recordPossessionLoss(
  state: TacticalAdaptationState,
  zone: string,
  simTime: number,
): void {
  const existing = state.zoneLosses.find((r) => r.zone === zone);
  if (existing) {
    existing.count += 1;
    existing.lastAt = simTime;
  } else {
    state.zoneLosses.push({ zone, count: 1, lastAt: simTime });
  }
}

/**
 * Recomputes anchorAdjustment based on zone loss patterns.
 * Called approximately every 30s of simulated time.
 *
 * Logic:
 * - Losing possession on flanks → narrow width (compress flanks)
 * - Losing possession in center → push depth back (more compact)
 * - Losing on left flank more than right → shift anchor right (and vice versa)
 */
export function recomputeAnchorAdjustment(
  state: TacticalAdaptationState,
): void {
  const losses = state.zoneLosses;

  if (losses.length === 0) {
    state.anchorAdjustment = { widthMod: 0, depthMod: 0 };
    return;
  }

  const totalLosses = losses.reduce((sum, r) => sum + r.count, 0);

  const leftFlank = losses.find((r) => r.zone === 'left_flank')?.count ?? 0;
  const rightFlank = losses.find((r) => r.zone === 'right_flank')?.count ?? 0;
  const center = losses.find((r) => r.zone === 'center')?.count ?? 0;
  const flankTotal = leftFlank + rightFlank;

  // Width modifier: high flank losses → narrow (-ve = narrower)
  const flankRatio = totalLosses > 0 ? flankTotal / totalLosses : 0;
  const widthMod = flankRatio > 0.5 ? -(flankRatio - 0.5) * 0.3 : 0;

  // Depth modifier: high center losses → push back (-ve = deeper)
  const centerRatio = totalLosses > 0 ? center / totalLosses : 0;
  const depthMod = centerRatio > 0.4 ? -(centerRatio - 0.4) * 0.25 : 0;

  // Clamp adjustments to reasonable range
  state.anchorAdjustment = {
    widthMod: Math.max(-0.15, Math.min(0.1, widthMod)),
    depthMod: Math.max(-0.15, Math.min(0.1, depthMod)),
  };
}
