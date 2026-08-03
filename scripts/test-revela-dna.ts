/**
 * Self-test do PLAYER DNA — `npm run test:revela-dna`.
 *
 * O QUE ESTE TESTE EXISTE PRA PROVAR: que a normalização por oportunidade não é
 * detalhe de implementação, é o que faz o arquétipo significar alguma coisa.
 * Construção cabe em 10 dos 13 itens e Disciplina em 4 — na contagem crua,
 * escolher Construção quatro vezes ganharia de escolher Disciplina três, mesmo
 * o segundo atleta tendo dito "disciplina" em 3 de 4 chances contra 4 de 10.
 */
import {
  ITENS_DNA,
  TRACOS,
  oportunidadesPorTraco,
  pontuarDna,
  respondidas,
  type RespostasDna,
  type TracoId,
} from '../revela/src/data/dna';

let falhas = 0;
function ok(nome: string, cond: boolean, detalhe = '') {
  if (cond) {
    console.log(`  ✓ ${nome}`);
  } else {
    falhas += 1;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Escolhe, em cada item, a primeira alternativa que tem o traço pedido. */
function responderPreferindo(prefs: TracoId[]): RespostasDna {
  const r: RespostasDna = {};
  for (const item of ITENS_DNA) {
    let i = -1;
    for (const p of prefs) {
      i = item.alternativas.findIndex((a) => a.traco === p);
      if (i >= 0) break;
    }
    r[item.id] = i >= 0 ? i : 0;
  }
  return r;
}

console.log('\nPLAYER DNA\n');

/* ── Integridade do banco de itens ──────────────────────────────────────── */
ok('13 itens', ITENS_DNA.length === 13, `são ${ITENS_DNA.length}`);
ok(
  'todo item tem 4 alternativas',
  ITENS_DNA.every((i) => i.alternativas.length === 4),
);
ok('nenhum id repetido', new Set(ITENS_DNA.map((i) => i.id)).size === ITENS_DNA.length);
ok(
  'todo traço aparece em pelo menos 3 itens',
  TRACOS.every((t) => oportunidadesPorTraco()[t.id] >= 3),
  JSON.stringify(oportunidadesPorTraco()),
);

/* ── A armadilha da contagem crua ───────────────────────────────────────── */
const oport = oportunidadesPorTraco();
console.log(`\n  oportunidades: ${TRACOS.map((t) => `${t.nome} ${oport[t.id]}`).join(' · ')}\n`);

// Um atleta que prefere Disciplina sempre que ela existe, e Adaptação no resto.
const metodico = pontuarDna(responderPreferindo(['disciplina', 'adaptacao']));
const cruDisciplina = ITENS_DNA.filter((i) => {
  const alt = i.alternativas[responderPreferindo(['disciplina', 'adaptacao'])[i.id]];
  return alt?.traco === 'disciplina';
}).length;
const cruAdaptacao = ITENS_DNA.filter((i) => {
  const alt = i.alternativas[responderPreferindo(['disciplina', 'adaptacao'])[i.id]];
  return alt?.traco === 'adaptacao';
}).length;

ok(
  'na contagem crua, Adaptação ganharia de Disciplina',
  cruAdaptacao > cruDisciplina,
  `disciplina ${cruDisciplina} × adaptação ${cruAdaptacao}`,
);
ok(
  'normalizado, Disciplina fica no topo',
  metodico.ordem[0] === 'disciplina',
  `topo = ${metodico.ordem[0]} (${metodico.tracos.disciplina} × ${metodico.tracos.adaptacao})`,
);
ok('e o arquétipo reflete isso', metodico.arquetipo.startsWith('Incansável'), metodico.arquetipo);

/* ── Determinismo ───────────────────────────────────────────────────────── */
const r = responderPreferindo(['construcao', 'lideranca']);
const a = pontuarDna(r);
const b = pontuarDna({ ...r });
ok('mesmo conjunto de respostas → mesmo arquétipo', a.arquetipo === b.arquetipo, a.arquetipo);

/* ── Ficha incompleta não quebra ────────────────────────────────────────── */
const parcial = pontuarDna({ a1: 0, a2: 3 });
ok('responder só 2 itens não estoura', Number.isFinite(parcial.tracos.lideranca));
ok('e a contagem de respondidas confere', respondidas({ a1: 0, a2: 3 }) === 2);
ok('índice fora da faixa é ignorado', respondidas({ a1: 99 }) === 1 && pontuarDna({ a1: 99 }).tracos.lideranca === 0);

/* ── Toda combinação de topo gera um nome legível ───────────────────────── */
const nomes = new Set<string>();
for (const p of TRACOS) {
  for (const s of TRACOS) {
    if (p.id === s.id) continue;
    nomes.add(`${p.substantivo} ${s.adjetivo}`);
  }
}
ok('42 arquétipos possíveis, nenhum repetido', nomes.size === 42, `são ${nomes.size}`);

/* ── Amostra pra leitura humana ─────────────────────────────────────────── */
console.log('\n  amostras:');
for (const prefs of [
  ['lideranca', 'construcao'],
  ['estrategia', 'decisao'],
  ['competitividade', 'adaptacao'],
] as TracoId[][]) {
  const res = pontuarDna(responderPreferindo(prefs));
  console.log(`    ${prefs.join('+').padEnd(28)} → ${res.arquetipo}`);
}

console.log(falhas === 0 ? '\n✅ DNA ok\n' : `\n❌ ${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
