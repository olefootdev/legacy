/**
 * Lightweight spatial memory for match agents.
 *
 * Players remember where opponents and teammates were for a short TTL,
 * even after they leave the visual cone. Positions are projected forward
 * using the last observed velocity, decaying in confidence over time.
 *
 * Works with the awareness system: focal/peripheral players update memory,
 * blind-spot players do NOT — memory decays naturally until they're seen again.
 */

export interface SpatialMemoryRecord {
  entityId: string;
  team: 'home' | 'away';
  lastSeenX: number;
  lastSeenZ: number;
  lastSeenAt: number;
  velocityX: number;
  velocityZ: number;
  role: string;
}

export class SpatialMemory {
  private records = new Map<string, SpatialMemoryRecord>();
  private readonly ttlMs: number;

  constructor(ttlMs = 3000) {
    this.ttlMs = ttlMs;
  }

  update(
    players: ReadonlyArray<{
      playerId: string;
      team: 'home' | 'away';
      x: number;
      y: number;
      vx?: number;
      vy?: number;
      role?: string;
    }>,
    nowMs: number,
  ): void {
    for (const p of players) {
      this.records.set(p.playerId, {
        entityId: p.playerId,
        team: p.team,
        lastSeenX: p.x,
        lastSeenZ: p.y,
        lastSeenAt: nowMs,
        velocityX: p.vx ?? 0,
        velocityZ: p.vy ?? 0,
        role: p.role ?? '',
      });
    }
  }

  recall(id: string, nowMs: number): SpatialMemoryRecord | null {
    const r = this.records.get(id);
    if (!r || nowMs - r.lastSeenAt > this.ttlMs) return null;
    const dtSec = (nowMs - r.lastSeenAt) / 1000;
    return {
      ...r,
      lastSeenX: r.lastSeenX + r.velocityX * dtSec,
      lastSeenZ: r.lastSeenZ + r.velocityZ * dtSec,
    };
  }

  recallAll(nowMs: number): SpatialMemoryRecord[] {
    const result: SpatialMemoryRecord[] = [];
    for (const r of this.records.values()) {
      if (nowMs - r.lastSeenAt > this.ttlMs) continue;
      const dtSec = (nowMs - r.lastSeenAt) / 1000;
      result.push({
        ...r,
        lastSeenX: r.lastSeenX + r.velocityX * dtSec,
        lastSeenZ: r.lastSeenZ + r.velocityZ * dtSec,
      });
    }
    return result;
  }

  recallOpponents(myTeam: 'home' | 'away', nowMs: number): SpatialMemoryRecord[] {
    return this.recallAll(nowMs).filter(r => r.team !== myTeam);
  }

  recallTeammates(myTeam: 'home' | 'away', nowMs: number): SpatialMemoryRecord[] {
    return this.recallAll(nowMs).filter(r => r.team === myTeam);
  }

  /** Memory age as confidence factor 1.0 (just seen) → 0.0 (expired). */
  confidence(id: string, nowMs: number): number {
    const r = this.records.get(id);
    if (!r) return 0;
    const age = nowMs - r.lastSeenAt;
    if (age > this.ttlMs) return 0;
    return 1 - age / this.ttlMs;
  }

  forget(id: string): void {
    this.records.delete(id);
  }

  clear(): void {
    this.records.clear();
  }
}
