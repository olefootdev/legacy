import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { DecisionContext, OffBallAction, ContextReading, BallSector } from './types';
import { buildContextReading } from './ContextScanner';
import { nearestOpponentPressure01 } from '@/simulation/InteractionResolver';
import {
  mapRole,
  mapArchetype,
  extractAttributes,
  chooseAction,
  buildPlayerState,
  buildTeamTacticalContext,
  getCollectiveTarget,
  type ActionOption,
} from './collectiveIndividualDecision';
import { evaluateSupportQuality } from './teamCollectiveState';
import { getZoneTags, getDefendingGoalX, clampGoalkeeperTargetX, type TeamSide } from '@/match/fieldZones';
import { getDefensiveIntent } from '@/tactics/playingStyle';
import { pick01ForDecision } from './decisionRng';
import { applyPrethinkingToOffBall } from './prethinking';
import { contextualFullbackOverlapRoll01 } from './contextualGameplayBoost';
import { nudgeOffBallTowardHigherThreat } from './goalEvolutionRead';
import {
  evaluateGoalkeeperPositionDuel,
  evaluateMarkingDuelDefender,
  evaluateAnticipationDuel,
} from './localDuelRead';
import {
  buildFullbackInputs,
  shouldFireFullbackUtility,
} from './utilityFullbackSupport';
import {
  buildAttackingInputs,
  evaluateAttackingUtility,
} from './utilityAttackingSupport';

/** Bote só se o duelo de marcação ou a antecipação favorecer — evita exposição burra. */
function shouldPressCarrierByDuel(ctx: DecisionContext, reading: ContextReading): boolean {
  const carrier = ctx.opponents.find((o) => o.id === ctx.carrierId);
  if (!carrier) return true;
  const marking = evaluateMarkingDuelDefender(ctx.self, carrier, reading);
  const anticipation = evaluateAnticipationDuel(ctx.self, carrier, reading);
  if (marking.outcome === 'disadvantage' && anticipation.outcome !== 'advantage') return false;
  return true;
}

/**
 * Off-ball decision for players without possession.
 * Covers both attacking support and defensive actions.
 *
 * When `ctx.carrierJustChanged` is true the evaluation is immediate —
 * possession is a collective trigger: teammates reposition to create options
 * for the new carrier.
 */
export function decideOffBall(ctx: DecisionContext): OffBallAction {
  return applyPrethinkingToOffBall(ctx, decideOffBallCore(ctx));
}

function decideOffBallCore(ctx: DecisionContext): OffBallAction {
  const reading = buildContextReading(ctx);
  const teamHasBall = ctx.possession === ctx.self.side;

  // ── Sprint L4: marcação individual designada pelo manager ──
  // Quando time perde a posse e há assignment, jogador marca o adversário designado.
  if (!teamHasBall && ctx.markingAssignment && ctx.self.role !== 'gk') {
    const target = ctx.opponents.find((o) => o.id === ctx.markingAssignment);
    if (target) {
      // Mantém posição entre o adversário e o gol
      return {
        type: 'mark_man',
        targetId: target.id,
        targetX: target.x,
        targetZ: target.z,
      };
    }
  }

  if (ctx.self.role === 'gk') {
    const gkDuel = evaluateGoalkeeperPositionDuel(ctx, reading);
    const half = ctx.clockHalf ?? 1;
    const team = ctx.self.side as TeamSide;
    const ownGx = getDefendingGoalX(team, half);
    const toBallSign = Math.sign(ctx.ballX - ctx.self.x) || ctx.attackDir;
    const threat = Math.min(1, ctx.threatLevel);
    let tx = ctx.slotX;
    if (gkDuel.outcome === 'advantage') {
      tx = ctx.slotX + toBallSign * (4.2 + threat * 3.6) * (0.45 + threat * 0.5);
    } else if (gkDuel.outcome === 'balance') {
      tx = ctx.slotX + toBallSign * 1.9 * (0.4 + threat * 0.45);
    } else {
      tx = ctx.slotX + Math.sign(ownGx - ctx.slotX) * 1.5;
    }
    tx = clampGoalkeeperTargetX(team, half, tx);
    return {
      type: 'move_to_slot',
      targetX: tx,
      targetZ: clamp(ctx.slotZ + (ctx.ballZ - FIELD_WIDTH / 2) * 0.14, 12, FIELD_WIDTH - 12),
    };
  }

  // Collective/individual architecture layer for off-ball behavior.
  const collective = getCollectiveTarget(ctx.self, ctx);
  const role = mapRole(ctx.self);
  const attrs = extractAttributes(ctx.self, ctx.profile);
  const arch = mapArchetype(ctx.profile, ctx.self);
  const pressure01 = nearestOpponentPressure01(ctx.self, ctx.opponents);
  const tctx = buildTeamTacticalContext(ctx);
  const pstate = buildPlayerState(ctx, pressure01);
  const options: ActionOption[] = [
    { id: 'hold_position', targetX: collective.targetX, targetZ: collective.targetZ },
    { id: 'cover', targetX: ctx.slotX, targetZ: ctx.slotZ },
    { id: 'press', targetX: ctx.ballX, targetZ: ctx.ballZ },
  ];
  const half = ctx.clockHalf ?? 1;
  const zoneTags = getZoneTags({ x: ctx.self.x, z: ctx.self.z }, { team: ctx.self.side, half });
  const pick = chooseAction(role, attrs, arch, tctx, pstate, options, !!ctx.decisionDebug, { tags: zoneTags });
  if (!teamHasBall) {
    // Voice command: pressão / falta tática → força press mais próximo, ignora delay.
    const vPress = ctx.voiceBias?.pressIntensity ?? 0;
    const vFoul = ctx.voiceBias?.foulBoost ?? 0;
    if (vPress >= 0.5 || vFoul >= 0.5) {
      const distToBall = Math.hypot(ctx.self.x - ctx.ballX, ctx.self.z - ctx.ballZ);
      if (distToBall < 22) {
        return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
      }
    }
    if (pick.action.id === 'press') {
      if (!shouldPressCarrierByDuel(ctx, reading)) {
        return {
          type: 'delay_press',
          targetX: (ctx.self.x + ctx.ballX) / 2,
          targetZ: (ctx.self.z + ctx.ballZ) / 2,
        };
      }
      return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
    }
    if (pick.action.id === 'cover' || pick.action.id === 'hold_position') {
      return {
        type: 'cover_central',
        targetX: pick.action.targetX ?? collective.targetX,
        targetZ: pick.action.targetZ ?? collective.targetZ,
      };
    }
  } else if (pick.action.id === 'hold_position') {
    return { type: 'move_to_slot', targetX: collective.targetX, targetZ: collective.targetZ };
  }

  if (teamHasBall) {
    return decideAttackingSupport(ctx, reading);
  }

  return decideDefending(ctx, reading);
}

