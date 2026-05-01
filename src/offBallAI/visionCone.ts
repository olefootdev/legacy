const DEG_TO_RAD = Math.PI / 180;

/**
 * Cone de visão 120° usando dot product.
 * heading: ângulo em radianos da direção que o jogador está olhando.
 * Retorna true se o target está dentro do cone de visão.
 */
export function isInVisionCone(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  targetX: number,
  targetZ: number,
  coneAngleDeg = 120,
): boolean {
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const dist = Math.hypot(dx, dz);

  // Target is at same position — consider it visible
  if (dist < 1e-6) return true;

  // Unit vector toward target
  const tx = dx / dist;
  const tz = dz / dist;

  // Unit vector of player heading (convention: atan2(vx, vz))
  const hx = Math.sin(playerHeading);
  const hz = Math.cos(playerHeading);

  // Dot product = cos(angle between heading and direction to target)
  const dot = hx * tx + hz * tz;

  // Half-angle threshold
  const halfAngleRad = (coneAngleDeg / 2) * DEG_TO_RAD;
  const threshold = Math.cos(halfAngleRad);

  return dot >= threshold;
}

/**
 * Bola atrás do zagueiro = não interceptada até virar.
 * Retorna true se o jogador pode ver/reagir à bola.
 * Uses a fixed 120° cone.
 */
export function canReactToBall(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  ballX: number,
  ballZ: number,
): boolean {
  return isInVisionCone(playerX, playerZ, playerHeading, ballX, ballZ, 120);
}
