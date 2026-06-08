/**
 * Self-test pós-migração — confirma que contextModifiers + rng fluem
 * corretamente pelo motor live (src/gamespirit/) após o refactor.
 *
 * Cobre:
 *  1. buildSpiritContext propaga contextModifiers para o SpiritContext retornado.
 *  2. applyContextModifiers efetivamente altera homeTeamAvg quando isHome=true.
 *  3. rngNext fallback pra Math.random quando ctx.rng undefined (sem regressão).
 *  4. rngNext consome ctx.rng quando presente (Monte Carlo via motor live).
 *
 * Roda com: `npm run test:live-migration`
 */

import { buildSpiritContext } from './GameSpirit';
import { rngNext } from './rngNext';
import { computeMatchContextModifiers } from '@/match/contextFactors';
import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import type { PlayerEntity } from '@/entities/types';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, ok: cond, detail });
}

// Roster mínimo válido pra buildSpiritContext.
const mkPlayer = (id: string, pos: string, ovr = 75): PlayerEntity => ({
  id, num: 1, name: `P${id}`, pos,
  archetype: 'criativo' as never, zone: 'meio' as never, behavior: 'equilibrado',
  attrs: {
    passe: ovr, marcacao: ovr, velocidade: ovr, drible: ovr, finalizacao: ovr,
    fisico: ovr, tatico: ovr, mentalidade: ovr, confianca: ovr, fairPlay: 70,
  },
  fatigue: 30, injuryRisk: 20, outForMatches: 0, evolutionXp: 0,
});

const homeRoster: PlayerEntity[] = [
  mkPlayer('h1', 'GOL'), mkPlayer('h2', 'ZAG'), mkPlayer('h3', 'ZAG'),
  mkPlayer('h4', 'LE'), mkPlayer('h5', 'LD'),
  mkPlayer('h6', 'VOL'), mkPlayer('h7', 'MC'), mkPlayer('h8', 'MC'),
  mkPlayer('h9', 'PE'), mkPlayer('h10', 'ATA'), mkPlayer('h11', 'PD'),
];

// ─── Test 1: contextModifiers fluem ────────────────────────────────────────
{
  const mods = computeMatchContextModifiers({ isHome: true });
  const ctx = buildSpiritContext({
    minute: 1, homeScore: 0, awayScore: 0, possession: 'home',
    ball: { x: 50, y: 50 }, crowdSupport: 0.5, tacticalMentality: 60,
    opponentStrength: 70, homeRoster, homePlayers: [], awayRoster: [],
    contextModifiers: mods,
  });
  check('contextModifiers propagado para SpiritContext', ctx.contextModifiers === mods);
  check('contextModifiers tem homeAdvantage > 1 quando isHome', (ctx.contextModifiers?.homeAdvantage ?? 0) > 1);
}

// ─── Test 2: homeTeamAvg muda com isHome ───────────────────────────────────
{
  const modsHome = computeMatchContextModifiers({ isHome: true });
  const modsAway = computeMatchContextModifiers({ isHome: false });

  const ctxHome = buildSpiritContext({
    minute: 1, homeScore: 0, awayScore: 0, possession: 'home',
    ball: { x: 50, y: 50 }, crowdSupport: 0.5, tacticalMentality: 60,
    opponentStrength: 70, homeRoster, homePlayers: [], awayRoster: [],
    contextModifiers: modsHome,
  });
  const ctxAway = buildSpiritContext({
    minute: 1, homeScore: 0, awayScore: 0, possession: 'home',
    ball: { x: 50, y: 50 }, crowdSupport: 0.5, tacticalMentality: 60,
    opponentStrength: 70, homeRoster, homePlayers: [], awayRoster: [],
    contextModifiers: modsAway,
  });
  check(
    'homeTeamAvg amplificado quando isHome=true vs false',
    ctxHome.homeTeamAvg > ctxAway.homeTeamAvg,
    `home=${ctxHome.homeTeamAvg.toFixed(2)} away=${ctxAway.homeTeamAvg.toFixed(2)}`,
  );
  // Calibração 2026-06-08: opponentStrength deve ser MENOR quando user home
  // (opp recebe inverso do mando) e MAIOR quando user away.
  check(
    'opponentStrength reduzido quando user home (away mais presente que era)',
    ctxHome.opponentStrength < ctxAway.opponentStrength,
    `user-home opp=${ctxHome.opponentStrength.toFixed(2)} user-away opp=${ctxAway.opponentStrength.toFixed(2)}`,
  );
}

// ─── Test 3: sem contextModifiers ⇒ motor neutro (zero regressão) ──────────
{
  const ctxNoMods = buildSpiritContext({
    minute: 1, homeScore: 0, awayScore: 0, possession: 'home',
    ball: { x: 50, y: 50 }, crowdSupport: 0.5, tacticalMentality: 60,
    opponentStrength: 70, homeRoster, homePlayers: [], awayRoster: [],
  });
  check('contextModifiers undefined quando não passado', ctxNoMods.contextModifiers === undefined);
  check('tacticalMentality igual ao input (neutro)', ctxNoMods.tacticalMentality === 60);
  check('crowdSupport igual ao input (neutro)', ctxNoMods.crowdSupport === 0.5);
}

// ─── Test 4: rngNext fallback pra Math.random ──────────────────────────────
{
  // Sem ctx — usa Math.random (mas devolve número em [0,1))
  for (let i = 0; i < 50; i++) {
    const v = rngNext(undefined);
    if (v < 0 || v >= 1) {
      check('rngNext(undefined) sempre em [0,1)', false, `v=${v}`);
      break;
    }
  }
  check('rngNext(undefined) sempre em [0,1)', true);
}

// ─── Test 5: rngNext consome ctx.rng quando presente ──────────────────────
{
  const rng = new SpiritRng(12345);
  const expected = [rng.next(), rng.next(), rng.next()];
  const fresh = new SpiritRng(12345);
  const ctxFake = { rng: fresh };
  const got = [rngNext(ctxFake), rngNext(ctxFake), rngNext(ctxFake)];
  check(
    'rngNext(ctx) com rng presente consome de ctx.rng',
    got[0] === expected[0] && got[1] === expected[1] && got[2] === expected[2],
  );
}

// ─── Test 6: rng propaga via SpiritContext ────────────────────────────────
{
  const rng = new SpiritRng(99);
  const ctx = buildSpiritContext({
    minute: 1, homeScore: 0, awayScore: 0, possession: 'home',
    ball: { x: 50, y: 50 }, crowdSupport: 0.5, tacticalMentality: 60,
    opponentStrength: 70, homeRoster, homePlayers: [], awayRoster: [],
    rng,
  });
  check('rng propagado para SpiritContext', ctx.rng === rng);
}

// ─── Report ──────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;

console.log('\n=== src/gamespirit live engine migration self-test ===');
for (const r of results) {
  const sym = r.ok ? '✓' : '✗';
  console.log(`  ${sym} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${pass}/${results.length} passou${fail > 0 ? `, ${fail} falhou` : ''}\n`);

if (fail > 0) process.exit(1);
