/**
 * Unit-style checks for pickPlayAfterTurnover (run: npx tsx src/simulation/runPickPlayAfterTurnoverTest.ts).
 */
import type { AgentSnapshot } from './InteractionResolver';
import { createSeededRng, pickPlayAfterTurnover } from './pickPlayAfterTurnover';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function base(id: string, side: 'home' | 'away', x: number, z: number, fin = 65): AgentSnapshot {
  const passe = 72;
  return {
    id,
    side,
    x,
    z,
    speed: 5,
    role: 'mid',
    passe,
    passeCurto: passe,
    passeLongo: Math.round(passe * 0.92 + 4),
    cruzamento: 64,
    marcacao: 62,
    drible: 62,
    finalizacao: fin,
    velocidade: 72,
    fisico: 64,
    fairPlay: 76,
    tatico: 68,
    mentalidade: 70,
    confianca: 72,
    confidenceRuntime: 1,
    stamina: 88,
  };
}

function main() {
  const carrier = base('c1', 'home', 52, 34);
  const tmProg = base('prog', 'home', 72, 34);
  const tmLat = base('lat', 'home', 52, 52);
  const opps: AgentSnapshot[] = [
    base('d1', 'away', 58, 34),
    base('d2', 'away', 50, 22),
  ];

  const fixed = createSeededRng(424242);
  const a1 = pickPlayAfterTurnover(carrier, [tmProg, tmLat], opps, {
    rng: fixed,
    mentality: 72,
    risk: 0.45,
    exCarrierId: null,
    attackDir: 1,
    stealX: 52,
    stealZ: 34,
    reason: 'tackle',
  });
  assert(
    (a1.type === 'vertical_pass' || a1.type === 'through_ball' || a1.type === 'long_ball')
      && 'option' in a1
      && a1.option.targetId === 'prog',
    `progressive pass to prog expected, got ${a1.type}`,
  );

  const fixed2 = createSeededRng(424242);
  const a1b = pickPlayAfterTurnover(carrier, [tmProg, tmLat], opps, {
    rng: fixed2,
    mentality: 72,
    risk: 0.45,
    exCarrierId: null,
    attackDir: 1,
    stealX: 52,
    stealZ: 34,
  });
  assert(JSON.stringify(a1) === JSON.stringify(a1b), 'same seed → identical action');

  const boxCarrier = base('st', 'home', 94, 34, 82);
  const farOpp = base('d3', 'away', 70, 40);
  const shootPick = pickPlayAfterTurnover(boxCarrier, [tmProg, tmLat], [farOpp], {
    rng: createSeededRng(1),
    mentality: 75,
    risk: 0.5,
    exCarrierId: null,
    attackDir: 1,
    stealX: 93,
    stealZ: 34,
  });
  assert(
    shootPick.type === 'shoot' || shootPick.type === 'shoot_long_range',
    `finishing zone should prefer shot over passes, got ${shootPick.type}`,
  );

  const midCarrier = base('mid', 'home', 55, 34);
  const passNotShot = pickPlayAfterTurnover(midCarrier, [tmProg, tmLat], opps, {
    rng: createSeededRng(77),
    mentality: 70,
    risk: 0.4,
    exCarrierId: null,
    attackDir: 1,
    stealX: 55,
    stealZ: 34,
  });
  assert(
    passNotShot.type !== 'shoot' && passNotShot.type !== 'shoot_long_range',
    `midfield should not trigger finishing shot; got ${passNotShot.type}`,
  );

  const blockProg = pickPlayAfterTurnover(carrier, [tmProg, tmLat], opps, {
    rng: createSeededRng(424242),
    mentality: 72,
    risk: 0.45,
    exCarrierId: 'prog',
    attackDir: 1,
    stealX: 52,
    stealZ: 34,
  });
  assert(
    'option' in blockProg && blockProg.option.targetId === 'lat',
    `ex-carrier excluded: expected pass to lat, got ${'option' in blockProg ? blockProg.option.targetId : blockProg.type}`,
  );

  console.log('pickPlayAfterTurnover tests: ok');
}

main();
