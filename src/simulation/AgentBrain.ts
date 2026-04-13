import { FIELD_LENGTH, FIELD_WIDTH } from './field';
import type { AgentSnapshot, PassOption } from './InteractionResolver';
import { evaluateShot, findPassOptions, passOptionAttackBuildUpScore } from './InteractionResolver';

export type AgentAction =
  | { type: 'idle' }
  | { type: 'move_to_slot' }
  | { type: 'receive_ball' }
  | { type: 'pass'; option: PassOption }
  | { type: 'shoot' }
  | { type: 'dribble'; targetX: number; targetZ: number }
  | { type: 'press'; targetId: string; targetX: number; targetZ: number }
  | { type: 'support'; targetX: number; targetZ: number }
  | { type: 'mark'; targetId: string; targetX: number; targetZ: number };

export interface BrainContext {
  self: AgentSnapshot;
  teammates: AgentSnapshot[];
  opponents: AgentSnapshot[];
  ballX: number;
  ballZ: number;
  isCarrier: boolean;
  /** Is the ball in flight toward this player? */
  isReceiver: boolean;
  possession: 'home' | 'away' | null;
  /** 1 = attack toward FIELD_LENGTH, -1 = attack toward 0 */
  attackDir: 1 | -1;
  /** Slot target from tactical layer */
  slotX: number;
  slotZ: number;
  /** Match score difference from this team's perspective */
  scoreDiff: number;
  minute: number;
  /** 0-100 tactical mentality */
  mentality: number;
}

const DECISION_COOLDOWN = 0.35;

export class AgentBrain {
  lastDecisionTime = 0;
  currentAction: AgentAction = { type: 'idle' };

  tick(ctx: BrainContext, simTime: number): AgentAction {
    if (simTime - this.lastDecisionTime < DECISION_COOLDOWN && !ctx.isCarrier && !ctx.isReceiver) {
      return this.currentAction;
    }

    this.lastDecisionTime = simTime;

    if (ctx.isReceiver) {
      this.currentAction = { type: 'receive_ball' };
      return this.currentAction;
    }

    if (ctx.isCarrier) {
      this.currentAction = this.decideWithBall(ctx);
      return this.currentAction;
    }

    if (ctx.possession === ctx.self.side) {
      this.currentAction = this.decideTeamHasBall(ctx);
    } else {
      this.currentAction = this.decideTeamDefending(ctx);
    }

    return this.currentAction;
  }

  private decideWithBall(ctx: BrainContext): AgentAction {
    const attackDir = ctx.attackDir;
    const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
    const distToGoal = Math.abs(goalX - ctx.self.x);

    const shot = evaluateShot(ctx.self, attackDir, ctx.opponents);
    const passOptions = findPassOptions(ctx.self, ctx.teammates, ctx.opponents, attackDir);

    const nearPressure = ctx.opponents.filter(
      (o) => Math.hypot(o.x - ctx.self.x, o.z - ctx.self.z) < 5,
    ).length;

    const urgencyBoost = ctx.scoreDiff < 0 && ctx.minute > 70 ? 0.08 : 0;

    if (distToGoal < 22 && shot.xG > 0.06 + urgencyBoost) {
      if (nearPressure < 3 || shot.xG > 0.12) {
        return { type: 'shoot' };
      }
    }

    if (passOptions.length > 0) {
      const forwardPasses = passOptions
        .filter((p) => p.isForward && p.successProb > 0.45)
        .sort((a, b) => passOptionAttackBuildUpScore(b) - passOptionAttackBuildUpScore(a));
      const safePasses = passOptions.filter((p) => p.successProb > 0.65);

      if (nearPressure >= 2 && safePasses.length > 0) {
        return { type: 'pass', option: safePasses[0]! };
      }

      const mentBias = ctx.mentality / 100;
      if (forwardPasses.length > 0 && Math.random() < 0.4 + mentBias * 0.3) {
        return { type: 'pass', option: forwardPasses[0]! };
      }

      if (safePasses.length > 0) {
        const pick = safePasses[Math.floor(Math.random() * Math.min(3, safePasses.length))];
        if (pick) return { type: 'pass', option: pick };
      }
    }

    if (nearPressure < 2 && ctx.self.drible > 55) {
      const dribX = ctx.self.x + attackDir * (6 + Math.random() * 8);
      const dribZ = ctx.self.z + (Math.random() - 0.5) * 6;
      return {
        type: 'dribble',
        targetX: Math.max(2, Math.min(FIELD_LENGTH - 2, dribX)),
        targetZ: Math.max(2, Math.min(FIELD_WIDTH - 2, dribZ)),
      };
    }

    if (passOptions.length > 0) {
      return { type: 'pass', option: passOptions[0]! };
    }

    return { type: 'dribble', targetX: ctx.self.x + attackDir * 5, targetZ: ctx.self.z };
  }

  private decideTeamHasBall(ctx: BrainContext): AgentAction {
    const distToBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);

    if (distToBall < 12 && ctx.self.role !== 'gk') {
      const supportX = ctx.ballX + ctx.attackDir * (5 + Math.random() * 8);
      const supportZ = ctx.ballZ + (Math.random() - 0.5) * 15;
      return {
        type: 'support',
        targetX: Math.max(3, Math.min(FIELD_LENGTH - 3, supportX)),
        targetZ: Math.max(3, Math.min(FIELD_WIDTH - 3, supportZ)),
      };
    }

    return { type: 'move_to_slot' };
  }

  private decideTeamDefending(ctx: BrainContext): AgentAction {
    const distToBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);

    const pressThreshold = ctx.mentality > 65 ? 18 : 12;
    const maxPressers = ctx.mentality > 65 ? 3 : 2;

    if (distToBall < pressThreshold && ctx.self.role !== 'gk') {
      const nearerTeammates = ctx.teammates.filter((t) => {
        const td = Math.hypot(ctx.ballX - t.x, ctx.ballZ - t.z);
        return td < distToBall && t.id !== ctx.self.id;
      });

      if (nearerTeammates.length < maxPressers) {
        return {
          type: 'press',
          targetId: 'ball',
          targetX: ctx.ballX,
          targetZ: ctx.ballZ,
        };
      }
    }

    const nearestOpp = this.findNearestOpponentInZone(ctx);
    if (nearestOpp && ctx.self.role !== 'gk') {
      const markX = nearestOpp.x + (ctx.slotX - nearestOpp.x) * 0.3;
      const markZ = nearestOpp.z + (ctx.slotZ - nearestOpp.z) * 0.3;
      return { type: 'mark', targetId: nearestOpp.id, targetX: markX, targetZ: markZ };
    }

    return { type: 'move_to_slot' };
  }

  private findNearestOpponentInZone(ctx: BrainContext): AgentSnapshot | null {
    let best: AgentSnapshot | null = null;
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
}
