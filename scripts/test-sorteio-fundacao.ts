/**
 * Teste do sorteio da Fundação do Clube (Fase 2) — a função pura `sortear`
 * do servidor, com um catálogo parecido com o de produção (2026-10-07).
 * Rodar: npm run test:sorteio
 */
import { randomInt } from 'node:crypto';
import { CHANCES_DE_LENDA, pessoaDe, sortear, tierDoRotulo } from '../server/src/routes/onboarding';

let falhas = 0;
const checa = (nome: string, ok: boolean, det = '') => {
  console.log(`${ok ? '  OK  ' : '  FALHA '}${nome}${det ? `  ${det}` : ''}`);
  if (!ok) falhas++;
};

// Catálogo no formato real (pos × raridade como em produção).
const linhas: { pos: string; rarity_label: string; n: number }[] = [
  { pos: 'ATA', rarity_label: 'basic', n: 1 }, { pos: 'ATA', rarity_label: 'gold', n: 3 },
  { pos: 'GOL', rarity_label: 'academy', n: 1 }, { pos: 'GOL', rarity_label: 'basic', n: 3 }, { pos: 'GOL', rarity_label: 'gold', n: 1 }, { pos: 'GOL', rarity_label: 'silver', n: 1 },
  { pos: 'LD', rarity_label: 'basic', n: 2 }, { pos: 'LD', rarity_label: 'gold', n: 1 },
  { pos: 'LE', rarity_label: 'basic', n: 2 }, { pos: 'LE', rarity_label: 'gold', n: 1 },
  { pos: 'MC', rarity_label: 'basic', n: 8 }, { pos: 'MC', rarity_label: 'gold', n: 1 }, { pos: 'MC', rarity_label: 'rare', n: 1 }, { pos: 'MC', rarity_label: 'silver', n: 1 }, { pos: 'MC', rarity_label: 'ultra rare', n: 1 },
  { pos: 'PD', rarity_label: 'basic', n: 3 }, { pos: 'PD', rarity_label: 'gold', n: 1 },
  { pos: 'PE', rarity_label: 'basic', n: 1 }, { pos: 'PE', rarity_label: 'silver', n: 1 },
  { pos: 'VOL', rarity_label: 'basic', n: 3 },
  { pos: 'ZAG', rarity_label: 'basic', n: 3 }, { pos: 'ZAG', rarity_label: 'gold', n: 1 }, { pos: 'ZAG', rarity_label: 'next', n: 1 },
];
const genesis = linhas.flatMap((l) => Array.from({ length: l.n }, (_, i) => ({ id: `${l.pos}-${l.rarity_label}-${i}`, pos: l.pos, rarity_label: l.rarity_label })));
const lendas = Array.from({ length: 23 }, (_, i) => ({ id: `lenda-${i}` }));
const porId = new Map(genesis.map((g) => [g.id, g]));
const grupo = (pos: string) => (pos === 'GOL' ? 'GOL' : ['ZAG', 'LD', 'LE'].includes(pos) ? 'DEF' : ['VOL', 'MC'].includes(pos) ? 'MEI' : 'ATA');

console.log('1) Um sorteio');
const s = sortear(genesis, lendas, (m) => randomInt(m))!;
checa('sai um sorteio', !!s);
checa('12 Genesis + 3 premium', s.genesis.length === 12 && s.premium.length === 3);
const todos = [...s.genesis, ...s.premium.filter((p) => p.tipo === 'premium').map((p) => p.id)];
checa('nenhum jogador repetido', new Set(todos).size === todos.length);
const cont = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 } as Record<string, number>;
for (const id of s.genesis) cont[grupo(porId.get(id)!.pos)]!++;
checa('2 GOL, 4 DEF, 3 MEI, 3 ATA', cont.GOL === 2 && cont.DEF === 4 && cont.MEI === 3 && cont.ATA === 3, JSON.stringify(cont));
checa('os 12 são de base (basic/rare)', s.genesis.every((id) => ['basic', 'rare'].includes(tierDoRotulo(porId.get(id)!.rarity_label))));
checa('premium sem lenda vem do topo (gold/next/ultra)', s.premium.filter((p) => p.tipo === 'premium').every((p) => ['epic', 'legendary'].includes(tierDoRotulo(porId.get(p.id)!.rarity_label))));
checa('chances gravadas 35/25/15', s.premium.map((p) => p.chance).join(',') === CHANCES_DE_LENDA.join(','));

