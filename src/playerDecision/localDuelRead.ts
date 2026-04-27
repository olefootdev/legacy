/**
 * Leitura de duelo local — confronto com o adversário mais relevante antes da ação.
 * Usa ContextReading (pressão, espaço, LOS), subzonas smartfield no ctx e atributos AgentSnapshot.
 * Só inclina decisões existentes (macroTilt / gates); não é motor paralelo.
 */
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import type { ContextReading, DecisionContext } from './types';
import { isReceivingBackToGoalShaped } from './ContextScanner';
import type { DecisionActionId } from './collectiveIndividualDecision';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

export type DuelOutcome = 'advantage' | 'balance' | 'disadvantage';

export type LocalDuelKind =
  | 'dribble'
  | 'speed'
  | 'body'
  | 'pass'
  | 'finish'
  | 'marking'
  | 'anticipation'
  | 'aerial'
  | 'goalkeeper'
  | 'open_play';

export interface LocalDuelRead {
  kind: LocalDuelKind;
  outcome: DuelOutcome;
  /** -1..1 */
  scoreDelta: number;
  primaryOpponentId: string | null;
}

function n(v: number): number {
  return Math.max(0, Math.min(1, v / 100));
}

function stamina01(agent: AgentSnapshot): number {
  return Math.max(0, Math.min(1, (agent.stamina ?? 100) / 100));
}

function confidenceBlend(agent: AgentSnapshot): number {
  const rt = agent.confidenceRuntime ?? 1;
  return Math.max(0.35, Math.min(1.15, n(agent.confianca) * 0.5 + n(agent.mentalidade) * 0.35 + rt * 0.25));
}

function spatialFreedom01(reading: ContextReading, ctx: DecisionContext): number {
  const fwd = Math.min(1, reading.space.forwardSpaceDepth / 14);
  const lat = Math.min(
    1,
    Math.max(reading.space.lateralSpaceLeft, reading.space.lateralSpaceRight) / 10,
  );
  const lane =
    Math.min(1, reading.laneBehindBall.depthM / 16) * 0.35
    + Math.min(1, reading.laneBehindBall.widthM / 12) * 0.25;
  const wing = (reading.wingSpace01.left + reading.wingSpace01.right) * 0.5 * 0.2;
  let sf = 0;
  if (ctx.sfSubzone && ctx.sfBallSubzone && ctx.sfSubzone === ctx.sfBallSubzone) sf += 0.06;
  if (reading.spatialBand === 'danger') sf += 0.04;
  return Math.max(0, Math.min(1, fwd * 0.42 + lat * 0.28 + lane + wing + sf));
}

