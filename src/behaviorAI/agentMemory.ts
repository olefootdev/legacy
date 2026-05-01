/**
 * 4.1 — Agent Short Memory
 * Tracks duel outcomes per agent to modulate aggression and marking distance.
 */

export interface DuelMemoryEntry {
  opponentId: string;
  outcome: 'won' | 'lost';
  simTime: number;
}

export interface AgentShortMemory {
  playerId: string;
  /** Last 5 times this agent was dribbled past */
  dribbledBy: DuelMemoryEntry[];
  /** Last 5 successful dribbles by this agent */
  successfulDribbles: DuelMemoryEntry[];
  /** Entries older than ttlSeconds are pruned */
  ttlSeconds: number;
}

const MAX_ENTRIES = 5;

export function createAgentShortMemory(
  playerId: string,
  ttlSeconds = 120,
): AgentShortMemory {
  return {
    playerId,
    dribbledBy: [],
    successfulDribbles: [],
    ttlSeconds,
  };
}

export function recordDribbledBy(
  mem: AgentShortMemory,
  opponentId: string,
  simTime: number,
): void {
  mem.dribbledBy.push({ opponentId, outcome: 'lost', simTime });
  if (mem.dribbledBy.length > MAX_ENTRIES) {
    mem.dribbledBy.shift();
  }
}

export function recordSuccessfulDribble(
  mem: AgentShortMemory,
  opponentId: string,
  simTime: number,
): void {
  mem.successfulDribbles.push({ opponentId, outcome: 'won', simTime });
  if (mem.successfulDribbles.length > MAX_ENTRIES) {
    mem.successfulDribbles.shift();
  }
}

export function pruneExpiredEntries(
  mem: AgentShortMemory,
  simTime: number,
): void {
  const cutoff = simTime - mem.ttlSeconds;
  mem.dribbledBy = mem.dribbledBy.filter((e) => e.simTime >= cutoff);
  mem.successfulDribbles = mem.successfulDribbles.filter(
    (e) => e.simTime >= cutoff,
  );
}

/**
 * Returns aggression and marking distance modifiers based on duel history.
 * Being dribbled 3+ times by the same opponent → -0.3 aggression, +2m marking distance.
 */
export function getDuelMemoryModifiers(
  mem: AgentShortMemory,
  opponentId: string,
  simTime: number,
): { aggressionMod: number; markingDistanceMod: number } {
  pruneExpiredEntries(mem, simTime);

  const timesBeaten = mem.dribbledBy.filter(
    (e) => e.opponentId === opponentId,
  ).length;

  const timesWon = mem.successfulDribbles.filter(
    (e) => e.opponentId === opponentId,
  ).length;

  // Each time beaten reduces aggression; each win restores some
  const aggressionMod = Math.max(
    -0.5,
    Math.min(0.2, timesWon * 0.1 - timesBeaten * 0.1),
  );

  // 3+ times beaten → +2m marking distance (back off)
  const markingDistanceMod = timesBeaten >= 3 ? 2.0 : timesBeaten * 0.5;

  return { aggressionMod, markingDistanceMod };
}
