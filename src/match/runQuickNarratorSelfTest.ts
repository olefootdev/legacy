/**
 * Self-test do narrador reativo (quick-match-revolution.md §6).
 * Roda: `npm run test:quick-narrator`
 */

import {
  reactToGoal,
  reactToRed,
  reactToDecision,
  reactToNearMiss,
  type NarratorMemory,
} from './quickNarrator';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const pick0 = () => 0; // determinístico: sempre a 1ª frase

console.log('\n▶ Quick Narrator Self-Test\n');

// Gol nosso sempre exalta, com punch GOOOL.
const g1 = reactToGoal('home', { minute: 30, homeScore: 1, awayScore: 0 }, pick0);
check('gol nosso → exalta + punch GOOOL', g1.tone === 'exalta' && g1.punch === 'GOOOL', g1.text);

// Gol sofrido tarde que tira a frente → frieza.
const g2 = reactToGoal('away', { minute: 80, homeScore: 1, awayScore: 1 }, pick0);
check('gol sofrido tarde no empate → frieza', g2.tone === 'frieza', `${g2.tone} :: ${g2.text}`);

// Gol sofrido cedo → cutuca (não frieza).
const g3 = reactToGoal('away', { minute: 20, homeScore: 2, awayScore: 1 }, pick0);
check('gol sofrido cedo com vantagem → cutuca', g3.tone === 'cutuca', `${g3.tone} :: ${g3.text}`);

// Vermelho nosso = frieza; deles = exalta.
check('vermelho nosso → frieza', reactToRed('home', pick0).tone === 'frieza');
check('vermelho deles → exalta', reactToRed('away', pick0).tone === 'exalta');

// Decisão certa → exalta.
const mem: NarratorMemory = {};
const d1 = reactToDecision({ momentType: 'set_piece', success: true, memory: mem }, pick0);
check('decisão certa → exalta', d1.tone === 'exalta', d1.text);

// 1º erro → cutuca normal; 2º erro do MESMO tipo → memória ("de novo").
const d2 = reactToDecision({ momentType: 'counter_attack', success: false, memory: mem }, pick0);
const d3 = reactToDecision({ momentType: 'counter_attack', success: false, memory: mem }, pick0);
check('1º erro → cutuca', d2.tone === 'cutuca', d2.text);
check('2º erro mesmo tipo → linha de memória', d3.text.toLowerCase().includes('de novo'), d3.text);
check('memória contou 2 erros de contra-ataque', mem.counter_attack === 2, JSON.stringify(mem));

// Quase-gol: nosso = tensão, contra = alívio.
check('quase-gol nosso → tensão', reactToNearMiss('home', pick0).tone === 'tensao');
check('quase-gol contra → alívio', reactToNearMiss('away', pick0).tone === 'alivio');

// Nenhuma linha vazia.
const allLines = [g1, g2, g3, d1, d2, d3].map((l) => l.text);
check('nenhuma frase vazia', allLines.every((t) => t.length >= 4), allLines.join(' | '));

if (failures > 0) {
  console.log(`\n✗ quick narrator self-test FALHOU (${failures})\n`);
  process.exit(1);
}
console.log('\n▶ quick narrator self-test OK — narrador reativo (exalta/cutuca/frieza + memória)\n');
