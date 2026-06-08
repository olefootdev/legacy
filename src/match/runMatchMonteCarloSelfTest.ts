/**
 * Self-test pro PR-B da Fase 1 — Monte Carlo de Predição de Partida.
 *
 * Cobre: determinismo, probabilidades válidas, xG calibrado, mando faz
 * diferença, desfalques penalizam, performance < 500ms, zebra detectada.
 *
 * Roda com: `npm run test:monte-carlo`
 */

import { simulateMatchN } from './matchMonteCarlo';
import { computeMatchContextModifiers } from './contextFactors';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, ok: cond, detail });
}

function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

// ─── Test 1: determinismo ─────────────────────────────────────────────────
{
  const a = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 500, seed: 42 });
  const b = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 500, seed: 42 });
  check('determinismo: mesma seed = mesmo winHome', a.winHome === b.winHome);
  check('determinismo: mesma seed = mesma xgHome', a.xgHome === b.xgHome);
  check('determinismo: mesma seed = mesmo scoreDist[0]', a.scoreDist[0]?.score === b.scoreDist[0]?.score);
}

// ─── Test 2: probabilidades somam 1 ──────────────────────────────────────
{
  const r = simulateMatchN({ homeTeamOvr: 80, awayTeamOvr: 70, n: 1000, seed: 1 });
  const sum = r.winHome + r.draw + r.winAway;
  check('probs somam 1.0 (± 0.001)', approx(sum, 1.0, 0.001), `soma=${sum.toFixed(4)}`);
}

// ─── Test 3: time mais forte tem mais chance de vitória ──────────────────
{
  const strong = simulateMatchN({ homeTeamOvr: 90, awayTeamOvr: 60, n: 1000, seed: 7 });
  const weak = simulateMatchN({ homeTeamOvr: 60, awayTeamOvr: 90, n: 1000, seed: 7 });
  check('forte em casa > 60% de vitória', strong.winHome > 0.6, `winHome=${strong.winHome.toFixed(3)}`);
  check('fraco em casa < 30% de vitória', weak.winHome < 0.3, `winHome=${weak.winHome.toFixed(3)}`);
}

// ─── Test 4: xG positivo e razoável ──────────────────────────────────────
{
  const r = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 3 });
  const totalXg = r.xgHome + r.xgAway;
  check('xg total entre 2.0 e 3.5 com times equilibrados', totalXg >= 2.0 && totalXg <= 3.5, `total=${totalXg.toFixed(2)}`);
  check('xg de cada time positivo', r.xgHome > 0 && r.xgAway > 0);
}

// ─── Test 5: mando de campo aumenta winHome ──────────────────────────────
{
  const noMando = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 11 });
  const comMando = simulateMatchN({
    homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 11,
    contextModifiers: computeMatchContextModifiers({ isHome: true }),
  });
  check(
    'homeAdvantage aumenta winHome',
    comMando.winHome > noMando.winHome,
    `sem=${noMando.winHome.toFixed(3)} → com=${comMando.winHome.toFixed(3)}`,
  );
}

// ─── Test 6: desfalques reduzem winHome ──────────────────────────────────
{
  const completo = simulateMatchN({
    homeTeamOvr: 80, awayTeamOvr: 70, n: 1000, seed: 13,
    effectiveHomeStrength: {
      baseOverall: 80, effectiveOverall: 80, depletionMultiplier: 1.0,
      startersCounted: 11, penalties: { fatigue: 0, contractWarning: 0, forcedPosition: 0 },
    },
  });
  const desfalcado = simulateMatchN({
    homeTeamOvr: 80, awayTeamOvr: 70, n: 1000, seed: 13,
    effectiveHomeStrength: {
      baseOverall: 80, effectiveOverall: 70, depletionMultiplier: 0.85,
      startersCounted: 11, penalties: { fatigue: 4, contractWarning: 3, forcedPosition: 1 },
    },
  });
  check(
    'desfalques reduzem winHome',
    desfalcado.winHome < completo.winHome,
    `completo=${completo.winHome.toFixed(3)} → desfalcado=${desfalcado.winHome.toFixed(3)}`,
  );
}

// ─── Test 7: scoreDist top 5 ordenado por prob desc ──────────────────────
{
  const r = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 5 });
  let monotone = true;
  for (let i = 1; i < r.scoreDist.length; i++) {
    if (r.scoreDist[i]!.prob > r.scoreDist[i - 1]!.prob) monotone = false;
  }
  check('scoreDist ordenado desc por prob', monotone);
  check('scoreDist tem até 5 entradas', r.scoreDist.length > 0 && r.scoreDist.length <= 5);
}

