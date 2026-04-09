import type {
  DecisionPhase,
  DecisionContext,
  PlayerAction,
  PlayerProfile,
  DecisionTiming,
  OnBallAction,
  OffBallAction,
  PreReceptionResult,
  ReceptionResult,
  DecisionSpeed,
} from './types';
import { resolvePreReception } from './PreReception';
import { resolveReception } from './Reception';
import { decideOnBall, computeDecisionSpeed, decisionDelaySec, carryScanAction } from './OnBallDecision';
import { decideOffBall } from './OffBallDecision';
import { buildContextReading, identifyFieldZone } from './ContextScanner';
import {
  DECISION_TICK_MS,
  DELIBERATION_BASE_SEC,
  DELIBERATION_MIN_SEC,
  DELIBERATION_MAX_SEC,
} from '@/match/matchSimulationTuning';

/**
 * Per-player decision state machine.
 *
 * Architecture: MOVEMENT → PERCEPTION → INTENTION → ACTION
 *
 * ZERO-FREEZE RULE:
 *  - No tick may ever return `{ kind: 'idle' }`. Every tick produces
 *    a contextual action — on-ball carry, off-ball movement, or approach.
 *  - Reception is part of continuous movement: the player moves DURING
 *    reception, not after it.
 *  - Scanning produces a carry action so the carrier keeps moving while
 *    the decision forms.
 *  - Off-ball players always have a contextual action, never stand still.
 */
export class PlayerDecisionEngine {
  phase: DecisionPhase = 'idle';
  profile: PlayerProfile;

  private timing: DecisionTiming = { speed: 'normal', delaySec: 0, elapsed: 0 };
  private preReception: PreReceptionResult | null = null;
  private reception: ReceptionResult | null = null;
  private currentOnBall: OnBallAction | null = null;
  private currentOffBall: OffBallAction | null = null;
  private scanCarryAction: OnBallAction | null = null;
  private phaseTimer = 0;
  private lastDecisionTime = 0;
  private deliberationDuration = 0;
  private deliberationCarryAction: OnBallAction | null = null;

  /** Very short cooldown — off-ball players re-evaluate frequently */
  private static readonly OFF_BALL_COOLDOWN = 0.18;
  /** Executing lasts just long enough to commit to an action */
  private static readonly EXECUTING_DURATION = 0.10;
  /** Re-plan cap: decisions cached between physics ticks */
  private static readonly MIN_REPLAN_SEC = DECISION_TICK_MS / 1000;

  constructor(profile: PlayerProfile) {
    this.profile = profile;
  }

  /**
   * Sim loop forced an on-ball action the same frame as a turnover (tackle / loose pickup).
   * Keeps phase consistent so the next tick does not treat the carrier as off-ball pressing.
   */
  syncAfterTurnoverImmediateAction(action: OnBallAction, simTime: number) {
    this.scanCarryAction = null;
    this.phase = 'executing';
    this.phaseTimer = 0;
    if (isCarryAction(action)) {
      this.currentOnBall = action;
      this.currentOffBall = null;
    } else {
      this.currentOnBall = null;
    }
    this.lastDecisionTime = simTime;
  }

