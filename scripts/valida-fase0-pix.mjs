/**
 * Valida a Fase 0 — o caminho do dinheiro — num Postgres DESCARTÁVEL.
 *   npm run test:fase0-pix
 *
 * O que precisa ficar provado, e cada item é um bloqueio que estava em produção:
 *   · a pré-venda é aceita, credita posição, põe a pessoa na árvore e gera OLEXP
 *   · a pré-venda NÃO gera BRO
 *   · o depósito credita BRO convertido (1 BRO = 1 dólar) e PENDENTE
 *   · número que vira dinheiro só sai de `server_data`, nunca de `metadata`
 *   · um pagamento confirma uma intent só
 *   · o estorno desfaz a posição
 *   · a comissão sobre depósito sumiu
 *   · uma conta não lê a rede de outra
 *
 * As migrations de base são as REAIS do repositório, não cópia: se alguma
 * mudar a assinatura de uma função que a Fase 0 substitui, o teste quebra aqui
 * e não em produção. O que o PGlite não tem (auth, roles, tabelas do jogo que
 * o pagamento só encosta) entra como stub.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const M = 'supabase/migrations/';

await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
    raw_user_meta_data jsonb, created_at timestamptz default now());
  -- Igual ao Supabase: quem está logado sai do JWT que o PostgREST põe na sessão.
  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$
    select auth.jwt() ->> 'role' $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role; exception when duplicate_object then null; end $$;

  create table public.profiles (id uuid primary key, username text unique, display_name text,
    club_name text, club_short text, onboarding_data jsonb, referred_by_code text,
    my_referral_code text, email text, updated_at timestamptz default now());
  create table public.manager_friendships (requester_id uuid, addressee_id uuid,
    requester_club_name text, addressee_club_name text, status text, responded_at timestamptz,
    updated_at timestamptz, primary key (requester_id, addressee_id));
  create table public.expansao_pendente (user_id uuid primary key, patrocinador_id uuid,
    codigo text, motivo text, criado_em timestamptz default now(), resolvido_em timestamptz);

  create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;

  -- O ramo de CARD não muda na Fase 0, mas tem que continuar entregando.
  create table public.legacy_players (id text primary key, name text, payment_split jsonb);
  create table public.manager_squad (user_id uuid primary key, players jsonb, lineup jsonb,
    updated_at timestamptz default now());
  create table public.legacy_player_lots (legacy_player_id text, status text, sold integer default 0);
  create table public.market_activities (id uuid primary key default gen_random_uuid(), type text,
    manager_id uuid, manager_name text, club_name text, player_name text, player_ovr int,
    player_pos text, price_exp bigint, created_at timestamptz default now());
`);

const base = [
  ['20260421194739_wallet_credits.sql'],
  ['20260502030001_wallet_credits_exp.sql'],
  ['20260527000100_affiliate_commissions.sql'],
  // Só a tabela e `is_user_activated`: o resto do arquivo é carreira e HODL.
  ['20260527000400_activation_pack.sql', '-- Adiciona coluna lost_commissions_cents'],
  ['20260528100000_payment_intents.sql'],
  ['20260703130000_payment_refunds.sql'],
  ['20260704120000_legacy_pix_record_sale.sql'],
  ['20260918220000_wallet_credits_claim_rpc.sql'],
  ['20260928120000_presale_packs_e_travas.sql'],
  ['20260928130000_presale_pix_e_credito.sql'],
  ['20260928140000_expansao_arvore_e_ciclo.sql'],
  ['20260929120000_expansao_ponte_cadastro.sql', '-- ─── o gancho no cadastro'],
  ['20260929140000_expansao_convite_confirmado.sql'],
  ['20260929160000_expansao_ativacao_casa.sql'],
  ['20260929180000_carreira_por_equiparado_pago.sql'],
];

for (const [arq, ate] of base) {
  let sql = readFileSync(M + arq, 'utf8');
  if (ate) sql = sql.slice(0, sql.indexOf(ate));
  try { await db.exec(sql); }
  catch (e) { console.log(`❌ base ${arq}: ${e.message}`); process.exit(1); }
}
console.log('✅ base: as migrations reais aplicam em sequência');

// ─── gente ────────────────────────────────────────────────────────────────
const U = {};
const cria = async (nome, extra = {}) => {
  const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [nome + '@t'])).rows[0].id;
  await db.query(
    `insert into public.profiles (id, username, display_name, my_referral_code, referred_by_code)
     values ($1,$2,$2,$3,$4)`,
    [id, nome, extra.codigo ?? null, extra.indicadoPor ?? null]);
  U[nome] = id;
  return id;
};
const loga = (id, papel = 'authenticated') => db.query(
  `select set_config('request.jwt.claims', $1, false)`,
  [id === null ? JSON.stringify({ role: papel }) : JSON.stringify({ sub: id, role: papel })]);
const servidor = () => db.query(`select set_config('request.jwt.claims', $1, false)`,
  [JSON.stringify({ role: 'service_role' })]);

// raiz → carlos (ativo, indicou ana) → ana ; dora indicou ernesto mas dora NÃO está na árvore
await cria('raiz', { codigo: 'RAIZ0001' });
await cria('carlos', { codigo: 'CARLOS01', indicadoPor: 'RAIZ0001' });
await cria('ana', { indicadoPor: 'CARLOS01' });
await cria('dora', { codigo: 'DORA0001', indicadoPor: 'CARLOS01' });
await cria('ernesto', { indicadoPor: 'DORA0001' });
await cria('fulano');            // sem indicação nenhuma
await cria('estranho');
await cria('livre');             // fica fora de tudo: é quem a verificação da migration usa

await db.query(`select public.expansao_inserir($1,null,null,null)`, [U.raiz]);
await db.query(`insert into public.expansao_ativacao_casa (user_id, motivo, ativado_por) values ($1,'teste','teste')`, [U.raiz]);
await db.query(`select * from public.expansao_entrar($1,$2)`, [U.carlos, U.raiz]);
await db.query(`insert into public.expansao_ativacao_casa (user_id, motivo, ativado_por) values ($1,'teste','teste')`, [U.carlos]);

// ─── as duas migrations da Fase 0 ─────────────────────────────────────────
for (const arq of ['20260929210000_expansao_leitura_so_do_dono.sql', '20260929220000_fase0_pix_credita_certo.sql']) {
  try { await db.exec(readFileSync(M + arq, 'utf8')); }
  catch (e) { console.log(`❌ ${arq}: ${e.message}`); process.exit(1); }
  console.log(`✅ ${arq} aplica — e a verificação de dentro passou`);
}

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };
const um = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const estoura = async (f, contem) => { try { await f(); return false; } catch (e) { return String(e.message).includes(contem); } };

/** Cria a intent como o servidor faz: RPC com o JWT da pessoa, server_data com service_role. */
const intent = async (quem, kind, brlCents, serverData, ref = null, metadata = {}) => {
  await loga(U[quem]);
  const r = await um(`select * from public.create_payment_intent($1,$2,$3,'N','n@t','00000000000',null,$4::jsonb)`,
    [kind, ref, brlCents, JSON.stringify(metadata)]);
  await servidor();
  if (serverData) await db.query(`update public.payment_intents set server_data = $2::jsonb where id = $1`,
    [r.intent_id, JSON.stringify(serverData)]);
  return r.intent_id;
};
const confirma = async (id, pagamento) => { await servidor();
  return um(`select * from public.confirm_payment_intent($1,$2)`, [id, pagamento]); };
