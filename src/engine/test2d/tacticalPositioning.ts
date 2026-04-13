/**
 * test2d — Tactical Positioning Engine
 *
 * Replaces the naive `jitterPlayers` (uniform ball-chase + noise) with
 * formation-anchored, role-aware, spacing-enforced player movement.
 *
 * Reuses MatchEngine slot-shifting logic (shiftAttackingSlot / shiftDefendingSlot)
 * via the FORMATION_BASES catalog — no Yuka, no Babylon dependencies.
 *
 * Coordinate system: engine 0–100 (percentage of field).
 *   FORMATION_BASES normalized nx/nz [0,1] → multiply by 100 for engine coords.
 *   FIELD_LENGTH=105, FIELD_WIDTH=68 (world meters) are used for MatchEngine
 *   internals; we convert at the boundary.
 */
import type { PitchPlayerState, PossessionSide, PitchPoint } from '@/engine/types';
import type { FormationSchemeId, PlayBeat, PossessionContext, PressureReading } from '@/match-engine/types';
import { FORMATION_BASES, type BaseSlot } from '@/match-engine/formations/catalog';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { computePressureOnCarrier } from '@/match-engine/pressure';
import { type ShapeModifiers, getShapeModifiers, deriveTeamIntention, ballZoneFromEngineX, type BallZoneSimple } from './teamShape';
import type { SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';
import type { UltraliveMovementKnobs } from '@/engine/ultralive2d/applyAttrsToMovement';
import { kickoffEngineXPercent, kickoffHalfMarginMeters, outfieldCatalogNxBounds } from '@/engine/kickoffFormationLayout';

/* ── Constants ──────────────────────────────────────────────────────── */

/** Minimum distance (engine units 0-100) between two teammates before repulsion kicks in. */
const MIN_SPACING = 9.4;
/** Repulsion strength when spacing violation detected. */
const REPULSION_FORCE = 0.66;
/** How fast players lerp toward their target each tick (0 = frozen, 1 = instant). */
const MOVE_LERP = 0.18;
/** Extra lerp boost for the player on the ball (carrier). */
const CARRIER_LERP_BOOST = 0.08;
/** Tiny per-tick noise for alive feeling (much less than the old ±1). */
const MICRO_NOISE = 0.3;
/** Ball influence factor per role — how much a player is pulled toward ball beyond formation. */
const BALL_PULL: Record<PitchPlayerState['role'], number> = {
  gk: 0.00,
  def: 0.03,
  mid: 0.055,
  attack: 0.085,
};
/** Role-based depth clamp in engine 0-100 coords (home attacks toward +x). */
const ROLE_DEPTH_CLAMP: Record<PitchPlayerState['role'], { min: number; max: number }> = {
  gk: { min: 2, max: 16 },
  def: { min: 8, max: 52 },
  mid: { min: 18, max: 72 },
  /** Atacantes ancorados mais alto para receber na zona de finalização. */
  attack: { min: 44, max: 98 },
};

/* ── Helpers ─────────────────────────────────────────────────────────── */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Convert engine 0-100 coords to MatchEngine world meters. */
function toWorld(ex: number, ey: number): { x: number; z: number } {
  return { x: (ex / 100) * FIELD_LENGTH, z: (ey / 100) * FIELD_WIDTH };
}

/** Mirror for away team: home attacks +x, away attacks -x. */
function mirrorNx(nx: number): number {
  return 1 - nx;
}

/* ── Reused MatchEngine slot-shifting (inlined to avoid class instantiation) ── */

function shiftAttackingSlot(
  nx: number, nz: number, line: BaseSlot['line'], slot: string,
  ballX: number, ballZ: number,
  manager: { tacticalMentality: number; defensiveLine: number; tempo: number },
  context: PossessionContext, storyBeat: PlayBeat, pressure: PressureReading,
): { nx: number; nz: number } {
  const mind = (manager.tacticalMentality - 50) / 100;
  const defL = (manager.defensiveLine - 50) / 120;
  const press = (manager.tacticalMentality - 50) / 200;
  const bx = ballX / FIELD_LENGTH;
  const bz = ballZ / FIELD_WIDTH;
  let nx2 = nx + mind * 0.06 + (bx - 0.5) * 0.085 * (1 + press) - defL * 0.05;
  let nz2 = nz;

  if (context === 'transition_attack') nx2 += 0.032;
  if (context === 'attack' || storyBeat === 'chance_creation' || storyBeat === 'finishing') {
    if (line === 'att') nx2 += 0.034;
    if (slot === 'ata' || slot === 'pe' || slot === 'pd') {
      nx2 += 0.02;
    }
    if (slot === 'pe' || slot === 'pd') {
      nz2 = clamp(nz + (nz - 0.5) * 0.14, 0.06, 0.94);
    }
  }
  if (pressure.intensity > 0.62 && line === 'def') nx2 -= 0.035;
  const tempoBoost = (manager.tempo - 50) / 250;
  nx2 += tempoBoost * 0.04;

  return {
    nx: clamp(nx2, 0.05, 0.93),
    nz: clamp(nz2 + (bz - 0.5) * 0.04 * (slot === 'mc1' || slot === 'mc2' ? 1 : 0.35), 0.06, 0.94),
  };
}

function shiftDefendingSlot(
  nx: number, nz: number, slot: string,
  ballX: number, ballZ: number,
  manager: { tacticalMentality: number; defensiveLine: number; tempo: number },
  storyBeat: PlayBeat,
): { nx: number; nz: number } {
  const defL = (manager.defensiveLine - 50) / 120;
  const press = (manager.tacticalMentality - 50) / 200;
  const bx = ballX / FIELD_LENGTH;
  const bz = ballZ / FIELD_WIDTH;
  const pressHigh = manager.tacticalMentality > 76;

  let nx2 = nx - defL * 0.09 + (bx - 0.5) * (pressHigh ? 0.09 : 0.055) * (1 + press);
  let nz2 = nz + (bz - 0.5) * 0.05;

  if (storyBeat === 'recovery' || storyBeat === 'organization') {
    nx2 -= pressHigh ? 0.02 : 0.04;
  }
  if (slot === 'pe' || slot === 'pd') {
    nz2 = clamp(nz2 + (nz - 0.5) * 0.06, 0.06, 0.94);
  }

  return {
    nx: clamp(nx2, 0.06, 0.92),
    nz: clamp(nz2, 0.06, 0.94),
  };
}

/* ── Derive PossessionContext from engine ball x ─────────────────────── */

function derivePossessionContextFromEngine(
  side: 'home' | 'away',
  ballEngineX: number,
  storyBeat: PlayBeat,
): PossessionContext {
  const worldX = (ballEngineX / 100) * FIELD_LENGTH;
  if (storyBeat === 'recovery') return 'transition_attack';
  if (side === 'home') {
    if (worldX < FIELD_LENGTH * 0.38) return 'build';
    if (worldX > FIELD_LENGTH * 0.58) return 'attack';
    return 'progression';
  }
  if (worldX > FIELD_LENGTH * 0.62) return 'build';
  if (worldX < FIELD_LENGTH * 0.42) return 'attack';
  return 'progression';
}

/* ── Story beat approximation from spirit action kind ────────────────── */

function approximateStoryBeat(
  actionKind: string | undefined,
  ballZone: BallZoneSimple,
  hasBall: boolean,
): PlayBeat {
  if (!hasBall) return 'organization';
  if (actionKind === 'counter') return 'recovery';
  if (actionKind === 'shot') return 'finishing';
  if (actionKind === 'press') return 'recovery';
  if (ballZone === 'att') return 'chance_creation';
  if (ballZone === 'def') return 'organization';
  return 'progression';
}

/* ── Core: compute tactical targets for one team ───────────────────── */

export interface TacticalPositionInput {
  players: PitchPlayerState[];
  ball: PitchPoint;
  possession: PossessionSide;
  side: 'home' | 'away';
  formation: FormationSchemeId;
  spiritPhase: SpiritPhase | undefined;
  actionKind: string | undefined;
  manager: { tacticalMentality: number; defensiveLine: number; tempo: number };
  onBallPlayerId: string | undefined;
  /** Opponent positions for pressure calculation (engine 0-100 coords). */
  opponentPositions?: { x: number; y: number }[];
  /** ultralive2d: fatores derivados de attrs (opcional). */
  movementKnobs?: UltraliveMovementKnobs;
  /** test2d / ultralive2d: multiplicador global de velocidade de deslocamento. */
  live2dSpeedMult?: number;
  /**
   * Sem posse: 0–1, aproximar defesas/médios da bola (pressão ao portador).
   */
  pressTowardBall01?: number;
  /**
   * 0 = reforçar meio-campo próprio (saída de bola); 1 = sem restrição extra.
   * Interpola em metros para não depender de convenções home/away em %.
   */
  kickoffShapeRelax01?: number;
}

/**
 * Compute intelligent tactical positions for a team of players.
 * Formation-anchored with role-aware modifiers, spacing enforcement,
 * and gradual lerp movement (no teleport).
 */
export function computeTacticalPositions(input: TacticalPositionInput): PitchPlayerState[] {
  const {
    players, ball, possession, side, formation, spiritPhase,
    actionKind, manager, onBallPlayerId, opponentPositions, movementKnobs,
    live2dSpeedMult = 1,
    pressTowardBall01 = 0,
    kickoffShapeRelax01 = 1,
  } = input;

  const mk = movementKnobs;
  const moveLerp = MOVE_LERP * (mk?.moveLerpMult ?? 1) * live2dSpeedMult;
  const carrierBoost = (CARRIER_LERP_BOOST + (mk?.carrierLerpBoostAdd ?? 0)) * live2dSpeedMult;
  const ballPullScale = mk?.ballPullMult ?? 1;
  const noiseScale = mk?.microNoiseMult ?? 1;
  const minSpacing = MIN_SPACING + (mk?.minSpacingAdd ?? 0);

  const hasBall = side === possession;
  const ballZone = ballZoneFromEngineX(ball.x, side);
  const intention = deriveTeamIntention(hasBall, ballZone, spiritPhase, actionKind, possession, side, manager.tacticalMentality);
  const shape = getShapeModifiers(intention);

  const bases = FORMATION_BASES[formation] ?? FORMATION_BASES['4-3-3'];
  const storyBeat = approximateStoryBeat(actionKind, ballZone, hasBall);
  const possCtx = derivePossessionContextFromEngine(side, ball.x, storyBeat);

  // World-space ball for MatchEngine slot shifting
  const worldBall = toWorld(ball.x, ball.y);

  // Pressure from opponents (if available)
  const pressure: PressureReading = (() => {
    if (!opponentPositions?.length || !onBallPlayerId) {
      return { opponentsWithin6m: 0, opponentsWithin12m: 0, closestOpponentM: 24, intensity: 0 };
    }
    const carrier = players.find((p) => p.playerId === onBallPlayerId);
    if (!carrier) {
      return { opponentsWithin6m: 0, opponentsWithin12m: 0, closestOpponentM: 24, intensity: 0 };
    }
    const cWorld = toWorld(carrier.x, carrier.y);
    const oppWorld = opponentPositions.map((o) => toWorld(o.x, o.y));
    return computePressureOnCarrier(cWorld.x, cWorld.z, oppWorld);
  })();

  // Step 1: Compute raw formation target per player
  const targets: { playerId: string; tx: number; ty: number }[] = [];

  for (const p of players) {
    const slot = bases[p.slotId];
    if (!slot) {
      targets.push({ playerId: p.playerId, tx: p.x, ty: p.y });
      continue;
    }

    let baseNx = slot.nx;
    let baseNz = slot.nz;

    // Mirror for away team
    if (side === 'away') {
      baseNx = mirrorNx(baseNx);
    }

    // Apply MatchEngine slot shifting
    const shifted = hasBall
      ? shiftAttackingSlot(baseNx, baseNz, slot.line, p.slotId, worldBall.x, worldBall.z, manager, possCtx, storyBeat, pressure)
      : shiftDefendingSlot(baseNx, baseNz, p.slotId, worldBall.x, worldBall.z, manager, storyBeat);

    // Convert normalized -> engine 0-100
    let tx = shifted.nx * 100;
    let ty = shifted.nz * 100;

    // Apply shape modifiers
    tx = applyShapeToX(tx, ball.x, shape, p.role, side);
    ty = applyShapeToY(ty, ball.y, shape, p.role);

    // Ball pull (role-weighted attraction toward ball beyond formation target)
    const pullFactor = (BALL_PULL[p.role] ?? 0.06) * ballPullScale;
    const centralBand = ball.x > 36 && ball.x < 64;
    const pullDamp = centralBand ? 0.5 : 1;
    tx += (ball.x - tx) * pullFactor * pullDamp;
    ty += (ball.y - ty) * pullFactor * pullDamp;

    // Carrier: stay with ball without collapsing support lines into a cluster
    if (p.playerId === onBallPlayerId && hasBall) {
      tx = lerp(tx, ball.x, 0.38);
      ty = lerp(ty, ball.y, 0.38);
    }

    // Role depth clamp
    const depthClamp = ROLE_DEPTH_CLAMP[p.role];
    if (depthClamp) {
      if (side === 'away') {
        tx = clamp(tx, 100 - depthClamp.max, 100 - depthClamp.min);
      } else {
        tx = clamp(tx, depthClamp.min, depthClamp.max);
      }
    }

    // Field boundary clamp
    tx = clamp(tx, 3, 97);
    ty = clamp(ty, 4, 96);

    if (!hasBall && pressTowardBall01 > 0 && p.role !== 'gk') {
      const w = p.role === 'def' ? 1 : p.role === 'mid' ? 0.82 : 0.5;
      const s = pressTowardBall01 * w * 0.38;
      tx = lerp(tx, ball.x, s);
      ty = lerp(ty, ball.y, s * 0.9);
      tx = clamp(tx, 3, 97);
      ty = clamp(ty, 4, 96);
    }

    if (kickoffShapeRelax01 < 1 && p.role !== 'gk') {
      const mid = FIELD_LENGTH / 2;
      const m = kickoffHalfMarginMeters();
      let wx = (tx / 100) * FIELD_LENGTH;
      if (side === 'home' && wx > mid - m) {
        wx = lerp(mid - m, wx, kickoffShapeRelax01);
      } else if (side === 'away' && wx < mid + m) {
        wx = lerp(mid + m, wx, kickoffShapeRelax01);
      }
      tx = (wx / FIELD_LENGTH) * 100;
    }

    targets.push({ playerId: p.playerId, tx, ty });
  }

  // Step 2: Spacing repulsion between teammates (two passes — single pass leaves chains tight)
  applySpacingRepulsion(targets, minSpacing);
  applySpacingRepulsion(targets, minSpacing);

  // Step 3: Gradual lerp from current position toward target + micro noise
  return players.map((p) => {
    const t = targets.find((tg) => tg.playerId === p.playerId);
    if (!t) return p;

    const isCarrier = p.playerId === onBallPlayerId && hasBall;
    const lerpFactor = moveLerp + (isCarrier ? carrierBoost : 0);
    const noise = () => (Math.random() - 0.5) * MICRO_NOISE * 2 * noiseScale;

    const nx = clamp(lerp(p.x, t.tx, lerpFactor) + noise(), 3, 97);
    const ny = clamp(lerp(p.y, t.ty, lerpFactor) + noise(), 4, 96);

    return { ...p, x: nx, y: ny };
  });
}

/* ── Shape modifier application ──────────────────────────────────── */

function applyShapeToX(
  tx: number, ballX: number, shape: ShapeModifiers, role: PitchPlayerState['role'], side: 'home' | 'away',
): number {
  // lineHeight pushes defensive line up or drops it back
  const lineShift = (shape.lineHeight - 0.5) * 8;
  if (role === 'def' || role === 'gk') {
    tx += side === 'home' ? lineShift : -lineShift;
  }
  // compactness pulls all lines toward ball X (keep mild to avoid scrums)
  const compactPull = (shape.compactness - 0.5) * 0.026;
  tx += (ballX - tx) * compactPull;

  return tx;
}

function applyShapeToY(
  ty: number, ballY: number, shape: ShapeModifiers, role: PitchPlayerState['role'],
): number {
  // Width expands laterals, narrows centrals
  const widthFactor = shape.width;
  const lateralSlots = role === 'def' || role === 'attack';
  if (lateralSlots) {
    // Push away from center proportional to how far from center they already are
    const fromCenter = ty - 50;
    ty = 50 + fromCenter * (0.85 + widthFactor * 0.3);
  }
  return clamp(ty, 4, 96);
}

/* ── Spacing repulsion ──────────────────────────────────────────────── */

function applySpacingRepulsion(
  targets: { playerId: string; tx: number; ty: number }[],
  minDist: number = MIN_SPACING,
): void {
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!;
      const b = targets[j]!;
      const d = dist(a.tx, a.ty, b.tx, b.ty);
      if (d < minDist && d > 0.01) {
        const overlap = minDist - d;
        const push = (overlap / d) * REPULSION_FORCE;
        const dx = (a.tx - b.tx) * push;
        const dy = (a.ty - b.ty) * push;
        a.tx = clamp(a.tx + dx, 3, 97);
        a.ty = clamp(a.ty + dy, 4, 96);
        b.tx = clamp(b.tx - dx, 3, 97);
        b.ty = clamp(b.ty - dy, 4, 96);
      }
    }
  }
}

