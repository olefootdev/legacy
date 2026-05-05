import { tickAgent, type PlayerAgentState } from '../core/PlayerAgent';
import type { Vec2 } from '../core/AgentTypes';
import {
  executeTeamMovement,
  applyMovementResults,
} from '../integration/MovementBridge';
import { MatchFieldContext } from '../match/MatchFieldContext';

// ── MatchFieldContext instances (one per team, created once per simulation) ───
// AP-RULES.md: updateTick() called ONCE per tick before all agents
let _homeCtx: MatchFieldContext | null = null;
let _awayCtx: MatchFieldContext | null = null;

function getContexts(): { home: MatchFieldContext; away: MatchFieldContext } {
  if (!_homeCtx) _homeCtx = new MatchFieldContext('home');
  if (!_awayCtx) _awayCtx = new MatchFieldContext('away');
  return { home: _homeCtx, away: _awayCtx };
}

export function resetContexts(): void {
  _homeCtx = null;
  _awayCtx = null;
}

export interface TickSnapshot {
  tick: number;
  ballPosition: Vec2;
  ballCarrierId: string | null;
  homePlayers: PlayerAgentState[];
  awayPlayers: PlayerAgentState[];
  events: SimEvent[];
}

// Lightweight match events emitted each tick — feed Fase 4 confidence changes.
export type SimEventKind = 'SHOT' | 'GOAL' | 'TACKLE' | 'PASS_SUCCESS' | 'POSSESSION_CHANGE';
export interface SimEvent {
  kind: SimEventKind;
  agentId: string;
  side: 'home' | 'away';
}

export interface SimulatorState {
  homePlayers: PlayerAgentState[];
  awayPlayers: PlayerAgentState[];
  ballPosition: Vec2;
  ballCarrierId: string | null;
  possession: 'home' | 'away' | null;
  carrierTickCount: number;  // how many ticks the current carrier has held the ball
}

// ── Confidence deltas per event (Fase 4) ─────────────────────────────────────
const CONF_DELTA: Record<SimEventKind, number> = {
  GOAL:              +15,
  SHOT:              +4,
  PASS_SUCCESS:      +2,
  TACKLE:            +3,
  POSSESSION_CHANGE: -3,
};
const CONF_MIN = 10;
const CONF_MAX = 100;

function applyConfidenceDelta(
  players: PlayerAgentState[],
  events: SimEvent[],
  side: 'home' | 'away',
): PlayerAgentState[] {
  if (events.length === 0) return players;
  return players.map((p) => {
    let delta = 0;
    for (const ev of events) {
      if (ev.agentId === p.id) {
        // Direct actor: full delta
        delta += CONF_DELTA[ev.kind] ?? 0;
      } else if (ev.side === side) {
        // Teammate event: small contagion effect
        delta += (CONF_DELTA[ev.kind] ?? 0) * 0.15;
      } else {
        // Opponent scored/tackled: negative contagion
        if (ev.kind === 'GOAL' || ev.kind === 'TACKLE') delta -= 3;
      }
    }
    if (delta === 0) return p;
    return {
      ...p,
      confidence: Math.min(CONF_MAX, Math.max(CONF_MIN, p.confidence + delta)),
    };
  });
}

// ── Football mechanics helpers ────────────────────────────────────────────────