const pack = (usdCents) => ({ presale: {
  usd_cents: usdCents, brl_cents: String(Math.ceil(usdCents * 5.535)), brl_por_usd_micro: '5535000',
  tokens_entregues: String(BigInt(usdCents) * 80n * 10n ** 9n),
  tokens_brutos: String((BigInt(usdCents) * 80n * 10n ** 9n * 10000n) / 9500n + 1n) } });
const volume = async (quem, trilho = 'equiparacao') => Number((await um(
  `select coalesce(sum(volume),0) v from public.expansao_perna where user_id=$1 and trilho=$2`, [U[quem], trilho])).v);

// ═══ 1. pré-venda ═════════════════════════════════════════════════════════
let iAna;
await t('🔑 a pré-venda é aceita na criação (era "invalid product_kind")', async () => {
  iAna = await intent('ana', 'presale_pack', 5535, pack(1000)); return !!iAna; });
await t('🔑 confirmar credita a posição travada', async () => {
  await confirma(iAna, 'mp-1');
  const p = await um(`select tokens_totais, compra_original_usd_cents c from public.presale_position where user_id=$1`, [U.ana]);
  return String(p.tokens_totais) === '80000000000000' && Number(p.c) === 1000; });
await t('🔴 e NÃO gera crédito BRO', async () =>
  Number((await um(`select count(*) c from public.wallet_credits where user_id=$1`, [U.ana])).c) === 0);
