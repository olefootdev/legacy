/**
 * Prova que a busca em largura do SQL dá EXATAMENTE a mesma vaga que o motor
 * em TS. `npm run test:bfs-paridade`
 *
 * Por que existe: o cadastro fala direto com o Supabase, sem passar pelo Hono,
 * então o `vagaNaPerna` precisou existir dos dois lados. Duas implementações
 * da mesma regra divergem em silêncio — e aqui divergir significa colocar a
 * pessoa embaixo de outro patrocinador. Este arquivo é o que impede isso.
 *
 * 🐞 Já pegou uma divergência real: ordenar por (nivel, y_ordem) não é busca
 * em largura, porque y_ordem é a ordem GLOBAL de chegada. A ordem certa é pelo
 * CAMINHO de lados desde a raiz da perna.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { arvoreVazia, inserirRaiz, inserir, vagaNaPerna, type Arvore, type Lado }
  from '../server/src/lib/expansao/arvore.js';

const db = new PGlite();
await db.exec(`create schema if not exists auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
 create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
 do $$ begin create role anon; exception when duplicate_object then null; end $$;
 do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
 do $$ begin create role service_role; exception when duplicate_object then null; end $$;`);
await db.exec(readFileSync('supabase/migrations/20260928140000_expansao_arvore_e_ciclo.sql', 'utf8'));
const ponte = readFileSync('supabase/migrations/20260929120000_expansao_ponte_cadastro.sql', 'utf8');
await db.exec(ponte.slice(0, ponte.indexOf('-- ─── o gancho no cadastro')));

const ID: Record<string, string> = {};
const uid = async (n: string) => (ID[n] ??= (await db.query<{ id: string }>(
  `insert into auth.users (email) values ($1) returning id`, [n + '@t'])).rows[0]!.id);

const N = 120;
let semente = 12345;
const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;

let a: Arvore = inserirRaiz(arvoreVazia(), 'n0');
await uid('n0');
await db.query(`select public.expansao_inserir($1,null,null,null)`, [ID['n0']]);

let iguais = 0; const divergiu: string[] = []; const nomes = ['n0'];
for (let i = 1; i <= N; i++) {
  const nome = 'n' + i;
  const pat = nomes[Math.floor(rnd() * nomes.length)]!;
  const lado: Lado = rnd() < 0.5 ? 1 : 2;
  const ts = vagaNaPerna(a, pat, lado);
  await uid(nome);
  const sql = (await db.query<{ pai_id: string; lado: number }>(
    `select * from public.expansao_vaga_na_perna($1,$2::smallint)`, [ID[pat], lado])).rows[0]!;
  if (ID[ts.paiId] === sql.pai_id && ts.lado === sql.lado) iguais++;
  else divergiu.push(`#${i} pat=${pat} lado=${lado}: TS→(${ts.paiId},${ts.lado}) SQL→(${Object.keys(ID).find(k => ID[k] === sql.pai_id)},${sql.lado})`);
  a = inserir(a, nome, pat, lado);
  await db.query(`select public.expansao_inserir($1,$2,$3,$4::smallint)`, [ID[nome], ID[pat], ID[ts.paiId], ts.lado]);
  nomes.push(nome);
}

const T: Array<[string, boolean]> = [[`BFS idêntico em ${N} inserções sorteadas`, iguais === N]];
for (const d of divergiu.slice(0, 5)) console.log('     ' + d);

// A perna alvo tem DOIS critérios, nesta ordem. Testados num patrocinador
// limpo, porque na árvore aleatória o n0 já tem diretos demais.
const limpo = await uid('limpo');
await db.query(`select * from public.expansao_entrar($1,$2)`, [limpo, ID['n0']]);
const alvoDe = async (u: string) =>
  (await db.query<{ p: number }>(`select public.expansao_perna_alvo($1) p`, [u])).rows[0]!.p;

T.push(['🔑 patrocinador novo: 1º indicado vai pro Time 1', await alvoDe(limpo) === 1]);
const d1 = await uid('d1');
await db.query(`select * from public.expansao_entrar($1,$2)`, [d1, limpo]);
T.push(['🔑 com 1 no T1, o próximo vai pro Time 2 (é o que ATIVA)', await alvoDe(limpo) === 2]);
const d2 = await uid('d2');
await db.query(`select * from public.expansao_entrar($1,$2)`, [d2, limpo]);
T.push(['   e o patrocinador fica ATIVO',
  (await db.query<{ a: boolean }>(`select ativo a from public.expansao_ativacao($1)`, [limpo])).rows[0]!.a === true]);
T.push(['empatado em diretos, alterna de volta pro Time 1', await alvoDe(limpo) === 1]);

// Empate em diretos → desempata pelo VOLUME menor.
await db.query(`insert into expansao_perna values ($1,1,'qualificacao',5000),($1,2,'qualificacao',900)
  on conflict (user_id,lado,trilho) do update set volume=excluded.volume`, [limpo]);
T.push(['empatado em diretos, o volume MENOR desempata', await alvoDe(limpo) === 2]);

await db.query(`update expansao_no set perna_padrao = 1 where user_id = $1`, [limpo]);
T.push(['preferência do patrocinador vence os dois critérios', await alvoDe(limpo) === 1]);

const nv = await uid('novo');
const r1 = (await db.query<{ entrou: boolean; motivo: string }>(`select * from public.expansao_entrar($1,$2)`, [nv, nv])).rows[0]!;
T.push(['🔒 auto-patrocínio barrado', r1.entrou === false && r1.motivo === 'auto_patrocinio']);
const r2 = (await db.query<{ entrou: boolean; motivo: string }>(`select * from public.expansao_entrar($1,$2)`,
  [nv, '00000000-0000-0000-0000-000000000001'])).rows[0]!;
T.push(['🔒 patrocinador fora da árvore barrado', r2.entrou === false && r2.motivo === 'patrocinador_fora_da_arvore']);
T.push(['entrada válida funciona',
  (await db.query<{ entrou: boolean }>(`select * from public.expansao_entrar($1,$2)`, [nv, ID['n0']])).rows[0]!.entrou === true]);
T.push(['🔒 entrar duas vezes barrado',
  (await db.query<{ motivo: string }>(`select * from public.expansao_entrar($1,$2)`, [nv, ID['n0']])).rows[0]!.motivo === 'ja_esta_na_arvore']);
for (const f of ['public.expansao_vaga_na_perna(uuid,smallint)', 'public.expansao_entrar(uuid,uuid)'])
  T.push([`🔒 ${f.split('(')[0]!.replace('public.', '')} fechada pra authenticated`,
    (await db.query<{ p: boolean }>(`select has_function_privilege('authenticated',$1,'execute') p`, [f])).rows[0]!.p === false]);

let f = 0;
for (const [n, ok] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
