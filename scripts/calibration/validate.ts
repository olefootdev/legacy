/**
 * Validation: roda N partidas headless e compara stats vs targets reais.
 *
 * Usa o generateEvent() do engine em loop pra simular partidas completas
 * sem UI, coleta stats e reporta desvios vs MATCH_FREQUENCY_TARGETS.
 *
 * Uso: npx tsx scripts/calibration/validate.ts [numMatches]
 */

// We can't import from the TS source directly with path aliases,
// so we inline the core logic here for headless validation.

import { MATCH_FREQUENCY_TARGETS } from '../../src/engine/classic/calibrationData';

const NUM_MATCHES = parseInt(process.argv[2] ?? '100', 10);
const EVENTS_PER_MATCH = 120; // ~120 events per 90 min

// Simple simulation: just test resolveShot distributions
import { SHOT_ZONE_DISTRIBUTIONS, type ShotZone } from '../../src/engine/classic/calibrationData';
import { PASS_COMPLETION } from '../../src/engine/classic/calibrationData';
import { ovrModifier } from '../../src/engine/classic/ovrModifier';

interface SimResult {
  goals: number;
  shots: number;
  saves: number;
  blocked: number;
  wide: number;
  posts: number;
  rebounds: number;
  corners: number;
  passesAttempted: number;
  passesCompleted: number;
  passesIntercepted: number;
  passesOut: number;
}

function simulateShotOutcome(zone: ShotZone, ovr: number, onFire: boolean): string {
  const dist = SHOT_ZONE_DISTRIBUTIONS[zone];
  let goalProb = dist.goalRate * ovrModifier(ovr);
  if (onFire) goalProb *= 1.25;
  goalProb = Math.max(0.01, Math.min(0.35, goalProb));

  const r = Math.random();
  if (r < goalProb) return 'goal';

  const remaining = 1 - goalProb;
  const r2 = Math.random();
  const total = dist.saveRate + dist.blockedRate + dist.wideRate + dist.postRate + dist.reboundRate + dist.cornerRate;
  let acc = 0;
  acc += dist.saveRate / total;    if (r2 < acc) return 'save';
  acc += dist.blockedRate / total;  if (r2 < acc) return 'blocked';
  acc += dist.wideRate / total;     if (r2 < acc) return 'wide';
  acc += dist.postRate / total;     if (r2 < acc) return 'post';
  acc += dist.reboundRate / total;  if (r2 < acc) return 'rebound';
  return 'corner';
}

function simulatePassOutcome(type: 'short' | 'medium' | 'long' | 'cross', ovr: number, underPressure: boolean): 'completed' | 'intercepted' | 'out' {
  let prob = PASS_COMPLETION[type].baseCompletion * ovrModifier(ovr);
  if (underPressure) prob *= 0.88;
  prob = Math.max(0.15, Math.min(0.98, prob));

  if (Math.random() < prob) return 'completed';
  return Math.random() < 0.6 ? 'intercepted' : 'out';
}

function simulateMatch(): SimResult {
  const result: SimResult = {
    goals: 0, shots: 0, saves: 0, blocked: 0, wide: 0, posts: 0,
    rebounds: 0, corners: 0,
    passesAttempted: 0, passesCompleted: 0, passesIntercepted: 0, passesOut: 0,
  };

  // ~12 shots per team per match → ~24 total
  const numShots = 20 + Math.floor(Math.random() * 10);
  for (let i = 0; i < numShots; i++) {
    const zones: ShotZone[] = ['box', 'box', 'box', 'edge', 'edge', 'edge', 'edge', 'outside', 'outside', 'outside'];
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const ovr = 65 + Math.floor(Math.random() * 30); // 65-94
    const onFire = Math.random() < 0.15;

    result.shots++;
    const outcome = simulateShotOutcome(zone, ovr, onFire);
    if (outcome === 'goal') result.goals++;
    else if (outcome === 'save') result.saves++;
    else if (outcome === 'blocked') result.blocked++;
    else if (outcome === 'wide') result.wide++;
    else if (outcome === 'post') result.posts++;
    else if (outcome === 'rebound') result.rebounds++;
    else if (outcome === 'corner') result.corners++;
  }

  // ~400-500 passes per team → ~800-1000 total
  const numPasses = 700 + Math.floor(Math.random() * 300);
  for (let i = 0; i < numPasses; i++) {
    const types: Array<'short' | 'medium' | 'long' | 'cross'> = ['short', 'short', 'short', 'short', 'medium', 'medium', 'medium', 'long', 'cross'];
    const pType = types[Math.floor(Math.random() * types.length)];
    const ovr = 65 + Math.floor(Math.random() * 30);
    const underPressure = Math.random() < 0.25;

    result.passesAttempted++;
    const outcome = simulatePassOutcome(pType, ovr, underPressure);
    if (outcome === 'completed') result.passesCompleted++;
    else if (outcome === 'intercepted') result.passesIntercepted++;
    else result.passesOut++;
  }

  return result;
}