// ---------------------------------------------------------------------------
// Attacking support (team has ball)
// ---------------------------------------------------------------------------

function countTeammatesNearBall(ctx: DecisionContext, radius: number): number {
  let n = 0;
  for (const t of ctx.teammates) {
    if (t.id === ctx.self.id) continue;
    if (Math.hypot(t.x - ctx.ballX, t.z - ctx.ballZ) < radius) n++;
  }
  return n;
}

/**
 * Entre colegas sem a bola, quão “à frente” na fila de apoio curto estamos (0 = mais perto).
 * O portador não entra — já está na jogada.
 */
function nonCarrierDistanceRankToBall(ctx: DecisionContext): number {
  if (!ctx.carrierId || ctx.self.id === ctx.carrierId) return 0;
  const dSelf = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  let rank = 0;
  for (const t of ctx.teammates) {
    if (t.id === ctx.self.id) continue;
    if (t.id === ctx.carrierId) continue;
    const d = Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z);
    if (d < dSelf - 0.45) rank++;
    else if (Math.abs(d - dSelf) <= 0.45 && t.id.localeCompare(ctx.self.id) < 0) rank++;
  }
  return rank;
}

/** Evita “vaca louca”: com portador, só 1–2 apoiantes fecham a bola; os outros largam e esperam linha. */
function shouldDeferOffBallBallChase(ctx: DecisionContext, distToBall: number): boolean {
  if (!ctx.carrierId || ctx.self.id === ctx.carrierId) return false;
  const rank = nonCarrierDistanceRankToBall(ctx);
  if (distToBall < 18 && rank > 0) return true;
  if (distToBall < 30 && rank > 1) return true;
  return false;
}

function peelFromCarrierBallCluster(ctx: DecisionContext): OffBallAction {
  const role = ctx.self.role;
  const sideSign = ctx.self.z < ctx.ballZ ? -1 : 1;

  // Attackers peel forward into depth instead of sideways
  if (role === 'attack') {
    return {
      type: 'attack_depth',
      targetX: clamp(ctx.ballX + ctx.attackDir * (12 + pick01ForDecision(ctx) * 8), 5, FIELD_LENGTH - 5),
      targetZ: clamp(ctx.self.z + sideSign * (6 + pick01ForDecision(ctx) * 6), 6, FIELD_WIDTH - 6),
    };
  }

  // Defenders/DMs peel back toward slot to provide coverage
  if (role === 'def' || ctx.self.slotId === 'vol') {
    return {
      type: 'defensive_cover',
      targetX: clamp(ctx.slotX, 5, FIELD_LENGTH - 5),
      targetZ: clamp(ctx.slotZ + sideSign * 4, 4, FIELD_WIDTH - 4),
    };
  }

  // Midfielders / wingers: peel wide to create passing angle
  const rz = findReceptionZone(ctx);
  const peelZ = clamp(rz.z + sideSign * (10 + pick01ForDecision(ctx) * 7), 4, FIELD_WIDTH - 4);
  const peelX = clamp(rz.x + ctx.attackDir * (2 + pick01ForDecision(ctx) * 5), 3, FIELD_LENGTH - 3);
  return {
    type: 'open_width',
    targetX: peelX,
    targetZ: peelZ,
  };
}

function decideAttackingSupport(ctx: DecisionContext, reading: ContextReading): OffBallAction {
  const distToBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  const profile = ctx.profile;
  const role = ctx.self.role;
  const slot = ctx.self.slotId ?? '';
  const sector = ctx.ballSector;

  // Hard cap: max 2 teammates near ball — third player MUST peel away.
  const nearBallCount = countTeammatesNearBall(ctx, 10);
  const tripleCluster =
    ctx.carrierId
    && ctx.self.id !== ctx.carrierId
    && nearBallCount >= 2
    && distToBall < 18;
  if (shouldDeferOffBallBallChase(ctx, distToBall) || tripleCluster) {
    return applySpacingToAction(ctx, peelFromCarrierBallCluster(ctx));
  }

  // -----------------------------------------------------------------------
  // ANTI-SWARM: if too many teammates are already forward, stay anchored
  // to maintain team structure instead of joining the pile.
  // -----------------------------------------------------------------------
  const phase = ctx.attackPhase;
  const isAttackerLike =
    role === 'attack'
    || slot.includes('pe') || slot.includes('pd')
    || slot.includes('le') || slot.includes('ld')
    || slot.includes('mei') || slot.includes('am');

  // -----------------------------------------------------------------------
  // FASE 1.3 — Utility AI multi-candidate (Phases 2–4).
  // Substitui: box_entry cascade + shouldAnchorToSlot + distToBall>30 + collective sq.
  // Quando nenhum candidate atinge ATTACKING_FIRE_THRESHOLD, cai pra Phase 5
  // (role dispatch legacy) — comportamento legacy 100% preservado nesse path.
  // Phase 1 (cluster guard, acima) e Phase 5 (role dispatch, abaixo) intactos.
  // -----------------------------------------------------------------------
  {
    const inBoxCount = (phase === 'box_entry' || phase === 'final_third') && isAttackerLike
      ? countTeammatesInBox(ctx)
      : 0;
    const sq = ctx.collective
      ? evaluateSupportQuality(
          ctx.self, ctx.ballX, ctx.ballZ, ctx.attackDir,
          ctx.teammates, ctx.opponents, ctx.collective,
        )
      : null;
    const inputs = buildAttackingInputs({
      role,
      slot,
      attackPhase: phase,
      inBoxCount,
      shouldAnchor: shouldAnchorToSlot(ctx),
      distToBall,
      supportQuality: sq,
      // PR1: player-aware inputs (posição + atributos).
      selfX: ctx.self.x,
      attackDir: ctx.attackDir,
      finalizacao: ctx.self.finalizacao,
      velocidade: ctx.self.velocidade,
    });
    const { action: utilityAction } = evaluateAttackingUtility(
      ctx,
      reading,
      inputs,
      { ctx, reading, pick01: pick01ForDecision, findReceptionZone },
    );
    if (utilityAction) {
      const lifted = nudgeOffBallTowardHigherThreat(ctx, reading, utilityAction);
      let finalAction = applySpacingToAction(ctx, lifted);
      if (ctx.offensivePassMobility) {
        finalAction = ctx.offensivePassMobility.forward
          ? applySectorChangeAfterForwardPass(ctx, finalAction)
          : applyLightSectorNudgeAfterPass(ctx, finalAction);
      }
      return finalAction;
    }
    // Fallthrough → Phase 5 (role dispatch legacy).
  }

  // -----------------------------------------------------------------------
  // Role-specific positioning with spacing enforcement
  // -----------------------------------------------------------------------
  let action: OffBallAction;

  if (role === 'attack') {
    action = decideStrikerSupport(ctx, reading, distToBall, sector);
  } else if (slot.includes('pe') || slot.includes('pd')) {
    action = decideWingerSupport(ctx, reading, distToBall, sector);
  } else if (slot.includes('le') || slot.includes('ld')) {
    action = decideFullbackSupport(ctx, reading, sector);
  } else if (role === 'mid') {
    action = decideMidSupport(ctx, reading, distToBall, sector);
  } else if (role === 'def') {
    action = decideDefenderSupport(ctx, reading, distToBall);
  } else if (distToBall < 15 && nonCarrierDistanceRankToBall(ctx) === 0) {
    const rz = findReceptionZone(ctx);
    action = {
      type: 'offer_short_line',
      targetX: rz.x,
      targetZ: rz.z,
    };
  } else {
    const rz = findReceptionZone(ctx);
    action = { type: 'move_to_slot', targetX: rz.x, targetZ: rz.z };
  }

  // Mobilidade ofensiva pós-passe: troca de setor / continuidade (meios táticos ofensivos).
  if (ctx.offensivePassMobility) {
    action = ctx.offensivePassMobility.forward
      ? applySectorChangeAfterForwardPass(ctx, action)
      : applyLightSectorNudgeAfterPass(ctx, action);
  }

  // Ajuste leve rumo a posições que elevam ameaça ao golo (integrado ao apoio existente).
  const lifted = nudgeOffBallTowardHigherThreat(ctx, reading, action);
  return applySpacingToAction(ctx, lifted);
}

