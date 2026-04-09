import type { PressureReading } from './types';

export function computePressureOnCarrier(
  carrierX: number,
  carrierZ: number,
  opponentPositions: { x: number; z: number }[],
): PressureReading {
  let within6 = 0;
  let within12 = 0;
  let closest = 1e9;
  for (const o of opponentPositions) {
    const d = Math.hypot(o.x - carrierX, o.z - carrierZ);
    if (d < closest) closest = d;
    if (d <= 6) within6++;
    if (d <= 12) within12++;
  }
  if (closest > 1e8) closest = 30;
  const intensity = Math.min(
    1,
    within6 * 0.22 + within12 * 0.06 + Math.max(0, (14 - closest) / 14) * 0.35,
  );
  return {
    opponentsWithin6m: within6,
    opponentsWithin12m: within12,
    closestOpponentM: closest,
    intensity,
  };
}