  tick(ctx: DecisionContext, simTime: number): PlayerAction {
    // ---------------------------------------------------------------
    // Collective trigger: carrier changed → immediate off-ball re-eval
    // ---------------------------------------------------------------
    if (ctx.carrierJustChanged && !ctx.isCarrier && !ctx.isReceiver) {
      this.forceOffBallReEval(ctx, simTime);
    }

    // Became carrier while still in an off-ball executing phase (e.g. right after tackle) — start on-ball flow
    if (ctx.isCarrier && !this.currentOnBall && this.currentOffBall && (this.phase === 'executing' || this.phase === 'idle')) {
      this.enterScanning(ctx, simTime);
    }

    // ---------------------------------------------------------------
    // Ball arriving → pre-reception pipeline
    // ---------------------------------------------------------------
    if (ctx.isReceiver && this.phase !== 'pre_receiving' && this.phase !== 'receiving') {
      this.enterPreReception(ctx);
    }

    // ---------------------------------------------------------------
    // Just became carrier — enter reception flow or scanning
    // ---------------------------------------------------------------
    if (
      ctx.isCarrier
      && this.phase !== 'deliberating'
      && this.phase !== 'scanning'
      && this.phase !== 'deciding'
      && this.phase !== 'executing'
      && this.phase !== 'receiving'
    ) {
      if (this.phase === 'pre_receiving') {
        this.enterReception(ctx);
      } else {
        this.enterScanning(ctx, simTime);
      }
    }

    // ---------------------------------------------------------------
    // Lost the ball while in on-ball phases → immediate off-ball eval
    // ---------------------------------------------------------------
    if (!ctx.isCarrier && !ctx.isReceiver && isOnBallPhase(this.phase)) {
      this.transitionToOffBall(ctx, simTime);
    }

    // ---------------------------------------------------------------
    // Phase-specific logic — EVERY branch produces movement
    // ---------------------------------------------------------------
    const dt = 1 / 60;

    switch (this.phase) {
      case 'pre_receiving':
        return this.tickPreReceiving(ctx, dt);
      case 'receiving':
        return this.tickReceiving(ctx, dt, simTime);
      case 'deliberating':
        return this.tickDeliberating(ctx, dt, simTime);
      case 'scanning':
        return this.tickScanning(ctx, dt, simTime);
      case 'deciding':
        return this.tickDeciding(ctx, dt, simTime);
      case 'executing':
        return this.tickExecuting(ctx, dt, simTime);
      case 'recovering':
      case 'idle':
      default:
        return this.tickAlive(ctx, simTime);
    }
  }

  // ===================================================================
  // Phase transitions
  // ===================================================================

  private enterPreReception(ctx: DecisionContext) {
    this.phase = 'pre_receiving';
    this.phaseTimer = 0;
    this.preReception = resolvePreReception(ctx);
  }

  private enterReception(ctx: DecisionContext) {
    this.phase = 'receiving';
    this.phaseTimer = 0;
    this.reception = resolveReception(ctx);
  }

  /**
   * DELIBERATION: the player has just received the ball and reads the field
   * before committing to any action. Duration depends on mentalidade, confianca,
   * pressure, and field zone. During this window the player may only adjust
   * body position or carry very short — no pass/shot/dribble.
   */
  private enterDeliberation(ctx: DecisionContext, simTime: number) {
    const reading = buildContextReading(ctx);
    const mental01 = (ctx.self.mentalidade ?? 70) / 100;
    const conf01 = (ctx.self.confianca ?? 70) / 100;
    const pressure = reading.pressure;

    let dur = DELIBERATION_BASE_SEC;
    dur -= mental01 * 0.04;
    dur -= conf01 * 0.03;
    if (pressure.intensity === 'extreme') dur *= 0.35;
    else if (pressure.intensity === 'high') dur *= 0.55;
    else if (pressure.intensity === 'none') dur *= 1.3;
    if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third') dur *= 1.15;
    if (reading.fieldZone === 'opp_box') dur *= 0.6;

    // Pre-scanned first-touch receptions: player already anticipated action,
    // so deliberation is shorter — but never zero (the player still processes).
    const recType = this.reception?.type;
    if (recType === 'first_touch_pass' || recType === 'first_touch_shot') {
      dur *= 0.4;
    } else if (recType === 'oriented_forward' || recType === 'let_run') {
      dur *= 0.6;
    }

    dur = Math.max(DELIBERATION_MIN_SEC, Math.min(DELIBERATION_MAX_SEC, dur));

    this.phase = 'deliberating';
    this.phaseTimer = 0;
    this.deliberationDuration = dur;
    this.deliberationCarryAction = carryScanAction(ctx, reading);
    this.lastDecisionTime = simTime;
  }