// ---------------------------------------------------------------------------
// Pós-passe: troca de corredor + ligeira profundidade (organização ofensiva)
// ---------------------------------------------------------------------------

/** Passe vertical / último terço: desmarque forte para não “ficar no mesmo setor”. */
function applySectorChangeAfterForwardPass(ctx: DecisionContext, action: OffBallAction): OffBallAction {
  if (!('targetX' in action) || !('targetZ' in action)) return action;
  const midZ = FIELD_WIDTH / 2;
  const awayFromBallZ = ctx.ballZ >= midZ ? -1 : 1;
  const dz = awayFromBallZ * (6.5 + pick01ForDecision(ctx) * 5.5);
  const dx = ctx.attackDir * (2.2 + pick01ForDecision(ctx) * 4);
  return {
    ...action,
    targetX: clamp(action.targetX + dx, 3, FIELD_LENGTH - 3),
    targetZ: clamp(action.targetZ + dz, 3, FIELD_WIDTH - 3),
  };
}

/** Passe lateral / seguro: continuidade mais suave. */
function applyLightSectorNudgeAfterPass(ctx: DecisionContext, action: OffBallAction): OffBallAction {
  if (!('targetX' in action) || !('targetZ' in action)) return action;
  const midZ = FIELD_WIDTH / 2;
  const awayFromBallZ = ctx.ballZ >= midZ ? -1 : 1;
  const dz = awayFromBallZ * (3.5 + pick01ForDecision(ctx) * 3);
  const dx = ctx.attackDir * (1 + pick01ForDecision(ctx) * 2);
  return {
    ...action,
    targetX: clamp(action.targetX + dx, 3, FIELD_LENGTH - 3),
    targetZ: clamp(action.targetZ + dz, 3, FIELD_WIDTH - 3),
  };
}

// ---------------------------------------------------------------------------
// Role-specific attacking support (sector-aware)
// ---------------------------------------------------------------------------

/**
 * Detect if a *teammate* fullback has pushed far forward, exposing the
 * corridor behind them. Used by CBs/DMs to shift cover toward that wing.
 */
function detectExposedFlankFromTeammate(
  ctx: DecisionContext,
): { x: number; z: number } | null {
  const ad = ctx.attackDir;
  for (const tm of ctx.teammates) {
    if (tm.id === ctx.self.id) continue;
    if (tm.role !== 'def') continue;
    const isFb = tm.z < FIELD_WIDTH * 0.3 || tm.z > FIELD_WIDTH * 0.7;
    if (!isFb) continue;
    const localDepth = ad === 1 ? tm.x : FIELD_LENGTH - tm.x;
    if (localDepth > FIELD_LENGTH * 0.55) {
      const ownGoalX = ad === 1 ? 0 : FIELD_LENGTH;
      const coverX = ownGoalX + ad * 18;
      const coverZ = tm.z < FIELD_WIDTH / 2
        ? FIELD_WIDTH * 0.22
        : FIELD_WIDTH * 0.78;
      return { x: coverX, z: coverZ };
    }
  }
  return null;
}

/**
 * Detect if an opponent fullback has pushed far forward, opening a corridor
 * behind them. Returns the Z of the open wing and target X depth, or null.
 */
function detectOpenCorridorFromAdvancedFullback(
  ctx: DecisionContext,
): { targetX: number; targetZ: number } | null {
  const ad = ctx.attackDir;
  const defLineX = ad === 1 ? FIELD_LENGTH * 0.25 : FIELD_LENGTH * 0.75;
  for (const opp of ctx.opponents) {
    if (opp.role !== 'def') continue;
    const isFullback = opp.z < FIELD_WIDTH * 0.3 || opp.z > FIELD_WIDTH * 0.7;
    if (!isFullback) continue;
    const oppDepthFromGoal = ad === 1
      ? FIELD_LENGTH - opp.x
      : opp.x;
    if (oppDepthFromGoal > 35) {
      const behindZ = opp.z;
      const behindX = ad === 1 ? FIELD_LENGTH - 12 : 12;
      const nearbyOpps = ctx.opponents.filter(
        (o) => o.id !== opp.id && Math.hypot(o.x - behindX, o.z - behindZ) < 14,
      );
      if (nearbyOpps.length < 2) {
        return {
          targetX: clamp(behindX, 5, FIELD_LENGTH - 5),
          targetZ: clamp(behindZ, 6, FIELD_WIDTH - 6),
        };
      }
    }
  }
  return null;
}

function decideStrikerSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;

  if (reading.teamPhase === 'attack') {
    // If penalty area has some free space (few opponents in immediate box)
    // prefer to infiltrate the small area to create finishing chances.
    try {
      const opponentsInBox = ctx.opponents.filter((o) => {
        const inBoxX = ctx.attackDir === 1 ? o.x > FIELD_LENGTH - 22 : o.x < 22;
        const inBoxZ = Math.abs(o.z - FIELD_WIDTH / 2) < FIELD_WIDTH * 0.34;
        return inBoxX && inBoxZ;
      }).length;
      const boxSpaceFactor = Math.max(0, 1 - opponentsInBox / 4);
      if (boxSpaceFactor > 0.45 && pick01ForDecision(ctx) < 0.45 + profile.verticality * 0.3) {
        // aim to occupy central penalty area depth
        return {
          type: 'infiltrate',
          targetX: clamp(goalX - ctx.attackDir * (8 + pick01ForDecision(ctx) * 6), 3, FIELD_LENGTH - 3),
          targetZ: clamp(FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 8, 6, FIELD_WIDTH - 6),
        };
      }
    } catch (e) {
      // noop
    }
    const openCorridor = detectOpenCorridorFromAdvancedFullback(ctx);
    if (openCorridor && pick01ForDecision(ctx) < 0.55) {
      return { type: 'attack_depth', ...openCorridor };
    }
    // Ball on the wing → attack box at specific posts (spread)
    if (sector !== 'center') {
      const nearPost = sector === 'left' ? FIELD_WIDTH * 0.3 : FIELD_WIDTH * 0.7;
      const farPost = sector === 'left' ? FIELD_WIDTH * 0.7 : FIELD_WIDTH * 0.3;
      // Use own Z position to decide near vs far post (spread)
      const myZ = ctx.self.z;
      const targetPost = Math.abs(myZ - nearPost) < Math.abs(myZ - farPost) ? nearPost : farPost;
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (4 + pick01ForDecision(ctx) * 5), 3, FIELD_LENGTH - 3),
        targetZ: clamp(targetPost + (pick01ForDecision(ctx) - 0.5) * 6, 8, FIELD_WIDTH - 8),
      };
    }

    // Central play: position between defenders but use own lateral offset
    const lateralOffset = ctx.self.z < FIELD_WIDTH / 2 ? -8 : 8;
    const laneBoost =
      reading.laneBehindBall.depthM > 10
      && reading.laneBehindBall.widthM > 7
      && reading.localTargetConfidence.ball01 > 0.42
        ? 0.14
        : 0;
    if (pick01ForDecision(ctx) < 0.5 + laneBoost) {
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (5 + pick01ForDecision(ctx) * 7), 3, FIELD_LENGTH - 3),
        targetZ: clamp(FIELD_WIDTH / 2 + lateralOffset + (pick01ForDecision(ctx) - 0.5) * 6, 8, FIELD_WIDTH - 8),
      };
    }

    // Drop to create space for arriving midfielders (keeps structure)
    if (reading.threatTrend === 'falling' || pick01ForDecision(ctx) < 0.3) {
      return {
        type: 'drop_to_create_space',
        targetX: clamp(ctx.self.x - ctx.attackDir * 8, 5, FIELD_LENGTH - 5),
        targetZ: clamp(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 8, 6, FIELD_WIDTH - 6),
      };
    }

    if (nonCarrierDistanceRankToBall(ctx) > 0) {
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (8 + pick01ForDecision(ctx) * 8), 5, FIELD_LENGTH - 5),
        targetZ: clamp(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 10, 6, FIELD_WIDTH - 6),
      };
    }
    return {
      type: 'anticipate_second_ball',
      targetX: clamp(ctx.ballX + ctx.attackDir * 6, 5, FIELD_LENGTH - 5),
      targetZ: clamp(ctx.ballZ + (pick01ForDecision(ctx) > 0.5 ? 10 : -10), 6, FIELD_WIDTH - 6),
    };
  }

  // Progression: short line ONLY if closest non-carrier AND no one else is already there.
  if (distToBall < 20 && nonCarrierDistanceRankToBall(ctx) === 0 && countTeammatesNearBall(ctx, 12) < 2) {
    const rz = findReceptionZone(ctx);
    return {
      type: 'offer_short_line',
      targetX: clamp(rz.x + ctx.attackDir * 5, 10, FIELD_LENGTH - 5),
      targetZ: clamp(rz.z, 10, FIELD_WIDTH - 10),
    };
  }

  // Default: hold depth — striker's primary duty is staying high.
  return {
    type: 'attack_depth',
    targetX: clamp(goalX - ctx.attackDir * (10 + pick01ForDecision(ctx) * 8), 5, FIELD_LENGTH - 5),
    targetZ: clamp(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 10, 6, FIELD_WIDTH - 6),
  };
}

// When midfield is congested, nudge fullbacks to push higher and open width
function shouldFullbackPushOnCongestedMidfield(ctx: DecisionContext): boolean {
  try {
    const midOpponents = ctx.opponents.filter((o) => {
      const inMidX = ctx.attackDir === 1 ? o.x > FIELD_LENGTH * 0.33 && o.x < FIELD_LENGTH * 0.77 : o.x < FIELD_LENGTH * 0.66 && o.x > FIELD_LENGTH * 0.23;
      return inMidX;
    }).length;
    const midTeammates = ctx.teammates.filter((t) => {
      const inMidX = ctx.attackDir === 1 ? t.x > FIELD_LENGTH * 0.33 && t.x < FIELD_LENGTH * 0.77 : t.x < FIELD_LENGTH * 0.66 && t.x > FIELD_LENGTH * 0.23;
      return inMidX;
    }).length;
    // If midfield is crowded (more opponents than teammates near midfield) suggest push
    return midOpponents >= Math.max(3, midTeammates + 1);
  } catch (e) {
    return false;
  }
}

function decideWingerSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;
  const isLeft = ctx.self.z < FIELD_WIDTH / 2;
  const mySector: BallSector = isLeft ? 'left' : 'right';
  const wideZ = isLeft ? 4 + pick01ForDecision(ctx) * 6 : FIELD_WIDTH - 4 - pick01ForDecision(ctx) * 6;

  // Exploit corridor left by advanced opponent fullback on the winger's side
  if (reading.teamPhase === 'attack' || reading.teamPhase === 'progression') {
    const openCorridor = detectOpenCorridorFromAdvancedFullback(ctx);
    if (openCorridor) {
      const corridorOnMySide = isLeft
        ? openCorridor.targetZ < FIELD_WIDTH * 0.4
        : openCorridor.targetZ > FIELD_WIDTH * 0.6;
      if (corridorOnMySide && pick01ForDecision(ctx) < 0.6) {
        return { type: 'attack_depth', ...openCorridor };
      }
    }
  }

  // Same-side as ball: get wide and high
  if (sector === mySector) {
    if (pick01ForDecision(ctx) < 0.5 + profile.workRate * 0.2) {
      return {
        type: 'open_width',
        targetX: clamp(ctx.ballX + ctx.attackDir * (8 + pick01ForDecision(ctx) * 10), 5, FIELD_LENGTH - 5),
        targetZ: wideZ,
      };
    }
  }

  // Opposite side: cut inside, offer diagonal receiving option
  if (sector !== mySector && sector !== 'center') {
    return {
      type: 'offer_diagonal_line',
      targetX: clamp(ctx.ballX + ctx.attackDir * 10, 10, FIELD_LENGTH - 10),
      targetZ: clamp(FIELD_WIDTH / 2 + (isLeft ? -6 : 6), 10, FIELD_WIDTH - 10),
    };
  }

  // Central play: hug the touchline to stretch the defense
  if (sector === 'center') {
    if (reading.teamPhase === 'attack' && pick01ForDecision(ctx) < 0.4) {
      const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (8 + pick01ForDecision(ctx) * 10), 5, FIELD_LENGTH - 5),
        targetZ: wideZ,
      };
    }
    return {
      type: 'open_width',
      targetX: clamp(ctx.ballX + ctx.attackDir * 6, 5, FIELD_LENGTH - 5),
      targetZ: wideZ,
    };
  }

  return {
    type: 'open_width',
    targetX: clamp(ctx.ballX + ctx.attackDir * (5 + pick01ForDecision(ctx) * 8), 5, FIELD_LENGTH - 5),
    targetZ: wideZ,
  };
}

function decideFullbackSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;
  const isLeft = ctx.self.z < FIELD_WIDTH / 2;
  const mySector: BallSector = isLeft ? 'left' : 'right';
  const overlapRoll01 = contextualFullbackOverlapRoll01(ctx, reading, sector);
  const inputs = buildFullbackInputs(
    reading,
    profile,
    sector,
    mySector,
    overlapRoll01,
    // PR1: player-aware inputs (posição + cruzamento).
    ctx.self.x,
    ctx.attackDir,
    ctx.self.cruzamento,
  );
  const { action } = shouldFireFullbackUtility(ctx, reading, inputs, isLeft, pick01ForDecision);
  return action;
}

function decideMidSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;

  // Close to ball → short line ONLY if closest AND no other short supporters already.
  if (distToBall < 15 && nonCarrierDistanceRankToBall(ctx) === 0 && countTeammatesNearBall(ctx, 12) < 2) {
    if (pick01ForDecision(ctx) < 0.4) {
      const rz = findReceptionZone(ctx);
      return {
        type: 'offer_short_line',
        targetX: rz.x,
        targetZ: rz.z,
      };
    }
  }

  // Diagonal line: primary mid role — offer angle away from carrier's line.
  if (distToBall < 25 && pick01ForDecision(ctx) < 0.5 + profile.vision * 0.2) {
    const diagDir = ctx.self.z < FIELD_WIDTH / 2 ? 1 : -1;
    const diagZ = ctx.self.z + diagDir * (8 + pick01ForDecision(ctx) * 6);
    return {
      type: 'offer_diagonal_line',
      targetX: clamp(ctx.ballX + ctx.attackDir * (6 + pick01ForDecision(ctx) * 6), 5, FIELD_LENGTH - 5),
      targetZ: clamp(diagZ, 5, FIELD_WIDTH - 5),
    };
  }

  // Ball on the wing → position at edge of box but use own Z anchor
  if (sector !== 'center' && reading.teamPhase === 'attack') {
    if (pick01ForDecision(ctx) < 0.3 + profile.workRate * 0.15) {
      const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
      const t = anchoredTarget(ctx,
        goalX - ctx.attackDir * 20,
        ctx.slotZ,
        25,
      );
      return { type: 'anticipate_second_ball', targetX: t.x, targetZ: t.z };
    }
  }

  // Infiltrate: between lines (progression) or box run (attack phase for high-verticality mids)
  if (reading.teamPhase === 'progression' && profile.verticality > 0.5 && pick01ForDecision(ctx) < 0.35) {
    const t = anchoredTarget(ctx,
      ctx.ballX + ctx.attackDir * 12,
      ctx.slotZ + (pick01ForDecision(ctx) - 0.5) * 10,
      22,
    );
    return { type: 'infiltrate', targetX: t.x, targetZ: t.z };
  }
  if (reading.teamPhase === 'attack' && profile.verticality > 0.65 && pick01ForDecision(ctx) < 0.28) {
    const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
    return {
      type: 'infiltrate',
      targetX: clamp(goalX - ctx.attackDir * (14 + pick01ForDecision(ctx) * 8), 5, FIELD_LENGTH - 5),
      targetZ: clamp(FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 18, 8, FIELD_WIDTH - 8),
    };
  }

  // Default: hold structural position, create passing angle from carrier
  const rz = findReceptionZone(ctx);
  return {
    type: 'move_to_slot',
    targetX: rz.x,
    targetZ: rz.z,
  };
}

function decideDefenderSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
): OffBallAction {
  // Build-up: offer short safety pass behind ball
  if (reading.teamPhase === 'buildup' && distToBall < 20) {
    return {
      type: 'offer_short_line',
      targetX: clamp(ctx.ballX - ctx.attackDir * 8, 3, FIELD_LENGTH - 3),
      targetZ: clamp(ctx.ballZ + (pick01ForDecision(ctx) - 0.5) * 15, 5, FIELD_WIDTH - 5),
    };
  }

  // Progression: hold depth, only minor lateral shift to stay connected
  if (reading.teamPhase === 'progression') {
    return {
      type: 'move_to_slot',
      targetX: ctx.slotX,
      targetZ: lerpToward(ctx.slotZ, ctx.ballZ, 0.08),
    };
  }

  return {
    type: 'defensive_cover',
    targetX: ctx.slotX,
    targetZ: ctx.slotZ,
  };
}

// ---------------------------------------------------------------------------
// Defending (opponent has ball)
// Goal: REDUCE the opponent's goal threat and RECOVER the ball.
// Decisions scale with how dangerous the opponent's attack is.
// ---------------------------------------------------------------------------

