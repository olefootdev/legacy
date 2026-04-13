/**
 * Partida ao vivo “natural” (sem pin de atacante): remates + presença de disciplina no log causal.
 * npx tsx src/simulation/runTacticalLiveNaturalMomentsSelfTest.ts
 */
import type { LiveMatchSnapshot, PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { defaultSlotOrder } from '@/formation/layout433';
import { LIVE_NATURAL_SHOT_ATTEMPTS_MIN } from '@/match/shootDecisionTuning';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const baseAttrs: MatchPlayerAttributes = {
  passeCurto: 72,
  passeLongo: 68,
  cruzamento: 62,
  marcacao: 70,
  velocidade: 74,
  fairPlay: 68,
  drible: 70,
  finalizacao: 72,
  fisico: 72,
  tatico: 72,
  mentalidade: 76,
  confianca: 74,
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
        ? { ...baseAttrs, finalizacao: 86, mentalidade: 82, confianca: 84, drible: 72, passeCurto: 70, fairPlay: 58 }
        : { ...baseAttrs, finalizacao: 68, passeCurto: 78, mentalidade: 76, fairPlay: 66 },
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
    simulationSeed: 404_413,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
  };
}

function main() {
  const loop = new TacticalSimLoop();
  const live = minimalLive();
  const manager = { tacticalMentality: 82, defensiveLine: 52, tempo: 76 };
  loop.syncLive(live, manager);

  /** ~200 s de tempo de sim ≈ percorre 1.º tempo + parte do 2.º — stress de desarmes e remates. */
  const steps = 12_000;
  for (let i = 0; i < steps; i++) {
    loop.step(1 / 60, manager);
  }

  const tel = loop.getSimState().shotTelemetry;
  const causal = loop.getSimState().causalLog.entries;
  const fouls = causal.filter((e: CausalMatchEvent) => e.type === 'foul_committed').length;
  const cards = causal.filter((e: CausalMatchEvent) => e.type === 'card_shown').length;

  assert(
    tel.attempts >= LIVE_NATURAL_SHOT_ATTEMPTS_MIN,
    `expected attempts >= ${LIVE_NATURAL_SHOT_ATTEMPTS_MIN}, got ${tel.attempts}`,
  );
  assert(fouls >= 1, `expected >=1 foul in causal log, got ${fouls}`);
  assert(cards >= 1, `expected >=1 card in causal log, got ${cards}`);

  console.log(
    `tactical-live-natural-moments: ok attempts=${tel.attempts} fouls=${fouls} cards=${cards} goals=${tel.goals}`,
  );
}

main();
