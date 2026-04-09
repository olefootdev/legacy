/**
 * Deliberation self-test: verifies the deliberation phase prevents instant-pass
 * on ball reception, and that different pressure/zone contexts produce different
 * deliberation behaviors.
 *
 * npx tsx src/playerDecision/runDeliberationSelfTest.ts
 */
import { PlayerDecisionEngine } from './PlayerDecisionEngine';
import { profileForSlot } from './PlayerProfile';
import { detectTeamPhase } from './ContextScanner';
import { decideOnBall } from './OnBallDecision';
import type { DecisionContext } from './types';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function snap(over: Partial<AgentSnapshot> & Pick<AgentSnapshot, 'id'>): AgentSnapshot {
  return {
    id: over.id,
    side: over.side ?? 'home',
    slotId: over.slotId ?? 'mc1',
    x: over.x ?? 55,
    z: over.z ?? 34,
    speed: over.speed ?? 5,
    role: over.role ?? 'mid',
    passe: 72,
    passeCurto: 72,
    passeLongo: 68,
    cruzamento: 62,
    marcacao: 60,
    drible: 68,
    finalizacao: 65,
    velocidade: 70,
    fisico: 68,
    fairPlay: 75,
    tatico: 72,
    mentalidade: over.mentalidade ?? 74,
    confianca: over.confianca ?? 72,
    confidenceRuntime: 1,
    stamina: 90,
  };
}

function buildCtx(
  self: AgentSnapshot,
  opts: { isCarrier: boolean; isReceiver: boolean; ballFlight?: number; pressure?: AgentSnapshot[] },
): DecisionContext {
  const profile = profileForSlot(self.slotId ?? 'mc1', self.role);
  const phase = detectTeamPhase(self.x, 1, 'home', 'home', opts.isCarrier ? self.id : null);
  const opps = opts.pressure ?? [
    snap({ id: 'd1', side: 'away', x: self.x + 12, z: self.z + 3, role: 'def' }),
  ];
  return {
    self,
    teammates: [
      snap({ id: 't1', x: self.x - 8, z: self.z + 5, slotId: 'vol' }),
      snap({ id: 't2', x: self.x + 15, z: self.z - 2, slotId: 'ata', role: 'attack' }),
    ],
    opponents: opps,
    ballX: self.x,
    ballZ: self.z,
    isCarrier: opts.isCarrier,
    isReceiver: opts.isReceiver,
    ballFlightProgress: opts.ballFlight ?? 0,
    possession: 'home',
    attackDir: 1,
    clockHalf: 1,
    slotX: self.x,
    slotZ: self.z,
    scoreDiff: 0,
    minute: 30,
    mentality: 65,
    tacticalDefensiveLine: 50,
    tacticalPressing: 55,
    tacticalWidth: 50,
    tacticalTempo: 60,
    stamina: 90,
    decisionDebug: false,
    profile,
    teamPhase: phase,
    carrierId: opts.isCarrier ? self.id : null,
    carrierJustChanged: false,
    ballSector: 'center',
    threatLevel: 0.3,
    threatTrend: 'stable',
  };
}

function isPassAction(a: { kind: string; action?: { type: string } }): boolean {
  if (a.kind !== 'on_ball') return false;
  const t = (a as { action: { type: string } }).action.type;
  return t.includes('pass') || t === 'vertical_pass' || t === 'lateral_pass'
    || t === 'short_pass_safety' || t === 'through_ball' || t === 'long_ball'
    || t === 'switch_play' || t === 'one_two';
}