await t('🔑 quem comprou entrou na árvore', async () =>
  Number((await um(`select count(*) c from public.expansao_no where user_id=$1`, [U.ana])).c) === 1);
await t('   embaixo de quem indicou no cadastro (carlos)', async () =>
  (await um(`select patrocinador_id p from public.expansao_no where user_id=$1`, [U.ana])).p === U.carlos);
await t('   e o registro diz que foi por COMPRA, não por convite', async () => {
  const r = await um(`select origem, username_convite u from public.expansao_confirmacao where user_id=$1`, [U.ana]);
  return r.origem === 'compra' && r.u === 'carlos'; });
await t('🔑 $10 = 10 OLEXP no livro, fonte compra_olefoot', async () => {
  const r = await um(`select olexp, fonte, equiparou from public.expansao_olexp where user_id=$1`, [U.ana]);
  return Number(r.olexp) === 10 && r.fonte === 'compra_olefoot' && r.equiparou === true; });
await t('   o volume sobe pra quem está acima: carlos +10, raiz +10', async () =>
  (await volume('carlos')) === 10 && (await volume('raiz')) === 10);
await t('   e nos DOIS trilhos (o que gradua e o que paga)', async () =>
  (await volume('carlos', 'qualificacao')) === 10);
await t('   quem comprou não credita a si mesmo', async () => (await volume('ana')) === 0);
await t('🔑 o pack de $10 libera o convite de quem comprou', async () => {
  await servidor(); return (await um(`select public.expansao_pode_convidar_interno($1) p`, [U.ana])).p === true; });
await t('🔒 confirmar de novo não credita de novo', async () => {
  const r = await confirma(iAna, 'mp-1');
  const p = await um(`select tokens_totais from public.presale_position where user_id=$1`, [U.ana]);
  return r.was_already_paid === true && String(p.tokens_totais) === '80000000000000' && (await volume('raiz')) === 10; });
await t('   segunda compra da mesma pessoa soma posição e volume, sem mover na árvore', async () => {
  const antes = await um(`select pai_id, lado from public.expansao_no where user_id=$1`, [U.ana]);
  const i2 = await intent('ana', 'presale_pack', 27675, pack(5000), 'segunda');
  await confirma(i2, 'mp-2');
  const depois = await um(`select pai_id, lado from public.expansao_no where user_id=$1`, [U.ana]);
  const p = await um(`select compra_original_usd_cents c from public.presale_position where user_id=$1`, [U.ana]);
  return Number(p.c) === 6000 && (await volume('raiz')) === 60
    && antes.pai_id === depois.pai_id && antes.lado === depois.lado; });
await t('   valor quebrado arredonda pra baixo: $15,99 = 15 OLEXP', async () =>
  Number((await um(`select public.expansao_olexp_da_compra(1599) v`)).v) === 15);

// ═══ 2. embaixo de quem ═══════════════════════════════════════════════════
await t('🔑 indicador fora da árvore: sobe a cadeia até achar alguém dentro', async () => {
  const i = await intent('ernesto', 'presale_pack', 5535, pack(1000));   // ernesto ← dora (fora) ← carlos
  await confirma(i, 'mp-3');
  return (await um(`select patrocinador_id p from public.expansao_no where user_id=$1`, [U.ernesto])).p === U.carlos; });
await t('🔑 sem indicação nenhuma: entra sob a raiz', async () => {
  const i = await intent('fulano', 'presale_pack', 5535, pack(1000));
  await confirma(i, 'mp-4');
  return (await um(`select patrocinador_id p from public.expansao_no where user_id=$1`, [U.fulano])).p === U.raiz; });
await t('🔒 indicador na árvore mas SEM pack não recebe: sobe pro próximo', async () => {
  // dora entra por convite do carlos, mas não comprou nem foi ativada pela casa
  await servidor();
  await db.query(`select * from public.expansao_entrar($1,$2)`, [U.dora, U.carlos]);
  await cria('gil', { indicadoPor: 'DORA0001' });
  const i = await intent('gil', 'presale_pack', 5535, pack(1000));
  await confirma(i, 'mp-5');
  return (await um(`select patrocinador_id p from public.expansao_no where user_id=$1`, [U.gil])).p === U.carlos; });

