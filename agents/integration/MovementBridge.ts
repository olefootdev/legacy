/**
 * /agents/integration/MovementBridge.ts
 *
 * ÚNICA fonte de movimento de posição dos agentes.
 * PlayerAgent.tickAgent() decide a intenção e o target.
 * Este bridge executa o movimento — nada mais move os agentes.
 *
 * COORDINATE SYSTEM (matches /agents/positions/* and FieldZones.ts):
 *   x: 0=home goal → 100=away goal  (depth)
 *   y: 0=left edge → 100=right edge (width)
 *
 * clampToPitch() usa o sistema legado (x=depth 0–105m, z=width 0–68m).
 * A conversão aqui é: agent.x → world.x, agent.y → world.z
 *
 * Reused from existing engine (NO duplication):
 *   clampToPitch()           — src/tactical/fieldGeometry.ts
 *   FIELD_LENGTH_M           — src/tactical/fieldGeometry.ts
 *   FIELD_WIDTH_M            — src/tactical/fieldGeometry.ts
 *   SPEED_WALK_BASE          — src/match/playerSpeedTuning.ts
 *   SPEED_SPRINT_BASE        — src/match/playerSpeedTuning.ts
 *   fatigueSpeedMultiplier() — src/match/playerSpeedTuning.ts
 *   computeSeparationForces()— src/offBallAI/separationForce.ts
 */

import {
  clampToPitch,
  FIELD_LENGTH_M,
  FIELD_WIDTH_M,
} from '../../src/tactical/fieldGeometry';

import {
  SPEED_WALK_BASE,
  SPEED_SPRINT_BASE,
  fatigueSpeedMultiplier,
} from '../../src/match/playerSpeedTuning';

import { computeSeparationForces } from '../../src/offBallAI/separationForce';
import type { AntiChaosAgent } from '../../src/engine/test2d/antiChaosEngine';
import type { PlayerAgentState } from '../core/PlayerAgent';
import type { Vec2 } from '../core/AgentTypes';

// ── Coordinate conversion ─────────────────────────────────────────────────────
// Agent coords: x=depth(0–100), y=width(0–100)
// World coords: x=depth(0–105m), z=width(0–68m)  ← clampToPitch expects this

function agentToWorld(pos: Vec2): { x: number; z: number } {
  return {
    x: (pos.x / 100) * FIELD_LENGTH_M,  // depth
    z: (pos.y / 100) * FIELD_WIDTH_M,   // width
  };
}

function worldToAgent(x: number, z: number): Vec2 {
  return {
    x: (x / FIELD_LENGTH_M) * 100,  // depth
    y: (z / FIELD_WIDTH_M)  * 100,  // width
  };
}

function clampAgentPos(pos: Vec2): Vec2 {
  const w = agentToWorld(pos);
  const c = clampToPitch(w.x, w.z, 0.5);
  return worldToAgent(c.x, c.z);
}

// ── Speed ─────────────────────────────────────────────────────────────────────
// Visible speed: how many normalized units per tick at 24fps.
// SPEED_WALK_BASE = 7.05 m/s → at 24fps → 0.29 m/frame → 0.28 normalized units
// That's too slow visually. We use a VISUAL_SCALE to make movement perceptible.
// This does NOT change the physics — it only affects the visual representation.

const TICK_SEC      = 1 / 24;
const VISUAL_SCALE  = 3.5;   // makes movement visible at 24fps without teleporting

function computeSpeed(
  actionType: 'MOVE' | 'RUN',
  stamina: number,
  speedBias = 1.0,
): number {
  const stamina01   = Math.max(0, Math.min(1, stamina / 100));
  const fatigueMul  = fatigueSpeedMultiplier(stamina01, 0.7);
  const baseSpeed   = actionType === 'RUN' ? SPEED_SPRINT_BASE : SPEED_WALK_BASE;
  const metersPerTick = baseSpeed * fatigueMul * speedBias * TICK_SEC * VISUAL_SCALE;
  return (metersPerTick / FIELD_LENGTH_M) * 100; // normalized units per tick
}

// ── Core step ─────────────────────────────────────────────────────────────────

function stepToward(from: Vec2, to: Vec2, speed: number): Vec2 {
  const dx   = to.x - from.x;
  const dy   = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.05) return clampAgentPos(from);
  const ratio = Math.min(1, speed / dist);
  return clampAgentPos({
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  });
}

// ── Separation ────────────────────────────────────────────────────────────────

function applySeparation(
  agents: PlayerAgentState[],
): Map<string, Vec2> {
  const antiChaos: AntiChaosAgent[] = agents.map(a => ({
    id: a.id,
    x:  a.currentPosition.x,
    y:  a.currentPosition.y,
  }));
  const forces = computeSeparationForces(antiChaos, 4, 1.2);
  const result = new Map<string, Vec2>();
  for (const [id, f] of forces) {
    result.set(id, { x: f.dx, y: f.dz });
  }
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MovementResult {
  id: string;
  newPosition: Vec2;
}

/**
 * Execute movement for a single agent based on its lastAction.
 * Returns new position — does NOT mutate.
 */
export function executeAgentMovement(
  agent: PlayerAgentState,
  speedBias = 1.0,
): Vec2 {
  const action = agent.lastAction;
  if (!action?.target) return agent.currentPosition;
  // SHOOT: run toward the shoot target (goal) until in range — prevents carrier freeze
  if (action.type === 'SHOOT') {
    const speed = computeSpeed('RUN', agent.stamina, speedBias);
    return stepToward(agent.currentPosition, action.target, speed);
  }
  if (action.type !== 'MOVE' && action.type !== 'RUN') return agent.currentPosition;

  const speed = computeSpeed(action.type, agent.stamina, speedBias);
  return stepToward(agent.currentPosition, action.target, speed);
}

/**
 * Execute movement for an entire team, then apply separation.
 * This is the main entry point — call once per tick per team.
 */
export function executeTeamMovement(
  agents: PlayerAgentState[],
  speedBias = 1.0,
): MovementResult[] {
  // Step 1: move each agent toward its action target
  const moved = agents.map(agent => ({
    id:          agent.id,
    newPosition: executeAgentMovement(agent, speedBias),
  }));

  // Step 2: build temp list with new positions for separation
  const movedAgents: PlayerAgentState[] = agents.map((agent, i) => ({
    ...agent,
    currentPosition: moved[i]!.newPosition,
  }));

  // Step 3: separation forces
  const offsets = applySeparation(movedAgents);

  // Step 4: apply offsets + clamp
  return moved.map(m => {
    const offset = offsets.get(m.id);
    if (!offset) return m;
    return {
      id: m.id,
      newPosition: clampAgentPos({
        x: m.newPosition.x + offset.x,
        y: m.newPosition.y + offset.y,
      }),
    };
  });
}

/**
 * Apply MovementResult[] back onto PlayerAgentState[].
 * Returns new immutable agent states.
 */
export function applyMovementResults(
  agents: PlayerAgentState[],
  results: MovementResult[],
): PlayerAgentState[] {
  const posMap = new Map(results.map(r => [r.id, r.newPosition]));
  return agents.map(agent => {
    const newPos = posMap.get(agent.id);
    if (!newPos) return agent;
    return { ...agent, currentPosition: newPos };
  });
}