// Find the best teammate to pass to: open, ahead, not too far
function findPassTarget(
  carrier: PlayerAgentState,
  teammates: PlayerAgentState[],
  goalPosition: Vec2,
  opponentPositions: Vec2[],
): PlayerAgentState | null {
  const carrierX = carrier.currentPosition.x;
  const goalX    = goalPosition.x;
  const forward  = goalX > 50 ? 1 : -1; // home attacks x=100, away attacks x=0

  let best: PlayerAgentState | null = null;
  let bestScore = -Infinity;

  for (const t of teammates) {
    if (t.id === carrier.id) continue;
    const dx = t.currentPosition.x - carrierX;
    const dy = t.currentPosition.y - carrier.currentPosition.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5 || dist > 40) continue; // too close or too far

    // Prefer forward passes
    const forwardBonus = dx * forward * 0.5;

    // Penalize if opponent is close to the target
    const nearestOpp = opponentPositions.reduce((min, op) => {
      const d = Math.hypot(op.x - t.currentPosition.x, op.y - t.currentPosition.y);
      return d < min ? d : min;
    }, Infinity);
    const pressurePenalty = nearestOpp < 8 ? -20 : 0;

    const score = forwardBonus + nearestOpp * 0.3 + pressurePenalty - dist * 0.1;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// Check if carrier is under pressure from opponents
function isUnderPressure(
  carrier: PlayerAgentState,
  opponentPositions: Vec2[],
  threshold = 10,
): boolean {
  return opponentPositions.some(op =>
    Math.hypot(op.x - carrier.currentPosition.x, op.y - carrier.currentPosition.y) < threshold
  );
}

// Check if an opponent can tackle the carrier this tick
function canTackle(
  carrier: PlayerAgentState,
  opponents: PlayerAgentState[],
): PlayerAgentState | null {
  for (const opp of opponents) {
    const dist = Math.hypot(
      opp.currentPosition.x - carrier.currentPosition.x,
      opp.currentPosition.y - carrier.currentPosition.y,
    );
    if (dist < 6) return opp; // within tackle range (6 normalized units ≈ 4m)
  }
  return null;
}

// ── Core step ─────────────────────────────────────────────────────────────────

export function stepSimulator(
  state: SimulatorState,
  tick = 0,
): SimulatorState & { events: SimEvent[] } {
  const { homePlayers, awayPlayers, ballPosition, possession } = state;
  const prevCarrierId = state.ballCarrierId;

  // Determine ball carrier — prefer keeping the existing carrier if still valid.
  let ballCarrierId = state.ballCarrierId;
  if (possession === 'home') {
    const existing = ballCarrierId && homePlayers.find(p => p.id === ballCarrierId);
    if (!existing) ballCarrierId = closestToBall(homePlayers, ballPosition);
  } else if (possession === 'away') {
    const existing = ballCarrierId && awayPlayers.find(p => p.id === ballCarrierId);
    if (!existing) ballCarrierId = closestToBall(awayPlayers, ballPosition);
  } else {
    ballCarrierId = null;
  }

  // Track how many ticks the current carrier has held the ball
  const carrierTickCount = ballCarrierId === prevCarrierId
    ? (state.carrierTickCount ?? 0) + 1
    : 0;

  const homePositions = homePlayers.map((p) => p.currentPosition);
  const awayPositions = awayPlayers.map((p) => p.currentPosition);

  const homeGoal: Vec2 = { x: 97, y: 50 };
  const awayGoal: Vec2 = { x: 3,  y: 50 };

  // ── MatchFieldContext: updateTick() ONCE before all agents ────────────────
  const { home: homeCtx, away: awayCtx } = getContexts();
  homeCtx.updateTick(tick, ballPosition, homePlayers, possession);
  awayCtx.updateTick(tick, ballPosition, awayPlayers, possession);

  // ── queryForAgent() per agent, then tick ─────────────────────────────────
  const tickedHome = homePlayers.map((p) => {
    const fieldQuery = homeCtx.queryForAgent(p);
    return tickAgent(p, ballPosition, homeGoal, homePositions, awayPositions,
      possession === 'home', ballCarrierId, fieldQuery, 'home', possession);
  });
  const tickedAway = awayPlayers.map((p) => {
    const fieldQuery = awayCtx.queryForAgent(p);
    return tickAgent(p, ballPosition, awayGoal, awayPositions, homePositions,
      possession === 'away', ballCarrierId, fieldQuery, 'away', possession);
  });

  // ── Football mechanics ────────────────────────────────────────────────────
  const events: SimEvent[] = [];
  let newPossession = possession;
  let newBallPos    = ballPosition;
  let newCarrierId  = ballCarrierId;

  const carrierTeam     = possession === 'home' ? tickedHome : tickedAway;
  const opponentTeam    = possession === 'home' ? tickedAway : tickedHome;
  const opponentPositions = opponentTeam.map(p => p.currentPosition);
  const carrierState    = carrierTeam.find(p => p.id === ballCarrierId) ?? null;

  if (carrierState) {
    const side = possession!;
    const goalPos = side === 'home' ? homeGoal : awayGoal;

    // ── 1. SHOOT — only when inside penalty box area ─────────────────────
    const distToGoal = Math.hypot(
      carrierState.currentPosition.x - goalPos.x,
      carrierState.currentPosition.y - goalPos.y,
    );
    const inShootingRange = distToGoal < 18;

    if (carrierState.lastAction?.type === 'SHOOT' && inShootingRange) {
      events.push({ kind: 'SHOT', agentId: carrierState.id, side });
      const scored = Math.random() < 0.30;
      if (scored) events.push({ kind: 'GOAL', agentId: carrierState.id, side });
      newPossession = side === 'home' ? 'away' : 'home';
      newBallPos    = { x: 50, y: 50 };
      newCarrierId  = null;

    // ── 2. TACKLE attempt by opponent ────────────────────────────────────
    } else {
      const tackler = canTackle(carrierState, opponentTeam);
      if (tackler) {
        const tackleSuccess = Math.random() < 0.35;
        if (tackleSuccess) {
          events.push({ kind: 'TACKLE', agentId: tackler.id, side: side === 'home' ? 'away' : 'home' });
          events.push({ kind: 'POSSESSION_CHANGE', agentId: carrierState.id, side });
          newPossession = side === 'home' ? 'away' : 'home';
          newCarrierId  = tackler.id;
          newBallPos    = { ...tackler.currentPosition };
        }
      }

      // ── 3. PASS — agent decision (TacticaDoZero) OR pressure/timer ─────
      if (newCarrierId === ballCarrierId) {
        const underPressure = isUnderPressure(carrierState, opponentPositions, 10);
        // Agent explicitly decided to pass (TacticaDoZero principle: apoio/circulação)
        const agentWantsPass = carrierState.lastAction?.type === 'PASS';
        // Fallback: pass under pressure after 8+ ticks, or force after 36 ticks (~1.5s)
        const shouldPass = agentWantsPass || (underPressure && carrierTickCount > 8) || carrierTickCount > 36;

        if (shouldPass) {
          const passTarget = findPassTarget(
            carrierState, carrierTeam, goalPos, opponentPositions,
          );
          if (passTarget) {
            events.push({ kind: 'PASS_SUCCESS', agentId: carrierState.id, side });
            newCarrierId = passTarget.id;
            newBallPos   = { ...passTarget.currentPosition };
          }
        }
      }
    }
  } else if (possession !== null) {
    // Loose ball — closest player from possession team picks it up
    const team = possession === 'home' ? tickedHome : tickedAway;
    const closest = closestToBall(team, newBallPos);
    if (closest) {
      newCarrierId = closest;
      const player = team.find(p => p.id === closest);
      if (player) newBallPos = { ...player.currentPosition };
    }
  }

  // ── Possession change event ───────────────────────────────────────────────
  if (newPossession !== possession && possession !== null && ballCarrierId) {
    if (!events.find(e => e.kind === 'POSSESSION_CHANGE')) {
      events.push({ kind: 'POSSESSION_CHANGE', agentId: ballCarrierId, side: possession });
    }
  }

  // Apply confidence deltas (Fase 4)
  const confHome = applyConfidenceDelta(tickedHome, events, 'home');
  const confAway = applyConfidenceDelta(tickedAway, events, 'away');

  // ── MovementBridge: execute movement ─────────────────────────────────────
  const homeResults = executeTeamMovement(confHome);
  const awayResults = executeTeamMovement(confAway);
  const finalHome   = applyMovementResults(confHome, homeResults);
  const finalAway   = applyMovementResults(confAway, awayResults);

  // Ball follows carrier after bridge moved them
  if (newCarrierId) {
    const movedCarrier =
      finalHome.find(p => p.id === newCarrierId) ??
      finalAway.find(p => p.id === newCarrierId);
    if (movedCarrier) newBallPos = { ...movedCarrier.currentPosition };
  }

  return {
    homePlayers: finalHome,
    awayPlayers: finalAway,
    ballPosition: newBallPos,
    ballCarrierId: newCarrierId,
    possession: newPossession,
    carrierTickCount: newCarrierId === ballCarrierId ? carrierTickCount : 0,
    events,
  };
}

// Run N ticks and return a snapshot per tick.
export function runSimulation(
  initialState: SimulatorState,
  ticks: number,
): TickSnapshot[] {
  // Reset MatchFieldContext instances for a fresh simulation
  resetContexts();

  const snapshots: TickSnapshot[] = [];
  let state = initialState;

  for (let t = 0; t < ticks; t++) {
    const result = stepSimulator(state, t + 1);
    state = result;
    snapshots.push({
      tick: t + 1,
      ballPosition: state.ballPosition,
      ballCarrierId: state.ballCarrierId,
      homePlayers: state.homePlayers,
      awayPlayers: state.awayPlayers,
      events: result.events,
    });
  }

  return snapshots;
}

function closestToBall(players: PlayerAgentState[], ball: Vec2): string {
  let bestId = players[0]!.id;
  let bestDist = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.currentPosition.x - ball.x, p.currentPosition.y - ball.y);
    if (d < bestDist) { bestDist = d; bestId = p.id; }
  }
  return bestId;
}
