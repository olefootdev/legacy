/**
 * Pipeline de remate: elegibilidade, resolução (GOAL/SAVE/MISS) e decisão com orçamento.
 * npx tsx src/simulation/runShootPipelineSelfTest.ts
 */
import { isShootMinEligible } from '@/match/shootEligibility';
import { buildContextReading, detectTeamPhase } from '@/playerDecision/ContextScanner';
import { decideOnBall } from '@/playerDecision/OnBallDecision';
import { profileForSlot } from '@/playerDecision/PlayerProfile';
import type { DecisionContext } from '@/playerDecision/types';
import { resolveShotForPossession, type ShotOutcomeKind } from '@/simulation/ActionResolver';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function snap(over: Partial<AgentSnapshot> & Pick<AgentSnapshot, 'id'>): AgentSnapshot {
  const passe = 70;
  return {
    id: over.id,
    side: over.side ?? 'home',
    slotId: over.slotId ?? 'ata',
    x: over.x ?? 88,
    z: over.z ?? 34,
    speed: 5,
    role: over.role ?? 'attack',
    passe,
    passeCurto: passe,
    passeLongo: 68,
    cruzamento: 65,
    marcacao: 60,
    drible: 70,
    finalizacao: over.finalizacao ?? 78,
    velocidade: 72,
    fisico: 70,
    fairPlay: 75,
    tatico: 70,
    mentalidade: over.mentalidade ?? 74,
    confianca: over.confianca ?? 76,
    confidenceRuntime: over.confidenceRuntime ?? 1,
    stamina: over.stamina ?? 90,
  };
}

function findShotOutcome(
  want: ShotOutcomeKind,
  seed: number,
  maxTick: number,
  factory: (tick: number) => ReturnType<typeof resolveShotForPossession>,
): void {
  for (let tick = 0; tick < maxTick; tick++) {
    if (factory(tick).outcome === want) return;
  }
  throw new Error(`shot-resolve: could not find outcome ${want} within ${maxTick} ticks`);
}

function buildAttackingCarrierCtx(shootBudgetForce: boolean): DecisionContext {
  const self = snap({
    id: 'carrier',
    side: 'home',
    slotId: 'ata',
    x: FIELD_LENGTH - 14,
    z: FIELD_WIDTH / 2,
    role: 'attack',
    finalizacao: 88,
    mentalidade: 86,
    confianca: 88,
  });
  const tm: AgentSnapshot[] = [
    snap({ id: 't1', side: 'home', slotId: 'mc1', x: self.x - 10, z: self.z + 2, role: 'mid' }),
    snap({ id: 't2', side: 'home', slotId: 'pe', x: self.x - 6, z: self.z - 16, role: 'attack' }),
  ];
  const opps: AgentSnapshot[] = [
    snap({ id: 'd1', side: 'away', x: FIELD_LENGTH - 4, z: self.z, role: 'def', marcacao: 78 }),
  ];
  const profile = profileForSlot('ata', 'attack');
  const teamPhase = detectTeamPhase(self.x, 1, 'home', 'home', self.id);
  return {
    self,
    teammates: tm,
    opponents: opps,
    ballX: self.x,
    ballZ: self.z,
    isCarrier: true,
    isReceiver: false,
    ballFlightProgress: 0,
    possession: 'home',
    attackDir: 1,
    clockHalf: 1,
    shootBudgetForce,
    offensiveStallShotBoost: false,
    slotX: self.x,
    slotZ: self.z,
    scoreDiff: 0,
    minute: 28,
    mentality: 78,
    tacticalDefensiveLine: 52,
    tacticalPressing: 55,
    tacticalWidth: 52,
    tacticalTempo: 68,
    stamina: 90,
    decisionDebug: false,
    profile,
    teamPhase,
    carrierId: self.id,
    carrierJustChanged: false,
    ballSector: 'center',
    threatLevel: 0.55,
    threatTrend: 'rising',
  };
}

function main() {
  const ctxBase = buildAttackingCarrierCtx(false);
  const reading = buildContextReading(ctxBase);
  assert(
    isShootMinEligible(ctxBase.self, reading, ctxBase),
    'attacking carrier near goal should be min-eligible for shoot',
  );

  const seed = 777_888_999;
  const opps: AgentSnapshot[] = [snap({ id: 'd1', side: 'away', x: 96, z: 32, marcacao: 70 })];
  const tags = ['attacking_third', 'opp_box', 'lane_center'] as const;

  const goalCarrier = snap({ id: 'g1', x: 94, z: 34, finalizacao: 99, mentalidade: 99, confianca: 99 });
  findShotOutcome('goal', seed, 120_000, (tick) =>
    resolveShotForPossession(seed, tick, goalCarrier, 1, opps, tags, false),
  );

  const saveCarrier = snap({ id: 's1', x: 90, z: 34, finalizacao: 82, mentalidade: 80, confianca: 80 });
  findShotOutcome('save', seed, 120_000, (tick) =>
    resolveShotForPossession(seed, tick + 50_000, saveCarrier, 1, opps, tags, false),
  );

  const missCarrier = snap({ id: 'm1', x: 88, z: 34, finalizacao: 25, mentalidade: 40, confianca: 40 });
  findShotOutcome('miss', seed, 120_000, (tick) =>
    resolveShotForPossession(seed, tick + 100_000, missCarrier, 1, opps, ['defensive_third'], true),
  );

  let shootsWithBudget = 0;
  for (let i = 0; i < 120; i++) {
    const ctx = buildAttackingCarrierCtx(true);
    ctx.minute = 30 + (i % 40);
    const a = decideOnBall(ctx);
    if (a.type === 'shoot' || a.type === 'shoot_long_range') shootsWithBudget++;
  }
  assert(shootsWithBudget >= 8, `expected several shoots with budget+attacking ctx, got ${shootsWithBudget}`);

  console.log('shoot-pipeline self-test: ok');
}

main();
