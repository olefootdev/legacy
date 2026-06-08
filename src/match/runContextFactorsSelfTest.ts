/**
 * Self-test pra Fase 3 — Fatores Contextuais.
 *
 * Exercita ranges, monotonicidade e idempotência dos modificadores.
 * Roda com: `tsx src/match/runContextFactorsSelfTest.ts`
 */

import {
  computeMatchContextModifiers,
  applyContextModifiers,
  neutralContextModifiers,
  daysSinceLastMatchFromHistory,
  type MatchContextModifiers,
} from './contextFactors';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, ok: cond, detail });
}

function approx(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}

// ─── Test 1: ranges respeitados ──────────────────────────────────────────────
{
  const mods = computeMatchContextModifiers({
    isHome: true,
    daysSinceLastMatch: 0,
    isDerby: true,
    importance: 'final',
  });
  check('home isHome=true ⇒ homeAdvantage > 1', mods.homeAdvantage > 1, `got ${mods.homeAdvantage}`);
  check('home derby ⇒ derbyIntensity > 1', mods.derbyIntensity > 1, `got ${mods.derbyIntensity}`);
  check('final ⇒ importance > 1', mods.importance > 1, `got ${mods.importance}`);
  check('rest 0 dias ⇒ restMultiplier < 1', mods.restMultiplier < 1, `got ${mods.restMultiplier}`);
}

// ─── Test 2: away isHome=false ⇒ homeAdvantage < 1 ──────────────────────────
{
  const mods = computeMatchContextModifiers({ isHome: false });
  check('away ⇒ homeAdvantage < 1', mods.homeAdvantage < 1, `got ${mods.homeAdvantage}`);
}

// ─── Test 3: monotonicidade do descanso ──────────────────────────────────────
{
  const days = [0, 1, 2, 3, 5, 7, 10];
  let prev = -Infinity;
  let mono = true;
  for (const d of days) {
    const m = computeMatchContextModifiers({ isHome: true, daysSinceLastMatch: d });
    if (m.restMultiplier < prev) mono = false;
    prev = m.restMultiplier;
  }
  check('restMultiplier não-decrescente com dias', mono);
}

// ─── Test 4: importance monotônica ──────────────────────────────────────────
{
  const liga = computeMatchContextModifiers({ isHome: true, importance: 'liga' });
  const dec = computeMatchContextModifiers({ isHome: true, importance: 'decisao' });
  const fin = computeMatchContextModifiers({ isHome: true, importance: 'final' });
  check(
    'importance: liga < decisao < final',
    liga.importance < dec.importance && dec.importance < fin.importance,
    `${liga.importance} / ${dec.importance} / ${fin.importance}`,
  );
}

// ─── Test 5: squadDepletion vem do EffectiveTeamStrength ────────────────────
{
  const mods = computeMatchContextModifiers({
    isHome: true,
    effectiveTeamStrength: {
      baseOverall: 80,
      effectiveOverall: 76,
      depletionMultiplier: 0.95,
      startersCounted: 11,
      penalties: { fatigue: 2, contractWarning: 1, forcedPosition: 1 },
    },
  });
  check('squadDepletion = EffectiveTeamStrength.depletionMultiplier', approx(mods.squadDepletion, 0.95));
}

// ─── Test 6: caps de segurança não estouram ─────────────────────────────────
{
  const extreme: MatchContextModifiers = {
    homeAdvantage: 1.07,
    restMultiplier: 1.05,
    derbyIntensity: 1.15,
    importance: 1.13,
    squadDepletion: 0.95,
    breakdown: { homeAdvantage: '', rest: '', derby: '', importance: '', depletion: '' },
  };
  const out = applyContextModifiers(
    { homeTeamAvg: 100, crowdSupport: 1.0, avgHomeFatigue: 80, tacticalMentality: 1.0, opponentStrength: 80 },
    extreme,
  );
  check('homeTeamAvg clamped ≤ 100', out.homeTeamAvg <= 100, `got ${out.homeTeamAvg}`);
  check('crowdSupport clamped ≤ 1.6', out.crowdSupport <= 1.6, `got ${out.crowdSupport}`);
  check('avgHomeFatigue clamped ≤ 100', out.avgHomeFatigue <= 100, `got ${out.avgHomeFatigue}`);
  check('tacticalMentality clamped ≤ 1.2', out.tacticalMentality <= 1.2, `got ${out.tacticalMentality}`);
  check('opponentStrength clamped ≤ 100', out.opponentStrength <= 100, `got ${out.opponentStrength}`);
}

// ─── Test 7: neutral = no-op ────────────────────────────────────────────────
{
  const base = { homeTeamAvg: 75, crowdSupport: 0.5, avgHomeFatigue: 40, tacticalMentality: 0.7, opponentStrength: 70 };
  const out = applyContextModifiers(base, neutralContextModifiers());
  check('neutral homeTeamAvg unchanged', approx(out.homeTeamAvg, base.homeTeamAvg));
  check('neutral crowdSupport unchanged', approx(out.crowdSupport, base.crowdSupport));
  check('neutral avgHomeFatigue unchanged', approx(out.avgHomeFatigue, base.avgHomeFatigue));
  check('neutral tacticalMentality unchanged', approx(out.tacticalMentality, base.tacticalMentality));
  check('neutral opponentStrength unchanged', approx(out.opponentStrength, base.opponentStrength));
}