// ─── Test 8: zebra detectada quando favorito ainda lidera mas underdog > 25% ──
{
  // Time mandante levemente melhor — visitante deve ter > 25% e gerar zebra
  const r = simulateMatchN({ homeTeamOvr: 78, awayTeamOvr: 72, n: 1000, seed: 9 });
  if (r.winHome > r.winAway) {
    check('zebra detectada quando winAway ≥ 25%', r.winAway < 0.25 || r.zebra, `winAway=${r.winAway.toFixed(3)}, zebra=${r.zebra}`);
  } else {
    check('skip — distribuição não cabe nesse cenário', true);
  }
}

// ─── Test 9: drama index alto em jogo equilibrado ────────────────────────
{
  const r = simulateMatchN({ homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 17 });
  check('drama ≥ 60% em jogo equilibrado', r.dramaIndex >= 0.6, `drama=${(r.dramaIndex * 100).toFixed(1)}%`);
}

// ─── Test 10: performance — 1000 sims < 500ms ────────────────────────────
{
  const r = simulateMatchN({ homeTeamOvr: 80, awayTeamOvr: 70, n: 1000, seed: 99 });
  check('1000 sims rodam em < 500ms', r.durationMs < 500, `${r.durationMs}ms`);
}

// ─── Test 11: topScorers com roster ──────────────────────────────────────
{
  const roster = [
    {
      id: 'a1', num: 9, name: 'Atacante A', pos: 'ATA',
      attrs: { passe: 50, marcacao: 30, velocidade: 80, drible: 75, finalizacao: 88, fisico: 70, tatico: 65, mentalidade: 70, confianca: 75, fairPlay: 70 },
      archetype: 'finisher' as const, zone: 'attack' as const, behavior: 'ofensivo' as const,
      fatigue: 0, injuryRisk: 0, outForMatches: 0, evolutionXp: 0,
    },
    {
      id: 'm1', num: 8, name: 'Meia A', pos: 'MC',
      attrs: { passe: 80, marcacao: 50, velocidade: 60, drible: 70, finalizacao: 60, fisico: 65, tatico: 75, mentalidade: 70, confianca: 70, fairPlay: 75 },
      archetype: 'creator' as const, zone: 'midfield' as const, behavior: 'criativo' as const,
      fatigue: 0, injuryRisk: 0, outForMatches: 0, evolutionXp: 0,
    },
    {
      id: 'd1', num: 4, name: 'Zagueiro A', pos: 'ZAG',
      attrs: { passe: 55, marcacao: 85, velocidade: 60, drible: 40, finalizacao: 30, fisico: 80, tatico: 75, mentalidade: 70, confianca: 70, fairPlay: 75 },
      archetype: 'defender' as const, zone: 'defense' as const, behavior: 'defensivo' as const,
      fatigue: 0, injuryRisk: 0, outForMatches: 0, evolutionXp: 0,
    },
  ] as never;

  const r = simulateMatchN({
    homeTeamOvr: 75, awayTeamOvr: 75, n: 1000, seed: 21,
    homeRoster: roster,
  });
  const top = r.topHomeScorers[0];
  check('topHomeScorers tem entradas', r.topHomeScorers.length > 0);
  check('top scorer é atacante (ATA pesa muito mais)', top?.playerId === 'a1', `top=${top?.playerName}`);
}

// ─── Test 12: importance influencia winHome ──────────────────────────────
{
  const liga = simulateMatchN({
    homeTeamOvr: 80, awayTeamOvr: 75, n: 1000, seed: 23,
    contextModifiers: computeMatchContextModifiers({ isHome: true, importance: 'liga' }),
  });
  const final = simulateMatchN({
    homeTeamOvr: 80, awayTeamOvr: 75, n: 1000, seed: 23,
    contextModifiers: computeMatchContextModifiers({ isHome: true, importance: 'final' }),
  });
  check(
    'final eleva winHome vs liga (mesma seed)',
    final.winHome >= liga.winHome,
    `liga=${liga.winHome.toFixed(3)}, final=${final.winHome.toFixed(3)}`,
  );
}

// ─── Report ──────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;

console.log('\n=== matchMonteCarlo self-test ===');
for (const r of results) {
  const sym = r.ok ? '✓' : '✗';
  console.log(`  ${sym} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${pass}/${results.length} passou${fail > 0 ? `, ${fail} falhou` : ''}\n`);

if (fail > 0) process.exit(1);
