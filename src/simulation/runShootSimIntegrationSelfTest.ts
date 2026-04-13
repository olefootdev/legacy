/**
 * Integração motor: coloca portador no terço final (o sim “vanilla” raramente chega a x>62 em 1.º tempo),
 * corre step(dt) e exige tentativas de remate + telemetria — prova que o ramo shoot está ligado ao loop.
 *
 * QA manual 90’ completo: definir globalThis.__OF_SHOT_TELEMETRY_LOG__ = true e observar consola ao apito final.
 *
 * npx tsx src/simulation/runShootSimIntegrationSelfTest.ts
 */
import type { LiveMatchSnapshot, PitchPlayerState } from '@/engine/types';
import { defaultSlotOrder } from '@/formation/layout433';
import { SHOT_ATTEMPTS_MIN_PER_90MIN_SIM } from '@/match/shootDecisionTuning';
import type { BallSystem } from '@/simulation/BallSystem';
import { FIELD_WIDTH } from '@/simulation/field';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

type LoopTestHooks = {
  world: { simTime: number };
  ballSys: BallSystem;
};

function minimalLive(): LiveMatchSnapshot {
  const order = defaultSlotOrder();
  const matchLineupBySlot: Record<string, string> = {};
  const homePlayers: PitchPlayerState[] = order.map((slotId, i) => {
    const pid = `home-${slotId}`;
    matchLineupBySlot[slotId] = pid;
    const role =
      slotId === 'gol'
        ? 'gk'
        : ['zag1', 'zag2', 'le', 'ld', 'vol'].includes(slotId)
          ? 'def'
          : slotId.startsWith('mc')
            ? 'mid'
            : 'attack';
    const wingOrStriker = slotId === 'pe' || slotId === 'pd' || slotId === 'ata';
    return {
      playerId: pid,
      slotId,
      name: slotId,
      num: i + 1,
      pos: slotId,
      x: 50,
      y: 48,
      fatigue: 14,
      role,
      cognitiveArchetype: wingOrStriker ? 'finalizador' : 'criador',
      attributes: wingOrStriker
        ? { finalizacao: 86, mentalidade: 82, confianca: 84, drible: 72, passeCurto: 70 }
        : { finalizacao: 68, passeCurto: 78, mentalidade: 76 },
    };
  });

  return {
    mode: 'test2d',
    phase: 'playing',
    minute: 0,
    footballElapsedSec: 0,
    homeScore: 0,
    awayScore: 0,
    homeShort: 'TST',
    awayShort: 'OPP',
    possession: 'home',
    ball: { x: 52, y: 48 },
    homePlayers,
    events: [],
    homeStats: {},
    matchLineupBySlot,
    substitutionsUsed: 0,
    travelKm: 0,
    simulationSeed: 900_001,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
  };
}

/** Mantém um avançado com bola na zona de finalização para exercitar decideOnBall → shoot → resolver. */
function pinCarrierInAttThird(loop: TacticalSimLoop, everyFrames: number) {
  const L = loop as unknown as LoopTestHooks;
  const striker = loop.homeAgents.find((a) => a.slotId === 'ata' || a.slotId === 'pe');
  if (!striker) return;
  const frame = Math.floor(L.world.simTime * 60);
  if (frame % everyFrames !== 0) return;
  const x = 91;
  const z = FIELD_WIDTH / 2 + 3;
  striker.vehicle.position.x = x;
  striker.vehicle.position.z = z;
  L.ballSys.giveTo(striker.id, x, z);
  loop.getSimState().carrierId = striker.id;
  loop.getSimState().possession = 'home';
}

function main() {
  const loop = new TacticalSimLoop();
  const live = minimalLive();
  const manager = { tacticalMentality: 80, defensiveLine: 52, tempo: 74 };
  loop.syncLive(live, manager);

  const L = loop as unknown as LoopTestHooks;
  L.world.simTime = 120;

  const steps = 55 * 60;
  for (let i = 0; i < steps; i++) {
    pinCarrierInAttThird(loop, 28);
    loop.step(1 / 60, manager);
  }

  const tel = loop.getSimState().shotTelemetry;
  assert(
    tel.attempts >= SHOT_ATTEMPTS_MIN_PER_90MIN_SIM,
    `harness expected attempts >= ${SHOT_ATTEMPTS_MIN_PER_90MIN_SIM}, got ${tel.attempts} (chosen=${tel.shootChosen}, candidates=${tel.shootCandidatesAsCarrier})`,
  );
  assert(tel.shootChosen >= 1, 'expected shoot chosen at least once in telemetry');
  assert(tel.shootCandidatesAsCarrier >= 1, 'expected shoot candidate counter > 0');
  assert(tel.goals + tel.saves + tel.offTarget >= 1, 'expected classified shot outcomes');

  console.log(
    `shoot-sim-integration: ok attempts=${tel.attempts} SOT=${tel.onTarget} goals=${tel.goals} saves=${tel.saves} off=${tel.offTarget} chosen=${tel.shootChosen} candidates=${tel.shootCandidatesAsCarrier}`,
  );
}

main();
