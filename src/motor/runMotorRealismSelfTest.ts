/**
 * Régua de realismo aplicada ao MOTOR NOVO.
 * npm run test:motor
 *
 * Mesma régua, mesmos seeds, mesmos limiares que `test:match-realism` roda
 * contra o TacticalSimLoop. É de propósito: os dois motores precisam ser
 * comparáveis medida a medida, senão "o novo é melhor" vira opinião.
 */
import { MotorEngine, type MotorPlayerInput, HALF_SECONDS } from './MotorEngine';
import {
  MatchRealismSampler,
  checkRealism,
  checkMatchRates,
  formatRealism,
  type MatchRealismReport,
  type RealismCheck,
} from '@/simulation/matchRealismMetrics';

const SEEDS = [404_413, 777_001, 190_277];
/** Duas amostras por segundo de futebol — mesma densidade da régua antiga. */
const SAMPLE_EVERY_STEPS = 10;

const SLOTS_433: Array<{ slot: string; role: MotorPlayerInput['role'] }> = [
  { slot: 'gol', role: 'gk' },
  { slot: 'zag1', role: 'def' }, { slot: 'zag2', role: 'def' },
  { slot: 'le', role: 'def' }, { slot: 'ld', role: 'def' },
  { slot: 'vol', role: 'mid' }, { slot: 'mc1', role: 'mid' }, { slot: 'mc2', role: 'mid' },
  { slot: 'pe', role: 'attack' }, { slot: 'ata', role: 'attack' }, { slot: 'pd', role: 'attack' },
];

const SLOTS_442: Array<{ slot: string; role: MotorPlayerInput['role'] }> = [
  { slot: 'gol', role: 'gk' },
  { slot: 'le', role: 'def' }, { slot: 'zag1', role: 'def' },
  { slot: 'zag2', role: 'def' }, { slot: 'ld', role: 'def' },
  { slot: 'vol', role: 'mid' }, { slot: 'mc1', role: 'mid' },
  { slot: 'mc2', role: 'mid' }, { slot: 'pd', role: 'mid' },
  { slot: 'ata', role: 'attack' }, { slot: 'pe', role: 'attack' },
];

function team(
  side: 'home' | 'away',
  slots: Array<{ slot: string; role: MotorPlayerInput['role'] }>,
): MotorPlayerInput[] {
  return slots.map((s, i) => ({
    id: `${side}-${s.slot}`,
    side,
    slotId: s.slot,
    role: s.role,
    shirtNumber: i + 1,
    attrs: {
      velocidade: 74, passe: 72, marcacao: 70,
      finalizacao: 72, fisico: 72, drible: 70,
    },
  }));
}

interface SeedResult { report: MatchRealismReport; rates: RealismCheck[]; }

function runSeed(seed: number): SeedResult {
  const engine = new MotorEngine(team('home', SLOTS_433), team('away', SLOTS_442), { seed });
  const sampler = new MatchRealismSampler('football');
  let i = 0;
  while (!engine.finished) {
    engine.step();
    // Só bola rolando: parada distorce forma e pressão, igual à régua antiga.
    if (i % SAMPLE_EVERY_STEPS === 0 && engine.phase === 'live') {
      sampler.add(engine.snapshot(), engine.carrier);
    }
    i++;
  }
  const r = sampler.report();
  console.log(
    `seed ${seed}: ${engine.homeScore}x${engine.awayScore} · amostras=${r.samples} ` +
    `corr=${r.ballBlockCorrelation.home.toFixed(2)}/${r.ballBlockCorrelation.away.toFixed(2)} ` +
    `disputa=${r.contestPct.toFixed(1)}% bloco=${r.blockDepthM.home.toFixed(1)}m ` +
    `pressao=${r.pressureDistM.toFixed(1)}m portador=${r.carrierPct.toFixed(1)}% ` +
    `| passes=${engine.stats.passes} chutes=${engine.stats.shots} ` +
    `bola rolando=${(engine.inPlaySeconds / 60).toFixed(0)}min`,
  );
  return {
    report: r,
    rates: checkMatchRates({
      passes: engine.stats.passes,
      shots: engine.stats.shots,
      goals: engine.homeScore + engine.awayScore,
    }),
  };
}

function mergeReports(reports: MatchRealismReport[]): MatchRealismReport {
  const n = reports.length;
  const avg = (pick: (r: MatchRealismReport) => number) =>
    reports.reduce((s, r) => s + pick(r), 0) / n;
  return {
    samples: reports.reduce((s, r) => s + r.samples, 0),
    ballBlockCorrelation: {
      home: avg((r) => r.ballBlockCorrelation.home),
      away: avg((r) => r.ballBlockCorrelation.away),
    },
    contestPct: avg((r) => r.contestPct),
    blockDepthM: { home: avg((r) => r.blockDepthM.home), away: avg((r) => r.blockDepthM.away) },
    blockWidthM: { home: avg((r) => r.blockWidthM.home), away: avg((r) => r.blockWidthM.away) },
    blockAreaM2: { home: avg((r) => r.blockAreaM2.home), away: avg((r) => r.blockAreaM2.away) },
    pressureDistM: avg((r) => r.pressureDistM),
    carrierPct: avg((r) => r.carrierPct),
    sprintTopMs: avg((r) => r.sprintTopMs),
    ballFlightMs: avg((r) => r.ballFlightMs),
    ballPlayerRatio: avg((r) => r.ballPlayerRatio),
  };
}

function main(): void {
  console.log(`motor novo — ${HALF_SECONDS * 2}s de futebol por partida, sem compressão de tempo\n`);
  const results = SEEDS.map(runSeed);
  const merged = mergeReports(results.map((r) => r.report));
  // Ritmo: cobra a MÉDIA das partidas, não uma sortuda.
  const rateAvg = (i: number) =>
    results.reduce((s, r) => s + r.rates[i]!.value, 0) / results.length;
  const rates = results[0]!.rates.map((c, i) => {
    const value = rateAvg(i);
    return { ...c, value, ok: c.dir === 'min' ? value >= c.limit : value <= c.limit };
  });
  const checks = [...checkRealism(merged), ...rates];
  console.log(`\nmédia de ${SEEDS.length} partidas (${merged.samples} amostras):`);
  console.log(formatRealism(checks));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nmotor novo: ${checks.length - failed.length} de ${checks.length} medidas dentro do limiar.`);
  if (failed.length > 0) {
    console.error(`FALHOU — fora do limiar: ${failed.map((c) => c.label).join(', ')}`);
    process.exit(1);
  }
  console.log('motor: ok');
}

main();
