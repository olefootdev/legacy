/**
 * Resolução de remate com seed fixa (reprodutível).
 * npx tsx src/simulation/runShotResolveSelfTest.ts
 */
import { resolveShotForPossession } from './ActionResolver';
import type { AgentSnapshot } from './InteractionResolver';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function snap(over: Partial<AgentSnapshot> & Pick<AgentSnapshot, 'id'>): AgentSnapshot {
  const passe = 70;
  return {
    id: over.id,
    side: over.side ?? 'home',
    x: over.x ?? 88,
    z: over.z ?? 34,
    speed: 5,
    role: 'attack',
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

function main() {
  const seed = 555_444_333;
  const tick = 12_000;
  const carrier = snap({ id: 's1', side: 'home', x: 92, z: 34 });
  const opps: AgentSnapshot[] = [
    snap({ id: 'd1', side: 'away', x: 96, z: 32, finalizacao: 50, marcacao: 82 }),
  ];
  const tags = ['attacking_third', 'opp_box', 'lane_center'] as const;

  const a = resolveShotForPossession(seed, tick, carrier, 1, opps, tags, false);
  const b = resolveShotForPossession(seed, tick, carrier, 1, opps, tags, false);
  assert(a.outcome === b.outcome && a.rollOnTarget === b.rollOnTarget, 'same seed → same shot branch');
  assert(['goal', 'save', 'block', 'miss'].includes(a.outcome), `valid outcome ${a.outcome}`);

  let manyMiss = resolveShotForPossession(seed, tick + 1, { ...carrier, finalizacao: 12, mentalidade: 30 }, 1, opps, ['defensive_third'], true);
  for (let t = 0; t < 300 && manyMiss.outcome !== 'miss'; t++) {
    manyMiss = resolveShotForPossession(seed, 50_000 + t, { ...carrier, finalizacao: 12, mentalidade: 30 }, 1, opps, ['defensive_third'], true);
  }
  assert(manyMiss.outcome === 'miss', `expected a miss branch for very low skill, got ${manyMiss.outcome}`);

  console.log(`shot-resolve self-test: ok (stable=${a.outcome}, lowSkill=${manyMiss.outcome})`);
}

main();
