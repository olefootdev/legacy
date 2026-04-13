/**
 * Invariante: após falha contestada (passe sem intercept), não há portador até recuperação.
 * npx tsx src/match/runPossessionInvariantSelfTest.ts
 */
import { resolvePassForPossession } from '@/simulation/ActionResolver';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function main() {
  const opt: PassOption = {
    targetId: 't2',
    targetX: 72,
    targetZ: 34,
    distance: 22,
    successProb: 0.5,
    isForward: true,
    isLong: false,
    progressionGain: 0.3,
    spaceAtTarget: 4,
    linesBroken: 0,
    threatDepth01: 72 / FIELD_LENGTH,
    distToOppGoal: Math.hypot(FIELD_LENGTH - 72, FIELD_WIDTH / 2 - 34),
    sectorVacancy01: 0.5,
  };
  const carrier: AgentSnapshot = {
    id: 'c1',
    side: 'home',
    x: 55,
    z: 34,
    speed: 4,
    role: 'mid',
    passe: 60,
    passeCurto: 55,
    passeLongo: 58,
    cruzamento: 50,
    marcacao: 50,
    drible: 55,
    finalizacao: 50,
    velocidade: 65,
    fisico: 60,
    fairPlay: 75,
    tatico: 55,
    mentalidade: 50,
    confianca: 48,
    stamina: 88,
  };
  /** Sem interceptador na linha — força ramo “bola solta” quando o passe falha. */
  const opp: AgentSnapshot[] = [];

  let looseNoCarrier = 0;
  for (let tick = 0; tick < 120; tick++) {
    const r = resolvePassForPossession(999_001, tick, carrier, opt, 0.95, opp);
    if (!r.completed && !r.interceptPlayerId) {
      looseNoCarrier++;
      assert(typeof r.x === 'number' && typeof r.z === 'number', 'loose landing coords');
    }
  }
  assert(looseNoCarrier > 8, 'expected some loose balls under high pressure / low skill');

  console.log(`possession-invariant self-test: ok (loose samples=${looseNoCarrier})`);
}

main();