// ─── Test 8: rest INVERSO em avgHomeFatigue ─────────────────────────────────
{
  // restMultiplier < 1 (cansado) ⇒ avgHomeFatigue SOBE
  const tired: MatchContextModifiers = {
    ...neutralContextModifiers(),
    restMultiplier: 0.85,
  };
  const rested: MatchContextModifiers = {
    ...neutralContextModifiers(),
    restMultiplier: 1.05,
  };
  const baseFatigue = 50;
  const tiredOut = applyContextModifiers(
    { homeTeamAvg: 75, crowdSupport: 0, avgHomeFatigue: baseFatigue, tacticalMentality: 1, opponentStrength: 70 },
    tired,
  );
  const restedOut = applyContextModifiers(
    { homeTeamAvg: 75, crowdSupport: 0, avgHomeFatigue: baseFatigue, tacticalMentality: 1, opponentStrength: 70 },
    rested,
  );
  check(
    'rest < 1 ⇒ fadiga sobe; rest > 1 ⇒ fadiga desce',
    tiredOut.avgHomeFatigue > baseFatigue && restedOut.avgHomeFatigue < baseFatigue,
    `tired=${tiredOut.avgHomeFatigue}, rested=${restedOut.avgHomeFatigue}`,
  );
}

// ─── Test 9: appliedDelta auditável ─────────────────────────────────────────
{
  const mods = computeMatchContextModifiers({
    isHome: true,
    isDerby: true,
    importance: 'final',
  });
  const base = { homeTeamAvg: 78, crowdSupport: 0.6, avgHomeFatigue: 45, tacticalMentality: 0.8, opponentStrength: 72 };
  const out = applyContextModifiers(base, mods);
  check('appliedDelta.homeTeamAvg = post - pre', approx(out.appliedDelta.homeTeamAvg, out.homeTeamAvg - base.homeTeamAvg));
  check('appliedDelta.crowdSupport = post - pre', approx(out.appliedDelta.crowdSupport, out.crowdSupport - base.crowdSupport));
}

// ─── Test 11: opponentStrength simétrico — away presente ─────────────────────
{
  const modsHome = computeMatchContextModifiers({ isHome: true });
  const modsAway = computeMatchContextModifiers({ isHome: false });
  const base = { homeTeamAvg: 75, crowdSupport: 0.5, avgHomeFatigue: 40, tacticalMentality: 1, opponentStrength: 80 };
  const outHome = applyContextModifiers(base, modsHome);
  const outAway = applyContextModifiers(base, modsAway);
  // isHome=true ⇒ homeAdvantage=1.04 ⇒ opp recebe 0.96 (sutil debuff)
  // isHome=false ⇒ homeAdvantage=0.97 ⇒ opp recebe 1.03 (sutil buff por ser mandante real)
  check(
    'user home: opponentStrength reduzido suavemente (não anula)',
    outHome.opponentStrength < base.opponentStrength && outHome.opponentStrength >= 0.95 * base.opponentStrength,
    `user-home opp=${outHome.opponentStrength.toFixed(2)} (base=${base.opponentStrength})`,
  );
  check(
    'user away: opponentStrength aumentado (mandante real)',
    outAway.opponentStrength > base.opponentStrength,
    `user-away opp=${outAway.opponentStrength.toFixed(2)} (base=${base.opponentStrength})`,
  );
}

// ─── Test 12: homeAdvantage SUTIL (~4%) — não dominante ────────────────────
{
  const mods = computeMatchContextModifiers({ isHome: true });
  check(
    'homeAdvantage calibrado em 1.04 (suave)',
    Math.abs(mods.homeAdvantage - 1.04) < 0.001,
    `homeAdvantage=${mods.homeAdvantage}`,
  );
}

// ─── Test 10: daysSinceLastMatchFromHistory ─────────────────────────────────
{
  const now = 1_700_000_000_000;
  const history = [
    { atMs: now - 2 * 24 * 60 * 60 * 1000 },
    { atMs: now - 5 * 24 * 60 * 60 * 1000 },
  ];
  const d = daysSinceLastMatchFromHistory(history, now);
  check('daysSinceLastMatch pega a mais recente', d !== undefined && approx(d, 2, 0.01));

  const empty = daysSinceLastMatchFromHistory([], now);
  check('history vazio ⇒ undefined', empty === undefined);
}

// ─── Report ────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;

console.log(`\n=== contextFactors self-test ===`);
for (const r of results) {
  const sym = r.ok ? '✓' : '✗';
  console.log(`  ${sym} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${pass}/${results.length} passou${fail > 0 ? `, ${fail} falhou` : ''}\n`);

if (fail > 0) process.exit(1);