export function findPrimaryOpponent(
  self: AgentSnapshot,
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
  maxDist = 16,
): AgentSnapshot | null {
  let best: AgentSnapshot | null = null;
  let bestScore = -1e9;
  for (const o of opponents) {
    const d = Math.hypot(o.x - self.x, o.z - self.z);
    if (d > maxDist) continue;
    const inFront = (o.x - self.x) * attackDir;
    const aheadWeight = inFront > 0.5 ? 1.15 : inFront > -1 ? 1 : 0.88;
    const s = -d * aheadWeight;
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}

function nearestGoalkeeper(opponents: AgentSnapshot[], attackDir: 1 | -1): AgentSnapshot | null {
  const goalX = attackDir === 1 ? 0 : FIELD_LENGTH;
  let best: AgentSnapshot | null = null;
  let bestD = 1e9;
  for (const o of opponents) {
    if (o.role !== 'gk') continue;
    const d = Math.hypot(o.x - goalX, o.z - FIELD_WIDTH / 2);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function outcomeFromDelta(delta: number): DuelOutcome {
  if (delta > 0.11) return 'advantage';
  if (delta < -0.11) return 'disadvantage';
  return 'balance';
}

function pickCarrierDuelKind(ctx: DecisionContext, reading: ContextReading): LocalDuelKind {
  const distBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  const flight = ctx.ballFlightProgress;
  if (flight > 0.16 && flight < 0.86 && distBall < 6) return 'aerial';

  if (reading.pressureBand === 'high' || reading.pressureBand === 'critical') return 'pass';

  const inShootPhase =
    reading.distToGoal < 18
    || (
      (reading.fieldZone === 'att_third' || reading.fieldZone === 'opp_box')
      && reading.distToGoal < 28
      && reading.lineOfSightScore > 0.16
    );
  if (inShootPhase) return 'finish';

  if (isReceivingBackToGoalShaped(ctx, reading) || reading.pressure.nearestOpponentDist < 3.4) {
    return 'body';
  }

  if (
    reading.space.forwardSpaceDepth > 6.5
    && reading.pressure.nearestOpponentDist > 4.8
    && reading.pressure.nearestOpponentDist < 14
  ) {
    return 'speed';
  }

  if (reading.pressure.nearestOpponentDist < 7.2) return 'dribble';

  return 'open_play';
}

function scoreFinishDuel(
  self: AgentSnapshot,
  primary: AgentSnapshot | null,
  opponents: AgentSnapshot[],
  reading: ContextReading,
  attackDir: 1 | -1,
): number {
  const los = reading.lineOfSightScore;
  const dist = reading.distToGoal;
  const off =
    n(self.finalizacao) * 0.42
    + confidenceBlend(self) * 0.28
    + n(self.fisico) * 0.18
    + los * 0.12
    + Math.max(0, 1 - dist / 42) * 0.08;

  const gk = nearestGoalkeeper(opponents, attackDir);
  const marker = primary && primary.role !== 'gk' ? primary : findPrimaryOpponent(self, opponents.filter((o) => o.role !== 'gk'), attackDir, 14);

  let def = 0;
  if (gk) {
    def += n(gk.marcacao) * 0.22 + n(gk.mentalidade) * 0.12 + n(gk.tatico) * 0.14 + n(gk.fisico) * 0.08;
    const gx = gk.x;
    const sx = self.x;
    const gkDepth = Math.abs((sx - gx) * attackDir);
    def += Math.max(0, 1 - gkDepth / 22) * 0.12;
  }
  if (marker) {
    const md = Math.hypot(marker.x - self.x, marker.z - self.z);
    const block01 = Math.max(0, 1 - md / 9) * n(marker.marcacao) * 0.26;
    def += block01 + n(marker.fisico) * 0.08;
  }
  def += (1 - los) * 0.14;
  return off - def;
}

function scorePassDuel(self: AgentSnapshot, primary: AgentSnapshot | null, reading: ContextReading): number {
  const off =
    n(self.passe) * 0.38
    + n(self.tatico) * 0.28
    + n(self.mentalidade) * 0.18
    + confidenceBlend(self) * 0.16;
  const press = reading.pressureBand === 'critical' ? 0.22 : reading.pressureBand === 'high' ? 0.14 : 0.06;
  const def =
    (primary ? n(primary.marcacao) * 0.34 + n(primary.tatico) * 0.22 + n(primary.velocidade) * 0.14 : 0.12)
    + Math.min(0.28, (reading.pressure.opponentsInZone / 6) * 0.26)
    + press;
  return off - def;
}

function scoreDribbleDuel(
  self: AgentSnapshot,
  primary: AgentSnapshot | null,
  reading: ContextReading,
  ctx: DecisionContext,
): number {
  if (!primary) return 0.06;
  const off =
    n(self.drible) * 0.34
    + n(self.velocidade) * 0.22
    + confidenceBlend(self) * 0.22
    + n(self.mentalidade) * 0.12
    + spatialFreedom01(reading, ctx) * 0.1;
  const def =
    n(primary.marcacao) * 0.3
    + n(primary.velocidade) * 0.22
    + n(primary.fisico) * 0.24
    + n(primary.tatico) * 0.18;
  return off - def;
}

function scoreSpeedDuel(self: AgentSnapshot, primary: AgentSnapshot | null, reading: ContextReading): number {
  const fat = (1 - stamina01(self)) * 0.14;
  const off = n(self.velocidade) * 0.45 + confidenceBlend(self) * 0.28 + n(self.mentalidade) * 0.15 - fat;
  const def = primary
    ? n(primary.velocidade) * 0.42 + n(primary.fisico) * 0.22 + n(primary.marcacao) * 0.18
    : 0.1;
  const path = Math.min(1, reading.space.forwardSpaceDepth / 12) * 0.12;
  return off - def + path;
}

function scoreBodyDuel(self: AgentSnapshot, primary: AgentSnapshot | null): number {
  if (!primary) return 0.04;
  const off = n(self.fisico) * 0.38 + n(self.mentalidade) * 0.28 + confidenceBlend(self) * 0.22 + n(self.drible) * 0.12;
  const def = n(primary.fisico) * 0.4 + n(primary.marcacao) * 0.28 + n(primary.mentalidade) * 0.2 + n(primary.tatico) * 0.12;
  return off - def;
}

function scoreAerialDuel(self: AgentSnapshot, primary: AgentSnapshot | null): number {
  if (!primary) return 0.05;
  const off = n(self.fisico) * 0.42 + n(self.mentalidade) * 0.26 + confidenceBlend(self) * 0.18 + n(self.tatico) * 0.14;
  const def = n(primary.fisico) * 0.44 + n(primary.mentalidade) * 0.22 + n(primary.tatico) * 0.18 + n(primary.marcacao) * 0.16;
  return off - def;
}

function scoreOpenPlay(self: AgentSnapshot, primary: AgentSnapshot | null, reading: ContextReading, ctx: DecisionContext): number {
  const off = n(self.tatico) * 0.3 + n(self.mentalidade) * 0.25 + confidenceBlend(self) * 0.25 + spatialFreedom01(reading, ctx) * 0.2;
  const def = primary ? n(primary.tatico) * 0.35 + n(primary.marcacao) * 0.25 + n(primary.mentalidade) * 0.2 : 0.08;
  return off - def;
}

/** Portador: identifica duelo principal e resultado vantagem / equilíbrio / desvantagem. */
export function evaluateCarrierLocalDuel(ctx: DecisionContext, reading: ContextReading): LocalDuelRead {
  const primary = findPrimaryOpponent(ctx.self, ctx.opponents, ctx.attackDir, 17);
  const kind = pickCarrierDuelKind(ctx, reading);
  let delta = 0;
  switch (kind) {
    case 'finish':
      delta = scoreFinishDuel(ctx.self, primary, ctx.opponents, reading, ctx.attackDir);
      break;
    case 'pass':
      delta = scorePassDuel(ctx.self, primary, reading);
      break;
    case 'dribble':
      delta = scoreDribbleDuel(ctx.self, primary, reading, ctx);
      break;
    case 'speed':
      delta = scoreSpeedDuel(ctx.self, primary, reading);
      break;
    case 'body':
      delta = scoreBodyDuel(ctx.self, primary);
      break;
    case 'aerial':
      delta = scoreAerialDuel(ctx.self, primary);
      break;
    default:
      delta = scoreOpenPlay(ctx.self, primary, reading, ctx);
      break;
  }
  delta = Math.max(-1, Math.min(1, delta));
  return {
    kind,
    outcome: outcomeFromDelta(delta),
    scoreDelta: delta,
    primaryOpponentId: primary?.id ?? null,
  };
}

function tilt(
  m: Partial<Record<DecisionActionId, number>>,
  id: DecisionActionId,
  v: number,
): void {
  m[id] = (m[id] ?? 0) + v;
}

/** Inclinação para `chooseAction` (portador) a partir do duelo local. */
export function duelMacroTiltForCarrier(
  duel: LocalDuelRead,
  reading: ContextReading,
): Partial<Record<DecisionActionId, number>> {
  const m: Partial<Record<DecisionActionId, number>> = {};
  const { outcome, kind } = duel;
  const riskZone = reading.spatialBand === 'danger' || reading.pressureBand !== 'passive';

  const agg = outcome === 'advantage' ? 1 : outcome === 'balance' ? 0.55 : 0.2;
  const safe = outcome === 'disadvantage' ? 1 : outcome === 'balance' ? 0.45 : 0.2;

  if (kind === 'finish') {
    if (outcome === 'advantage') tilt(m, 'shoot', 0.26 * agg);
    else if (outcome === 'disadvantage') {
      tilt(m, 'shoot', -0.38);
      tilt(m, 'pass_safe', 0.16 * safe);
      tilt(m, 'pass_progressive', 0.08);
    } else {
      tilt(m, 'shoot', 0.06);
    }
  }

  if (kind === 'pass' || (riskZone && outcome === 'disadvantage')) {
    tilt(m, 'pass_safe', 0.18 * safe);
    if (outcome === 'disadvantage') {
      tilt(m, 'pass_progressive', -0.14);
      tilt(m, 'dribble_risk', -0.22);
    }
    if (kind === 'pass' && outcome === 'advantage') tilt(m, 'pass_progressive', 0.14);
  }

  if (kind === 'dribble') {
    if (outcome === 'advantage') {
      tilt(m, 'dribble_risk', 0.3 * agg);
      tilt(m, 'carry', 0.12 * agg);
    } else if (outcome === 'disadvantage') {
      tilt(m, 'dribble_risk', -0.42);
      tilt(m, 'pass_safe', 0.22 * safe);
      tilt(m, 'carry', -0.08);
    }
  }

  if (kind === 'speed') {
    if (outcome === 'advantage') {
      tilt(m, 'carry', 0.2 * agg);
      tilt(m, 'dribble_risk', 0.08 * agg);
    } else {
      tilt(m, 'pass_safe', 0.12 * safe);
      tilt(m, 'carry', -0.06);
    }
  }

  if (kind === 'body') {
    if (outcome === 'disadvantage') {
      tilt(m, 'dribble_risk', -0.28);
      tilt(m, 'pass_safe', 0.2 * safe);
      tilt(m, 'pass_progressive', 0.06);
    } else if (outcome === 'advantage') {
      tilt(m, 'carry', 0.1);
    }
  }

  if (kind === 'aerial') {
    if (outcome === 'advantage') tilt(m, 'pass_long', 0.08);
    else tilt(m, 'pass_safe', 0.14 * safe);
  }

  if (kind === 'open_play') {
    if (outcome === 'disadvantage') tilt(m, 'dribble_risk', -0.12);
  }

  if (riskZone && outcome === 'disadvantage') tilt(m, 'clearance', 0.08);

  return m;
}

/** Defensor vs portador: duelo de marcação / bote. */
export function evaluateMarkingDuelDefender(
  self: AgentSnapshot,
  carrier: AgentSnapshot,
  reading: ContextReading,
): LocalDuelRead {
  const off =
    n(self.marcacao) * 0.34
    + n(self.velocidade) * 0.22
    + n(self.fisico) * 0.2
    + n(self.fairPlay) * 0.08
    + n(self.mentalidade) * 0.16;
  const cover01 = Math.min(1, reading.laneBehindBall.depthM / 14) * 0.08;
  const threat = reading.threatLevel * 0.06;
  const def =
    n(carrier.drible) * 0.28
    + n(carrier.velocidade) * 0.26
    + n(carrier.confianca) * 0.18
    + n(carrier.mentalidade) * 0.14
    + reading.progressToGoal * 0.14;
  const delta = Math.max(-1, Math.min(1, off - def + cover01 - threat));
  return {
    kind: 'marking',
    outcome: outcomeFromDelta(delta),
    scoreDelta: delta,
    primaryOpponentId: carrier.id,
  };
}

/** Interceptação / leitura de linha (volante / zagueiro). */
export function evaluateAnticipationDuel(
  self: AgentSnapshot,
  carrier: AgentSnapshot,
  reading: ContextReading,
): LocalDuelRead {
  const off = n(self.tatico) * 0.38 + n(self.marcacao) * 0.28 + n(self.mentalidade) * 0.22 + n(self.velocidade) * 0.12;
  const def = n(carrier.passe) * 0.32 + n(carrier.tatico) * 0.24 + n(carrier.mentalidade) * 0.2 + reading.localTargetConfidence.carrier01 * 0.18;
  const delta = Math.max(-1, Math.min(1, off - def));
  return {
    kind: 'anticipation',
    outcome: outcomeFromDelta(delta),
    scoreDelta: delta,
    primaryOpponentId: carrier.id,
  };
}

/** Goleiro: sair / ficar vs ameaça da jogada (sem teletransporte — só alvo de movimento). */
export function evaluateGoalkeeperPositionDuel(ctx: DecisionContext, reading: ContextReading): LocalDuelRead {
  const carrier = ctx.opponents.find((o) => o.id === ctx.carrierId) ?? null;
  if (!carrier) {
    return { kind: 'goalkeeper', outcome: 'balance', scoreDelta: 0, primaryOpponentId: null };
  }
  const gk = ctx.self;
  const goalX = ctx.attackDir === 1 ? 0 : FIELD_LENGTH;
  const distCarrierGoal = Math.hypot(carrier.x - goalX, carrier.z - FIELD_WIDTH / 2);
  const distGkCarrier = Math.hypot(carrier.x - gk.x, carrier.z - gk.z);
  const shotUrgency = reading.threatLevel * 0.22 + Math.max(0, 1 - distCarrierGoal / 38) * 0.2;
  const off =
    n(gk.marcacao) * 0.28
    + n(gk.mentalidade) * 0.26
    + n(gk.tatico) * 0.24
    + n(gk.velocidade) * 0.12
    + Math.max(0, 1 - distGkCarrier / 28) * 0.1;
  const def =
    n(carrier.finalizacao) * 0.22
    + n(carrier.velocidade) * 0.24
    + n(carrier.confianca) * 0.18
    + shotUrgency;
  const delta = Math.max(-1, Math.min(1, off - def));
  return {
    kind: 'goalkeeper',
    outcome: outcomeFromDelta(delta),
    scoreDelta: delta,
    primaryOpponentId: carrier.id,
  };
}
