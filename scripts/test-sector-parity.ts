/**
 * Paridade do motor por setor: src/match/globalSectorModel.ts (cliente) vs
 * supabase/functions/global-league-tick/_sectorModel.ts (Edge/Deno, cópia).
 *
 * O Deno não importa de src/, então o modelo vive em DOIS arquivos. Este teste
 * roda os mesmos cenários semeados nos dois e exige saída IDÊNTICA — se alguém
 * editar um e esquecer o outro, quebra aqui (mesmo padrão do test:revela-ovr).
 */
import * as SRC from '../src/match/globalSectorModel';
import * as EDGE from '../supabase/functions/global-league-tick/_sectorModel.ts';
import type { SnapshotPlayer } from '../src/match/globalSectorModel';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failed = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) {
    failed++;
    console.log(`  ❌ ${name}\n     src=${JSON.stringify(a)}\n     edge=${JSON.stringify(b)}`);
  }
}

function mk(over: Partial<SnapshotPlayer> & { name: string; pos: string }): SnapshotPlayer {
  return {
    id: over.name, finalizacao: 60, drible: 60, velocidade: 60, passe: 60, marcacao: 60,
    fisico: 60, cabeceio: 60, bolaParada: 60, penalti: 60, confianca: 60, ...over,
  };
}

const XI: SnapshotPlayer[] = [
  mk({ name: 'GK', pos: 'GOL', marcacao: 40 }),
  mk({ name: 'Z1', pos: 'ZAG', marcacao: 82, fisico: 84, cabeceio: 92 }),
  mk({ name: 'Z2', pos: 'ZAG', marcacao: 78, fisico: 80 }),
  mk({ name: 'LE', pos: 'LE', velocidade: 78 }),
  mk({ name: 'LD', pos: 'LD', velocidade: 78 }),
  mk({ name: 'VOL', pos: 'VOL', marcacao: 76 }),
  mk({ name: 'MEI', pos: 'MEI', passe: 84, bolaParada: 94 }),
  mk({ name: 'MC', pos: 'MC', passe: 80 }),
  mk({ name: 'PE', pos: 'PE', velocidade: 85, drible: 82, finalizacao: 70 }),
  mk({ name: 'PD', pos: 'PD', velocidade: 85, drible: 82, finalizacao: 70 }),
  mk({ name: 'ATA', pos: 'ATA', finalizacao: 86, penalti: 95, confianca: 88 }),
];

console.log('\n[paridade] computeSectors / sectorsToLambda');
eq('computeSectors', SRC.computeSectors(XI), EDGE.computeSectors(XI));
{
  const secH = SRC.computeSectors(XI);
  const secA = SRC.computeSectors(XI.map((p) => mk({ ...p, name: p.name + 'w', finalizacao: 40, marcacao: 40, fisico: 40 })));
  eq('sectorsToLambda', SRC.sectorsToLambda({ home: secH, away: secA }), EDGE.sectorsToLambda({ home: secH, away: secA }));
}

console.log('[paridade] pickGoalType / pickScorer (mesma sequência de rng)');
for (let seed = 1; seed <= 200; seed++) {
  const rSrc = mulberry32(seed);
  const rEdge = mulberry32(seed);
  eq(`pickGoalType seed=${seed}`, SRC.pickGoalType(rSrc), EDGE.pickGoalType(rEdge));
}
for (const type of ['open', 'header', 'free_kick', 'penalty'] as const) {
  for (let seed = 1; seed <= 100; seed++) {
    const rSrc = mulberry32(seed * 7);
    const rEdge = mulberry32(seed * 7);
    eq(`pickScorer ${type} seed=${seed}`, SRC.pickScorer(XI, type, rSrc), EDGE.pickScorer(XI, type, rEdge));
  }
}

console.log(failed === 0 ? '\n✅ PARIDADE cliente↔Deno — idênticos\n' : `\n❌ ${failed} divergências — sincronize os dois arquivos\n`);
process.exit(failed === 0 ? 0 : 1);
