/**
 * Self-test do motor de cadeia de narração (quick-match-revolution.md §3.2).
 * Roda: `npm run test:quick-narration-chain`
 */

import type { PitchPlayerState } from '@/engine/types';
import { buildGoalChain, buildNearMissChain } from './quickNarrationChain';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const pick0 = () => 0;
const players = [
  { playerId: 'm1', name: 'Carlos Lima', role: 'mid' },
  { playerId: 'a1', name: 'Diego Souza', role: 'attack' },
  { playerId: 'd1', name: 'Rafa Pinto', role: 'def' },
] as unknown as PitchPlayerState[];

console.log('\n▶ Quick Narration Chain Self-Test\n');

const goal = buildGoalChain({ scorerName: 'João Pedro', players, pick: pick0 });
check('gol: termina em GOOOL (climax)', goal.beats[goal.beats.length - 1]!.text === 'GOOOL');
check('gol: último beat é kind climax', goal.beats[goal.beats.length - 1]!.kind === 'climax');
check('gol: linha do artilheiro usa o nome', goal.beats.some((b) => b.text.includes('João')), JSON.stringify(goal.beats));
check('gol: 3+ beats de construção', goal.beats.filter((b) => b.kind === 'build').length >= 3);
check('gol: legendas curtas (≤ ~6 palavras)', goal.beats.every((b) => b.text.split(/\s+/).length <= 6), JSON.stringify(goal.beats.map((b) => b.text)));

const post = buildNearMissChain({ kind: 'post', players, pick: pick0 });
check('trave: climax NA TRAVE!', post.climaxWord === 'NA TRAVE!');
const save = buildNearMissChain({ kind: 'save', players, pick: pick0 });
check('defesa: climax DEFENDEÇÃO!', save.climaxWord === 'DEFENDEÇÃO!');
const wide = buildNearMissChain({ kind: 'wide', players, pick: pick0 });
check('fora: climax PRA FORA!', wide.climaxWord === 'PRA FORA!');
check('quase-gol: exatamente 1 climax no fim', [post, save, wide].every((c) => c.beats.filter((b) => b.kind === 'climax').length === 1));

// Robustez: sem jogadores nem nomes, não quebra e ainda fecha em GOOOL.
const bare = buildGoalChain({ pick: pick0 });
check('sem dados: ainda gera cadeia válida', bare.beats.length >= 2 && bare.climaxWord === 'GOOOL');
check('sem dados: nenhuma legenda vazia/undefined', bare.beats.every((b) => b.text && !b.text.includes('undefined')), JSON.stringify(bare.beats));

if (failures > 0) {
  console.log(`\n✗ quick narration chain self-test FALHOU (${failures})\n`);
  process.exit(1);
}
console.log('\n▶ quick narration chain self-test OK — cadeia cinética (build-up → clímax)\n');