  private enterScanning(ctx: DecisionContext, simTime: number) {
    const reading = buildContextReading(ctx);
    const zone = identifyFieldZone(ctx.self.x, ctx.attackDir);

    // URGENCY: in the attacking third or box, skip scanning — decide NOW.
    // The goal is everything; don't waste time carrying when you should shoot or pass.
    if (zone === 'opp_box' || zone === 'att_third') {
      this.enterDeciding(ctx, simTime);
      return;
    }

    // URGENCY: very high threat level — act instantly
    if (ctx.threatLevel > 0.65) {
      this.enterDeciding(ctx, simTime);
      return;
    }

    this.phase = 'scanning';
    this.phaseTimer = 0;
    const speed = computeDecisionSpeed(reading, ctx.profile);
    this.timing = { speed, delaySec: decisionDelaySec(speed), elapsed: 0 };
    this.scanCarryAction = carryScanAction(ctx, reading);
  }

  private enterDeciding(ctx: DecisionContext, simTime: number) {
    const zone = ctx.isCarrier ? identifyFieldZone(ctx.self.x, ctx.attackDir) : null;
    const urgentDecide = zone === 'opp_box' || zone === 'att_third';
    if (!urgentDecide && simTime - this.lastDecisionTime < PlayerDecisionEngine.MIN_REPLAN_SEC) {
      this.phase = 'executing';
      this.phaseTimer = 0;
      return;
    }
    this.phase = 'deciding';
    this.phaseTimer = 0;

    if (ctx.isCarrier) {
      this.currentOnBall = decideOnBall(ctx);
      this.currentOffBall = null;
    } else {
      this.currentOnBall = null;
      this.currentOffBall = decideOffBall(ctx);
    }
    this.lastDecisionTime = simTime;
  }

  private enterExecuting() {
    this.phase = 'executing';
    this.phaseTimer = 0;
  }

  /**
   * Instead of a "recovering" dead state, immediately evaluate
   * off-ball movement — no freeze allowed after losing possession.
   */
  private transitionToOffBall(ctx: DecisionContext, simTime: number) {
    this.phase = 'executing';
    this.phaseTimer = 0;
    this.currentOnBall = null;
    this.scanCarryAction = null;
    this.currentOffBall = decideOffBall(ctx);
    this.lastDecisionTime = simTime;
  }

  /**
   * Possession changed to this team — force immediate off-ball re-evaluation
   * so teammates react to the new carrier without waiting for cooldown.
   */
  private forceOffBallReEval(ctx: DecisionContext, simTime: number) {
    this.currentOffBall = decideOffBall(ctx);
    this.lastDecisionTime = simTime;
    this.phase = 'executing';
    this.phaseTimer = 0;
  }

  // ===================================================================
  // Phase ticks — ZERO returns of { kind: 'idle' }
  // ===================================================================

  /**
   * PRE-RECEIVING: The player is moving toward the ball or adjusting body.
   * Always produces a movement action (pre_receiving intent or off-ball).
   */
  private tickPreReceiving(ctx: DecisionContext, dt: number): PlayerAction {
    this.phaseTimer += dt;

    if (!ctx.isReceiver) {
      // Ball went elsewhere — immediately do off-ball movement
      return this.produceOffBall(ctx);
    }

    if (this.preReception) {
      if (ctx.ballFlightProgress > 0.85) {
        this.enterReception(ctx);
        return this.tickReceiving(ctx, dt, 0);
      }
      return { kind: 'pre_receiving', intent: this.preReception };
    }

    // Fallback: move toward ball
    return this.produceOffBall(ctx);
  }