// ═══ 3. só server_data vale ═══════════════════════════════════════════════
await t('🔴 pré-venda com os números em METADATA é recusada', async () => {
  const i = await intent('estranho', 'presale_pack', 100, null, 'forjada', pack(125000));
  return estoura(() => confirma(i, 'mp-6'), 'PRESALE_SEM_DADOS_DO_SERVIDOR'); });
await t('   e a intent continua pendente, não paga', async () =>
  (await um(`select status from public.payment_intents where product_ref='forjada'`)).status === 'pending');
await t('🔴 o cliente não escreve server_data', async () => {
  await loga(U.estranho);
  await db.exec(`set role authenticated`);
  try {
    const r = await db.query(`update public.payment_intents set server_data = '{"presale":{}}'::jsonb
                               where product_ref='forjada' returning id`);
    return r.rows.length === 0;
  } catch { return true; } finally { await db.exec(`reset role`); } });

// ═══ 4. depósito ══════════════════════════════════════════════════════════
let iDep;
await t('🔑 depósito de R$ 100 credita 18,06 BRO — não 100', async () => {
  iDep = await intent('estranho', 'recharge', 10000, { recarga: { bro_cents: '1806', brl_por_usd_micro: '5535000' } });
  await confirma(iDep, 'mp-7');
  const c = await um(`select bro_cents, applied_at from public.wallet_credits where reason=$1`, ['pix_payment:' + iDep]);
  return Number(c.bro_cents) === 1806 && c.applied_at === null; });
await t('🔑 o resgate do cliente devolve o depósito (antes devolvia zero)', async () => {
  await loga(U.estranho);
  const r = await um(`select * from public.claim_pending_wallet_credits()`);
  return Number(r.bro_cents_total) === 1806; });
await t('   e resgatar de novo não devolve de novo', async () => {
  const r = await um(`select * from public.claim_pending_wallet_credits()`);
  return Number(r.bro_cents_total) === 0; });
await t('🔴 a comissão sobre depósito não existe mais', async () =>
  Number((await um(`select count(*) c from public.affiliate_commissions`)).c) === 0
  && Number((await um(`select count(*) c from pg_trigger where tgname='wallet_credits_affiliate_bonus_trg'`)).c) === 0);
await t('🔴 depósito sem cotação do servidor estoura em vez de creditar 1:1', async () => {
  const i = await intent('estranho', 'recharge', 10000, null, 'semcot', { recarga: { bro_cents: '999999' } });
  return estoura(() => confirma(i, 'mp-8'), 'RECARGA_SEM_COTACAO'); });
await t('🔴 BRO maior que os centavos pagos é recusado', async () => {
  const i = await intent('estranho', 'recharge', 10000, { recarga: { bro_cents: '10001' } }, 'acima');
  return estoura(() => confirma(i, 'mp-9'), 'RECARGA_ACIMA_DO_PAGO'); });
await t('   pack de ativação antigo também converte, e ativa', async () => {
  const i = await intent('fulano', 'activation_pack', 12500, { recarga: { bro_cents: '2258' } });
  const r = await confirma(i, 'mp-10');
  const c = await um(`select bro_cents from public.wallet_credits where id=$1`, [r.wallet_credit_id]);
  return Number(c.bro_cents) === 2258 && r.activation_id !== null; });

// ═══ 5. um pagamento, uma intent ══════════════════════════════════════════
await t('🔴 o mesmo pagamento não confirma uma segunda intent', async () => {
  const i = await intent('estranho', 'recharge', 10000, { recarga: { bro_cents: '1806' } }, 'dup');
  return estoura(() => confirma(i, 'mp-7'), 'PAGAMENTO_JA_USADO'); });
await t('   e o banco recusa mesmo se a função for contornada', async () => {
  await servidor();
  return estoura(() => db.query(
    `update public.payment_intents set status='paid', abacate_id='mp-7' where product_ref='dup'`), 'payment_intents_pagamento_unico'); });

