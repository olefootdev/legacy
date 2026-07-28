/**
 * Guarda da cópia: os pesos de OVR dentro da migration do REVELA têm que ser
 * IDÊNTICOS aos de src/entities/ovrWeights.ts.
 *
 * Por que a cópia existe: a aprovação do OLE SCOUT acontece hoje no SQL Editor,
 * sem passar por TypeScript. Sem os pesos no banco, alguém digita o `overall` na
 * mão — e a vitrine passa a mostrar um número que a carta no jogo não confirma.
 * Essa divergência já aconteceu uma vez (ver PlayerVipLanding.tsx).
 *
 * Este teste não precisa de banco: lê o .sql como texto, extrai o JSON dos pesos
 * e compara com o TS. Se alguém mexer num lado e esquecer o outro, quebra aqui.
 *
 *     npm run test:revela-ovr
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OVR_WEIGHTS_BY_POS, OVR_WEIGHTS_NEUTRAL, type OvrWeights } from '../src/entities/ovrWeights';

const here = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = join(here, '..', 'supabase', 'migrations', '20260723140000_revela_ovr.sql');

const EPS = 1e-9;
let fail = 0;

function bad(msg: string) {
  fail++;
  console.log(`  ❌ ${msg}`);
}

/** Extrai os dois blocos JSON de `revela_ovr_weights`: a tabela e o neutro. */
function parseSqlWeights(sql: string): { table: Record<string, OvrWeights>; neutral: OvrWeights } {
  const body = sql.slice(sql.indexOf('function public.revela_ovr_weights'));
  const blocks = [...body.matchAll(/'(\{[\s\S]*?\})'::jsonb/g)].map((m) => m[1]);
  if (blocks.length < 2) {
    throw new Error(`esperava 2 blocos jsonb em revela_ovr_weights, achei ${blocks.length}`);
  }
  return {
    table: JSON.parse(blocks[0]) as Record<string, OvrWeights>,
    neutral: JSON.parse(blocks[1]) as OvrWeights,
  };
}

function compare(label: string, ts: OvrWeights, sqlW: Record<string, number> | undefined) {
  if (!sqlW) {
    bad(`${label}: existe no TS e não existe no SQL`);
    return;
  }
  const keys = new Set([...Object.keys(ts), ...Object.keys(sqlW)]);
  const diffs: string[] = [];
  for (const k of keys) {
    const a = (ts as Record<string, number>)[k];
    const b = sqlW[k];
    if (a === undefined) diffs.push(`${k}: só no SQL (${b})`);
    else if (b === undefined) diffs.push(`${k}: só no TS (${a})`);
    else if (Math.abs(a - b) > EPS) diffs.push(`${k}: TS ${a} ≠ SQL ${b}`);
  }
  const sum = Object.values(sqlW).reduce((x, y) => x + y, 0);
  if (Math.abs(sum - 1) > EPS) diffs.push(`soma ${sum.toFixed(4)} ≠ 1.0`);

  if (diffs.length) bad(`${label}: ${diffs.join(' · ')}`);
  else console.log(`  ✅ ${label.padEnd(7)} 10 pesos batem · soma=1.0000`);
}

console.log('Paridade de pesos do OVR — TypeScript × migration do REVELA\n');

const { table, neutral } = parseSqlWeights(readFileSync(SQL_PATH, 'utf8'));

for (const [pos, ts] of Object.entries(OVR_WEIGHTS_BY_POS)) compare(pos, ts, table[pos]);
compare('NEUTRO', OVR_WEIGHTS_NEUTRAL, neutral);

// Posição no SQL que não existe no TS é tão ruim quanto o contrário: o banco
// aprovaria um atleta com um perfil que o jogo desconhece.
for (const pos of Object.keys(table)) {
  if (!(pos in OVR_WEIGHTS_BY_POS)) bad(`${pos}: existe no SQL e não existe no TS`);
}

// A UI do REVELA só oferece estas posições. Se uma delas não tiver perfil, o
// atleta cai no neutro sem ninguém perceber.
const UI_POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'];
const semPerfil = UI_POSITIONS.filter((p) => !(p in table));
if (semPerfil.length) bad(`posições do formulário sem perfil no SQL: ${semPerfil.join(', ')}`);
else console.log(`\n  ✅ as ${UI_POSITIONS.length} posições do formulário têm perfil próprio`);

console.log(fail ? `\n❌ ${fail} falha(s)` : '\n✅ tudo certo');
process.exit(fail ? 1 : 0);