  /**
   * RECEIVING: The ball is arriving. The player controls it while MOVING.
   * During the (very short) reception window, the player returns a carry
   * action in the direction of their body orientation — never freezes.
   */
  private tickReceiving(ctx: DecisionContext, dt: number, simTime: number): PlayerAction {
    this.phaseTimer += dt;

    if (!this.reception) {
      this.reception = resolveReception(ctx);
    }

    // During reception: player is conducting the ball in their oriented direction
    if (this.phaseTimer < this.reception.durationSec) {
      // Return the reception result so the loop knows about fumbles,
      // but the player is already moving (the loop handles this via
      // the pre-reception body angle / approach vector)
      return { kind: 'receiving', reception: this.reception };
    }

    // Reception complete — enter DELIBERATION (player reads the field before acting)
    if (this.reception.success) {
      this.enterDeliberation(ctx, simTime);
      return this.tickDeliberating(ctx, dt, simTime);
    }

    // Fumble: immediately switch to off-ball pursuit
    this.transitionToOffBall(ctx, simTime);
    return { kind: 'receiving', reception: this.reception };
  }

  /**
   * DELIBERATING: player has just received the ball and is reading the field.
   * Only body orientation / micro-carry allowed. No pass, shot, or dribble.
   *
   * INSTINCT CLEAR: under extreme pressure an opponent arriving within
   * tackle range may abort deliberation early (self-preservation).
   */
  private tickDeliberating(ctx: DecisionContext, dt: number, simTime: number): PlayerAction {
    this.phaseTimer += dt;

    if (!ctx.isCarrier) {
      return this.produceOffBall(ctx);
    }

    // Instinct clear: opponent too close — abort deliberation and decide NOW
    const nearOpp = nearestOpponentDist(ctx);
    if (nearOpp < 2) {
      this.enterDeciding(ctx, simTime);
      return this.tickDeciding(ctx, dt, simTime);
    }

    // Deliberation window elapsed → proceed to full decision
    if (this.phaseTimer >= this.deliberationDuration) {
      this.enterDeciding(ctx, simTime);
      return this.tickDeciding(ctx, dt, simTime);
    }

    // During deliberation: micro-carry only (no pass/shot/dribble dispatched)
    if (this.deliberationCarryAction) {
      return { kind: 'on_ball', action: this.deliberationCarryAction };
    }
    return { kind: 'on_ball', action: { type: 'hold_ball' } };
  }

  /**
   * SCANNING: The player is reading the field while conducting the ball.
   * Carrier gets a carry action. Non-carrier gets off-ball movement.
   *
   * APPROACH SENSE: if an opponent closes in during the scan, the carrier
   * interrupts thinking and decides immediately — self-preservation instinct.
   */
  private tickScanning(ctx: DecisionContext, dt: number, simTime: number): PlayerAction {
    this.timing.elapsed += dt;

    // APPROACH SENSE: opponent closing in during scan — abort and decide NOW
    if (ctx.isCarrier) {
      const nearOpp = nearestOpponentDist(ctx);
      if (nearOpp < 3) {
        this.enterDeciding(ctx, simTime);
        return this.tickDeciding(ctx, dt, simTime);
      }
      if (nearOpp < 6 && this.timing.elapsed > this.timing.delaySec * 0.3) {
        this.enterDeciding(ctx, simTime);
        return this.tickDeciding(ctx, dt, simTime);
      }
    }

    if (this.timing.elapsed >= this.timing.delaySec) {
      this.enterDeciding(ctx, simTime);
      return this.tickDeciding(ctx, dt, simTime);
    }

    // Carrier: conduct ball while thinking
    if (ctx.isCarrier && this.scanCarryAction) {
      return { kind: 'on_ball', action: this.scanCarryAction };
    }

    // Non-carrier in scanning (shouldn't happen normally, but safety)
    return this.produceOffBall(ctx);
  }

  /**
   * DECIDING: The decision is resolved. Immediately execute.
   */
  private tickDeciding(ctx: DecisionContext, dt: number, simTime: number): PlayerAction {
    this.phaseTimer += dt;

    if (ctx.isCarrier && this.currentOnBall) {
      this.enterExecuting();
      return { kind: 'on_ball', action: this.currentOnBall };
    }

    if (!ctx.isCarrier && this.currentOffBall) {
      this.enterExecuting();
      return { kind: 'off_ball', action: this.currentOffBall };
    }

    // Fallback: produce contextual movement
    return this.produceOffBall(ctx);
  }

