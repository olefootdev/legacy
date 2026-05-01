/**
 * Gera waypoints em curva para um atacante correr sem ir em linha reta.
 * Evita impedimento e cria ângulo de recepção melhor.
 *
 * Retorna array de 2-3 waypoints intermediários entre player e target.
 * O caller usa o primeiro waypoint como steering target.
 */
export function computeBendingRunWaypoints(
  playerX: number,
  playerZ: number,
  targetX: number,
  targetZ: number,
  defensiveLine: number,
  attackDir: 1 | -1,
  fieldWidth = 68,
): Array<{ x: number; z: number }> {
  const waypoints: Array<{ x: number; z: number }> = [];

  // Midpoint between player and target
  const midX = (playerX + targetX) / 2;
  const midZ = (playerZ + targetZ) / 2;

  // Perpendicular offset to create the curve
  // Direction vector player→target
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const len = Math.hypot(dx, dz);

  if (len < 1e-6) {
    // Degenerate: player already at target
    return [{ x: targetX, z: targetZ }];
  }

  // Perpendicular unit vector (rotate 90°)
  const perpX = -dz / len;
  const perpZ = dx / len;

  // Curve magnitude: ~15% of run length, biased toward center of field
  const curveMag = len * 0.15;

  // Bias toward field center (z = fieldWidth/2) to open up angle
  const fieldCenter = fieldWidth / 2;
  const sideSign = midZ < fieldCenter ? 1 : -1;

  // First waypoint: curved outward from direct line
  const wp1X = midX + perpX * curveMag * sideSign;
  const wp1Z = midZ + perpZ * curveMag * sideSign;

  // Clamp to field
  const clampedWp1Z = Math.max(2, Math.min(fieldWidth - 2, wp1Z));

  // Offside check: ensure waypoint doesn't cross defensive line
  let clampedWp1X = wp1X;
  if (attackDir === 1) {
    // Attacker must stay behind (≤) defensive line
    clampedWp1X = Math.min(wp1X, defensiveLine - 0.5);
  } else {
    // Attacker must stay ahead (≥) defensive line
    clampedWp1X = Math.max(wp1X, defensiveLine + 0.5);
  }

  waypoints.push({ x: clampedWp1X, z: clampedWp1Z });

  // Second waypoint: 75% of the way to target, slightly inside
  const wp2X = playerX + dx * 0.75;
  const wp2Z = playerZ + dz * 0.75;

  // Offside check for second waypoint
  let clampedWp2X = wp2X;
  if (attackDir === 1) {
    clampedWp2X = Math.min(wp2X, defensiveLine - 0.5);
  } else {
    clampedWp2X = Math.max(wp2X, defensiveLine + 0.5);
  }

  const clampedWp2Z = Math.max(2, Math.min(fieldWidth - 2, wp2Z));
  waypoints.push({ x: clampedWp2X, z: clampedWp2Z });

  // Third waypoint: the target itself (clamped for offside)
  let finalX = targetX;
  if (attackDir === 1) {
    finalX = Math.min(targetX, defensiveLine - 0.5);
  } else {
    finalX = Math.max(targetX, defensiveLine + 0.5);
  }
  const finalZ = Math.max(2, Math.min(fieldWidth - 2, targetZ));
  waypoints.push({ x: finalX, z: finalZ });

  return waypoints;
}