function decideTransitionDefense(ctx: DecisionContext, reading: ContextReading): OffBallAction | null {
  const role = ctx.self.role;
  const ballLineX = ctx.ballX;

  if (role === 'mid' && reading.pressure.intensity !== 'extreme') {
    const towardCenterZ = ctx.self.z + (FIELD_WIDTH / 2 - ctx.self.z) * 0.4;
    return {
      type: 'close_passing_lane',
      targetX: clamp(ballLineX - ctx.attackDir * 8, 5, FIELD_LENGTH - 5),
      targetZ: clamp(towardCenterZ, 8, FIELD_WIDTH - 8),
    };
  }

  if (role === 'def' || role === 'gk') {
    const isBehindBall = ctx.attackDir === 1 ? ctx.self.x < ballLineX : ctx.self.x > ballLineX;
    if (!isBehindBall) {
      return {
        type: 'recover_behind_ball',
        targetX: clamp(ballLineX - ctx.attackDir * 7, 3, FIELD_LENGTH - 3),
        targetZ: clamp(
          FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? -6 : 6),
          6,
          FIELD_WIDTH - 6,
        ),
      };
    }
  }

  return null;
}

function decideDefending(ctx: DecisionContext, reading: ContextReading): OffBallAction {
  const distToBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  const profile = ctx.profile;
  const role = ctx.self.role;
  const mentality = ctx.mentality;
  const defenseIntent = getDefensiveIntent(ctx.tacticalStyle);
  const half = ctx.clockHalf ?? 1;
  const zoneTags = getZoneTags({ x: ctx.self.x, z: ctx.self.z }, { team: ctx.self.side, half });
  const inOwnBox = zoneTags.includes('own_box');
  const collectivePhase = ctx.collective?.phase;
  const isBlockPhase = collectivePhase === 'defensive_block';

  // Segurança > estilo: em perigo máximo dentro da própria área, colapsar central.
  if (inOwnBox && role !== 'gk') {
    return {
      type: 'cover_central',
      targetX: clamp(ctx.slotX - ctx.attackDir * 2, 5, FIELD_LENGTH - 5),
      targetZ: clamp(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? -4 : 4), 8, FIELD_WIDTH - 8),
    };
  }

  // Coordinated defensive retreat: if opponents outnumber defenders near our goal,
  // any non-GK not already in position drops back to cover the line.
  if (role !== 'gk') {
    const ownGoalX = ctx.attackDir === 1 ? 0 : FIELD_LENGTH;
    const dangerZone = 35; // metres from own goal
    const defendersNearGoal = ctx.teammates.filter(
      (t) => t.role !== 'gk' && Math.abs(t.x - ownGoalX) < dangerZone,
    ).length;
    const attackersNearGoal = ctx.opponents.filter(
      (o) => Math.abs(o.x - ownGoalX) < dangerZone,
    ).length;
    const selfNearGoal = Math.abs(ctx.self.x - ownGoalX) < dangerZone;
    if (attackersNearGoal > defendersNearGoal + 1 && !selfNearGoal) {
      // Outnumbered — retreat to reinforce
      const retreatX = clamp(ownGoalX + ctx.attackDir * (12 + (pick01ForDecision(ctx) * 8)), 5, FIELD_LENGTH - 5);
      const retreatZ = clamp(ctx.self.z, 8, FIELD_WIDTH - 8);
      return { type: 'recover_behind_ball', targetX: retreatX, targetZ: retreatZ };
    }
  }

  if (ctx.teamPhase === 'transition_def') {
    const td = decideTransitionDefense(ctx, reading);
    if (td) return td;
  }

  // Cover the corridor left by an advanced teammate fullback:
  // CBs and DMs shift toward the exposed wing to prevent opponent counters.
  if (role === 'def' || ctx.self.slotId === 'vol') {
    const exposed = detectExposedFlankFromTeammate(ctx);
    if (exposed) {
      return {
        type: 'cover_central',
        targetX: clamp(exposed.x, 5, FIELD_LENGTH - 5),
        targetZ: clamp(exposed.z, 6, FIELD_WIDTH - 6),
      };
    }
  }

  const oppThreat = reading.threatLevel;
  const oppTrend = reading.threatTrend;

  // -----------------------------------------------------------------------
  // CRITICAL opponent threat: all hands on deck — protect the goal
  // -----------------------------------------------------------------------
  if (oppThreat > 0.65) {
    // Recover into the box if not already there
    const ownGoalX = ctx.attackDir === 1 ? 0 : FIELD_LENGTH;
    const distToOwnGoal = Math.abs(ctx.self.x - ownGoalX);

    if (role === 'def' || role === 'mid') {
      // Protect the box
      if (distToOwnGoal > 25) {
        return {
          type: 'recover_behind_ball',
          targetX: clamp(ownGoalX + ctx.attackDir * 16, 3, FIELD_LENGTH - 3),
          targetZ: clamp(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? -8 : 8), 5, FIELD_WIDTH - 5),
        };
      }

      // Close to box: mark the most dangerous attacker
      const dangerousOpp = findMostDangerousOpponent(ctx);
      if (dangerousOpp) {
        return { type: 'mark_man', targetId: dangerousOpp.id, targetX: dangerousOpp.x, targetZ: dangerousOpp.z };
      }
      return { type: 'cover_central', targetX: clamp(ownGoalX + ctx.attackDir * 12, 5, FIELD_LENGTH - 5), targetZ: clamp(FIELD_WIDTH / 2, 12, FIELD_WIDTH - 12) };
    }

    // Attackers/wingers: help defend if threat is extreme
    if (oppThreat > 0.8 && profile.workRate > 0.5) {
      return {
        type: 'recover_behind_ball',
        targetX: clamp(ctx.ballX - ctx.attackDir * 10, 5, FIELD_LENGTH - 5),
        targetZ: ctx.slotZ,
      };
    }
  }

  // -----------------------------------------------------------------------
  // DANGEROUS opponent threat: organized containment
  // -----------------------------------------------------------------------
  if (oppThreat > 0.4) {
    const pressThreshold = mentality > 65 ? 18 : 12;
    const dangerMaxPressers = isBlockPhase ? 1 : 2;

    // Press the carrier if close enough and not too many already pressing
    if (distToBall < pressThreshold && role !== 'gk') {
      const dangerNearerCount = ctx.teammates.filter(t =>
        t.id !== ctx.self.id && Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z) < distToBall,
      ).length;
      if (dangerNearerCount < dangerMaxPressers && (profile.workRate > 0.55 || pick01ForDecision(ctx) < 0.4)) {
        if (!shouldPressCarrierByDuel(ctx, reading)) {
          return {
            type: 'delay_press',
            targetX: (ctx.self.x + ctx.ballX) / 2,
            targetZ: (ctx.self.z + ctx.ballZ) / 2,
          };
        }
        return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
      }
      if (dangerNearerCount < dangerMaxPressers) {
        return { type: 'delay_press', targetX: (ctx.self.x + ctx.ballX) / 2, targetZ: (ctx.self.z + ctx.ballZ) / 2 };
      }
    }

    // Mid: close passing lanes toward goal
    if (role === 'mid' && distToBall < 20) {
      const goalDir = ctx.attackDir === 1 ? -1 : 1;
      return {
        type: 'close_passing_lane',
        targetX: clamp(ctx.ballX + goalDir * 6, 5, FIELD_LENGTH - 5),
        targetZ: clamp(ctx.ballZ + (ctx.self.z < ctx.ballZ ? -4 : 4), 5, FIELD_WIDTH - 5),
      };
    }

    // Def: protect central
    if (role === 'def' || ctx.self.id.includes('vol')) {
      return {
        type: 'cover_central',
        targetX: clamp(ctx.slotX, 5, FIELD_LENGTH - 5),
        targetZ: clamp(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? -6 : 6), 8, FIELD_WIDTH - 8),
      };
    }
  }

  // -----------------------------------------------------------------------
  // LOW-MEDIUM opponent threat: structured defense, look to recover
  // -----------------------------------------------------------------------

  // Collective defense: limit active pressers based on phase and proximity
  const pressThreshold = Math.max(8, (mentality > 65 ? 20 : mentality > 45 ? 14 : 10) + (defenseIntent.pressTrigger - 16));
  const maxPressers = isBlockPhase ? 1 : (mentality > 65 ? 3 : 2);

  // Count who is closer to the ball — prevent swarm
  const nearerCount = ctx.teammates.filter(t =>
    t.id !== ctx.self.id && Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z) < distToBall,
  ).length;

  // Press if in range, respecting anti-swarm limits
  if (distToBall < pressThreshold && role !== 'gk' && nearerCount < maxPressers) {
    if (profile.workRate > 0.6 || pick01ForDecision(ctx) < 0.5) {
      if (!shouldPressCarrierByDuel(ctx, reading)) {
        return {
          type: 'delay_press',
          targetX: (ctx.self.x + ctx.ballX) / 2,
          targetZ: (ctx.self.z + ctx.ballZ) / 2,
        };
      }
      return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
    }
    if (nearerCount < maxPressers) {
      return { type: 'delay_press', targetX: (ctx.self.x + ctx.ballX) / 2, targetZ: (ctx.self.z + ctx.ballZ) / 2 };
    }
  }

  // In defensive block with good compactness: protect zone over chasing
  if (isBlockPhase && ctx.collective && ctx.collective.compactness > 0.35) {
    const ownGoalX = ctx.attackDir === 1 ? 0 : FIELD_LENGTH;
    const ballIsCentral = Math.abs(ctx.ballZ - FIELD_WIDTH / 2) < 15;
    if (ballIsCentral && role === 'mid') {
      return {
        type: 'close_passing_lane',
        targetX: clamp(ctx.slotX, 5, FIELD_LENGTH - 5),
        targetZ: clamp(
          (ctx.self.z + ctx.ballZ) / 2,
          8, FIELD_WIDTH - 8,
        ),
      };
    }
    if (role === 'def') {
      const coverX = clamp(ctx.slotX + (ctx.ballX - ctx.slotX) * 0.15, 5, FIELD_LENGTH - 5);
      return { type: 'cover_central', targetX: coverX, targetZ: ctx.slotZ };
    }
    void ownGoalX;
  }

  // Recover behind ball line if ahead of it
  const ballLineX = ctx.ballX;
  const isBehindBall = ctx.attackDir === 1 ? ctx.self.x < ballLineX : ctx.self.x > ballLineX;
  if (!isBehindBall && role !== 'attack') {
    return {
      type: 'recover_behind_ball',
      targetX: clamp(ballLineX - ctx.attackDir * 5, 3, FIELD_LENGTH - 3),
      targetZ: ctx.slotZ,
    };
  }

  // Mark nearest opponent
  const nearestOpp = findNearestOpponentInZone(ctx);
  if (nearestOpp && role !== 'gk') {
    const markX = nearestOpp.x + (ctx.slotX - nearestOpp.x) * 0.3;
    const markZ = nearestOpp.z + (ctx.slotZ - nearestOpp.z) * 0.3;
    return { type: 'mark_man', targetId: nearestOpp.id, targetX: markX, targetZ: markZ };
  }

  return { type: 'mark_zone', targetX: ctx.slotX, targetZ: ctx.slotZ };
}

