/**
 * Valida o convite de expansão com ativação e confirmação.
 *   npm run test:convite-expansao
 *
 * O que precisa ficar provado: que sem pack de $10 pago o convite NÃO vale,
 * que ninguém entra na árvore sem dizer sim, e que o cadastro deixou de
 * inserir no binário sozinho.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`create schema if not exists auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 -- 🐞 precisa existir ANTES das migrations: as policies RLS resolvem auth.uid()
 -- na criação, não em tempo de execução.
 create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 create table public.profiles (id uuid primary key, username text unique, display_name text,
   club_name text, club_short text, onboarding_data jsonb, referred_by_code text,
   my_referral_code text, updated_at timestamptz default now());
 create table public.manager_friendships (requester_id uuid, addressee_id uuid,
   requester_club_name text, addressee_club_name text, status text, responded_at timestamptz,
   updated_at timestamptz, primary key (requester_id, addressee_id));
 create table public.presale_purchase (id uuid primary key default gen_random_uuid(),
   user_id uuid, usd_cents integer, status text);
 create table public.expansao_pendente (user_id uuid primary key, patrocinador_id uuid,
   codigo text, motivo text, criado_em timestamptz default now(), resolvido_em timestamptz);
 do $$ begin create role anon; exception when duplicate_object then null; end $$;
 do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
 do $$ begin create role service_role; exception when duplicate_object then null; end $$;`);
try {
await db.exec(readFileSync('supabase/migrations/20260928140000_expansao_arvore_e_ciclo.sql','utf8'));
const ponte = readFileSync('supabase/migrations/20260929120000_expansao_ponte_cadastro.sql','utf8');
await db.exec(ponte.slice(0, ponte.indexOf('-- ─── o gancho no cadastro')));
await db.exec(readFileSync('supabase/migrations/20260929140000_expansao_convite_confirmado.sql','utf8'));
} catch (e) { console.log('❌ DDL:', e.message); process.exit(1); }
console.log('✅ migrations aplicam em sequência');

const U = {};
const cria = async (nome) => {
  const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [nome+'@t'])).rows[0].id;
  await db.query(`insert into public.profiles (id, username, display_name) values ($1,$2,$2)`, [id, nome]);
  U[nome] = id; return id;
};
// auth.uid() passa a devolver quem a gente "loga"
const loga = (id) => db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select ${id ? `'${id}'::uuid` : 'null::uuid'} $$;`);
const confirmar = async (quem, deQuem) => { await loga(U[quem]);
  return (await db.query(`select * from public.expansao_confirmar_convite($1)`, [deQuem])).rows[0]; };
const pagar = (nome, cents=1000) => db.query(
  `insert into public.presale_purchase (user_id, usd_cents, status) values ($1,$2,'pago')`, [U[nome], cents]);

const T=[]; const t=async(n,f)=>{try{T.push([n,await f()])}catch(e){T.push([n,false,e.message])}};

for (const n of ['raiz','ana','bruno','carla','dudu']) await cria(n);
await db.query(`select public.expansao_inserir($1,null,null,null)`, [U.raiz]);

await t('🔴 sem pack pago, o convite NÃO vale', async () => {
  const r = await confirmar('ana','raiz'); return r.entrou === false && r.motivo === 'convite_nao_ativado'; });
await t('   e a tela do convite já avisa antes do clique', async () => {
  const r = (await db.query(`select * from public.expansao_convite_de('raiz')`)).rows[0];
  return r.existe === true && r.pode_convidar === false; });

await pagar('raiz');
await t('🔑 com pack de $10 pago, o convite vale', async () => {
  const r = (await db.query(`select * from public.expansao_convite_de('raiz')`)).rows[0];
  return r.pode_convidar === true; });
await t('🔑 e a confirmação coloca na árvore', async () => {
  const r = await confirmar('ana','raiz');
  return r.entrou === true && r.patrocinador === 'raiz'; });
await t('   o sim fica registrado, com nome e data', async () => {
  const r = (await db.query(`select * from public.expansao_confirmacao where user_id=$1`,[U.ana])).rows[0];
  return r && r.username_convite === 'raiz' && r.confirmado_em != null; });

await t('🔒 confirmar duas vezes não move ninguém', async () => {
  const r = await confirmar('ana','raiz'); return r.entrou === false && r.motivo === 'ja_esta_na_expansao'; });
await t('🔒 auto-convite barrado', async () => {
  await pagar('bruno'); const r = await confirmar('bruno','bruno');
  return r.entrou === false && r.motivo === 'auto_convite'; });
await t('🔒 username que não existe barrado', async () => {
  const r = await confirmar('carla','ninguem_aqui'); return r.entrou === false && r.motivo === 'convite_inexistente'; });
await t('🔒 patrocinador ativado mas fora da árvore barrado', async () => {
  const r = await confirmar('carla','bruno');  // bruno pagou mas nunca entrou
  return r.entrou === false && r.motivo === 'patrocinador_fora_da_arvore'; });
await t('🔒 sem sessão, estoura em vez de adivinhar', async () => {
  await loga(null);
  try { await db.query(`select * from public.expansao_confirmar_convite('raiz')`); return false; }
  catch { return true; } });

// 🔴 o cadastro NÃO pode mais inserir na árvore sozinho
await t('🔴 save_onboarding_profile NÃO insere mais no binário', async () => {
  await loga(U.dudu);
  await db.query(`update public.profiles set my_referral_code='ABC12345' where id=$1`, [U.raiz]);
  await db.query(`select public.save_onboarding_profile('D','Clube D','DDD','{}'::jsonb,'ABC12345')`);
  const n = (await db.query(`select count(*) c from public.expansao_no where user_id=$1`,[U.dudu])).rows[0].c;
  return Number(n) === 0; });
await t('   mas o perfil e a indicação do JOGO continuam gravando', async () => {
  const p = (await db.query(`select referred_by_code, club_name from public.profiles where id=$1`,[U.dudu])).rows[0];
  return p.referred_by_code === 'ABC12345' && p.club_name === 'Clube D'; });

const priv = async (f,r) => (await db.query(`select has_function_privilege($1,$2,'execute') p`,[r,f])).rows[0].p;
await t('🔒 confirmar_convite é executável por authenticated (é o próprio ato)', async () =>
  await priv('public.expansao_confirmar_convite(text)','authenticated') === true);
await t('🔒 mas NÃO por anon', async () =>
  await priv('public.expansao_confirmar_convite(text)','anon') === false);
await t('a tela do convite é legível por anon (ainda não logou)', async () =>
  await priv('public.expansao_convite_de(text)','anon') === true);

let f=0; for(const [n,ok,e] of T){console.log(`  ${ok?'✅':'❌'} ${n}${e?' — '+e:''}`); if(!ok)f++;}
console.log(`\n${f===0?'🟢':'🔴'} ${T.length-f} passaram, ${f} falharam`); process.exit(f===0?0:1);
