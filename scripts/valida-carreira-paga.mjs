/**
 * A graduação conta o que foi PAGO. `npm run test:carreira-paga`
 *
 * Regra do fundador (2026-09-29). O que este arquivo prova é o caso que a
 * regra antiga errava: quando entra volume grande de um lado só, a perna MENOR
 * troca de lado. Lendo "a menor agora", o degrau passaria a olhar outro número
 * e poderia cair. Somando o pago, ele só sobe.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec(`create schema if not exists auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 do $$ begin create role anon; exception when duplicate_object then null; end $$;
 do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
 do $$ begin create role service_role; exception when duplicate_object then null; end $$;`);
await db.exec(readFileSync('supabase/migrations/20260928140000_expansao_arvore_e_ciclo.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20260929180000_carreira_por_equiparado_pago.sql','utf8'));

const T=[]; const t=async(n,f)=>{try{T.push([n,await f()])}catch(e){T.push([n,false,e.message])}};
const u=(await db.query(`insert into auth.users (email) values ('a@t') returning id`)).rows[0].id;
await db.query(`select public.expansao_inserir($1,null,null,null)`,[u]);
const car=async()=>(await db.query(`select * from public.expansao_carreira($1)`,[u])).rows[0];
const somar=(q)=>db.query(`select public.expansao_somar_equiparado($1,$2)`,[u,q]);

await t('começa sem graduação', async()=>{const c=await car(); return c.degrau===null && String(c.equiparado_acumulado)==='0';});
await t('ciclo 1 (T1=1000 T2=500) soma 500', async()=>{await somar(500); return String((await car()).equiparado_acumulado)==='500';});
await t('🔑 ciclo 2, com a menor TROCANDO de lado, soma 1000 → 1500',
  async()=>{await somar(1000); return String((await car()).equiparado_acumulado)==='1500';});
await t('10k vira CAMPEAO', async()=>{await somar(8500); return (await car()).degrau==='CAMPEAO';});
await t('e diz o que falta pro próximo', async()=>{const c=await car();
  return c.proximo==='DUPLO_CAMPEAO' && String(c.falta)==='40000';});
await t('🔑 somar zero não muda nada', async()=>{await somar(0); return (await car()).degrau==='CAMPEAO';});
await t('🔒 somar negativo estoura', async()=>{try{await somar(-1); return false;}catch{return true;}});
await t('🔒 quem não está na árvore estoura', async()=>{
  try{ await db.query(`select public.expansao_somar_equiparado('00000000-0000-0000-0000-000000000009',1)`); return false;}catch{return true;}});
await t('🔒 somar não é executável por authenticated', async()=>
  (await db.query(`select has_function_privilege('authenticated','public.expansao_somar_equiparado(uuid,numeric)','execute') p`)).rows[0].p===false);
await t('a carreira É legível por authenticated', async()=>
  (await db.query(`select has_function_privilege('authenticated','public.expansao_carreira(uuid)','execute') p`)).rows[0].p===true);
await t('PENTA no teto, sem próximo', async()=>{await somar(500000); const c=await car();
  return c.degrau==='PENTA' && c.proximo===null && String(c.falta)==='0';});
await t('🔑 monotônico: o degrau nunca cai em 30 somas', async()=>{
  const ordem=[null,'CAMPEAO','DUPLO_CAMPEAO','TRI_CAMPEAO','TETRA','PENTA'];
  const v=(await db.query(`insert into auth.users (email) values ('b@t') returning id`)).rows[0].id;
  await db.query(`select public.expansao_inserir($1,null,null,null)`,[v]);
  let ult=-1;
  for (let i=0;i<30;i++){
    await db.query(`select public.expansao_somar_equiparado($1,$2)`,[v, i*1700]);
    const d=(await db.query(`select degrau from public.expansao_carreira($1)`,[v])).rows[0].degrau;
    const idx=ordem.indexOf(d); if (idx<ult) return false; ult=idx;
  }
  return true;});

let f=0; for(const [n,ok,e] of T){console.log(`  ${ok?'✅':'❌'} ${n}${e?' — '+e:''}`); if(!ok)f++;}
console.log(`\n${f===0?'🟢':'🔴'} ${T.length-f} passaram, ${f} falharam`); process.exit(f===0?0:1);