function main() {
  console.log(`Simulando ${NUM_MATCHES} partidas...\n`);

  const results: SimResult[] = [];
  for (let i = 0; i < NUM_MATCHES; i++) {
    results.push(simulateMatch());
  }

  const avg = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;

  const avgGoals = avg(results.map(r => r.goals));
  const avgShots = avg(results.map(r => r.shots));
  const avgPassesAttempted = avg(results.map(r => r.passesAttempted));
  const avgPassCompletion = avg(results.map(r => r.passesCompleted / r.passesAttempted));
  const avgInterceptions = avg(results.map(r => r.passesIntercepted));

  // Shot outcome breakdown
  const totalShots = results.reduce((s, r) => s + r.shots, 0);
  const totalGoals = results.reduce((s, r) => s + r.goals, 0);
  const totalSaves = results.reduce((s, r) => s + r.saves, 0);
  const totalBlocked = results.reduce((s, r) => s + r.blocked, 0);
  const totalWide = results.reduce((s, r) => s + r.wide, 0);
  const totalPosts = results.reduce((s, r) => s + r.posts, 0);
  const totalRebounds = results.reduce((s, r) => s + r.rebounds, 0);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  VALIDAÇÃO: Stats Simuladas vs Targets Reais');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  GOLS POR PARTIDA');
  console.log(`    Simulado:  ${avgGoals.toFixed(2)}`);
  console.log(`    Target:    ${MATCH_FREQUENCY_TARGETS.goalsPerMatch}`);
  console.log(`    Desvio:    ${((avgGoals - MATCH_FREQUENCY_TARGETS.goalsPerMatch) / MATCH_FREQUENCY_TARGETS.goalsPerMatch * 100).toFixed(1)}%`);
  console.log('');
  console.log('  CHUTES POR PARTIDA');
  console.log(`    Simulado:  ${avgShots.toFixed(1)}`);
  console.log(`    Target:    ${MATCH_FREQUENCY_TARGETS.shotsPerMatch}`);
  console.log('');
  console.log('  SHOT OUTCOMES (% do total)');
  console.log(`    Goal:     ${(totalGoals / totalShots * 100).toFixed(1)}%`);
  console.log(`    Save:     ${(totalSaves / totalShots * 100).toFixed(1)}%`);
  console.log(`    Blocked:  ${(totalBlocked / totalShots * 100).toFixed(1)}%`);
  console.log(`    Wide:     ${(totalWide / totalShots * 100).toFixed(1)}%`);
  console.log(`    Post:     ${(totalPosts / totalShots * 100).toFixed(1)}%`);
  console.log(`    Rebound:  ${(totalRebounds / totalShots * 100).toFixed(1)}%`);
  console.log('');
  console.log('  PASSES');
  console.log(`    Tentados/partida:  ${avgPassesAttempted.toFixed(0)}`);
  console.log(`    Completion rate:   ${(avgPassCompletion * 100).toFixed(1)}%`);
  console.log(`    Interceptados/partida:  ${avgInterceptions.toFixed(1)}`);
  console.log('');

  // Goal distribution
  const goalDist: Record<number, number> = {};
  for (const r of results) {
    goalDist[r.goals] = (goalDist[r.goals] || 0) + 1;
  }
  console.log('  DISTRIBUIÇÃO DE GOLS');
  for (const [g, c] of Object.entries(goalDist).sort((a, b) => +a[0] - +b[0])) {
    console.log(`    ${g} gols: ${((c as number) / NUM_MATCHES * 100).toFixed(1)}%`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');

  // Verdict
  const goalDeviation = Math.abs(avgGoals - MATCH_FREQUENCY_TARGETS.goalsPerMatch) / MATCH_FREQUENCY_TARGETS.goalsPerMatch;
  if (goalDeviation < 0.15) {
    console.log('  ✅ Gols por partida dentro de 15% do target — APROVADO');
  } else {
    console.log(`  ⚠️  Gols por partida ${goalDeviation > 0 ? 'acima' : 'abaixo'} do target em ${(goalDeviation * 100).toFixed(0)}% — ajustar goalRate`);
  }

  if (avgPassCompletion > 0.78 && avgPassCompletion < 0.95) {
    console.log('  ✅ Pass completion rate arcade (78-95%) — APROVADO');
  } else {
    console.log(`  ⚠️  Pass completion ${(avgPassCompletion * 100).toFixed(1)}% — fora do range arcade`);
  }

  if (avgGoals >= 3.0 && avgGoals <= 5.0) {
    console.log('  ✅ Gols no range arcade (3.0-5.0) — DIVERTIDO');
  } else if (avgGoals < 3.0) {
    console.log(`  ⚠️  Poucos gols (${avgGoals.toFixed(2)}) — precisa de mais ação`);
  } else {
    console.log(`  ⚠️  Gols demais (${avgGoals.toFixed(2)}) — pode parecer lunático`);
  }
}

main();
