/**
 * Régua de realismo — o contrato de jogabilidade do motor ao vivo.
 * npm run test:match-realism
 *
 * Roda partidas completas headless em 3 seeds e confronta o comportamento dos 22
 * agentes com os limiares de `matchRealismMetrics`. Falha se o motor voltar a
 * produzir 22 jogadores parados enquanto a bola passeia sozinha.
 */
import type { LiveMatchSnapshot, PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { defaultSlotOrder } from '@/formation/layout433';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import {
  MatchRealismSampler,
  checkRealism,
  formatRealism,
  type MatchRealismReport,
} from '@/simulation/matchRealismMetrics';

const SEEDS = [404_413, 777_001, 190_277];
const STEP_HZ = 60;
/** Tempo de simulação suficiente para cobrir os 90' do relógio com folga. */
const MAX_STEPS = STEP_HZ * 60 * 14;

const baseAttrs: MatchPlayerAttributes = {
  passeCurto: 72, passeLongo: 68, cruzamento: 62, marcacao: 70, velocidade: 74,
  fairPlay: 68, drible: 70, finalizacao: 72, fisico: 72, tatico: 72,
  mentalidade: 76, confianca: 74,
};

function liveSnapshot(seed: number): LiveMatchSnapshot {
  const order = defaultSlotOrder();
  const matchLineupBySlot: Record<string, string> = {};
  const homePlayers: PitchPlayerState[] = order.map((slotId, i) => {
    matchLineupBySlot[slotId] = `home-${slotId}`;
    const role: PitchPlayerState['role'] =
      slotId === 'gol' ? 'gk'
      : ['zag1', 'zag2', 'le', 'ld', 'vol'].includes(slotId) ? 'def'
      : slotId.startsWith('mc') ? 'mid'
      : 'attack';
    return {
      playerId: `home-${slotId}`,
      slotId,
      name: slotId,
      num: i + 1,
      pos: slotId,
      x: 50,
      y: 48,
      fatigue: 14,
      role,
      cognitiveArchetype: 'criador',
      attributes: baseAttrs,
    } as PitchPlayerState;
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
    simulationSeed: seed,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
  } as unknown as LiveMatchSnapshot;
}

function runSeed(seed: number): MatchRealismReport {
  const manager = { tacticalMentality: 60, defensiveLine: 50, tempo: 60 };
  const loop = new TacticalSimLoop();
  loop.syncLive(liveSnapshot(seed), manager);

  const sampler = new MatchRealismSampler();
  for (let i = 0; i < MAX_STEPS; i++) {
    loop.step(1 / STEP_HZ, manager);
    const st = loop.getSimState();
    if (String(st.phase) === 'fulltime') break;
    // Só bola rolando: reinício e intervalo distorcem as medidas.
    if (String(st.phase) !== 'live') continue;
    if (i % (STEP_HZ / 2) !== 0) continue; // 2 amostras por segundo
    const snap = loop.getSnapshot();
    if (snap) sampler.add(snap, st.carrierId);
  }
  return sampler.report();
}

/** Média dos relatórios — o contrato vale para o motor, não para um seed sortudo. */
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
    blockDepthM: {
      home: avg((r) => r.blockDepthM.home),
      away: avg((r) => r.blockDepthM.away),
    },
    pressureDistM: avg((r) => r.pressureDistM),
    carrierPct: avg((r) => r.carrierPct),
  };
}

function main(): void {
  const reports: MatchRealismReport[] = [];
  for (const seed of SEEDS) {
    const r = runSeed(seed);
    reports.push(r);
    console.log(
      `seed ${seed}: amostras=${r.samples} corr=${r.ballBlockCorrelation.home.toFixed(2)}/${r.ballBlockCorrelation.away.toFixed(2)} ` +
      `disputa=${r.contestPct.toFixed(1)}% bloco=${r.blockDepthM.home.toFixed(1)}m ` +
      `pressao=${r.pressureDistM.toFixed(1)}m portador=${r.carrierPct.toFixed(1)}%`,
    );
  }

  const merged = mergeReports(reports);
  const checks = checkRealism(merged);
  console.log(`\nmédia de ${SEEDS.length} partidas (${merged.samples} amostras):`);
  console.log(formatRealism(checks));

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.error(`\nmatch-realism: FALHOU — ${failed.length} de ${checks.length} medidas fora do limiar.`);
    process.exit(1);
  }
  console.log('\nmatch-realism: ok');
}

main();