// ═══ 6. card continua entregando ══════════════════════════════════════════
let iCard, iCardGil;
await t('   ramo de CARD intacto: entrega o jogador e não credita o comprador', async () => {
  await servidor();
  await db.query(`insert into public.legacy_players (id, name, payment_split) values ('lp1','Lenda','[]'::jsonb)`);
  await db.query(`insert into public.legacy_player_lots (legacy_player_id, status, sold) values ('lp1','open',0)`);
  iCard = await intent('fulano', 'card', 5000, null, 'lp1', { player: { id: 'legacy-lp1', name: 'Lenda', pos: 'ATA' } });
  await confirma(iCard, 'mp-11');
  const s = await um(`select players from public.manager_squad where user_id=$1`, [U.fulano]);
  const c = await um(`select count(*) c from public.wallet_credits where reason=$1`, ['pix_payment:' + iCard]);
  return s.players.length === 1 && s.players[0].id === 'legacy-lp1' && Number(c.c) === 0; });
await t('🐞 o contador de vendidos do lote anda (nunca tinha andado)', async () =>
  Number((await um(`select sold from public.legacy_player_lots where legacy_player_id='lp1'`)).sold) === 1
  && Number((await um(`select count(*) c from public.market_activities where player_name='Lenda'`)).c) === 1);
await t('   a comissão de CARD continua: 5% pra quem indicou o comprador', async () => {
  // fulano não tem indicação; gil ← dora ← carlos ← raiz
  await servidor();
  const i = await intent('gil', 'card', 10000, null, 'lp1', { player: { id: 'legacy-lp1b', name: 'Lenda', pos: 'ATA' } });
  await confirma(i, 'mp-13');
  const r = (await db.query(`select level, amount_cents, status from public.affiliate_commissions
                              where source_ref = $1 order by level`, ['card_purchase:' + i])).rows;
  iCardGil = i;
  return r.length === 3 && r.every((x) => Number(x.amount_cents) === 500 && x.status === 'confirmed'); });
await t('🐞 estorno de card funciona e reverte a comissão (todo estorno estourava)', async () => {
  const r = await um(`select * from public.reverse_payment_intent($1,'mp-13','refunded')`, [iCardGil]);
  const c = await um(`select count(*) c from public.affiliate_commissions where source_ref=$1 and status='reversed'`,
    ['card_purchase:' + iCardGil]);
  return r.status === 'refunded' && r.commissions_reversed === 3 && Number(c.c) === 3 && r.needs_manual === true; });
await t('🐞 estorno de intent que nunca foi paga só cancela', async () => {
  const i = await intent('gil', 'recharge', 5000, { recarga: { bro_cents: '903' } }, 'nuncapaga');
  await servidor();
  const r = await um(`select * from public.reverse_payment_intent($1,'mp-x','refunded')`, [i]);
  return r.status === 'cancelled'
    && (await um(`select status from public.payment_intents where id=$1`, [i])).status === 'cancelled'; });

// ═══ 7. estorno ═══════════════════════════════════════════════════════════
await t('🔑 estorno de pré-venda desfaz posição e total vendido', async () => {
  await servidor();
  const vendidoAntes = BigInt((await um(`select tokens_vendidos v from public.presale_config`)).v);
  const iF = (await um(`select id from public.payment_intents where user_id=$1 and product_kind='presale_pack'`, [U.fulano])).id;
  const r = await um(`select * from public.reverse_payment_intent($1,'mp-4','refunded')`, [iF]);
  const p = await um(`select tokens_totais from public.presale_position where user_id=$1`, [U.fulano]);
  const c = await um(`select status from public.presale_purchase where user_id=$1`, [U.fulano]);
  const vendidoDepois = BigInt((await um(`select tokens_vendidos v from public.presale_config`)).v);
  return r.needs_manual === true && String(p.tokens_totais) === '0' && c.status === 'estornado'
    && vendidoAntes - vendidoDepois === 80000000000000n; });
await t('   a posição na árvore fica (é permanente) e o estorno pede revisão', async () =>
  Number((await um(`select count(*) c from public.expansao_no where user_id=$1`, [U.fulano])).c) === 1
  && (await um(`select needs_manual m from public.payment_refunds order by created_at desc limit 1`)).m === true);
await t('   compra estornada deixa de liberar o convite', async () => {
  await servidor(); return (await um(`select public.expansao_pode_convidar_interno($1) p`, [U.fulano])).p === false; });
await t('🔒 estornar duas vezes não desconta duas vezes', async () => {
  const iF = (await um(`select id from public.payment_intents where user_id=$1 and product_kind='presale_pack'`, [U.fulano])).id;
  await um(`select * from public.reverse_payment_intent($1,'mp-4','refunded')`, [iF]);
  return String((await um(`select tokens_totais from public.presale_position where user_id=$1`, [U.fulano])).tokens_totais) === '0'; });
