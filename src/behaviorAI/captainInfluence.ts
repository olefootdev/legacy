/**
 * 4.9 — Captain Influence
 * Invisible communication: captain alters nearby teammates' behavior.
 */

export interface CaptainInfluenceState {
  captainId: string;
  /** Influence radius in meters */
  influenceRadius: number;
  /** Defensive line boost in meters */
  defensiveLineBoost: number;
  /** Pressing intensity boost (0-100) */
  pressingBoost: number;
}

export function createCaptainInfluenceState(
  captainId: string,
): CaptainInfluenceState {
  return {
    captainId,
    influenceRadius: 15,
    defensiveLineBoost: 3,
    pressingBoost: 12,
  };
}

/**
 * Returns IDs of agents within the captain's influence radius.
 */
export function getInfluencedAgents(
  captainX: number,
  captainZ: number,
  agents: Array<{ id: string; x: number; z: number }>,
  influenceRadius: number,
): string[] {
  const influenced: string[] = [];
  const radiusSq = influenceRadius * influenceRadius;

  for (const agent of agents) {
    const dx = agent.x - captainX;
    const dz = agent.z - captainZ;
    if (dx * dx + dz * dz <= radiusSq) {
      influenced.push(agent.id);
    }
  }

  return influenced;
}

/**
 * Applies captain influence: returns modifiers for each influenced agent.
 * Influence falls off linearly with distance.
 */
export function applyCaptainInfluence(
  state: CaptainInfluenceState,
  captainX: number,
  captainZ: number,
  agents: Array<{ id: string; x: number; z: number }>,
): Map<string, { defensiveLineBoost: number; pressingBoost: number }> {
  const result = new Map<
    string,
    { defensiveLineBoost: number; pressingBoost: number }
  >();

  for (const agent of agents) {
    if (agent.id === state.captainId) continue;

    const dx = agent.x - captainX;
    const dz = agent.z - captainZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > state.influenceRadius) continue;

    // Linear falloff: full influence at 0m, zero at influenceRadius
    const falloff = 1 - dist / state.influenceRadius;

    result.set(agent.id, {
      defensiveLineBoost: state.defensiveLineBoost * falloff,
      pressingBoost: state.pressingBoost * falloff,
    });
  }

  return result;
}
