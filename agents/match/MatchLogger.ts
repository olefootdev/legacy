/**
 * /agents/match/MatchLogger.ts
 *
 * Centralized ring-buffer logger for all agent decisions per tick.
 * Captures perception inputs, intention, action, zone, field query, and skill.
 *
 * Usage:
 *   MatchLogger.getInstance().record(snapshot)       — called inside tickAgent()
 *   MatchLogger.getInstance().dump(agentId)          — last N ticks for one agent
 *   MatchLogger.getInstance().dumpTick(tick)         — all agents at a given tick
 *   MatchLogger.getInstance().dumpAll()              — everything (use sparingly)
 *   MatchLogger.getInstance().getSnapshots(agentId)  — raw data for tests/overlays
 *
 * AP-RULES.md: no UI, no GameSpirit calls, no external side effects.
 */

import type { Vec2, Intention, ActionType, PositionId } from '../core/AgentTypes';
import type { GamePhase, PressurePriority } from './MatchFieldContext';

// ── Snapshot: one tick of one agent ──────────────────────────────────────────

export interface AgentTickSnapshot {
  tick: number;
  agentId: string;
  position: PositionId;

  // Inputs
  ownPos: Vec2;
  ballPos: Vec2;
  distToBall: number;
  distToGoal: number;
  teamHasBall: boolean;
  hasBall: boolean;
  stamina: number;
  confidence: number;

  // Decision
  intention: Intention;
  actionType: ActionType;
  actionTarget: Vec2 | undefined;
  skillFired: string | null;

  // Field context
  zoneId: string;
  phase: GamePhase | null;
  isOutOfPosition: boolean;
  shouldIgnoreBall: boolean;
  pressurePriority: PressurePriority | null;
  recoveryTarget: Vec2 | null;

  // Territory validation
  targetAdjusted: boolean;
}

// ── Ring buffer ───────────────────────────────────────────────────────────────

const BUFFER_SIZE = 100;

class RingBuffer {
  private buf: AgentTickSnapshot[] = [];
  private head = 0;
  private count = 0;

  push(s: AgentTickSnapshot): void {
    this.buf[this.head] = s;
    this.head = (this.head + 1) % BUFFER_SIZE;
    if (this.count < BUFFER_SIZE) this.count++;
  }

  toArray(): AgentTickSnapshot[] {
    if (this.count < BUFFER_SIZE) return this.buf.slice(0, this.count);
    return [...this.buf.slice(this.head), ...this.buf.slice(0, this.head)];
  }

  last(n: number): AgentTickSnapshot[] {
    const all = this.toArray();
    return all.slice(Math.max(0, all.length - n));
  }
}

// ── MatchLogger singleton ─────────────────────────────────────────────────────

export class MatchLogger {
  private static _instance: MatchLogger | null = null;
  private buffers = new Map<string, RingBuffer>();
  private enabled = true;

  static getInstance(): MatchLogger {
    if (!MatchLogger._instance) MatchLogger._instance = new MatchLogger();
    return MatchLogger._instance;
  }

  static reset(): void {
    MatchLogger._instance = null;
  }

  enable():  void { this.enabled = true; }
  disable(): void { this.enabled = false; }

  record(snapshot: AgentTickSnapshot): void {
    if (!this.enabled) return;
    let buf = this.buffers.get(snapshot.agentId);
    if (!buf) {
      buf = new RingBuffer();
      this.buffers.set(snapshot.agentId, buf);
    }
    buf.push(snapshot);
  }

  dump(agentId: string, last = 20): void {
    const buf = this.buffers.get(agentId);
    if (!buf) { console.warn(`[MatchLogger] no data for agent ${agentId}`); return; }
    console.group(`[MatchLogger] ${agentId} — last ${last} ticks`);
    for (const s of buf.last(last)) this._print(s);
    console.groupEnd();
  }

  dumpTick(tick: number): void {
    console.group(`[MatchLogger] tick ${tick} — all agents`);
    for (const [id, buf] of this.buffers) {
      const snap = buf.toArray().find(s => s.tick === tick);
      if (snap) this._print(snap);
      else console.debug(`  ${id}: no data for tick ${tick}`);
    }
    console.groupEnd();
  }

  dumpAll(): void {
    for (const id of this.buffers.keys()) this.dump(id, BUFFER_SIZE);
  }

  getSnapshots(agentId: string, last = BUFFER_SIZE): AgentTickSnapshot[] {
    return this.buffers.get(agentId)?.last(last) ?? [];
  }

  getAllAtTick(tick: number): AgentTickSnapshot[] {
    const result: AgentTickSnapshot[] = [];
    for (const buf of this.buffers.values()) {
      const snap = buf.toArray().find(s => s.tick === tick);
      if (snap) result.push(snap);
    }
    return result;
  }

  private _print(s: AgentTickSnapshot): void {
    const adj  = s.targetAdjusted ? ' [ADJ]' : '';
    const skill = s.skillFired ? ` skill:${s.skillFired}` : '';
    const oob  = s.isOutOfPosition ? ' OOB' : '';
    const ign  = s.shouldIgnoreBall ? ' IGN_BALL' : '';
    const tgt  = s.actionTarget
      ? `→(${s.actionTarget.x.toFixed(1)},${s.actionTarget.y.toFixed(1)})`
      : '';
    console.debug(
      `  [t${s.tick}] ${s.position.padEnd(5)} ` +
      `pos(${s.ownPos.x.toFixed(1)},${s.ownPos.y.toFixed(1)}) ` +
      `zone:${s.zoneId.padEnd(20)} ` +
      `phase:${(s.phase ?? '?').padEnd(18)} ` +
      `${s.intention.padEnd(14)} → ${s.actionType.padEnd(5)}${tgt}` +
      `${adj}${skill}${oob}${ign} ` +
      `stam:${s.stamina.toFixed(0)} conf:${s.confidence.toFixed(0)}`
    );
  }
}
