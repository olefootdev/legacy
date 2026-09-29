/**
 * Valida a migration do bônus de equiparação num Postgres DESCARTÁVEL.
 *   npm run test:expansao-migration
 *
 * O valor não está em provar que o DDL aplica — está em provar que as REGRAS
 * valem no banco: que o crédito sobe a perna de todos os ancestrais e não
 * credita na própria pessoa, que campanha entra só num trilho, que compra na
 * DEX não entra em nenhum, que a ativação exige 1 indicado em cada perna, e
 * que o mapa não vaza quem não é da sua rede.
 *
 * PGlite roda um Postgres real em memória; o schema auth e os roles do
 * Supabase entram como stub.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const ARQ = process.argv[2] ?? 'supabase/migrations/20260928140000_expansao_arvore_e_ciclo.sql';
const db = new PGlite();
await db.exec(`create schema if not exists auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text);
 create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 do $$ begin create role anon; exception when duplicate_object then null; end $$;
 do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
 do $$ begin create role service_role; exception when duplicate_object then null; end $$;`);
try { await db.exec(readFileSync(ARQ, 'utf8')); console.log('✅ migration aplica'); }
catch (e) { console.log('❌ DDL:', e.message); process.exit(1); }

const U = {};
for (const n of ['A','B','C','D','E','F','G'])
  U[n] = (await db.query(`insert into auth.users (email) values ('${n}@t') returning id`)).rows[0].id;
const T = [];
const t = async (nome, f) => { try { T.push([nome, await f()]); } catch (e) { T.push([nome, false, e.message]); } };
const ins = (u,pat,pai,lado) => db.query(`select public.expansao_inserir($1,$2,$3,$4)`,[U[u],pat?U[pat]:null,pai?U[pai]:null,lado]);
const perna = async (u,lado,trilho) => String((await db.query(
  `select coalesce((select volume from expansao_perna where user_id=$1 and lado=$2 and trilho=$3),0) v`,[U[u],lado,trilho])).rows[0].v);
const mapa = async (u,de,ate) => (await db.query(`select * from public.expansao_mapa($1,$2,$3)`,[U[u],de,ate])).rows;
const ativ = async (u) => (await db.query(`select * from public.expansao_ativacao($1)`,[U[u]])).rows[0];
const priv = async (f,r) => (await db.query(`select has_function_privilege($1,$2,'execute') p`,[r,f])).rows[0].p;

// A(raiz) → B(T1), C(T2). D sob B. E sob C. F indicado por A mas derramado sob
// D. G indicado por D, colocado sob E — atravessa pro T2 de A, e continua
// sendo equipe de A pela cadeia G→D→B→A.
await ins('A',null,null,null); await ins('B','A','A',1); await ins('C','A','A',2);
await ins('D','B','B',1);      await ins('E','C','C',2);
await ins('F','A','D',1);      await ins('G','D','E',2);

await t('caminhos materializados sobem certo', async () => {
  const r = (await db.query(`select posicao_path, patrocinio_path, nivel from expansao_no where user_id=$1`,[U.F])).rows[0];
  return r.nivel === 3 && r.posicao_path.length === 3 && r.patrocinio_path.length === 1; });
await t('🔒 vaga ocupada é recusada', async () => {
  try { await ins('G','A','A',1); return false; } catch { return true; } });

await t('crédito sobe a perna de TODOS os ancestrais', async () => {
  await db.query(`select * from public.expansao_creditar($1,1000,'compra_olefoot','r1')`,[U.D]);
  return await perna('A',1,'equiparacao') === '1000' && await perna('B',1,'equiparacao') === '1000'; });
await t('   e não vaza pra outra perna', async () => await perna('A',2,'equiparacao') === '0');
await t('   ⭐ e NÃO credita na própria pessoa', async () => await perna('D',1,'equiparacao') === '0');
await t('🔴 ref repetido não credita de novo', async () => {
  const r = (await db.query(`select * from public.expansao_creditar($1,1000,'compra_olefoot','r1')`,[U.D])).rows[0];
  return r.creditou === false && r.motivo === 'ref_ja_creditado'; });
await t('🔴 campanha entra SÓ na qualificação', async () => {
  await db.query(`select * from public.expansao_creditar($1,500,'campanha','r2')`,[U.D]);
  return await perna('A',1,'qualificacao') === '1500' && await perna('A',1,'equiparacao') === '1000'; });
await t('🔴 compra na DEX não entra em NENHUM trilho', async () => {
  await db.query(`select * from public.expansao_creditar($1,900,'compra_dex','r3')`,[U.D]);
  return await perna('A',1,'qualificacao') === '1500' && await perna('A',1,'equiparacao') === '1000'; });

await t('🔑 A indicou B(T1) e C(T2) → ATIVO', async () => (await ativ('A')).ativo === true);
await t('🔴 B indicou só no T1 → NÃO ativo, e diz qual falta', async () => {
  const r = await ativ('B'); return r.ativo === false && r.falta_na_perna === 2; });
await t('   indicado derramado fundo ainda conta pra perna', async () => (await ativ('A')).diretos_t1 >= 2);
await t('🔴 quem não indicou ninguém não ativa', async () => (await ativ('F')).ativo === false);

await t('mapa devolve só descendentes, com nível RELATIVO', async () => {
  const m = await mapa('B',1,9);   // B tem 2: D e F
  return m.length === 2 && m[0].nivel === 1 && m[1].nivel === 2; });
await t('🔒 privacidade: quem não é da minha equipe vem marcado', async () => {
  const g = (await mapa('C',1,9)).find(r => r.user_id === U.G);
  return g && g.da_minha_equipe === false; });
await t('🔑 equipe é TRANSITIVA: G é equipe de A (G→D→B→A)', async () => {
  const g = (await mapa('A',1,9)).find(r => r.user_id === U.G);
  return g && g.da_minha_equipe === true; });
await t('perna correta mesmo para quem está fundo', async () => {
  const m = await mapa('A',1,9);
  return m.find(r => r.user_id === U.F).perna === 1 && m.find(r => r.user_id === U.G).perna === 2; });
await t('🔒 mapa de quem não tem rede volta vazio', async () => (await mapa('F',1,9)).length === 0);
await t('janela de profundidade corta', async () => (await mapa('A',1,1)).length === 2);

await t('🔒 expansao_creditar NÃO é executável por authenticated', async () =>
  await priv('public.expansao_creditar(uuid,numeric,text,text)','authenticated') === false);
await t('🔒 expansao_inserir NÃO é executável por anon', async () =>
  await priv('public.expansao_inserir(uuid,uuid,uuid,smallint)','anon') === false);
await t('expansao_mapa É executável por authenticated', async () =>
  await priv('public.expansao_mapa(uuid,integer,integer)','authenticated') === true);
await t('🔒 a árvore não tem policy de select (só se lê pelo mapa)', async () =>
  Number((await db.query(`select count(*) c from pg_policy p join pg_class c on c.oid=p.polrelid where c.relname='expansao_no'`)).rows[0].c) === 0
  && (await db.query(`select relrowsecurity r from pg_class where relname='expansao_no'`)).rows[0].r === true);
await t('🔴 ledger de olexp é append-only', async () => {
  try { await db.exec(`update expansao_olexp set olexp=1`); return false; } catch { return true; } });
await t('numeric(78,0) aguenta 250M com 9 casas', async () => {
  await db.query(`insert into expansao_perna values ($1,1,'equiparacao',250000000000000000)
    on conflict (user_id,lado,trilho) do update set volume=excluded.volume`,[U.G]); return true; });
await t('🔑 ciclo sem pool guarda NULL, não zero', async () => {
  await db.query(`insert into expansao_ciclo (abre_em,fecha_em,status,motivo)
    values (now(),now()+interval '1 hour','HELD','ciclo sem receita elegível')`);
  return (await db.query(`select valor_por_olexp_micro v from expansao_ciclo limit 1`)).rows[0].v === null; });

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
