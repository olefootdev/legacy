/**
 * test2d — Tactical Positioning Engine
 *
 * Replaces the naive `jitterPlayers` (uniform ball-chase + noise) with
 * formation-anchored, role-aware, spacing-enforced player movement.
 *
 * Reuses MatchEngine slot-shifting logic (shiftAttackingSlot / shiftDefendingSlot)
 * via the FORMATION_BASES catalog — no Yuka, no Babylon dependencies.
 *
 * Live `test2d` match chronology (frame truth → `truthSnapshotToTest2dPitch`) is driven
 * by `TacticalSimLoop` + Yuka `Vehicle` / `stepVehicle` in `useLive2dTacticalSim` — not
 * by this module; keep that split when extending positioning.
 *
 * Coordinate system: engine 0–100 (percentage of field).
 *   FORMATION_BASES normalized nx/nz [0,1] → multiply by 100 for engine coords.
 *   FIELD_LENGTH=105, FIELD_WIDTH=68 (world meters) are used for MatchEngine
 *   internals; we convert at the boundary.
 */
import type { PitchPlayerState, PossessionSide, PitchPoint } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { behaviorToCognitiveArchetype, matchAttributesFromPlayerEntity } from '@/match/playerInMatch';
import type { FormationSchemeId, PlayBeat, PossessionContext, PressureReading } from '@/match-engine/types';
import { FORMATION_BASES, type BaseSlot, roleForSlotInFormation } from '@/match-engine/formations/catalog';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { computePressureOnCarrier } from '@/match-engine/pressure';
import {
  tacticalBallZoneForTeam,
  worldXZFromEnginePercent,
  getThird,
  depthFromOwnGoal,
  getDefendingGoalX,
  getAttackingGoalX,
  isInsideOwnPenaltyArea,
  clampGoalkeeperTargetX,
  GOALKEEPER_MAX_DEPTH_FROM_GOAL_M,
  type MatchHalf,
} from '@/match/fieldZones';
import { type ShapeModifiers, getShapeModifiers, deriveTeamIntention, sfPhaseFromIntention, voiceIntentionOverride, blendShape, type BallZoneSimple } from './teamShape';
import type { SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';
import type { UltraliveMovementKnobs } from '@/engine/ultralive2d/applyAttrsToMovement';
import { kickoffEngineXPercent, kickoffHalfMarginMeters, outfieldCatalogNxBounds } from '@/engine/kickoffFormationLayout';
import {
  sfGetAnchor,
  sfShapeCorrection,
  sfEffectiveRadius,
  sfShouldRecoverShape,
  sfForbiddenZoneRepulsion,
  sfZoneAttractionVector,
  sfRoleFromSlot,
  sfIsInForbiddenZone,
  type SfTeamPhase,
} from '@/smartfield/smartfieldBridge';
import {
  teammateProximityRadiusMul,
  shouldLateralOverlap,
  shouldRunBehindDefense,
  shouldRushOppBox,
} from '@/smartfield/dynamicZones';
import {
  commandPositionOverride,
  isCommandActive,
} from '@/voiceCommand/commandQueue';
import type { PendingCommand } from '@/voiceCommand/types';

import {
  TEST2D_MIN_SPACING_ENGINE_UNITS,
  TEST2D_REPULSION_FORCE,
} from '@/match/tacticalSpacingTuning';

/* ── Constants ──────────────────────────────────────────────────────── */

/** Minimum distance (engine units 0-100) between two teammates before repulsion kicks in. */
const MIN_SPACING = TEST2D_MIN_SPACING_ENGINE_UNITS;
/** Repulsion strength when spacing violation detected. */
const REPULSION_FORCE = TEST2D_REPULSION_FORCE;
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
/** Smartfield anchor blending weight: how much the SF anchor pulls vs formation catalog. */
const SF_ANCHOR_BLEND = 0.35;
/** Smartfield zone attraction strength. */
const SF_ZONE_PULL = 0.018;
/** Smartfield forbidden zone repulsion strength (engine units per tick). */
const SF_FORBIDDEN_REPULSION = 2.8;
/** Shape recovery urgency multiplier when smartfield says player must recover. */
const SF_RECOVERY_URGENCY = 0.12;
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

/* ── Possession context: terços IFAB (getThird), alinhado a fieldZones ─ */

function derivePossessionContextFromPitch(
  side: 'home' | 'away',
  ballEngineX: number,
  ballEngineY: number,
  half: MatchHalf,
  storyBeat: PlayBeat,
): PossessionContext {
  if (storyBeat === 'recovery') return 'transition_attack';
  const { x, z } = worldXZFromEnginePercent(ballEngineX, ballEngineY);
  const third = getThird({ x, z }, { team: side, half });
  if (third === 'defensive') return 'build';
  if (third === 'attacking') return 'attack';
  return 'progression';
}

function relaxBuildFromBack(params: {
  hasBall: boolean;
  spiritPhase: SpiritPhase | undefined;
  ballEx: number;
  ballEy: number;
  side: 'home' | 'away';
  half: MatchHalf;
}): boolean {
  if (!params.hasBall) return false;
  if (params.spiritPhase === 'buildup_gk') return true;
  const { x, z } = worldXZFromEnginePercent(params.ballEx, params.ballEy);
  if (isInsideOwnPenaltyArea({ x, z }, { team: params.side, half: params.half })) return true;
  const d = depthFromOwnGoal(x, params.side, params.half);
  return d < 21;
}

function depthBandMetersForRole(role: PitchPlayerState['role'], relax: boolean): { minM: number; maxM: number } {
  if (role === 'gk') return { minM: 0.5, maxM: GOALKEEPER_MAX_DEPTH_FROM_GOAL_M };
  if (relax) {
    if (role === 'attack') return { minM: 7.5, maxM: FIELD_LENGTH - 1.0 };
    if (role === 'mid') return { minM: 4.5, maxM: FIELD_LENGTH - 1.2 };
    if (role === 'def') return { minM: 2.2, maxM: 64 };
  }
  if (role === 'attack') return { minM: 33, maxM: FIELD_LENGTH - 1.0 };
  if (role === 'mid') return { minM: 8.5, maxM: FIELD_LENGTH - 1.2 };
  if (role === 'def') return { minM: 3.2, maxM: 58 };
  return { minM: 10, maxM: 90 };
}

/** Profundidade desde a baliza defendida (metros) → limite coerente em % motor para ambos os lados. */
function clampEngineXToRoleDepthBand(
  tx: number,
  role: PitchPlayerState['role'],
  side: 'home' | 'away',
  half: MatchHalf,
  relax: boolean,
): number {
  if (role === 'gk') {
    const w = worldXZFromEnginePercent(tx, 50);
    const cx = clampGoalkeeperTargetX(side, half, w.x);
    return (cx / FIELD_LENGTH) * 100;
  }
  const { x: wx } = worldXZFromEnginePercent(tx, 50);
  let d = depthFromOwnGoal(wx, side, half);
  const band = depthBandMetersForRole(role, relax);
  d = clamp(d, band.minM, band.maxM);
  const dg = getDefendingGoalX(side, half);
  const ag = getAttackingGoalX(side, half);
  const newWx = dg < ag ? dg + d : dg - d;
  return (newWx / FIELD_LENGTH) * 100;
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
  /** 1º / 2º tempo — terços e profundidade vêm de `fieldZones` (baliza defendida). */
  matchHalf?: MatchHalf;
  /**
   * Comandos de voz ativos por jogador (lidos de `liveMatch.voiceCommands`).
   * Quando presente + ativo, sobrepõe o alvo posicional por X segundos.
   */
  voiceCommands?: Record<string, PendingCommand>;
  /** Timestamp agora (ms) pra validar expiração dos comandos. */
  nowMs?: number;
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
    matchHalf = 1,
    voiceCommands,
    nowMs = Date.now(),
  } = input;

  const mk = movementKnobs;
  const moveLerp = MOVE_LERP * (mk?.moveLerpMult ?? 1) * live2dSpeedMult;
  const carrierBoost = (CARRIER_LERP_BOOST + (mk?.carrierLerpBoostAdd ?? 0)) * live2dSpeedMult;
  const ballPullScale = mk?.ballPullMult ?? 1;
  const noiseScale = mk?.microNoiseMult ?? 1;
  const minSpacing = MIN_SPACING + (mk?.minSpacingAdd ?? 0);

  const hasBall = side === possession;
  const ballZone = tacticalBallZoneForTeam(ball.x, ball.y, side, matchHalf);
  const baseIntention = deriveTeamIntention(hasBall, ballZone, spiritPhase, actionKind, possession, side, manager.tacticalMentality);
  const voiceOverride = voiceIntentionOverride(voiceCommands, nowMs);
  const intention = voiceOverride && voiceOverride.weight >= 0.5 ? voiceOverride.intention : baseIntention;
  const shape = voiceOverride
    ? blendShape(getShapeModifiers(baseIntention, formation), getShapeModifiers(voiceOverride.intention, formation), voiceOverride.weight)
    : getShapeModifiers(baseIntention, formation);
  const sfPhase = sfPhaseFromIntention(intention);

  const bases = FORMATION_BASES[formation] ?? FORMATION_BASES['4-3-3'];
  const storyBeat = approximateStoryBeat(actionKind, ballZone, hasBall);
  const possCtx = derivePossessionContextFromPitch(side, ball.x, ball.y, matchHalf, storyBeat);

  const relaxDepth = relaxBuildFromBack({
    hasBall,
    spiritPhase,
    ballEx: ball.x,
    ballEy: ball.y,
    side,
    half: matchHalf,
  });

  // World-space ball for MatchEngine slot shifting
  const worldBall = worldXZFromEnginePercent(ball.x, ball.y);

  // Pressure from opponents (if available)
  const pressure: PressureReading = (() => {
    if (!opponentPositions?.length || !onBallPlayerId) {
      return { opponentsWithin6m: 0, opponentsWithin12m: 0, closestOpponentM: 24, intensity: 0 };
    }
    const carrier = players.find((p) => p.playerId === onBallPlayerId);
    if (!carrier) {
      return { opponentsWithin6m: 0, opponentsWithin12m: 0, closestOpponentM: 24, intensity: 0 };
    }
    const cWorld = worldXZFromEnginePercent(carrier.x, carrier.y);
    const oppWorld = opponentPositions.map((o) => worldXZFromEnginePercent(o.x, o.y));
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

    // ── BLOCO COLETIVO: o time se desloca em bloco com a bola ────────
    //   Posse no ataque → bloco avança; defendendo no próprio campo → recua;
    //   press alto → bloco sobe. Lateral: inclina pro lado da bola.
    //   Shape per-role continua válida (atacantes ainda mais à frente, zagueiros atrás).
    const block = applyTeamBlockShift(ball, hasBall, ballZone, p.role, side);
    tx += block.dx;
    ty += block.dy;

    // ── LATERAL OFENSIVO: LE/LD avançam moderadamente no terço final.
    //   Suficiente pra aparecer na lateral, não tanto que "fuja" de passes direcionados.
    const isWingback = p.slotId === 'le' || p.slotId === 'ld';
    if (isWingback && hasBall && ballZone === 'att') {
      const wingAdvance = 8 * (side === 'home' ? 1 : -1);
      tx += wingAdvance;
      const isLeft = p.slotId === 'le';
      const lineTargetY = isLeft ? 14 : 86;
      ty = lerp(ty, lineTargetY, 0.14);
    }

    // ── SMARTFIELD: anchor blending + zone intelligence ──────────────
    const sfRole = sfRoleFromSlot(p.slotId, formation);
    const sfAnchor = sfGetAnchor(sfRole, side);
    if (sfAnchor) {
      const anchorEx = (sfAnchor.base_anchor.x / FIELD_LENGTH) * 100;
      const anchorEy = (sfAnchor.base_anchor.z / FIELD_WIDTH) * 100;
      tx = lerp(tx, anchorEx, SF_ANCHOR_BLEND);
      ty = lerp(ty, anchorEy, SF_ANCHOR_BLEND);

      const effRadius = sfEffectiveRadius(sfRole, side, sfPhase);
      // Zona integrada: colega próximo EXPANDE o raio permitido (criar espaço).
      const teammatePts = players.map((pp) => ({ playerId: pp.playerId, x: pp.x, z: pp.y }));
      const radiusMul = teammateProximityRadiusMul(p.x, p.y, teammatePts, p.playerId);
      const effRadiusEng = ((effRadius / FIELD_LENGTH) * 100) * radiusMul;
      const distFromAnchor = dist(tx, ty, anchorEx, anchorEy);
      if (distFromAnchor > effRadiusEng && distFromAnchor > 0.01) {
        const pullBack = Math.min(1, (distFromAnchor - effRadiusEng) / effRadiusEng) * 0.4;
        tx = lerp(tx, anchorEx, pullBack);
        ty = lerp(ty, anchorEy, pullBack);
      }
    }

    // DYNAMIC ZONES: overlap do lateral no flanco (cria espaço no corredor).
    {
      const carrier = onBallPlayerId
        ? (players.find((pp) => pp.playerId === onBallPlayerId) ?? null)
        : null;
      const carrierPos = carrier ? { x: carrier.x, y: carrier.y } : null;
      const ov = shouldLateralOverlap(p.slotId, p.role, p.x, p.y, carrierPos, hasBall, ballZone, side);
      tx += ov.dx;
      ty += ov.dy;
    }

    // DYNAMIC ZONES: atacante ataca a linha dos zagueiros quando meio tem a bola.
    {
      const carrier = onBallPlayerId
        ? (players.find((pp) => pp.playerId === onBallPlayerId) ?? null)
        : null;
      const carrierPos = carrier ? { x: carrier.x, y: carrier.y, role: carrier.role } : null;
      const rb = shouldRunBehindDefense(p.role, p.x, carrierPos, hasBall, ballZone, side);
      tx += rb.dx;
      ty += rb.dy;
    }

    // DYNAMIC ZONES: ATA invade a grande área (pull ao penalty spot adversário).
    {
      const ro = shouldRushOppBox(p.role, p.slotId, p.x, p.y, hasBall, ballZone, side);
      tx += ro.dx;
      ty += ro.dy;
    }

    // SMARTFIELD: zone attraction — pull toward role-appropriate subzones
    {
      const wx = (tx / 100) * FIELD_LENGTH;
      const wz = (ty / 100) * FIELD_WIDTH;
      const zoneVec = sfZoneAttractionVector(wx, wz, sfRole, side, sfPhase);
      tx += (zoneVec.dx / FIELD_LENGTH) * 100 * SF_ZONE_PULL;
      ty += (zoneVec.dz / FIELD_WIDTH) * 100 * SF_ZONE_PULL;
    }

    // SMARTFIELD: forbidden zone repulsion (stronger for GK to stay in proper zone)
    {
      const wx = (tx / 100) * FIELD_LENGTH;
      const wz = (ty / 100) * FIELD_WIDTH;
      const rep = sfForbiddenZoneRepulsion(wx, wz, sfRole, side);
      if (rep.dx !== 0 || rep.dz !== 0) {
        const repStrength = p.role === 'gk' ? SF_FORBIDDEN_REPULSION * 2 : SF_FORBIDDEN_REPULSION;
        tx += (rep.dx / FIELD_LENGTH) * 100 * repStrength;
        ty += (rep.dz / FIELD_WIDTH) * 100 * repStrength;
      }
    }

    // VOICE COMMAND: se há comando ativo no jogador, sobrepõe o alvo posicional.
    //   Aplica depois do SmartField (recebe o alvo base) mas antes da recuperação
    //   de forma — prioridade alta do manager sobre a "volta pra âncora".
    {
      const cmd = voiceCommands?.[p.playerId];
      if (cmd && isCommandActive(cmd, nowMs)) {
        const override = commandPositionOverride(cmd.intent, side, { x: p.x, y: p.y, role: p.role, slotId: p.slotId });
        if (override) {
          // Força escala com obediência efetiva: 100% de obediência = strength total;
          // 50% de obediência = metade da força.
          const obe = Math.max(0, Math.min(1, cmd.effectiveObedience / 100));
          const applied = override.strength * obe;
          tx = lerp(tx, override.tx, applied);
          ty = lerp(ty, override.ty, applied);
        }
      }
    }

    // SMARTFIELD: urgent shape recovery in defensive phases
    if (p.playerId !== onBallPlayerId) {
      const wx = (tx / 100) * FIELD_LENGTH;
      const wz = (ty / 100) * FIELD_WIDTH;
      if (sfShouldRecoverShape(wx, wz, sfRole, side, sfPhase) && sfAnchor) {
        const anchorEx = (sfAnchor.base_anchor.x / FIELD_LENGTH) * 100;
        const anchorEy = (sfAnchor.base_anchor.z / FIELD_WIDTH) * 100;
        const urgency = SF_RECOVERY_URGENCY * sfAnchor.recovery_priority;
        tx = lerp(tx, anchorEx, urgency);
        ty = lerp(ty, anchorEy, urgency);
      }
    }

    // Ball pull (role-weighted); na saída desde a defesa não puxar avançados para a linha de fundo.
    const pullDampBuild =
      relaxDepth && hasBall && p.playerId !== onBallPlayerId
        ? p.role === 'attack'
          ? 0.4
          : p.role === 'mid'
            ? 0.52
            : p.role === 'def'
              ? 0.72
              : 1
        : 1;
    // Invasão da área: atacantes/meios puxam pouco mais forte pra bola no último terço.
    // Magnitude dosada — movimento "excessivamente ativo" faz passes caírem em espaço
    // vazio (receptor já saiu do ponto em que o passador mirou).
    const inAttackingThird = hasBall && ballZone === 'att';
    const offensiveIntention =
      intention === 'attack_central' ||
      intention === 'attack_wide' ||
      intention === 'transition_attack';
    const boxRaidBoost =
      inAttackingThird && offensiveIntention
        ? p.role === 'attack'
          ? 1.55
          : p.role === 'mid'
            ? 1.25
            : 1
        : 1;
    const pullFactor = (BALL_PULL[p.role] ?? 0.06) * ballPullScale * pullDampBuild * boxRaidBoost;
    const centralBand = ball.x > 36 && ball.x < 64;
    const pullDamp = centralBand ? 0.5 : 1;
    tx += (ball.x - tx) * pullFactor * pullDamp;
    ty += (ball.y - ty) * pullFactor * pullDamp;

    // Carrier: stay with ball without collapsing support lines into a cluster
    if (p.playerId === onBallPlayerId && hasBall) {
      tx = lerp(tx, ball.x, 0.38);
      ty = lerp(ty, ball.y, 0.38);
    }

    tx = clampEngineXToRoleDepthBand(tx, p.role, side, matchHalf, relaxDepth);

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

/* ── Team block shift ────────────────────────────────────────────── */

/**
 * Desloca o time INTEIRO em bloco conforme a zona da bola.
 * Mantém a forma relativa (zagueiros atrás, atacantes na frente), mas o
 * conjunto desliza pra frente/trás e tilt lateral pro lado da bola.
 *
 * Magnitudes (engine units, 0–100):
 *   ∙ Em posse, bola no ataque     → +18  (bloco empurra tudo pra frente)
 *   ∙ Em posse, meio               → +8
 *   ∙ Em posse, defesa (construção)→ -2
 *   ∙ Defendendo, bola no ataque   → +10  (press alto)
 *   ∙ Defendendo, meio             → +2
 *   ∙ Defendendo, no próprio campo → -10  (bloco baixo)
 *
 * Role weight dosa quanto cada linha acompanha — GK move pouco, atacantes
 * já estão à frente e deslocam menos que os zagueiros/meios.
 */
function applyTeamBlockShift(
  ball: PitchPoint,
  hasBall: boolean,
  ballZone: BallZoneSimple,
  role: PitchPlayerState['role'],
  side: 'home' | 'away',
): { dx: number; dy: number } {
  // Magnitudes dosadas — shifts muito grandes geram passes para espaço vazio
  // porque o receptor cruza o campo no mesmo intervalo em que a bola viaja.
  let blockShift = 0;
  if (hasBall) {
    if (ballZone === 'att') blockShift = 12;
    else if (ballZone === 'mid') blockShift = 5;
    else blockShift = -1;
  } else {
    if (ballZone === 'def') blockShift = -7;
    else if (ballZone === 'mid') blockShift = 1;
    else blockShift = 6;
  }

  const roleW =
    role === 'gk' ? 0.35 :
    role === 'def' ? 1.0 :
    role === 'mid' ? 0.95 :
    0.85;

  const dirX = side === 'home' ? 1 : -1;
  const dx = blockShift * roleW * dirX;

  // Tilt lateral: 25% do deslocamento da bola do eixo y=50 (GK não acompanha).
  const lateralOffset = (ball.y - 50) * 0.25;
  const dy = role === 'gk' ? lateralOffset * 0.15 : lateralOffset * roleW;

  return { dx, dy };
}

/* ── Shape modifier application ──────────────────────────────────── */

function applyShapeToX(
  tx: number, ballX: number, shape: ShapeModifiers, role: PitchPlayerState['role'], side: 'home' | 'away',
): number {
  // lineHeight pushes defensive line up or drops it back.
  const lineShift = (shape.lineHeight - 0.5) * 8;
  if (role === 'def' || role === 'gk') {
    tx += side === 'home' ? lineShift : -lineShift;
  }
  // Atacantes e meios também avançam com o lineHeight — senão nunca invadem a área.
  // Dosado pra não "puxar" o jogador depois do passe já ter sido computado.
  if (role === 'attack' || role === 'mid') {
    const offensiveShift = (shape.lineHeight - 0.5) * (role === 'attack' ? 9 : 6);
    tx += side === 'home' ? offensiveShift : -offensiveShift;
  }
  // compactness pulls all lines toward ball X (keep mild to avoid scrums)
  const compactPull = (shape.compactness - 0.5) * 0.026;
  tx += (ballX - tx) * compactPull;

  return tx;
}

function applyShapeToY(
  ty: number, ballY: number, shape: ShapeModifiers, role: PitchPlayerState['role'],
): number {
  // Width expands laterals, narrows centrals.
  const widthFactor = shape.width;
  const lateralSlots = role === 'def' || role === 'attack';
  if (lateralSlots) {
    const fromCenter = ty - 50;
    ty = 50 + fromCenter * (0.85 + widthFactor * 0.3);
  }
  // Em ataque central (width baixo + lineHeight alto), atacantes convergem um pouco pro centro
  // pra brigar o cabeceio / posicionar melhor ângulo de chute.
  if (role === 'attack' && shape.lineHeight > 0.55 && shape.width < 0.65) {
    const centralPull = (0.65 - shape.width) * 0.35;
    ty += (50 - ty) * centralPull;
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

export const AWAY_SLOT_ORDER = ['gol', 'zag1', 'zag2', 'le', 'ld', 'vol', 'mc1', 'mc2', 'pe', 'ata', 'pd'] as const;

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
    const role = slotToRole(slotId, formation);
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

/** Titulares visitantes com atributos / cérebro (catálogo Genesis ou outro elenco real). */
export function buildAwayPitchPlayersFromEntities(
  orderedStarters: PlayerEntity[],
  formation: FormationSchemeId,
): PitchPlayerState[] {
  const bases = FORMATION_BASES[formation] ?? FORMATION_BASES['4-3-3'];
  const nxBounds = outfieldCatalogNxBounds(formation);
  return orderedStarters.slice(0, 11).map((pl, i) => {
    const slotId = AWAY_SLOT_ORDER[i] ?? 'mc1';
    const slot = bases[slotId] ?? bases.mc1;
    const role = slotToRole(slotId, formation);
    const kickX = kickoffEngineXPercent('away', slot.nx, nxBounds.nxMin, nxBounds.nxMax, slotId === 'gol');
    return {
      playerId: pl.id,
      slotId,
      name: pl.name,
      num: pl.num,
      pos: pl.pos,
      x: kickX,
      y: slot.nz * 100,
      fatigue: Math.round(pl.fatigue),
      role,
      attributes: matchAttributesFromPlayerEntity(pl),
      cognitiveArchetype: behaviorToCognitiveArchetype(pl.behavior),
      strongFoot: pl.strongFoot,
      archetype: pl.archetype,
    };
  });
}

function slotToRole(slot: string, formation: FormationSchemeId = '4-3-3'): PitchPlayerState['role'] {
  return roleForSlotInFormation(slot, formation);
}
