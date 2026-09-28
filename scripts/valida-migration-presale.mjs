/**
 * Valida a migration da pré-venda num Postgres DESCARTÁVEL antes de prod.
 *   npm run test:presale-migration
 *
 * Por que existe: o projeto já foi mordido por migration que dava "Success" e
 * não fazia o que dizia (ver docs/ e a nota de disciplina de migration). DDL que
 * compila não é DDL que funciona — então aqui não se testa só se aplica, se
 * testa se as TRAVAS RECUSAM dado ruim: ref repetido, bruto menor que líquido,
 * liberado maior que a posição, UPDATE e DELETE no ledger append-only.
 *
 * PGlite roda um Postgres real em memória. O que ele não tem (schema auth,
 * auth.uid(), os roles do Supabase) entra como stub aqui em cima.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
// Stubs do que o Supabase dá e o PGlite não tem.
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  do $$ begin
    create role anon; exception when duplicate_object then null; end $$;
  do $$ begin
    create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin
    create role service_role; exception when duplicate_object then null; end $$;
`);
const arquivo = process.argv[2] ?? 'supabase/migrations/20260928120000_presale_packs_e_travas.sql';
const sql = readFileSync(arquivo, 'utf8');
try {
  await db.exec(sql);
  console.log('✅ migration aplica sem erro');
} catch (e) {
  console.log('❌ ERRO:', e.message);
  process.exit(1);
}
// Prova que as travas funcionam de verdade, não só que o DDL passou.
const u = (await db.query(`insert into auth.users (email) values ('t@t') returning id`)).rows[0].id;
const testes = [];
const t = async (nome, sql, deveFalhar = true) => {
  try { await db.exec(sql); testes.push([nome, !deveFalhar]); }
  catch { testes.push([nome, deveFalhar]); }
};
await t('numeric(78,0) aguenta 250M tokens com 9 casas',
  `insert into public.presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro, tokens_entregues, tokens_brutos)
   values ('${u}','r1',3125000,16937500,5420000,250000000000000000,263157894736842106)`, false);
await t('🔴 mesmo ref recusado (webhook reentregue)',
  `insert into public.presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro, tokens_entregues, tokens_brutos)
   values ('${u}','r1',1000,5420,5420000,80000000000000,84210526315790)`);
await t('🔴 bruto menor que entregue recusado',
  `insert into public.presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro, tokens_entregues, tokens_brutos)
   values ('${u}','r2',1000,5420,5420000,80000000000000,1)`);
await t('posição válida entra',
  `insert into public.presale_position (user_id, compra_original_usd_cents, tokens_totais)
   values ('${u}',100000,8000000000000000)`, false);
await t('🔴 liberado maior que a posição recusado',
  `update public.presale_position set liberado_por_compra = 9000000000000000 where user_id='${u}'`);
await t('liberação dentro do teto passa',
  `update public.presale_position set liberado_por_compra = 6800000000000000 where user_id='${u}'`, false);
await t('unlock entra',
  `insert into public.presale_unlock (user_id, porta, ref, tokens, limitado_por)
   values ('${u}','compra','r1',2000000000000000,'razao_usd')`, false);
await t('🔴 mesma compra destrava uma vez só',
  `insert into public.presale_unlock (user_id, porta, ref, tokens) values ('${u}','compra','r1',1)`);
await t('🔴 ledger é append-only: UPDATE recusado',
  `update public.presale_unlock set tokens = 1 where ref='r1'`);
await t('🔴 ledger é append-only: DELETE recusado',
  `delete from public.presale_unlock where ref='r1'`);
await t('tokens zero ou negativo recusado',
  `insert into public.presale_unlock (user_id, porta, tokens) values ('${u}','tempo',0)`);
const restam = (await db.query(`select public.presale_restam(250000000000000000::numeric) as r`)).rows[0].r;
testes.push(['presale_restam devolve a alocação inteira com 0 vendido', String(restam) === '250000000000000000']);
await db.exec(`update public.presale_config set tokens_vendidos = 250000000000000000 where id`);
const zero = (await db.query(`select public.presale_restam(250000000000000000::numeric) as r`)).rows[0].r;
testes.push(['e zero quando tudo vendido', String(zero) === '0']);
await db.exec(`update public.presale_config set tokens_vendidos = 300000000000000000 where id`);
const neg = (await db.query(`select public.presale_restam(250000000000000000::numeric) as r`)).rows[0].r;
testes.push(['nunca devolve negativo', String(neg) === '0']);
let f = 0;
for (const [n, ok] of testes) { console.log(`  ${ok ? '✅' : '❌'} ${n}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${testes.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
