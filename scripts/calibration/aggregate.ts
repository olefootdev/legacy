/**
 * Agrega dados brutos do StatsBomb em distribuições estatísticas.
 *
 * Lê scripts/calibration/raw/events/*.json e produz:
 *   - Distribuição de outcomes de chute por zona (xG ranges)
 *   - Taxa de completion de passe por tipo (curto/longo/cruzamento)
 *   - Frequência de eventos por 90 minutos
 *   - Distribuição de gols por partida
 *
 * Uso: npx tsx scripts/calibration/aggregate.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RAW_DIR = join(import.meta.dirname, 'raw');
const OUT_FILE = join(import.meta.dirname, 'aggregated.json');

// StatsBomb event types we care about
interface SBEvent {
  type: { id: number; name: string };
  possession_team: { id: number; name: string };
  team: { id: number; name: string };
  location?: [number, number]; // [x, y] in SB coords (120x80 pitch)
  shot?: {
    outcome: { id: number; name: string };
    statsbomb_xg: number;
    body_part: { name: string };
    technique: { name: string };
    end_location: [number, number] | [number, number, number];
  };
  pass?: {
    length: number;
    height: { name: string };
    outcome?: { id: number; name: string };
    type?: { name: string };
    body_part?: { name: string };
    cross?: boolean;
    end_location?: [number, number];
  };
  duel?: {
    outcome?: { name: string };
    type?: { name: string };
  };
  foul_committed?: { type?: { name: string } };
  minute: number;
  period: number;
}

// Aggregation accumulators
interface ShotAgg {
  zone: 'box' | 'edge' | 'outside';
  total: number;
  goals: number;
  saved: number;
  blocked: number;
  wide: number;
  post: number;
  xgSum: number;
}

interface PassAgg {
  type: 'short' | 'medium' | 'long' | 'cross';
  total: number;
  completed: number;
}

interface MatchAgg {
  goals: number;
  shots: number;
  passes: number;
  fouls: number;
  corners: number;
  tackles: number;
  interceptions: number;
}

function classifyShotZone(location: [number, number] | undefined): 'box' | 'edge' | 'outside' {
  if (!location) return 'outside';
  const [x, y] = location;
  // SB pitch: 120x80, goal at x=120
  // Penalty area: x >= 102, y between 18-62
  if (x >= 102 && y >= 18 && y <= 62) return 'box';
  // Edge of box: x >= 90
  if (x >= 90) return 'edge';
  return 'outside';
}

function classifyPassType(pass: SBEvent['pass']): 'short' | 'medium' | 'long' | 'cross' {
  if (!pass) return 'short';
  if (pass.cross) return 'cross';
  if (pass.length > 32) return 'long';
  if (pass.length > 15) return 'medium';
  return 'short';
}

function main() {
  const eventsDir = join(RAW_DIR, 'events');
  let files: string[];
  try {
    files = readdirSync(eventsDir).filter(f => f.endsWith('.json'));
  } catch {
    console.error('Nenhum arquivo encontrado em raw/events/. Rode fetchStatsbomb.ts primeiro.');
    process.exit(1);
  }

  console.log(`Agregando ${files.length} partidas...`);

  const shots: Record<string, ShotAgg> = {
    box: { zone: 'box', total: 0, goals: 0, saved: 0, blocked: 0, wide: 0, post: 0, xgSum: 0 },
    edge: { zone: 'edge', total: 0, goals: 0, saved: 0, blocked: 0, wide: 0, post: 0, xgSum: 0 },
    outside: { zone: 'outside', total: 0, goals: 0, saved: 0, blocked: 0, wide: 0, post: 0, xgSum: 0 },
  };

  const passes: Record<string, PassAgg> = {
    short: { type: 'short', total: 0, completed: 0 },
    medium: { type: 'medium', total: 0, completed: 0 },
    long: { type: 'long', total: 0, completed: 0 },
    cross: { type: 'cross', total: 0, completed: 0 },
  };

  const matchStats: MatchAgg[] = [];
  let totalGoals = 0;

  for (const file of files) {
    const events: SBEvent[] = JSON.parse(readFileSync(join(eventsDir, file), 'utf-8'));

    const mAgg: MatchAgg = { goals: 0, shots: 0, passes: 0, fouls: 0, corners: 0, tackles: 0, interceptions: 0 };

    for (const evt of events) {
      const typeName = evt.type.name;

      // Shots
      if (typeName === 'Shot' && evt.shot) {
        const zone = classifyShotZone(evt.location);
        const agg = shots[zone];
        agg.total++;
        mAgg.shots++;
        agg.xgSum += evt.shot.statsbomb_xg || 0;

        const outcome = evt.shot.outcome.name;
        if (outcome === 'Goal') { agg.goals++; mAgg.goals++; totalGoals++; }
        else if (outcome === 'Saved' || outcome === 'Saved To Post' || outcome === 'Saved Off Target') agg.saved++;
        else if (outcome === 'Blocked') agg.blocked++;
        else if (outcome === 'Off T' || outcome === 'Wayward' || outcome === 'Off Target') agg.wide++;
        else if (outcome === 'Post') agg.post++;
        else agg.wide++; // fallback
      }

      // Passes
      if (typeName === 'Pass' && evt.pass) {
        const pType = classifyPassType(evt.pass);
        const agg = passes[pType];
        agg.total++;
        mAgg.passes++;
        if (!evt.pass.outcome) agg.completed++; // SB: no outcome = completed
      }

      // Fouls
      if (typeName === 'Foul Committed') mAgg.fouls++;

      // Tackles / Duels
      if (typeName === 'Duel' && evt.duel?.type === 'Tackle') mAgg.tackles++;

      // Interceptions
      if (typeName === 'Interception') mAgg.interceptions++;
    }

    matchStats.push(mAgg);
  }

  // Compute averages per match (both teams combined)
  const n = matchStats.length || 1;
  const avgPerMatch = {
    goals: matchStats.reduce((s, m) => s + m.goals, 0) / n,
    shots: matchStats.reduce((s, m) => s + m.shots, 0) / n,
    passes: matchStats.reduce((s, m) => s + m.passes, 0) / n,
    fouls: matchStats.reduce((s, m) => s + m.fouls, 0) / n,
    corners: matchStats.reduce((s, m) => s + m.corners, 0) / n,
    tackles: matchStats.reduce((s, m) => s + m.tackles, 0) / n,
    interceptions: matchStats.reduce((s, m) => s + m.interceptions, 0) / n,
  };

  // Shot conversion by zone
  const shotDistributions = Object.fromEntries(
    Object.entries(shots).map(([zone, agg]) => {
      const t = agg.total || 1;
      return [zone, {
        total: agg.total,
        goalRate: agg.goals / t,
        saveRate: agg.saved / t,
        blockedRate: agg.blocked / t,
        wideRate: agg.wide / t,
        postRate: agg.post / t,
        avgXG: agg.xgSum / t,
      }];
    }),
  );

  // Pass completion by type
  const passCompletion = Object.fromEntries(
    Object.entries(passes).map(([type, agg]) => {
      return [type, {
        total: agg.total,
        completionRate: agg.completed / (agg.total || 1),
      }];
    }),
  );

  // Goal distribution per match
  const goalDist: Record<number, number> = {};
  for (const m of matchStats) {
    goalDist[m.goals] = (goalDist[m.goals] || 0) + 1;
  }
  const goalDistPct = Object.fromEntries(
    Object.entries(goalDist).map(([g, c]) => [g, (c as number) / n]),
  );

  const result = {
    matchesAnalyzed: n,
    avgPerMatch,
    shotDistributions,
    passCompletion,
    goalDistribution: goalDistPct,
  };

  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log('\nResultados:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nSalvo em ${OUT_FILE}`);
}

main();
