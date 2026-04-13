import type { PitchPlayerState, PitchPoint, PossessionSide } from '@/engine/types';
import { overallFromAttributes } from '@/entities/player';
import type { BallZone, SpiritContext, SpiritOutcome, ProposedAction, SpiritSnapshotMeta } from './types';
import { PRE_GOAL_DURATION_MS, SECONDS_PER_TICK, type GoalBuildUp } from '@/engine/types';
import {
  adjustHomeShotWeights,
  causalOutcomeFromHomeShot,
  createGoalOverlay,
  DANGEROUS_FOUL_PROB,
  DEFAULT_HOME_SHOT_WEIGHTS,
  initialPenaltyState,
  patchAfterAwayShotWide,
  patchAfterHomeShot,
  penaltyOverlayForStage,
  PENALTY_FROM_FOUL_PROB,
  rollHomeShotLogicalOutcome,
} from './spiritStateMachine';
import * as T from './narrativeTemplates';
import { pickLine } from './narrationSeed';
import type { PlayerEntity } from '@/entities/types';
import { crowdSpiritFromSupport } from '@/systems/crowdSpirit';
import { createCausalBatch, type CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import { normalizeStyle } from '@/tactics/playingStyle';

function dist(a: PitchPoint, b: PitchPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function zoneFromBallX(x: number): BallZone {
  if (x < 38) return 'def';
  if (x < 68) return 'mid';
  return 'att';
}

/** Remate com desfecho pleno (golo/defesa/bloqueio): só com bola na zona final (≥68 m no eixo 0–100). */
function homeMayRegisterShot(ctx: SpiritContext): boolean {
  if (ctx.possession !== 'home' || !ctx.onBall) return false;
  if (ctx.ballZone !== 'att') return false;
  const r = ctx.onBall.role;
  return r === 'attack' || r === 'mid';
}

function nearestTeammateDistance(onBall: PitchPlayerState | undefined, mates: PitchPlayerState[]): number {
  if (!onBall) return 50;
  let best = 1e9;
  for (const m of mates) {
    if (m.playerId === onBall.playerId) continue;
    const d = dist({ x: onBall.x, y: onBall.y }, { x: m.x, y: m.y });
    if (d < best) best = d;
  }
  return best > 1e8 ? 40 : best;
}

function densityNearBall(ball: PitchPoint, mates: PitchPlayerState[], radius = 18): number {
  let c = 0;
  for (const m of mates) {
    if (dist(ball, { x: m.x, y: m.y }) < radius) c += 1;
  }
  return c;
}

function pickAction(ctx: SpiritContext): ProposedAction {
  const style = normalizeStyle(ctx.tacticalStyle);
  const losingHome = ctx.possession === 'home' && ctx.homeScore < ctx.awayScore;
  const highPress = ctx.tacticalMentality > 72;
  const deepDefense = ctx.ballZone === 'def';
  const isolated = ctx.nearestTeammateDist > 22;
  const crowded = ctx.homeDensityNearBall >= 3;
  const m = ctx.test2dTickModifiers;
  const st = ctx.live2dStagnationTicks ?? 0;

  /** live2d: após N recycles seguidos, obrigar avanço (condução/passe longo). */
  if (ctx.possession === 'home' && st >= 2) {
    return 'progress';
  }
  if (ctx.possession === 'home' && st >= 1 && ctx.onBall?.role === 'def' && ctx.ballZone === 'def') {
    return Math.random() < 0.88 ? 'progress' : 'recycle';
  }

  if (ctx.possession === 'away' && deepDefense && highPress) {
    if (!m) return 'press';
    if (Math.random() < Math.min(0.96, 0.88 * m.awayPressMult)) return 'press';
  }
  if (ctx.possession === 'home' && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')) {
    if (isolated && ctx.crowdPressure.longPassStress > 1.05) return 'recycle';
    const shotBias = style.shootingProfile * 0.25 + style.riskTaking * 0.18 + (m?.shotInAttThirdBias ?? 0);
    return Math.random() > 0.52 - shotBias ? 'shot' : 'progress';
  }
  if (ctx.possession === 'home' && style.buildUp > 0.72 && Math.random() < 0.22) return 'clear';
  if (ctx.possession === 'home' && style.verticality > 0.72 && Math.random() < 0.24) return 'progress';
  if (ctx.possession === 'home' && style.verticality < 0.28 && Math.random() < 0.28) return 'recycle';
  /** Sem remate “milagre” do meio-campo: em desespero só remata quem já chegou à zona final. */
  if (ctx.possession === 'home' && losingHome && ctx.minute > 70) {
    return crowded && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')
      ? 'shot'
      : 'progress';
  }
  if (ctx.possession === 'away' && ctx.ballZone === 'def') return 'clear';
  if (ctx.possession === 'home' && ctx.ballZone === 'mid' && Math.random() > 0.65) return 'progress';
  if (Math.random() > 0.72) return 'progress';
  return 'recycle';
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed * 9973)) % arr.length]!;
}