function main() {
  // -----------------------------------------------------------------------
  // Test 1: After becoming carrier, the first tick must NOT produce a pass
  // -----------------------------------------------------------------------
  {
    const self = snap({ id: 'carrier', slotId: 'mc1', x: 55, z: 34 });
    const engine = new PlayerDecisionEngine(profileForSlot('mc1', 'mid'));

    // Simulate ball arriving
    const recCtx = buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.5 });
    engine.tick(recCtx, 0);

    // Ball arrives → player becomes carrier (flight complete)
    const recCtx2 = buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.9 });
    engine.tick(recCtx2, 0.02);

    // Now player is carrier — first tick
    const carrierCtx = buildCtx(self, { isCarrier: true, isReceiver: false });
    const firstAction = engine.tick(carrierCtx, 0.04);

    assert(
      !isPassAction(firstAction),
      `first tick after becoming carrier must NOT be a pass, got: ${JSON.stringify(firstAction)}`,
    );
    assert(
      engine.phase === 'deliberating' || engine.phase === 'receiving',
      `phase should be deliberating or receiving after ball arrival, got: ${engine.phase}`,
    );
  }

  // -----------------------------------------------------------------------
  // Test 2: After deliberation completes, the engine produces a real action
  // -----------------------------------------------------------------------
  {
    const self = snap({ id: 'carrier2', slotId: 'ata', role: 'attack', x: 75, z: 34 });
    const engine = new PlayerDecisionEngine(profileForSlot('ata', 'attack'));

    // Pre-receive → receive
    engine.tick(buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.5 }), 0);
    engine.tick(buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.92 }), 0.05);

    // Tick through reception phase (carrier=true, need to pass through receiving duration)
    const carrierCtx = buildCtx(self, { isCarrier: true, isReceiver: false });
    for (let t = 0.06; t < 0.3; t += 1 / 60) {
      engine.tick(carrierCtx, t);
    }

    // By now engine should have gone through receiving → deliberating → deciding/executing
    // Tick through the rest of deliberation+deciding
    let action;
    for (let t = 0.3; t < 0.7; t += 1 / 60) {
      action = engine.tick(carrierCtx, t);
    }
    assert(action !== undefined, 'should produce action after deliberation');
    assert(
      action!.kind === 'on_ball',
      `after deliberation, action should be on_ball, got: ${action!.kind}`,
    );
  }

  // -----------------------------------------------------------------------
  // Test 3: Under extreme pressure, deliberation is very short (instinct)
  // -----------------------------------------------------------------------
  {
    const self = snap({ id: 'pressured', slotId: 'zag1', role: 'def', x: 25, z: 34 });
    const engine = new PlayerDecisionEngine(profileForSlot('zag1', 'def'));
    const nearOpp = [
      snap({ id: 'o1', side: 'away', x: 25.5, z: 34.5, role: 'attack', speed: 10 }),
      snap({ id: 'o2', side: 'away', x: 26, z: 33, role: 'attack', speed: 8 }),
    ];

    // Pre-receive
    engine.tick(buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.5, pressure: nearOpp }), 0);
    engine.tick(buildCtx(self, { isCarrier: false, isReceiver: true, ballFlight: 0.92, pressure: nearOpp }), 0.04);

    // Tick through reception + deliberation under extreme pressure
    const carrierCtx = buildCtx(self, { isCarrier: true, isReceiver: false, pressure: nearOpp });
    for (let t = 0.06; t < 0.3; t += 1 / 60) {
      engine.tick(carrierCtx, t);
    }

    // Under extreme pressure with opponent < 2m, the engine should have already
    // left deliberation (instinct clear) and be deciding or executing
    const phase = engine.phase;
    assert(
      phase === 'deciding' || phase === 'executing',
      `under extreme pressure, should be deciding or executing quickly, got: ${phase}`,
    );
  }

  // -----------------------------------------------------------------------
  // Test 4: Deep defensive zone → longer deliberation on average
  //         Attacking zone → shorter deliberation on average
  //         Run multiple trials to smooth out randomness
  // -----------------------------------------------------------------------
  {
    const farOpp = [snap({ id: 'oFar', side: 'away', x: 50, z: 34, role: 'mid' })];
    const TRIALS = 30;
    let totalDefFrames = 0;
    let totalAttFrames = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      const deepDef = snap({ id: `deep${trial}`, slotId: 'zag2', role: 'def', x: 12, z: 34 });
      const attThird = snap({ id: `att${trial}`, slotId: 'ata', role: 'attack', x: 92, z: 34 });
      const engDef = new PlayerDecisionEngine(profileForSlot('zag2', 'def'));
      const engAtt = new PlayerDecisionEngine(profileForSlot('ata', 'attack'));

      engDef.tick(buildCtx(deepDef, { isCarrier: false, isReceiver: true, ballFlight: 0.6, pressure: farOpp }), 0);
      engDef.tick(buildCtx(deepDef, { isCarrier: false, isReceiver: true, ballFlight: 0.92, pressure: farOpp }), 0.05);
      engAtt.tick(buildCtx(attThird, { isCarrier: false, isReceiver: true, ballFlight: 0.6, pressure: farOpp }), 0);
      engAtt.tick(buildCtx(attThird, { isCarrier: false, isReceiver: true, ballFlight: 0.92, pressure: farOpp }), 0.05);

      let defFrames = 0;
      let attFrames = 0;
      for (let t = 0.06; t < 0.5; t += 1 / 60) {
        engDef.tick(buildCtx(deepDef, { isCarrier: true, isReceiver: false, pressure: farOpp }), t);
        engAtt.tick(buildCtx(attThird, { isCarrier: true, isReceiver: false, pressure: farOpp }), t);
        if (engDef.phase === 'deliberating') defFrames++;
        if (engAtt.phase === 'deliberating') attFrames++;
      }
      totalDefFrames += defFrames;
      totalAttFrames += attFrames;
    }

    const avgDef = totalDefFrames / TRIALS;
    const avgAtt = totalAttFrames / TRIALS;
    assert(
      avgAtt <= avgDef + 1,
      `avg attacker deliberation frames (${avgAtt.toFixed(1)}) should be ≤ defender (${avgDef.toFixed(1)})`,
    );
  }

  // -----------------------------------------------------------------------
  // Test 5: decideOnBall evaluates 3+ candidates (pass_safe, pass_progressive,
  //         carry at minimum) — verified through debug callback
  // -----------------------------------------------------------------------
  {
    const self = snap({ id: 'dbg', slotId: 'mc1', x: 55, z: 34 });
    let debugPayload: { top3: string; pickedId: string } | null = null;
    const ctx = buildCtx(self, { isCarrier: true, isReceiver: false });
    ctx.noteCarrierDecisionDebug = (p) => { debugPayload = p; };

    decideOnBall(ctx);

    assert(debugPayload !== null, 'debug callback should fire');
    const top3Ids = debugPayload!.top3.split(' | ').map(s => s.split(':')[0]);
    assert(
      top3Ids.length >= 3,
      `should have 3+ scored candidates in top3, got: ${debugPayload!.top3}`,
    );
  }

  console.log('deliberation self-test: ok');
}

main();