await t('   estorno de depósito ainda não resgatado anula o crédito', async () => {
  const i = await intent('gil', 'recharge', 5000, { recarga: { bro_cents: '903' } }, 'est');
  await confirma(i, 'mp-12');
  const r = await um(`select * from public.reverse_payment_intent($1,'mp-12','refunded')`, [i]);
  const c = await um(`select voided_at from public.wallet_credits where reason=$1`, ['pix_payment:' + i]);
  await loga(U.gil);
  const resg = await um(`select * from public.claim_pending_wallet_credits()`);
  return r.credits_voided === 1 && c.voided_at !== null && Number(resg.bro_cents_total) === 0; });

// ═══ 8. a rede é do dono ══════════════════════════════════════════════════
const linhas = async (sql, p) => (await db.query(sql, p)).rows.length;
await t('🔴 estranho logado NÃO lê o mapa de outra conta', async () => {
  await loga(U.estranho); return (await linhas(`select * from public.expansao_mapa($1,1,50)`, [U.raiz])) === 0; });
await t('🔴 nem a ativação', async () => (await linhas(`select * from public.expansao_ativacao($1)`, [U.raiz])) === 0);
await t('🔴 nem a carreira', async () => (await linhas(`select * from public.expansao_carreira($1)`, [U.raiz])) === 0);
await t('🔴 nem se ela pode convidar', async () =>
  (await um(`select public.expansao_pode_convidar($1) p`, [U.raiz])).p === false);
await t('🔑 o dono lê o próprio mapa inteiro', async () => {
  await loga(U.raiz); return (await linhas(`select * from public.expansao_mapa($1,1,50)`, [U.raiz])) >= 5; });
await t('   a própria ativação e a própria carreira', async () =>
  (await linhas(`select * from public.expansao_ativacao($1)`, [U.raiz])) === 1
  && (await linhas(`select * from public.expansao_carreira($1)`, [U.raiz])) === 1);
await t('   e se pode convidar', async () => (await um(`select public.expansao_pode_convidar($1) p`, [U.raiz])).p === true);
await t('   o servidor lê qualquer conta', async () => {
  await servidor(); return (await linhas(`select * from public.expansao_mapa($1,1,50)`, [U.raiz])) >= 5; });
await t('   visitante sem login não lê nada', async () => {
  await loga(null, 'anon'); return (await linhas(`select * from public.expansao_ativacao($1)`, [U.raiz])) === 0; });
await t('🔑 mas a tela pública do convite continua dizendo se o convite vale', async () => {
  const r = await um(`select * from public.expansao_convite_de('carlos')`);
  return r.existe === true && r.pode_convidar === true; });
await t('🔑 e confirmar convite continua funcionando (pergunta do PATROCINADOR por dentro)', async () => {
  await cria('hugo'); await loga(U.hugo);
  const r = await um(`select * from public.expansao_confirmar_convite('carlos')`);
  const o = await um(`select origem from public.expansao_confirmacao where user_id=$1`, [U.hugo]);
  return r.entrou === true && o.origem === 'convite'; });

// ═══ 9. quem pode chamar o quê ════════════════════════════════════════════
const priv = async (f, r) => (await um(`select has_function_privilege($1,$2,'execute') p`, [r, f])).p;
for (const f of ['public.confirm_payment_intent(uuid,text)', 'public.reverse_payment_intent(uuid,text,text)',
  'public.expansao_entrar_por_compra(uuid)', 'public.expansao_pode_convidar_interno(uuid)',
  'public.expansao_olexp_da_compra(integer)']) {
  await t(`🔒 ${f.replace('public.', '')} fechada pro cliente`, async () =>
    (await priv(f, 'authenticated')) === false && (await priv(f, 'anon')) === false);
}
await t('   create_payment_intent segue executável por quem está logado', async () =>
  (await priv('public.create_payment_intent(text,text,bigint,text,text,text,text,jsonb)', 'authenticated')) === true);

await t('🧹 a verificação de dentro da migration não deixou rastro', async () => {
  await servidor();
  return Number((await um(`select count(*) c from public.expansao_no where user_id=$1`, [U.livre])).c) === 0
    && Number((await um(`select count(*) c from public.payment_intents where user_id=$1`, [U.livre])).c) === 0
    && Number((await um(`select count(*) c from public.expansao_olexp where user_id=$1`, [U.livre])).c) === 0; });

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