/* ── Away team factory ───────────────────────────────────────────────── */

const AWAY_SLOT_ORDER = ['gol', 'zag1', 'zag2', 'le', 'ld', 'vol', 'mc1', 'mc2', 'pe', 'ata', 'pd'] as const;

/**
 * Build PitchPlayerState[] for the away team from the synthetic roster.
 * Away players start at mirrored formation positions.
 */
export function buildAwayPitchPlayers(
  awayRoster: { id: string; num: number; name: string; pos: string }[],
  formation: FormationSchemeId,
): PitchPlayerState[] {
  const bases = FORMATION_BASES[formation] ?? FORMATION_BASES['4-3-3'];
  const nxBounds = outfieldCatalogNxBounds(formation);
  return awayRoster.slice(0, 11).map((pl, i) => {
    const slotId = AWAY_SLOT_ORDER[i] ?? 'mc1';
    const slot = bases[slotId] ?? bases.mc1;
    const role = slotToRole(slotId);
    const kickX = kickoffEngineXPercent('away', slot.nx, nxBounds.nxMin, nxBounds.nxMax, slotId === 'gol');
    return {
      playerId: pl.id,
      slotId,
      name: pl.name,
      num: pl.num,
      pos: pl.pos,
      x: kickX,
      y: slot.nz * 100,
      fatigue: 0,
      role,
    };
  });
}

function slotToRole(slot: string): PitchPlayerState['role'] {
  if (slot === 'gol') return 'gk';
  if (['zag1', 'zag2', 'le', 'ld', 'vol'].includes(slot)) return 'def';
  if (['mc1', 'mc2'].includes(slot)) return 'mid';
  return 'attack';
}
