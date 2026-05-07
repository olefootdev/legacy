/**
 * Gera calibrationData.ts a partir de aggregated.json.
 *
 * Lê as distribuições agregadas e emite um arquivo TypeScript tipado
 * que o engine importa em runtime.
 *
 * Uso: npx tsx scripts/calibration/emit.ts
 *
 * Se aggregated.json não existir, usa defaults baseados na literatura
 * (Understat, StatsBomb docs, Football Reference aggregates).
 */

import { readFileSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const AGG_FILE = join(import.meta.dirname, 'aggregated.json');
const OUT_FILE = join(import.meta.dirname, '..', '..', 'src', 'engine', 'classic', 'calibrationData.ts');

// Defaults from football literature when no aggregated data exists
const DEFAULTS = {
  shotDistributions: {
    box:     { goalRate: 0.15, saveRate: 0.20, blockedRate: 0.22, wideRate: 0.30, postRate: 0.04, avgXG: 0.15 },
    edge:    { goalRate: 0.06, saveRate: 0.22, blockedRate: 0.30, wideRate: 0.32, postRate: 0.04, avgXG: 0.06 },
    outside: { goalRate: 0.02, saveRate: 0.18, blockedRate: 0.35, wideRate: 0.38, postRate: 0.03, avgXG: 0.02 },
  },
  passCompletion: {
    short:  { completionRate: 0.88 },
    medium: { completionRate: 0.82 },
    long:   { completionRate: 0.58 },
    cross:  { completionRate: 0.28 },
  },
  avgPerMatch: {
    goals: 2.72,
    shots: 24,
    passes: 850,
    fouls: 22,
    corners: 10,
    tackles: 32,
    interceptions: 18,
  },
};

function main() {
  let data: typeof DEFAULTS;

  if (existsSync(AGG_FILE)) {
    console.log(`Lendo dados agregados de ${AGG_FILE}...`);
    const raw = JSON.parse(readFileSync(AGG_FILE, 'utf-8'));
    data = {
      shotDistributions: raw.shotDistributions ?? DEFAULTS.shotDistributions,
      passCompletion: raw.passCompletion ?? DEFAULTS.passCompletion,
      avgPerMatch: raw.avgPerMatch ?? DEFAULTS.avgPerMatch,
    };
    console.log(`  Baseado em ${raw.matchesAnalyzed ?? '?'} partidas reais.`);
  } else {
    console.log('aggregated.json não encontrado — usando defaults da literatura.');
    data = DEFAULTS;
  }

  // Normalize shot distributions: ensure they sum to ~1.0 (excluding goal)
  for (const [zone, dist] of Object.entries(data.shotDistributions)) {
    const d = dist as any;
    const nonGoalTotal = d.saveRate + d.blockedRate + d.wideRate + d.postRate;
    if (nonGoalTotal > 0 && Math.abs(nonGoalTotal + d.goalRate - 1) > 0.05) {
      // Normalize non-goal outcomes to fill remaining after goalRate
      const remaining = 1 - d.goalRate;
      const scale = remaining / nonGoalTotal;
      d.saveRate *= scale;
      d.blockedRate *= scale;
      d.wideRate *= scale;
      d.postRate *= scale;
    }
    // Ensure rebound is present (SB calls it rebound from save; we compute it)
    // We'll split save into save + rebound (20% of saves become rebounds)
  }

  const sd = data.shotDistributions as any;
  const pc = data.passCompletion as any;
  const ap = data.avgPerMatch;

  const output = `/**
 * Dados de calibração do motor CLASSIC — derivados de partidas reais.
 *
 * Gerado por: npx tsx scripts/calibration/emit.ts
 * Fonte: StatsBomb Open Data + defaults da literatura (Understat, FBref)
 *
 * NÃO editar manualmente — regenerar via pipeline.
 */

// ─── Shot Zone Classification ────────────────────────────────────────────────

export type ShotZone = 'box' | 'edge' | 'outside';

export type ShotOutcomeCalibrated =
  | 'goal' | 'save' | 'blocked' | 'wide' | 'post' | 'rebound' | 'corner_def';

export interface ShotZoneDistribution {
  goalRate: number;
  saveRate: number;
  blockedRate: number;
  wideRate: number;
  postRate: number;
  reboundRate: number;
  cornerRate: number;
}

/**
 * Distribuição de outcomes de chute por zona.
 * Baseado em dados reais — cada zona tem conversão e outcomes diferentes.
 *
 * box = dentro da grande área (xRel >= 0.85)
 * edge = borda da área (xRel >= 0.72)
 * outside = fora da área (xRel < 0.72)
 */
export const SHOT_ZONE_DISTRIBUTIONS: Record<ShotZone, ShotZoneDistribution> = {
  box: {
    goalRate:    ${sd.box.goalRate.toFixed(3)},
    saveRate:    ${(sd.box.saveRate * 0.80).toFixed(3)},
    blockedRate: ${sd.box.blockedRate.toFixed(3)},
    wideRate:    ${sd.box.wideRate.toFixed(3)},
    postRate:    ${sd.box.postRate.toFixed(3)},
    reboundRate: ${(sd.box.saveRate * 0.15).toFixed(3)},
    cornerRate:  ${(sd.box.saveRate * 0.05).toFixed(3)},
  },
  edge: {
    goalRate:    ${sd.edge.goalRate.toFixed(3)},
    saveRate:    ${(sd.edge.saveRate * 0.75).toFixed(3)},
    blockedRate: ${sd.edge.blockedRate.toFixed(3)},
    wideRate:    ${sd.edge.wideRate.toFixed(3)},
    postRate:    ${sd.edge.postRate.toFixed(3)},
    reboundRate: ${(sd.edge.saveRate * 0.18).toFixed(3)},
    cornerRate:  ${(sd.edge.saveRate * 0.07).toFixed(3)},
  },
  outside: {
    goalRate:    ${sd.outside.goalRate.toFixed(3)},
    saveRate:    ${(sd.outside.saveRate * 0.70).toFixed(3)},
    blockedRate: ${sd.outside.blockedRate.toFixed(3)},
    wideRate:    ${sd.outside.wideRate.toFixed(3)},
    postRate:    ${sd.outside.postRate.toFixed(3)},
    reboundRate: ${(sd.outside.saveRate * 0.20).toFixed(3)},
    cornerRate:  ${(sd.outside.saveRate * 0.10).toFixed(3)},
  },
};

// ─── Pass Completion ─────────────────────────────────────────────────────────

export type PassType = 'short' | 'medium' | 'long' | 'cross';

export type PassOutcome = 'completed' | 'intercepted' | 'out_of_play';

export interface PassCompletionProfile {
  baseCompletion: number;
}

export const PASS_COMPLETION: Record<PassType, PassCompletionProfile> = {
  short:  { baseCompletion: ${pc.short.completionRate.toFixed(3)} },
  medium: { baseCompletion: ${pc.medium.completionRate.toFixed(3)} },
  long:   { baseCompletion: ${pc.long.completionRate.toFixed(3)} },
  cross:  { baseCompletion: ${pc.cross.completionRate.toFixed(3)} },
};

// ─── Match Frequency Targets ─────────────────────────────────────────────────

export interface MatchFrequencyTargets {
  goalsPerMatch: number;
  shotsPerMatch: number;
  passesPerMatch: number;
  foulsPerMatch: number;
  cornersPerMatch: number;
  tacklesPerMatch: number;
  interceptionsPerMatch: number;
}

export const MATCH_FREQUENCY_TARGETS: MatchFrequencyTargets = {
  goalsPerMatch: ${ap.goals.toFixed(2)},
  shotsPerMatch: ${ap.shots.toFixed(0)},
  passesPerMatch: ${ap.passes.toFixed(0)},
  foulsPerMatch: ${ap.fouls.toFixed(0)},
  cornersPerMatch: ${ap.corners.toFixed(0)},
  tacklesPerMatch: ${ap.tackles.toFixed(0)},
  interceptionsPerMatch: ${ap.interceptions.toFixed(0)},
};
`;

  writeFileSync(OUT_FILE, output);
  console.log(`\ncalibrationData.ts gerado em ${OUT_FILE}`);
  console.log('Distribuições de chute por zona:');
  for (const [zone, dist] of Object.entries(SHOT_ZONE_DISTRIBUTIONS_PREVIEW(sd))) {
    console.log(`  ${zone}: goal=${(dist as any).goalRate}%  save=${(dist as any).saveRate}%  blocked=${(dist as any).blockedRate}%  wide=${(dist as any).wideRate}%`);
  }
}

function SHOT_ZONE_DISTRIBUTIONS_PREVIEW(sd: any) {
  return {
    box: { goalRate: `${(sd.box.goalRate * 100).toFixed(1)}`, saveRate: `${(sd.box.saveRate * 100 * 0.8).toFixed(1)}`, blockedRate: `${(sd.box.blockedRate * 100).toFixed(1)}`, wideRate: `${(sd.box.wideRate * 100).toFixed(1)}` },
    edge: { goalRate: `${(sd.edge.goalRate * 100).toFixed(1)}`, saveRate: `${(sd.edge.saveRate * 100 * 0.75).toFixed(1)}`, blockedRate: `${(sd.edge.blockedRate * 100).toFixed(1)}`, wideRate: `${(sd.edge.wideRate * 100).toFixed(1)}` },
    outside: { goalRate: `${(sd.outside.goalRate * 100).toFixed(1)}`, saveRate: `${(sd.outside.saveRate * 100 * 0.7).toFixed(1)}`, blockedRate: `${(sd.outside.blockedRate * 100).toFixed(1)}`, wideRate: `${(sd.outside.wideRate * 100).toFixed(1)}` },
  };
}

main();