/** Pick a teammate different from `excludeId`, nearest to ball, for two-player interactions. */
function secondaryMate(ctx: SpiritContext, excludeId?: string): string | undefined {
  const others = (ctx.homePlayers ?? []).filter(
    (p) => p.playerId !== excludeId && p.name,
  );
  if (others.length === 0) return undefined;
  if (!ctx.ball) return others[0]!.name;
  let best = others[0]!;
  let bestD = 1e9;
  for (const o of others) {
    const d = Math.hypot(o.x - ctx.ball.x, o.y - ctx.ball.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best.name;
}

const SEED_ACTION_MAP: Partial<Record<ProposedAction, string | string[]>> = {
  shot: ['shot_strong', 'long_shot'],
  progress: ['build_up', 'pass_long', 'wing_play', 'dribble_success'],
  recycle: ['pass_short', 'possession_switch'],
  press: ['pressure_high', 'tackle_clean', 'interception'],
  clear: 'clearance',
  counter: 'counter_attack',
};

function narrativeFor(
  action: ProposedAction,
  name: string,
  minute: number,
  _pressure: import('@/systems/crowdSpirit').CrowdSpiritPressure,
  homeShort: string,
  _zone: import('./types').BallZone,
  ctx?: SpiritContext,
): string {
  const mate = ctx ? secondaryMate(ctx, ctx.onBall?.playerId) : undefined;
  const sit = SEED_ACTION_MAP[action];
  if (sit) {
    const line = pickLine(sit, { min: minute, from: name, to: mate, team: homeShort }, minute);
    if (line) return line;
  }
  switch (action) {
    case 'shot':
      return T.shot({ min: minute, shooter: name });
    case 'progress':
      return T.progress({ min: minute, carrier: name, receiver: mate });
    case 'recycle':
      return T.recycle({ min: minute, passer: name, receiver: mate });
    case 'press':
      return T.press({ min: minute, team: homeShort, recoverer: mate });
    case 'clear':
      return T.clear({ min: minute, defender: mate });
    case 'counter':
      return T.counter({ min: minute, leader: name });
    default:
      return T.recycle({ min: minute, passer: name });
  }
}

export function buildSpiritContext(input: {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  ball: PitchPoint;
  onBall?: PitchPlayerState;
  crowdSupport: number;
  tacticalMentality: number;
  tacticalStyle?: import('@/tactics/playingStyle').TeamTacticalStyle;
  opponentStrength: number;
  homeRoster: PlayerEntity[];
  homePlayers: PitchPlayerState[];
  homeShort?: string;
  recentFeedLines?: string[];
  awayRoster?: { id: string; num: number; name: string; pos: string }[];
  test2dTickModifiers?: SpiritContext['test2dTickModifiers'];
  live2dStagnationTicks?: number;
  motorTelemetryTail?: SpiritContext['motorTelemetryTail'];
}): SpiritContext {
  const avg =
    input.homeRoster.length === 0
      ? 78
      : input.homeRoster.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / input.homeRoster.length;
  const avgHomeFatigue =
    input.homePlayers.length === 0
      ? 48
      : input.homePlayers.reduce((s, p) => s + p.fatigue, 0) / input.homePlayers.length;
  const mirrorAttack: PitchPoint = { x: 100 - input.ball.x, y: input.ball.y };
  const ballZone = zoneFromBallX(input.ball.x);
  const nearestTeammateDist = nearestTeammateDistance(input.onBall, input.homePlayers);
  const homeDensityNearBall = densityNearBall(input.ball, input.homePlayers);
  const crowdPressure = crowdSpiritFromSupport(input.crowdSupport);

  return {
    minute: input.minute,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    possession: input.possession,
    onBall: input.onBall,
    ball: input.ball,
    crowdSupport: input.crowdSupport,
    tacticalMentality: input.tacticalMentality,
    tacticalStyle: input.tacticalStyle,
    opponentStrength: input.opponentStrength,
    homeTeamAvg: avg,
    nearbyOpponentDist: dist(input.ball, mirrorAttack),
    ballZone,
    nearestTeammateDist,
    homeDensityNearBall,
    crowdPressure,
    recentFeedLines: input.recentFeedLines,
    avgHomeFatigue,
    homeShort: input.homeShort,
    homePlayers: input.homePlayers,
    awayRoster: input.awayRoster,
    test2dTickModifiers: input.test2dTickModifiers,
    live2dStagnationTicks: input.live2dStagnationTicks,
    motorTelemetryTail: input.motorTelemetryTail,
  };
}

function postGoalRestart(L: ReturnType<typeof createCausalBatch>, ball: PitchPoint, nextPossession: PossessionSide) {
  L.push({
    type: 'phase_change',
    payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'goal' },
  });
  L.push({
    type: 'ball_state',
    payload: { ...ball, reason: 'post_goal_center' },
  });
  L.push({
    type: 'possession_change',
    payload: { to: nextPossession, reason: 'kickoff' },
  });
  L.push({
    type: 'phase_change',
    payload: { from: 'GOAL_RESTART', to: 'KICKOFF_PENDING', reason: 'await_restart' },
  });
  L.push({
    type: 'phase_change',
    payload: { from: 'KICKOFF_PENDING', to: 'LIVE', reason: 'play_resumes' },
  });
}

/**
 * Detecta contra-ataque: posse no arranque do tick != lado que marcou,
 * OU último causal inclui turnover/recuperação recente para o marcador.
 */
function detectCounter(
  possessionAtTickStart: PossessionSide,
  scorerSide: PossessionSide,
  recentCausal: readonly CausalMatchEvent[],
): boolean {
  if (possessionAtTickStart !== scorerSide) return true;
  const last4 = recentCausal.slice(-4);
  for (const e of last4) {
    if (e.type === 'possession_change') {
      const p = e.payload as { to?: PossessionSide; reason?: string } | undefined;
      if (!p) continue;
      const reason = p.reason ?? '';
      if (
        p.to === scorerSide &&
        /turnover|recovery|press_win|high_press/.test(reason)
      ) {
        return true;
      }
    }
  }
  return false;
}

interface CommitGoalInput {
  scorerSide: PossessionSide;
  minute: number;
  buildUp: GoalBuildUp;
  scorerName: string;
  homeShort: string;
  awayShort: string;
  /** Variante textual: post_in, penalty, etc. */
  variant?: 'post_in';
  nowMs: number;
  /** Batch de eventos causais já em construção. */
  L: ReturnType<typeof createCausalBatch>;
  shooterId: string;
  ctx: SpiritContext;
}

/**
 * Ponto único para todo golo no `gameSpiritTick`.
 * Retorna fragmentos para compor o `SpiritOutcome` final.
 */
function commitGoal(input: CommitGoalInput): {
  narrative: string;
  goalFor: PossessionSide;
  goalScorerPlayerId: string;
  goalBuildUp: GoalBuildUp;
  threatBar01: number;
  spiritMeta: SpiritSnapshotMeta;
  ball: PitchPoint;
  nextPossession: PossessionSide;
} {
  const { scorerSide, minute, buildUp, scorerName, homeShort, awayShort, variant, nowMs, L, ctx } = input;

  const nextPossession: PossessionSide = scorerSide === 'home' ? 'away' : 'home';
  const ball: PitchPoint = { x: 50, y: 50 };

  postGoalRestart(L, ball, nextPossession);

  const threat01Target = scorerSide === 'home' ? 0.98 : 0.02;

  const gTeam = scorerSide === 'home' ? homeShort : awayShort;
  const gParams = { min: minute, from: scorerName, team: gTeam };

  let narrative: string;
  if (variant === 'post_in') {
    narrative = pickLine('goal_rebound', gParams, minute)
      ?? T.goalPostIn({ min: minute, scorer: scorerName });
  } else {
    narrative = pickLine(['goal_simple', 'goal_beautiful'], gParams, minute)
      ?? (scorerSide === 'home'
        ? T.goalPositional({ min: minute, scorer: scorerName })
        : T.goalAwayPositional({ min: minute, scorer: scorerName, team: awayShort }));
  }

  const { overlay, spiritMomentumClamp01 } = createGoalOverlay({
    nowMs: nowMs + PRE_GOAL_DURATION_MS,
    narrativeLine: narrative,
    scorerSide,
  });

  return {
    narrative,
    goalFor: scorerSide,
    goalScorerPlayerId: input.shooterId,
    goalBuildUp: buildUp,
    threatBar01: threat01Target,
    spiritMeta: {
      spiritPhase: 'celebration_goal',
      spiritOverlay: overlay,
      spiritMomentumClamp01,
      spiritBuildupGkTicksRemaining: 0,
      preGoalHint: {
        side: scorerSide,
        threat01Target,
        startedAtMs: nowMs,
        durationMs: PRE_GOAL_DURATION_MS,
      },
    },
    ball,
    nextPossession,
  };
}

/** Ciclo: contexto → decisão → consequência → narrativa + log causal (A1–A3). */
export function gameSpiritTick(
  ctx: SpiritContext,
  awayShort: string,
  causalSeqStart: number,
  nowMs: number = Date.now(),
): SpiritOutcome {
  const L = createCausalBatch(ctx.minute, causalSeqStart);

  if (ctx.possession === 'home' && !ctx.onBall) {
    const nb = { x: 44 + Math.random() * 12, y: 30 + Math.random() * 40 };
    L.push({
      type: 'possession_change',
      payload: { to: 'away', reason: 'no_home_carrier' },
    });
    L.push({
      type: 'ball_state',
      payload: { ...nb, reason: 'turnover_reorganize' },
    });
    return {
      narrative: pickLine('possession_switch', { min: ctx.minute, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
        ?? T.noCarrierRecycle({ min: ctx.minute, team: ctx.homeShort ?? 'Casa' }),
      action: 'recycle',
      nextPossession: 'away',
      ball: nb,
      causalEvents: [...L.events],
    };
  }

  /** Falta perigosa na zona final (casa a atacar): penálti ou bola parada. */
  if (
    ctx.possession === 'home' &&
    ctx.ballZone === 'att' &&
    ctx.onBall &&
    Math.random() < DANGEROUS_FOUL_PROB
  ) {
    const toPenalty = Math.random() < PENALTY_FROM_FOUL_PROB;
    const takerName = ctx.onBall.name;
    if (toPenalty) {
      L.push({
        type: 'phase_change',
        payload: { from: 'LIVE', to: 'PENALTY' as 'LIVE', reason: 'foul_in_box' },
      });
      const penaltyTakerId = ctx.onBall!.playerId;
      return {
        narrative: pickLine('foul_hard', { min: ctx.minute, from: takerName, to: takerName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
          ?? T.foulPenalty({ min: ctx.minute, fouled: takerName }),
        action: 'recycle',
        nextPossession: ctx.possession,
        ball: { ...ctx.ball },
        causalEvents: [...L.events],
        spiritMeta: {
          spiritPhase: 'penalty',
          penalty: initialPenaltyState('home', takerName, penaltyTakerId),
          spiritOverlay: penaltyOverlayForStage(
            'banner',
            takerName,
            ctx.homeShort ?? 'Casa',
            awayShort,
            nowMs,
            2000,
          ),
        },
      };
    }
    return {
      narrative: pickLine(['foul_soft', 'free_kick'], { min: ctx.minute, from: takerName, to: takerName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
        ?? T.foulFreeKick({ min: ctx.minute, fouled: takerName }),
      action: 'recycle',
      nextPossession: ctx.possession,
      ball: {
        x: Math.min(88, ctx.ball.x + 4 + Math.random() * 6),
        y: Math.min(78, Math.max(22, ctx.ball.y + (Math.random() * 10 - 5))),
      },
      causalEvents: [...L.events],
      spiritMeta: {
        spiritPhase: 'set_piece',
      },
    };
  }

  let action = pickAction(ctx);
  if (action === 'shot' && ctx.possession === 'home' && !homeMayRegisterShot(ctx)) {
    action = 'progress';
  }
  const name = ctx.possession === 'home' ? ctx.onBall?.name ?? ctx.homeShort ?? 'Casa' : awayShort;
  let narrative = narrativeFor(action, name, ctx.minute, ctx.crowdPressure, ctx.homeShort ?? 'Casa', ctx.ballZone, ctx);
  let next: PossessionSide = ctx.possession;
  let ball: PitchPoint = { ...ctx.ball };
  let goalFor: PossessionSide | undefined;
  let goalScorerPlayerId: string | undefined;
  let goalBuildUp: GoalBuildUp | undefined;
  let threatBar01: number | undefined;

  const cp = ctx.crowdPressure;
  const homeStat =
    ctx.possession === 'home' && ctx.onBall
      ? {
          playerId: ctx.onBall.playerId,
          passesOk: 0,
          passesAttempt: 0,
          tackles: 0,
          km: 0.02 + Math.random() * 0.05,
        }
      : undefined;

  const shotSkill = ctx.homeTeamAvg / 100;
  const errorTax = cp.errorPenalty + (ctx.nearestTeammateDist > 26 ? 0.04 : 0);
  const supportBoost = cp.supportBoost;
  let spiritMeta: SpiritSnapshotMeta | undefined;

  if (ctx.possession === 'home') {
    const shooterId = ctx.onBall!.playerId;
    if (action === 'shot') {
      homeStat!.passesAttempt += 1;
      L.push({
        type: 'shot_attempt',
        payload: {
          side: 'home',
          shooterId,
          zone: ctx.ballZone,
          minute: ctx.minute,
          target: { x: 96 + Math.random() * 3, y: 40 + Math.random() * 20 },
        },
      });

      const weights = adjustHomeShotWeights(DEFAULT_HOME_SHOT_WEIGHTS, {
        shotSkill01: shotSkill,
        zoneAtt: ctx.ballZone === 'att',
        zoneMid: ctx.ballZone === 'mid',
        denseNearBall: ctx.homeDensityNearBall >= 4,
        supportBoost,
        gkFactor01: ctx.opponentStrength / 120,
        errorTax,
      });
      const homeOnPitch = Math.max(0, ctx.homePlayers?.length ?? 11);
      const homeNumericRatio = Math.max(0.55, homeOnPitch / 11);
      weights.goal *= homeNumericRatio;
      weights.post_in *= homeNumericRatio;
      let logical = rollHomeShotLogicalOutcome(Math.random(), weights);
      /** Rede de segurança: golo só com bola na zona final (coerente com buildup / 2D). */
      if ((logical === 'goal' || logical === 'post_in') && ctx.ballZone !== 'att') {
        logical = 'wide';
      }
      const causalOut = causalOutcomeFromHomeShot(logical);
      L.push({
        type: 'shot_result',
        payload: { side: 'home', shooterId, outcome: causalOut },
      });

      const yNorm = Math.random();

      if (logical === 'goal' || logical === 'post_in') {
        const isCounter = detectCounter(ctx.possession, 'home', [...L.events]);
        const gol = commitGoal({
          scorerSide: 'home',
          minute: ctx.minute,
          buildUp: isCounter ? 'counter' : 'positional',
          scorerName: ctx.onBall?.name ?? ctx.homeShort ?? 'Casa',
          homeShort: ctx.homeShort ?? 'Casa',
          awayShort,
          variant: logical === 'post_in' ? 'post_in' : undefined,
          nowMs,
          L,
          shooterId,
          ctx,
        });
        goalFor = gol.goalFor;
        goalScorerPlayerId = gol.goalScorerPlayerId;
        narrative = gol.narrative;
        ball = gol.ball;
        next = gol.nextPossession;
        spiritMeta = gol.spiritMeta;
        goalBuildUp = gol.goalBuildUp;
        threatBar01 = gol.threatBar01;
      } else if (logical === 'block') {
        const patch = patchAfterHomeShot(logical, yNorm);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'defensive_clearance' },
        });
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_block' } });
        narrative = pickLine('shot_blocked', { min: ctx.minute, from: ctx.onBall?.name ?? 'Atacante' }, ctx.minute)
          ?? T.shotBlock({ min: ctx.minute, shooter: ctx.onBall?.name ?? 'Atacante' });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
      } else if (logical === 'save') {
        const patch = patchAfterHomeShot(logical, yNorm);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'keeper_save' },
        });
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_save' } });
        narrative = pickLine('shot_save', { min: ctx.minute, from: ctx.onBall?.name ?? 'Atacante' }, ctx.minute)
          ?? T.shotSave({ min: ctx.minute, shooter: ctx.onBall?.name ?? 'Atacante' });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
      } else {
        const patch = patchAfterHomeShot(logical, yNorm);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'shot_wide_goal_kick' },
        });
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_shot_wide' } });
        narrative = pickLine('shot_out', { min: ctx.minute, from: ctx.onBall?.name ?? 'Atacante' }, ctx.minute)
          ?? T.shotWide({ min: ctx.minute, shooter: ctx.onBall?.name ?? 'Atacante', recoverer: awayShort });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
        if (logical === 'wide' || logical === 'post_out' || logical === 'miss_far') {
          homeStat!.passesOk += 1;
        }
      }
    } else if (action === 'progress') {
      homeStat!.passesOk += 1;
      homeStat!.passesAttempt += 1;
      let lossChance = 0.14 + errorTax * 0.45 + (ctx.crowdPressure.longPassStress - 1) * 0.08;
      if (ctx.test2dTickModifiers && ctx.possession === 'home') {
        lossChance *= ctx.test2dTickModifiers.progressLossMult;
      }
      const pushX =
        ctx.ballZone === 'mid'
          ? 8 + Math.random() * 14
          : ctx.ballZone === 'def'
            ? 6 + Math.random() * 12
            : 4 + Math.random() * 10;
      ball = {
        x: Math.min(90, ctx.ball.x + pushX),
        y: Math.min(82, Math.max(18, ctx.ball.y + (Math.random() * 12 - 6))),
      };
      L.push({
        type: 'ball_state',
        payload: { ...ball, reason: 'progress_carry' },
      });
      if (Math.random() < lossChance) {
        next = 'away';
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'progress_loss' } });
        ball = { x: 40 + Math.random() * 15, y: 25 + Math.random() * 50 };
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'turnover_after_carry' } });
        narrative = pickLine('pass_missed', { min: ctx.minute, from: ctx.onBall?.name ?? 'Casa' }, ctx.minute)
          ?? T.progressLoss({ min: ctx.minute, loser: ctx.onBall?.name ?? 'Casa', winner: awayShort });
      }
    } else {
      homeStat!.passesOk += 1;
      homeStat!.passesAttempt += 1;
      ball = {
        x: Math.min(82, ctx.ball.x + 2 + Math.random() * 8),
        y: Math.min(85, Math.max(15, ctx.ball.y + (Math.random() * 10 - 5))),
      };
      L.push({
        type: 'ball_state',
        payload: { ...ball, reason: 'recycle_keep' },
      });
    }
  } else {
    const awayZone = zoneFromBallX(100 - ctx.ball.x);
    const awayAttackers = (ctx.awayRoster ?? []).filter((p) => /ATA|PD|PE/i.test(p.pos));
    const awayScorer = awayAttackers.length > 0
      ? awayAttackers[Math.floor(Math.random() * awayAttackers.length)]!
      : (ctx.awayRoster ?? [])[Math.floor(Math.random() * (ctx.awayRoster?.length || 1))] ?? { id: `away:${awayShort}`, name: awayShort };
    const awayShooterId = awayScorer.id;
    if (action === 'press' && Math.random() < 0.22 + (ctx.tacticalMentality - 50) / 250) {
      next = 'home';
      ball = { x: 58 + Math.random() * 10, y: 32 + Math.random() * 36 };
      L.push({ type: 'possession_change', payload: { to: 'home', reason: 'high_press_win' } });
      L.push({ type: 'ball_state', payload: { ...ball, reason: 'recovery_attack' } });
      narrative = pickLine(['pressure_high', 'tackle_clean'], { min: ctx.minute, from: secondaryMate(ctx), team: ctx.homeShort ?? 'Casa' }, ctx.minute)
        ?? T.press({ min: ctx.minute, team: ctx.homeShort ?? 'Casa', recoverer: secondaryMate(ctx) });
    } else {
      const rShot = Math.random();
      const awayOnPitch = Math.max(1, ctx.awayRoster?.length ?? 11);
      const awayNumericRatio = Math.max(0.55, awayOnPitch / 11);
      const pGoalAway =
        awayZone === 'att'
          ? (0.1 + ctx.opponentStrength / 850 + errorTax * 0.15) * awayNumericRatio
          : 0;
      const pWideAway = 0.12;
      if (awayZone === 'att' && rShot < pGoalAway) {
        L.push({
          type: 'shot_attempt',
          payload: {
            side: 'away',
            shooterId: awayShooterId,
            zone: awayZone,
            minute: ctx.minute,
            target: { x: 4 + Math.random() * 4, y: 40 + Math.random() * 20 },
          },
        });
        L.push({
          type: 'shot_result',
          payload: { side: 'away', shooterId: awayShooterId, outcome: 'goal' },
        });
        const isCounter = detectCounter(ctx.possession, 'away', [...L.events]);
        const gol = commitGoal({
          scorerSide: 'away',
          minute: ctx.minute,
          buildUp: isCounter ? 'counter' : 'positional',
          scorerName: awayScorer.name,
          homeShort: ctx.homeShort ?? 'Casa',
          awayShort,
          nowMs,
          L,
          shooterId: awayShooterId,
          ctx,
        });
        goalFor = gol.goalFor;
        goalScorerPlayerId = gol.goalScorerPlayerId;
        narrative = gol.narrative;
        ball = gol.ball;
        next = gol.nextPossession;
        spiritMeta = gol.spiritMeta;
        goalBuildUp = gol.goalBuildUp;
        threatBar01 = gol.threatBar01;
      } else if (awayZone === 'att' && rShot < pGoalAway + pWideAway) {
        L.push({
          type: 'shot_attempt',
          payload: {
            side: 'away',
            shooterId: awayShooterId,
            zone: awayZone,
            minute: ctx.minute,
            target: { x: 4 + Math.random() * 4, y: 40 + Math.random() * 20 },
          },
        });
        L.push({
          type: 'shot_result',
          payload: { side: 'away', shooterId: awayShooterId, outcome: 'wide' },
        });
        const yN = Math.random();
        const patch = patchAfterAwayShotWide(yN);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'away_shot_wide' },
        });
        L.push({ type: 'possession_change', payload: { to: 'home', reason: 'after_away_shot_wide' } });
        narrative = pickLine('shot_out', { min: ctx.minute, from: awayScorer.name, team: awayShort }, ctx.minute)
          ?? T.awayShotWide({ min: ctx.minute, shooter: awayScorer.name, team: awayShort });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
      } else {
        if (awayZone !== 'att') {
          const pushLeft = awayZone === 'mid' ? 7 + Math.random() * 14 : 5 + Math.random() * 11;
          ball = {
            x: Math.max(14, ctx.ball.x - pushLeft),
            y: Math.min(82, Math.max(18, ctx.ball.y + (Math.random() * 14 - 7))),
          };
        } else {
          ball = {
            x: 25 + Math.random() * 40,
            y: 20 + Math.random() * 60,
          };
        }
        L.push({
          type: 'ball_state',
          payload: { ...ball, reason: 'away_build' },
        });
        if (Math.random() < 0.35) {
          next = 'home';
          L.push({ type: 'possession_change', payload: { to: 'home', reason: 'away_turnover' } });
          narrative = pickLine('possession_switch', { min: ctx.minute, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
            ?? T.turnover({ min: ctx.minute, team: ctx.homeShort ?? 'Casa' });
        }
      }
    }
  }

  return {
    narrative,
    action,
    nextPossession: next,
    ball,
    goalFor,
    goalScorerPlayerId,
    goalBuildUp,
    threatBar01,
    statDeltas: homeStat,
    causalEvents: [...L.events],
    spiritMeta,
  };
}
