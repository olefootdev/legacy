/**
 * Valida a ativação da casa. `npm run test:ativacao-casa`
 *
 * O que precisa ficar provado: que ativar uma conta sem pagamento NÃO cria
 * linha em presale_purchase e NÃO infla a receita. O pool do bônus é 25% da
 * receita — dinheiro inventado ali sai do bolso de quem equipara de verdade.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec(`create schema if not exists auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text);
 create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 create table public.presale_purchase (id uuid primary key default gen_random_uuid(),
   user_id uuid, usd_cents integer, status text);
 do $$ begin create role anon; exception when duplicate_object then null; end $$;
 do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
 do $$ begin create role service_role; exception when duplicate_object then null; end $$;`);
await db.exec(readFileSync('supabase/migrations/20260929160000_expansao_ativacao_casa.sql','utf8'));

const T=[]; const t=async(n,f)=>{try{T.push([n,await f()])}catch(e){T.push([n,false,e.message])}};
const u = async () => (await db.query(`insert into auth.users (email) values (gen_random_uuid()||'@t') returning id`)).rows[0].id;
const pode = async (id) => (await db.query(`select public.expansao_pode_convidar($1) p`,[id])).rows[0].p;
const a = await u(), b = await u(), c = await u();

await t('sem nada, não pode convidar', async()=> await pode(a) === false);
await db.query(`insert into public.presale_purchase (user_id,usd_cents,status) values ($1,1000,'pago')`,[b]);
await t('com pack de $10 pago, pode', async()=> await pode(b) === true);
await t('🔒 pack abaixo de $10 não ativa', async()=>{
  const d = await u();
  await db.query(`insert into public.presale_purchase (user_id,usd_cents,status) values ($1,500,'pago')`,[d]);
  return await pode(d) === false; });
await t('🔒 pack pendente não ativa', async()=>{
  const d = await u();
  await db.query(`insert into public.presale_purchase (user_id,usd_cents,status) values ($1,5000,'pendente')`,[d]);
  return await pode(d) === false; });

await db.query(`insert into public.expansao_ativacao_casa (user_id,motivo,ativado_por)
  values ($1,'conta-selo da origem','fundador')`,[c]);
await t('🏠 ativada pela casa, pode convidar', async()=> await pode(c) === true);
await t('🔴 e NÃO deixou compra fantasma', async()=>
  Number((await db.query(`select count(*) c from public.presale_purchase where user_id=$1`,[c])).rows[0].c) === 0);
// 🐞 Esta asserção já nasceu errada uma vez: eu fixei a receita em 1000 e
// depois acrescentei um pack de $500 num teste acima, sem voltar aqui. O certo
// é afirmar o que o teste realmente quer dizer — que a conta ativada pela casa
// não somou NADA — em vez de cravar um total que qualquer teste novo quebra.
await t('🔴 a RECEITA não foi inflada — a conta da casa somou zero', async()=>{
  const daCasa = Number((await db.query(
    `select coalesce(sum(usd_cents),0) s from public.presale_purchase where user_id=$1`,[c])).rows[0].s);
  const total = Number((await db.query(
    `select coalesce(sum(usd_cents),0) s from public.presale_purchase where status='pago'`)).rows[0].s);
  const reais = Number((await db.query(
    `select coalesce(sum(usd_cents),0) s from public.presale_purchase
      where status='pago' and user_id <> $1`,[c])).rows[0].s);
  return daCasa === 0 && total === reais; });
await t('🏠 a ativação registra motivo e quem ativou', async()=>{
  const r = (await db.query(`select motivo, ativado_por, ativado_em from public.expansao_ativacao_casa where user_id=$1`,[c])).rows[0];
  return !!r.motivo && !!r.ativado_por && !!r.ativado_em; });
await t('a ativação da casa é PÚBLICA (esconder seria a parte errada)', async()=>
  Number((await db.query(`select count(*) c from pg_policy p join pg_class k on k.oid=p.polrelid
    where k.relname='expansao_ativacao_casa'`)).rows[0].c) > 0);

let f=0; for(const [n,ok,e] of T){console.log(`  ${ok?'✅':'❌'} ${n}${e?' — '+e:''}`); if(!ok)f++;}
console.log(`\n${f===0?'🟢':'🔴'} ${T.length-f} passaram, ${f} falharam`); process.exit(f===0?0:1);
