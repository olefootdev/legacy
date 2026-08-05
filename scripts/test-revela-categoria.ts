/**
 * Guarda da cópia: CATEGORIA × IDADE — `npm run test:revela-categoria`
 *
 * A regra existe em dois lugares e PRECISA existir nos dois:
 *
 *   • `revela/src/data/categoria.ts`  → esconde a opção impossível no formulário
 *   • `revela_rating_inicial` (SQL)   → teto de base, aplicado sempre
 *
 * A primeira sozinha não protege nada (validação de formulário é sugestão) e a
 * segunda sozinha frustra sem explicar. Se os dois lados divergirem, o atleta
 * escolhe uma categoria que a tela aceita e recebe um rating que ela não
 * explica — o pior dos dois mundos.
 *
 * Este teste não precisa de banco: lê o .sql como texto, extrai os números do
 * teto e compara com o TS. Mesmo modelo de `npm run test:revela-ovr`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  categoriaCabeNaIdade,
  categoriasPara,
  tetoDeBasePorIdade,
} from '../revela/src/data/categoria';

const aqui = dirname(fileURLToPath(import.meta.url));
const SQL = join(aqui, '..', 'supabase', 'migrations', '20260807100000_revela_teto_por_idade.sql');

let falhas = 0;
function ok(nome: string, cond: boolean, detalhe = '') {
  if (cond) console.log(`  ✓ ${nome}`);
  else {
    falhas += 1;
    console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

console.log('\nCATEGORIA × IDADE\n');

/* ── O caso que motivou tudo ─────────────────────────────────────────────── */
ok('14 anos NÃO pode se declarar profissional', !categoriaCabeNaIdade('profissional', 14));
ok('16 anos pode (contrato profissional existe)', categoriaCabeNaIdade('profissional', 16));
ok('27 anos NÃO pode se declarar sub-15', !categoriaCabeNaIdade('sub15', 27));
ok('15 anos pode sub-15 e sub-20', categoriaCabeNaIdade('sub15', 15) && categoriaCabeNaIdade('sub20', 15));
ok('20 anos NÃO pode sub-15', !categoriaCabeNaIdade('sub15', 20));
ok('amador vale pra 14 e pra 40', categoriaCabeNaIdade('amador', 14) && categoriaCabeNaIdade('amador', 40));
ok('legend exige idade de ex-atleta', !categoriaCabeNaIdade('legend', 19) && categoriaCabeNaIdade('legend', 38));

/* ── Sem idade, nada é barrado ───────────────────────────────────────────── */
ok(
  'sem ano de nascimento, todas as categorias aparecem',
  categoriasPara(null).length === 5,
  `vieram ${categoriasPara(null).length}`,
);
ok('idade absurda não deixa a lista vazia', categoriasPara(1).length > 0);

/* ── A lista some as impossíveis, mas nunca fica vazia ───────────────────── */
const de14 = categoriasPara(14).map((c) => c.code);
ok('lista de 14 anos não tem profissional', !de14.includes('profissional'), de14.join(','));
ok('lista de 14 anos tem sub15 e sub20', de14.includes('sub15') && de14.includes('sub20'));

/* ── O TETO: os dois lados têm que bater ─────────────────────────────────── */
const sql = readFileSync(SQL, 'utf8');
const bloco = sql.slice(sql.indexOf('nivel := least(nivel, case'), sql.indexOf('end);', sql.indexOf('nivel := least(nivel, case')));
const doSql = [...bloco.matchAll(/when idade <= (\d+) then (\d+)/g)].map((m) => ({
  ate: Number(m[1]),
  teto: Number(m[2]),
}));

ok('o SQL declara 3 faixas de teto', doSql.length === 3, JSON.stringify(doSql));

for (const faixa of doSql) {
  const noTs = tetoDeBasePorIdade(faixa.ate);
  ok(
    `até ${faixa.ate} anos: SQL ${faixa.teto} = TS ${noTs}`,
    noTs === faixa.teto,
    `divergiram — um dos dois lados mudou sozinho`,
  );
}

ok('18 anos não tem teto nos dois lados', tetoDeBasePorIdade(18) === null && !doSql.some((f) => f.ate >= 18));
ok('sem idade não tem teto', tetoDeBasePorIdade(null) === null);

console.log(falhas === 0 ? '\n✅ categoria × idade ok\n' : `\n❌ ${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