/**
 * Find the opponent closest to our goal in a dangerous position.
 */
function findMostDangerousOpponent(ctx: DecisionContext) {
  const ownGoalX = ctx.attackDir === 1 ? 0 : FIELD_LENGTH;
  let best: { id: string; x: number; z: number } | null = null;
  let bestDist = Infinity;
  for (const o of ctx.opponents) {
    const d = Math.abs(o.x - ownGoalX);
    if (d < bestDist && d < 30) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// RECEPTION ZONE: position where the player can receive a useful pass
// ---------------------------------------------------------------------------

/**
 * Compute a reception zone for the player based on:
 *  1. Their structural position (slot) — maintains team shape
 *  2. The carrier's position — creates a passing angle
 *  3. Opponent positions — avoids blocked lanes
 *  4. Team width — stays in own lateral corridor
 *
 * This replaces the old pattern of positioning relative to ball (which
 * caused clustering). Players stay in their structural corridor and
 * adjust to create viable passing lanes from the carrier.
 */
function findReceptionZone(ctx: DecisionContext): { x: number; z: number } {
  let rx = ctx.slotX;
  let rz = ctx.slotZ;

  // If we know who has the ball, create a passing angle from them
  const carrier = ctx.carrierId
    ? ctx.teammates.find(t => t.id === ctx.carrierId)
    : null;

  if (carrier) {
    const dxFromCarrier = (rx - carrier.x) * ctx.attackDir;
    const dzFromCarrier = Math.abs(rz - carrier.z);

    if (ctx.carrierJustChanged) {
      rx += ctx.attackDir * (4 + pick01ForDecision(ctx) * 5);
      const widen = 5 + pick01ForDecision(ctx) * 5;
      rz += rz < carrier.z ? -widen : widen;
    }

    // If directly behind or level with carrier (no useful angle),
    // push forward to create a vertical passing lane
    if (dxFromCarrier < 3 && dxFromCarrier > -15) {
      rx += ctx.attackDir * (5 + pick01ForDecision(ctx) * 5);
    }

    // If in the same lateral lane as the carrier, widen out
    if (dzFromCarrier < 6) {
      const sideSign = rz < FIELD_WIDTH / 2 ? -1 : 1;
      rz += sideSign * (6 + pick01ForDecision(ctx) * 4);
    }

    // Check if the passing lane to reception zone is blocked
    let blocked = false;
    for (const opp of ctx.opponents) {
      const cross = ptSegDist(opp.x, opp.z, carrier.x, carrier.z, rx, rz);
      if (cross < 2.5) { blocked = true; break; }
    }
    if (blocked) {
      // Shift laterally to open the lane
      const shiftDir = rz < carrier.z ? -1 : 1;
      rz += shiftDir * (3 + pick01ForDecision(ctx) * 3);
    }
  } else {
    // No identified carrier — use slot with slight forward bias
    rx += ctx.attackDir * 2;
  }

  return {
    x: clamp(rx, 3, FIELD_LENGTH - 3),
    z: clamp(rz, 3, FIELD_WIDTH - 3),
  };
}

function ptSegDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 0.001) return Math.hypot(apx, apz);
  let t = (apx * abx + apz * abz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), pz - (az + t * abz));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findNearestOpponentInZone(ctx: DecisionContext) {
  let best: { id: string; x: number; z: number } | null = null;
  let bestDist = 20;
  for (const o of ctx.opponents) {
    const d = Math.hypot(o.x - ctx.slotX, o.z - ctx.slotZ);
    if (d < bestDist) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// ANTI-SWARM: spacing system
// ---------------------------------------------------------------------------

const MIN_TEAMMATE_SPACING = 8.5;

/**
 * Apply spacing to any off-ball action that has target coordinates.
 * Prevents two players from targeting the same position.
 */
function applySpacingToAction(ctx: DecisionContext, action: OffBallAction): OffBallAction {
  if (!('targetX' in action) || !('targetZ' in action)) return action;
  const spaced = enforceSpacing(ctx, action.targetX, action.targetZ);
  return { ...action, targetX: spaced.x, targetZ: spaced.z } as OffBallAction;
}

/**
 * Check if a target position is too close to an existing teammate.
 * If so, push it away to maintain spacing.
 */
function repelFromBallSwarm(ctx: DecisionContext, tx: number, tz: number): { x: number; z: number } {
  if (!ctx.carrierId || ctx.self.id === ctx.carrierId) return { x: tx, z: tz };
  const dBall = Math.hypot(tx - ctx.ballX, tz - ctx.ballZ);
  if (dBall > 22) return { x: tx, z: tz };
  // Já há companheiro na bola: empurra alvos que ainda “caem” para o mesmo poço.
  const nearBall = countTeammatesNearBall(ctx, 12);
  if (nearBall < 1) return { x: tx, z: tz };
  const vx = tx - ctx.ballX;
  const vz = tz - ctx.ballZ;
  const d = Math.hypot(vx, vz) || 1;
  const crowdFactor = nearBall >= 2 ? 0.65 : 0.48;
  const push = (22 - dBall) * crowdFactor;
  return { x: tx + (vx / d) * push, z: tz + (vz / d) * push };
}

function enforceSpacing(
  ctx: DecisionContext,
  targetX: number,
  targetZ: number,
): { x: number; z: number } {
  let tx = targetX;
  let tz = targetZ;

  for (const t of ctx.teammates) {
    if (t.id === ctx.self.id) continue;
    const dx = tx - t.x;
    const dz = tz - t.z;
    const dist = Math.hypot(dx, dz);
    if (dist < MIN_TEAMMATE_SPACING && dist > 0.1) {
      const pushFactor = (MIN_TEAMMATE_SPACING - dist) / dist;
      tx += dx * pushFactor * 0.75;
      tz += dz * pushFactor * 0.75;
    }
  }

  const peeled = repelFromBallSwarm(ctx, tx, tz);
  tx = peeled.x;
  tz = peeled.z;

  return {
    x: clamp(tx, 3, FIELD_LENGTH - 3),
    z: clamp(tz, 3, FIELD_WIDTH - 3),
  };
}

/**
 * Count teammates already in the attacking third.
 * Used to prevent mass convergence.
 */
/** Bloco B — Conta colegas dentro da grande área adversária (cap pra evitar enxame). */
function countTeammatesInBox(ctx: DecisionContext): number {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  let count = 0;
  for (const t of ctx.teammates) {
    if (t.id === ctx.self.id) continue;
    const depthFromGoal = Math.abs(goalX - t.x);
    const widthFromCenter = Math.abs(t.z - FIELD_WIDTH / 2);
    if (depthFromGoal < 16.5 && widthFromCenter < 20.16) count++;
  }
  return count;
}

function countTeammatesInAttackingThird(ctx: DecisionContext): number {
  const threshold = ctx.attackDir === 1
    ? FIELD_LENGTH * 0.7
    : FIELD_LENGTH * 0.3;
  let count = 0;
  for (const t of ctx.teammates) {
    if (t.id === ctx.self.id) continue;
    const inAttThird = ctx.attackDir === 1 ? t.x > threshold : t.x < threshold;
    if (inAttThird) count++;
  }
  return count;
}

/**
 * Check if the player should stay anchored to their slot instead of
 * pushing forward, because too many teammates are already up front.
 * Max 4 outfield players in the attacking third.
 */
function shouldAnchorToSlot(ctx: DecisionContext): boolean {
  const role = ctx.self.role;
  if (role === 'gk') return true;
  // Fix #5: laterais (LE/LD) NUNCA são ancorados pela regra de "muitos no terço final" —
  // overlap é exatamente o comportamento que a regra antiga sufocava (decideFullbackSupport
  // existia mas nunca era chamado para wingbacks porque a anchor disparava antes).
  const slotId = ctx.self.slotId ?? '';
  if (slotId === 'le' || slotId === 'ld') return false;
  const inAttThird = countTeammatesInAttackingThird(ctx);
  // Defenders: don't push if 3+ already in attacking third
  if (role === 'def' && inAttThird >= 3) return true;
  // Midfielders: don't push if 4+ already there
  if (role === 'mid' && inAttThird >= 4) return true;
  return false;
}

/**
 * Limit the player's drift from their slot position.
 * Ensures structural integrity even during attacks.
 */
function anchoredTarget(
  ctx: DecisionContext,
  idealX: number,
  idealZ: number,
  maxDrift: number,
): { x: number; z: number } {
  const dx = idealX - ctx.slotX;
  const dz = idealZ - ctx.slotZ;
  const dist = Math.hypot(dx, dz);
  if (dist <= maxDrift) return { x: idealX, z: idealZ };
  const scale = maxDrift / dist;
  return {
    x: clamp(ctx.slotX + dx * scale, 3, FIELD_LENGTH - 3),
    z: clamp(ctx.slotZ + dz * scale, 3, FIELD_WIDTH - 3),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpToward(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
