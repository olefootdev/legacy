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
import { getZoneTags } from '@/match/fieldZones';
import { getDefensiveIntent } from '@/tactics/playingStyle';
import { pick01ForDecision } from './decisionRng';
import { applyPrethinkingToOffBall } from './prethinking';

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

  if (ctx.self.role === 'gk') {
    return { type: 'move_to_slot', targetX: ctx.slotX, targetZ: ctx.slotZ };
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
    if (pick.action.id === 'press') {
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

function decideAttackingSupport(ctx: DecisionContext, reading: ContextReading): OffBallAction {
  const distToBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  const profile = ctx.profile;
  const role = ctx.self.role;
  const slot = ctx.self.slotId ?? '';
  const sector = ctx.ballSector;

  // Amontoado na bola: abrir corredor / largura em vez de apertar o portador.
  if (
    ctx.carrierId
    && ctx.self.id !== ctx.carrierId
    && countTeammatesNearBall(ctx, 12) >= 2
    && distToBall < 14
  ) {
    const rz = findReceptionZone(ctx);
    const side = ctx.self.z < ctx.ballZ ? -1 : 1;
    const peelZ = clamp(rz.z + side * (7 + pick01ForDecision(ctx) * 6), 4, FIELD_WIDTH - 4);
    const peelX = clamp(rz.x - ctx.attackDir * (2.5 + pick01ForDecision(ctx) * 3), 3, FIELD_LENGTH - 3);
    return applySpacingToAction(ctx, {
      type: 'open_width',
      targetX: peelX,
      targetZ: peelZ,
    });
  }

  // -----------------------------------------------------------------------
  // ANTI-SWARM: if too many teammates are already forward, stay anchored
  // to maintain team structure instead of joining the pile.
  // -----------------------------------------------------------------------
  if (shouldAnchorToSlot(ctx)) {
    const anchor = enforceSpacing(ctx, ctx.slotX, ctx.slotZ);
    return { type: 'move_to_slot', targetX: anchor.x, targetZ: anchor.z };
  }

  // Far from ball: hold structural position — only compress X slightly,
  // keep lateral corridor to maintain team width and create passing angles.
  if (distToBall > 30) {
    const t = enforceSpacing(ctx,
      lerpToward(ctx.slotX, ctx.ballX, 0.08),
      ctx.slotZ,
    );
    return { type: 'move_to_slot', targetX: t.x, targetZ: t.z };
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
  } else if (distToBall < 15) {
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

  // Apply spacing enforcement to the chosen target
  return applySpacingToAction(ctx, action);
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

function decideStrikerSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;

  if (reading.teamPhase === 'attack') {
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
    if (pick01ForDecision(ctx) < 0.5) {
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

    return {
      type: 'anticipate_second_ball',
      targetX: clamp(ctx.ballX + ctx.attackDir * 6, 5, FIELD_LENGTH - 5),
      targetZ: clamp(ctx.ballZ + (pick01ForDecision(ctx) > 0.5 ? 10 : -10), 6, FIELD_WIDTH - 6),
    };
  }

  // Progression: position between CBs to receive — use own slot Z for spread
  if (distToBall < 20) {
    const rz = findReceptionZone(ctx);
    return {
      type: 'offer_short_line',
      targetX: clamp(rz.x + ctx.attackDir * 5, 10, FIELD_LENGTH - 5),
      targetZ: clamp(rz.z, 10, FIELD_WIDTH - 10),
    };
  }

  return {
    type: 'move_to_slot',
    targetX: ctx.slotX,
    targetZ: ctx.slotZ,
  };
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

  // Ball on my side: overlap forward
  if (sector === mySector && (reading.teamPhase === 'attack' || reading.teamPhase === 'progression')) {
    if (profile.workRate > 0.55 && pick01ForDecision(ctx) < 0.35) {
      return {
        type: 'overlap_run',
        targetX: clamp(ctx.ballX + ctx.attackDir * 15, 10, FIELD_LENGTH - 5),
        targetZ: isLeft ? 3 + pick01ForDecision(ctx) * 5 : FIELD_WIDTH - 3 - pick01ForDecision(ctx) * 5,
      };
    }
    return {
      type: 'offer_short_line',
      targetX: clamp(ctx.ballX - ctx.attackDir * 3, 3, FIELD_LENGTH - 3),
      targetZ: ctx.self.z,
    };
  }

  // Ball on opposite side: tuck in to cover transition
  if (sector !== mySector) {
    return {
      type: 'defensive_cover',
      targetX: clamp(ctx.slotX + ctx.attackDir * 3, 5, FIELD_LENGTH - 5),
      targetZ: lerpToward(ctx.slotZ, FIELD_WIDTH / 2, 0.3),
    };
  }

  return {
    type: 'offer_short_line',
    targetX: clamp(ctx.ballX - ctx.attackDir * 5, 3, FIELD_LENGTH - 3),
    targetZ: ctx.self.z,
  };
}

function decideMidSupport(
  ctx: DecisionContext,
  reading: ContextReading,
  distToBall: number,
  sector: BallSector,
): OffBallAction {
  const profile = ctx.profile;

  // Close to ball → find reception zone at a passing angle from carrier
  if (distToBall < 15 && pick01ForDecision(ctx) < 0.45) {
    const rz = findReceptionZone(ctx);
    return {
      type: 'offer_short_line',
      targetX: rz.x,
      targetZ: rz.z,
    };
  }

  // Ball on the wing → position at edge of box but use own Z anchor
  if (sector !== 'center' && reading.teamPhase === 'attack') {
    if (pick01ForDecision(ctx) < 0.3 + profile.workRate * 0.15) {
      const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
      // Use own slot Z to maintain lateral spread
      const t = anchoredTarget(ctx,
        goalX - ctx.attackDir * 20,
        ctx.slotZ,
        25,
      );
      return { type: 'anticipate_second_ball', targetX: t.x, targetZ: t.z };
    }
  }

  // Progression: infiltrate between lines but respect slot anchor
  if (reading.teamPhase === 'progression' && profile.verticality > 0.5 && pick01ForDecision(ctx) < 0.3) {
    const t = anchoredTarget(ctx,
      ctx.ballX + ctx.attackDir * 12,
      ctx.slotZ + (pick01ForDecision(ctx) - 0.5) * 10,
      22,
    );
    return { type: 'infiltrate', targetX: t.x, targetZ: t.z };
  }

  // Offer diagonal passing lane — use own Z side for spread
  if (distToBall < 20 && pick01ForDecision(ctx) < 0.3) {
    return {
      type: 'offer_diagonal_line',
      targetX: clamp(ctx.ballX + ctx.attackDir * 8, 5, FIELD_LENGTH - 5),
      targetZ: clamp(ctx.self.z + (ctx.self.z < FIELD_WIDTH / 2 ? 8 : -8), 5, FIELD_WIDTH - 5),
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

  // Segurança > estilo: em perigo máximo dentro da própria área, colapsar central.
  if (inOwnBox && role !== 'gk') {
    return {
      type: 'cover_central',
      targetX: clamp(ctx.slotX - ctx.attackDir * 2, 5, FIELD_LENGTH - 5),
      targetZ: clamp(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? -4 : 4), 8, FIELD_WIDTH - 8),
    };
  }

  if (ctx.teamPhase === 'transition_def') {
    const td = decideTransitionDefense(ctx, reading);
    if (td) return td;
  }

  // The opponent's threat level (from their perspective = our danger)
  // We use our own ctx.threatLevel which is our attacking threat;
  // the opponent's threat is conceptually the inverse scenario.
  // For defending, high threat against us → more urgent defense.
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
    const maxPressers = 2;

    // Press the carrier if close enough and not too many already pressing
    if (distToBall < pressThreshold && role !== 'gk') {
      const nearerCount = ctx.teammates.filter(t => Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z) < distToBall).length;
      if (nearerCount < maxPressers && (profile.workRate > 0.55 || pick01ForDecision(ctx) < 0.4)) {
        return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
      }
      if (nearerCount < maxPressers) {
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

  const pressThreshold = Math.max(8, (mentality > 65 ? 20 : mentality > 45 ? 14 : 10) + (defenseIntent.pressTrigger - 16));
  const maxPressers = mentality > 65 ? 3 : 2;

  // Press if in range
  if (distToBall < pressThreshold && role !== 'gk') {
    const nearerCount = ctx.teammates.filter(t => Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z) < distToBall).length;
    if (nearerCount < maxPressers && (profile.workRate > 0.6 || pick01ForDecision(ctx) < 0.5)) {
      return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
    }
    if (nearerCount < maxPressers) {
      return { type: 'delay_press', targetX: (ctx.self.x + ctx.ballX) / 2, targetZ: (ctx.self.z + ctx.ballZ) / 2 };
    }
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

const MIN_TEAMMATE_SPACING = 7.5;

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
  if (dBall > 17) return { x: tx, z: tz };
  if (countTeammatesNearBall(ctx, 12) < 2) return { x: tx, z: tz };
  const vx = tx - ctx.ballX;
  const vz = tz - ctx.ballZ;
  const d = Math.hypot(vx, vz) || 1;
  const push = (17 - dBall) * 0.44;
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
      tx += dx * pushFactor * 0.6;
      tz += dz * pushFactor * 0.6;
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
