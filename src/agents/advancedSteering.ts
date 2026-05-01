/**
 * Advanced steering behaviors for match agents.
 *
 * These are computed as force vectors and blended into the agent's
 * arrive target or velocity, working cooperatively with YUKA's
 * existing steering system.
 *
 * - InterposeSteering: Position between threat and goal (defenders)
 * - OffsetSupportSteering: Run in formation offset from carrier (attackers)
 * - DefensiveLineSteering: Cohesion + alignment for defensive block
 */

export interface SteeringForce {
  fx: number;
  fz: number;
  weight: number;
}

/**
 * Interpose: position the agent on the line between a threat player and
 * the goal they're attacking. Naturally creates shot-blocking positioning.
 */
export function computeInterpose(
  agentX: number,
  agentZ: number,
  threatX: number,
  threatZ: number,
  goalX: number,
  goalZ: number,
): SteeringForce {
  // Ideal position: midpoint between threat and goal, biased toward threat
  const bias = 0.65; // closer to the threat
  const targetX = threatX + (goalX - threatX) * (1 - bias);
  const targetZ = threatZ + (goalZ - threatZ) * (1 - bias);

  const dx = targetX - agentX;
  const dz = targetZ - agentZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) return { fx: 0, fz: 0, weight: 0 };

  return {
    fx: dx / dist,
    fz: dz / dist,
    weight: Math.min(1, dist / 15),
  };
}

/**
 * Offset support: move to a position offset from the carrier.
 * Used by attacking players to provide passing options in formation.
 */
export function computeOffsetSupport(
  agentX: number,
  agentZ: number,
  carrierX: number,
  carrierZ: number,
  offsetX: number,
  offsetZ: number,
): SteeringForce {
  const targetX = carrierX + offsetX;
  const targetZ = carrierZ + offsetZ;

  const dx = targetX - agentX;
  const dz = targetZ - agentZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) return { fx: 0, fz: 0, weight: 0 };

  return {
    fx: dx / dist,
    fz: dz / dist,
    weight: Math.min(1, dist / 20),
  };
}

/**
 * Defensive line cohesion: pulls defenders toward the average line position
 * of the defensive unit, creating a connected line that moves together.
 */
export function computeDefensiveLineCohesion(
  agentX: number,
  agentZ: number,
  linemates: ReadonlyArray<{ x: number; z: number }>,
): SteeringForce {
  if (linemates.length === 0) return { fx: 0, fz: 0, weight: 0 };

  let avgX = 0;
  let avgZ = 0;
  for (const m of linemates) {
    avgX += m.x;
    avgZ += m.z;
  }
  avgX /= linemates.length;
  avgZ /= linemates.length;

  // Only cohesion on X axis (depth alignment) — Z is individual
  const dx = avgX - agentX;
  const dz = (avgZ - agentZ) * 0.15; // minimal lateral pull
  const dist = Math.hypot(dx, dz);
  if (dist < 1.5) return { fx: 0, fz: 0, weight: 0 };

  return {
    fx: dx / dist,
    fz: dz / dist,
    weight: Math.min(0.4, dist / 25),
  };
}

/**
 * Defensive line alignment: match the average velocity direction
 * of the defensive line. Creates the "stepping up/dropping" effect.
 */
export function computeDefensiveLineAlignment(
  agentVx: number,
  agentVz: number,
  linematesVelocities: ReadonlyArray<{ vx: number; vz: number }>,
): SteeringForce {
  if (linematesVelocities.length === 0) return { fx: 0, fz: 0, weight: 0 };

  let avgVx = 0;
  let avgVz = 0;
  for (const v of linematesVelocities) {
    avgVx += v.vx;
    avgVz += v.vz;
  }
  avgVx /= linematesVelocities.length;
  avgVz /= linematesVelocities.length;

  // Force toward average velocity
  const fx = avgVx - agentVx;
  const fz = avgVz - agentVz;
  const mag = Math.hypot(fx, fz);
  if (mag < 0.1) return { fx: 0, fz: 0, weight: 0 };

  return {
    fx: fx / mag,
    fz: fz / mag,
    weight: 0.25,
  };
}

/**
 * Compute role-specific support offset for attacking players.
 * Returns the offset vector relative to the carrier's position.
 */
export function getSupportOffset(
  slotId: string,
  carrierSlotId: string,
  attackDir: 1 | -1,
): { offsetX: number; offsetZ: number } {
  // Overlapping run: lateral runs ahead of carrier
  if ((slotId === 'le' || slotId === 'ld') && carrierSlotId !== slotId) {
    const sideSign = slotId === 'ld' ? 1 : -1;
    return { offsetX: 8 * attackDir, offsetZ: 12 * sideSign };
  }

  // Striker near-post run
  if (slotId === 'ata') {
    return { offsetX: 12 * attackDir, offsetZ: 0 };
  }

  // Winger cutting inside
  if (slotId === 'pe' || slotId === 'pd') {
    const sideSign = slotId === 'pd' ? 1 : -1;
    return { offsetX: 6 * attackDir, offsetZ: -8 * sideSign };
  }

  // Midfielder support
  return { offsetX: -5 * attackDir, offsetZ: 0 };
}