console.log('2) Chances reais (20.000 sorteios)');
const N = 20000;
const lendaPorCard = [0, 0, 0];
let peloMenosUma = 0;
let lendaRepetida = 0;
for (let i = 0; i < N; i++) {
  const x = sortear(genesis, lendas, (m) => randomInt(m))!;
  let alguma = false;
  const ids: string[] = [];
  x.premium.forEach((p, k) => { if (p.tipo === 'lenda') { lendaPorCard[k]!++; alguma = true; ids.push(p.id); } });
  if (new Set(ids).size !== ids.length) lendaRepetida++;
  if (alguma) peloMenosUma++;
}
CHANCES_DE_LENDA.forEach((c, k) => {
  const obs = lendaPorCard[k]! / N;
  checa(`card ${k + 1}: ~${c * 100}% de lenda`, Math.abs(obs - c) < 0.015, `${(obs * 100).toFixed(1)}%`);
});
const esperado = 1 - (1 - 0.35) * (1 - 0.25) * (1 - 0.15);
checa(`pelo menos uma lenda ≈ ${(esperado * 100).toFixed(1)}%`, Math.abs(peloMenosUma / N - esperado) < 0.015, `${((peloMenosUma / N) * 100).toFixed(1)}%`);
checa('nunca a mesma lenda duas vezes no mesmo sorteio', lendaRepetida === 0);

console.log('3) Bordas');
checa('catálogo vazio = sem sorteio', sortear([], lendas, (m) => randomInt(m)) === null);
const semLenda = sortear(genesis, [], (m) => randomInt(m))!;
checa('sem lendas listadas: os 3 premium saem do topo', semLenda.premium.every((p) => p.tipo === 'premium'));

console.log('4) Mesma pessoa não vem duas vezes');
// Catálogo onde cada pessoa existe em 3 raridades (basic/rare/gold) e cada lenda em 3 fases.
const triplo = genesis.map((g, i) => ({ ...g, name: `Pessoa ${Math.floor(i / 3)}` }));
const fases = ['revelacao', 'consolidacao', 'expansao'];
const lendasFases = Array.from({ length: 9 }, (_, i) => ({ id: `legacy-craque${Math.floor(i / 3)}-${fases[i % 3]}` }));
let repetiuPessoa = 0;
for (let i = 0; i < 2000; i++) {
  const x = sortear(triplo, lendasFases, (m) => randomInt(m));
  if (!x) continue;
  const ids = [...x.genesis, ...x.premium.filter((p) => p.tipo === 'premium').map((p) => p.id)];
  const nomes = ids.map((id) => triplo.find((t) => t.id === id)!.name);
  const lend = x.premium.filter((p) => p.tipo === 'lenda').map((p) => pessoaDe({ id: p.id }));
  if (new Set(nomes).size !== nomes.length || new Set(lend).size !== lend.length) repetiuPessoa++;
}
checa('2000 sorteios: nenhuma pessoa repetida (Genesis por nome, lenda por slug)', repetiuPessoa === 0, String(repetiuPessoa));
checa('fases da mesma lenda = mesma pessoa', pessoaDe({ id: 'legacy-cocito-revelacao' }) === pessoaDe({ id: 'legacy-cocito-expansao' }));

console.log();
if (falhas) { console.log(`${falhas} falha(s).`); process.exit(1); }
console.log('Sorteio da Fundação: tudo certo.');