  /**
   * EXECUTING: Carrying out the decided action.
   * On completion, seamlessly re-evaluate (no idle gap).
   *
   * APPROACH SENSE: if carrying and an opponent closes to tackle range,
   * re-evaluate immediately — the player reacts to the approaching threat.
   */
  private tickExecuting(ctx: DecisionContext, dt: number, simTime: number): PlayerAction {
    this.phaseTimer += dt;

    if (ctx.isCarrier && this.currentOnBall) {
      const zone = identifyFieldZone(ctx.self.x, ctx.attackDir);
      const inFinishZone = zone === 'opp_box' || zone === 'att_third';
      if (
        inFinishZone
        && isCarryAction(this.currentOnBall)
        && simTime - this.lastDecisionTime >= PlayerDecisionEngine.MIN_REPLAN_SEC
      ) {
        this.currentOnBall = decideOnBall(ctx);
        this.lastDecisionTime = simTime;
        this.phaseTimer = 0;
        return { kind: 'on_ball', action: this.currentOnBall };
      }
      // APPROACH SENSE: opponent arrived during a carry — re-decide
      if (isCarryAction(this.currentOnBall) && this.phaseTimer > 0.05) {
        const nearOpp = nearestOpponentDist(ctx);
        if (nearOpp < 3) {
          this.currentOnBall = decideOnBall(ctx);
          this.lastDecisionTime = simTime;
          this.phaseTimer = 0;
          return { kind: 'on_ball', action: this.currentOnBall };
        }
      }
      return { kind: 'on_ball', action: this.currentOnBall };
    }

    if (this.currentOffBall) {
      if (this.phaseTimer > PlayerDecisionEngine.EXECUTING_DURATION) {
        return this.produceOffBall(ctx);
      }
      return { kind: 'off_ball', action: this.currentOffBall };
    }

    return this.produceOffBall(ctx);
  }

  /**
   * ALIVE: Replaces both 'idle' and 'recovering'. Off-ball players always
   * have contextual movement — they never stand still waiting for a command.
   */
  private tickAlive(ctx: DecisionContext, simTime: number): PlayerAction {
    // Re-evaluate frequently
    if (simTime - this.lastDecisionTime > PlayerDecisionEngine.OFF_BALL_COOLDOWN || !this.currentOffBall) {
      this.currentOffBall = decideOffBall(ctx);
      this.lastDecisionTime = simTime;
    }

    if (this.currentOffBall) {
      this.phase = 'executing';
      return { kind: 'off_ball', action: this.currentOffBall };
    }

    // Absolute last resort — should never reach here
    this.currentOffBall = decideOffBall(ctx);
    this.lastDecisionTime = simTime;
    return { kind: 'off_ball', action: this.currentOffBall };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /**
   * Produce an off-ball action immediately. Called whenever the player
   * needs contextual movement and isn't the carrier.
   */
  private produceOffBall(ctx: DecisionContext): PlayerAction {
    this.currentOffBall = decideOffBall(ctx);
    this.phase = 'executing';
    this.phaseTimer = 0;
    return { kind: 'off_ball', action: this.currentOffBall };
  }
}

function isOnBallPhase(phase: DecisionPhase): boolean {
  return phase === 'scanning' || phase === 'deciding' || phase === 'executing' || phase === 'receiving' || phase === 'pre_receiving' || phase === 'deliberating';
}

function nearestOpponentDist(ctx: DecisionContext): number {
  let min = Infinity;
  for (const o of ctx.opponents) {
    const d = Math.hypot(o.x - ctx.self.x, o.z - ctx.self.z);
    if (d < min) min = d;
  }
  return min;
}

function isCarryAction(action: OnBallAction): boolean {
  return action.type === 'simple_carry'
    || action.type === 'aggressive_carry'
    || action.type === 'progressive_dribble'
    || action.type === 'beat_marker'
    || action.type === 'cut_inside'
    || action.type === 'run_to_byline'
    || action.type === 'enter_box'
    || action.type === 'turn_on_marker';
}
