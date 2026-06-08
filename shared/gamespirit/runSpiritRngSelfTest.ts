/**
 * Self-test pra PR-A da Fase 1 — SpiritRng + rngNext helper.
 *
 * Comprova:
 *  1. SpiritRng com mesma seed produz EXATAMENTE a mesma sequência (determinismo).
 *  2. SpiritRng com seeds diferentes produz sequências diferentes (entropia).
 *  3. range/int respeitam os limites.
 *  4. rngNext(ctx) consome do ctx.rng quando presente.
 *  5. rngNext(undefined) cai pra Math.random (preserva legacy).
 *
 * Roda com: `npm run test:spirit-rng`
 */

import { SpiritRng } from './SpiritRng';
import { rngNext, rngRange, rngInt } from './rngNext';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, ok: cond, detail });
}

// ── Test 1: determinismo — mesma seed = mesma sequência ──────────────────
{
  const a = new SpiritRng(42);
  const b = new SpiritRng(42);
  const seqA = Array.from({ length: 50 }, () => a.next());
  const seqB = Array.from({ length: 50 }, () => b.next());
  const same = seqA.every((v, i) => v === seqB[i]);
  check('determinismo: seed=42 produz mesma sequência (50 rolls)', same);
}

// ── Test 2: seeds diferentes ⇒ sequências diferentes ─────────────────────
{
  const a = new SpiritRng(1);
  const b = new SpiritRng(2);
  const collisions = Array.from({ length: 100 }, () => a.next() === b.next()).filter(Boolean).length;
  check(
    'entropia: seed 1 vs 2 produzem ≤ 5% colisões em 100 rolls',
    collisions <= 5,
    `colisões: ${collisions}/100`,
  );
}

// ── Test 3: range e int respeitam bounds ─────────────────────────────────
{
  const rng = new SpiritRng(7);
  let inRange = true;
  let intInRange = true;
  for (let i = 0; i < 1000; i++) {
    const f = rng.range(10, 20);
    if (f < 10 || f >= 20) inRange = false;
    const n = rng.int(1, 5);
    if (n < 1 || n > 5 || !Number.isInteger(n)) intInRange = false;
  }
  check('range(10, 20) sempre em [10, 20)', inRange);
  check('int(1, 5) sempre inteiro em [1, 5]', intInRange);
}

// ── Test 4: pick devolve elemento do array ───────────────────────────────
{
  const rng = new SpiritRng(99);
  const arr = ['a', 'b', 'c', 'd'];
  let validPicks = 0;
  for (let i = 0; i < 200; i++) {
    if (arr.includes(rng.pick(arr))) validPicks++;
  }
  check('pick: 200/200 picks dentro do array', validPicks === 200);
}

// ── Test 5: rngNext(ctx) consome do ctx.rng ──────────────────────────────
{
  const rng = new SpiritRng(123);
  const expectedFirst = rng.next();
  const expectedSecond = rng.next();
  // Recria pra começar do mesmo state
  const fresh = new SpiritRng(123);
  const ctx = { rng: fresh };
  const got1 = rngNext(ctx);
  const got2 = rngNext(ctx);
  check('rngNext(ctx) com rng injetado segue a sequência', got1 === expectedFirst && got2 === expectedSecond);
}

// ── Test 6: rngNext(undefined) cai pra Math.random (não throwa) ──────────
{
  const v = rngNext(undefined);
  check('rngNext(undefined) devolve número em [0, 1)', typeof v === 'number' && v >= 0 && v < 1);
}

// ── Test 7: rngNext({ rng: undefined }) cai pra Math.random ──────────────
{
  const v = rngNext({ rng: undefined });
  check('rngNext({rng: undefined}) devolve número em [0, 1)', typeof v === 'number' && v >= 0 && v < 1);
}

// ── Test 8: rngRange e rngInt obedecem bounds (com rng injetado) ─────────
{
  const ctx = { rng: new SpiritRng(55) };
  let rangeOk = true;
  let intOk = true;
  for (let i = 0; i < 500; i++) {
    const f = rngRange(0, 90, ctx);
    if (f < 0 || f >= 90) rangeOk = false;
    const n = rngInt(0, 10, ctx);
    if (n < 0 || n > 10) intOk = false;
  }
  check('rngRange(0, 90, ctx) sempre em [0, 90)', rangeOk);
  check('rngInt(0, 10, ctx) sempre em [0, 10]', intOk);
}

// ── Test 9: fork produz RNG independente mas determinístico ──────────────
{
  const parent = new SpiritRng(777);
  const child1 = parent.fork();
  const child2 = parent.fork();
  const seq1 = Array.from({ length: 10 }, () => child1.next());
  const seq2 = Array.from({ length: 10 }, () => child2.next());
  const allDifferent = seq1.some((v, i) => v !== seq2[i]);
  check('fork: filhos sucessivos produzem sequências diferentes', allDifferent);

  // E é determinístico — re-rodando do mesmo parent dá os mesmos filhos
  const parent2 = new SpiritRng(777);
  const child1again = parent2.fork();
  const seq1again = Array.from({ length: 10 }, () => child1again.next());
  const match = seq1.every((v, i) => v === seq1again[i]);
  check('fork: determinístico ao recriar parent com mesma seed', match);
}

// ── Test 10: 1000 rolls — variância sanidade (média perto de 0.5) ────────
{
  const rng = new SpiritRng(2026);
  let sum = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) sum += rng.next();
  const mean = sum / N;
  check(
    'distribuição: média de 1000 rolls em [0.45, 0.55]',
    mean >= 0.45 && mean <= 0.55,
    `média = ${mean.toFixed(4)}`,
  );
}

// ── Report ────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;

console.log('\n=== SpiritRng + rngNext self-test ===');
for (const r of results) {
  const sym = r.ok ? '✓' : '✗';
  console.log(`  ${sym} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${pass}/${results.length} passou${fail > 0 ? `, ${fail} falhou` : ''}\n`);

if (fail > 0) process.exit(1);
