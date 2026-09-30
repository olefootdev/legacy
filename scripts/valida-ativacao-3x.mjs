/**
 * Valida a Ativação 3×. `npm run test:ativacao-3x`
 *
 * O que precisa ficar provado, na ordem de quanto custa errar:
 *   1. um Pix de $30 vira TRÊS compras de $10 — a receita da janela fecha com
 *      o que entrou, sem compra fantasma;
 *   2. as satélites são do comprador, uma em cada perna, e o ativam na hora
 *      ("1 em cada time") com 10 OLEXP de volume em cada lado;
 *   3. a segunda 3× DERRAMA: entra abaixo das satélites já cadastradas;
 *   4. reconfirmar não duplica conta, compra nem volume;
 *   5. o ciclo seguinte equipara os 10 pontos e paga $2,50 (ponto fixo).
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['raiz', 'ana', 'bruno'];
const u = {};

const db = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0,
           '20260930100000_expansao_ciclo_horario.sql',
           '20260930200000_card_pix_em_bro_do_servidor.sql',
           '20260930180000_expansao_ponto_fixo_teto_diario.sql',
           '20260930220000_expansao_premio_carreira.sql',
           '20260930230000_expansao_ativacao_3x.sql'],
  antesDosExtras: async (d) => {
    for (const n of NOMES) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into public.profiles (id, username, display_name) values ($1,$2,$2)`, [id, n]);
      u[n] = id;
    }
    await d.query(`select public.expansao_inserir($1,null,null,null)`, [u.raiz]);
    await d.query(`insert into public.expansao_ativacao_casa (user_id, motivo, ativado_por)
                   values ($1,'origem','teste')`, [u.raiz]);
  },
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// A Ana entra na árvore pelo convite da raiz e compra a 3×.
await q(`select * from public.expansao_entrar($1,$2)`, [u.ana, u.raiz]);

const SAT = (lado) => ({
  lado, usd_cents: 1000, brl_cents: '5600', brl_por_usd_micro: '5600000',
  tokens_entregues: '80000000000000', tokens_brutos: '84210526315790',
});
const criar3x = async (externalId, dono) =>
  (await q(
    `insert into public.payment_intents
       (user_id, external_id, product_kind, amount_cents, metadata, server_data)
     values ($1,$2,'presale_pack',16800,'{}'::jsonb,$3) returning id`,
    [dono, externalId, JSON.stringify({
      presale: { usd_cents: 1000, brl_cents: '5600', brl_por_usd_micro: '5600000',
                 tokens_entregues: '80000000000000', tokens_brutos: '84210526315790' },
      ativacao_3x: { satelites: [SAT(1), SAT(2)] },
    })],
  ))[0].id;

const i1 = await criar3x('3x-ana-1', u.ana);
await q(`select * from public.confirm_payment_intent($1, 'pag-3x-1')`, [i1]);

await t('um Pix de $30 = três compras de $10 pagas, refs distintos', async () => {
  const l = await q(`select ref, usd_cents, status from presale_purchase order by ref`);
  return l.length === 3 && l.every((x) => Number(x.usd_cents) === 1000 && x.status === 'pago')
    && l.map((x) => x.ref).join(',') === '3x-ana-1,3x-ana-1:s1,3x-ana-1:s2';
});
await t('a receita da janela é exatamente $30', async () => {
  const r = (await q(`select public.expansao_receita_da_janela(
    date_trunc('hour', now()), date_trunc('hour', now()) + interval '1 hour') n`))[0].n;
  return Number(r) === 3000;
});
await t('as satélites são da Ana, uma em cada perna, filhas diretas', async () => {
  const l = await q(`select s.lado, n.pai_id, n.patrocinador_id from expansao_satelite s
                      join expansao_no n on n.user_id = s.user_id
                     where s.dono_id = $1 order by s.lado`, [u.ana]);
  return l.length === 2 && l.every((x) => x.pai_id === u.ana && x.patrocinador_id === u.ana)
    && Number(l[0].lado) === 1 && Number(l[1].lado) === 2;
});
await t('a Ana fica ATIVA na hora (1 em cada time)', async () =>
  (await q(`select public.expansao_ativo_interno($1) a`, [u.ana]))[0].a === true);
await t('10 OLEXP de equiparação em CADA perna da Ana', async () => {
  const l = await q(`select lado, volume from expansao_perna
                      where user_id = $1 and trilho = 'equiparacao' order by lado`, [u.ana]);
  return l.length === 2 && l.every((x) => Number(x.volume) === 10);
});
await t('a raiz ganha os 30 OLEXP na perna da Ana', async () => {
  const l = await q(`select volume from expansao_perna
                      where user_id = $1 and trilho = 'equiparacao'`, [u.raiz]);
  return l.length === 1 && Number(l[0].volume) === 30;
});
await t('as três posições de tokens existem (Ana + 2 satélites)', async () =>
  Number((await q(`select count(*) n from presale_position where tokens_totais > 0`))[0].n) === 3);
await t('🔒 satélite não loga: sem senha e sem identities', async () => {
  const l = await q(`select encrypted_password from auth.users where email like 'satelite-%'`);
  return l.length === 2 && l.every((x) => x.encrypted_password === '');
});
await t('profile da satélite tem display e username únicos', async () => {
  const l = await q(`select p.display_name, p.username from profiles p
                      join expansao_satelite s on s.user_id = p.id order by s.lado`);
  return l.length === 2 && l[0].display_name === 'ana · Time 1'
    && l[0].username.startsWith('ana-t1-') && l[1].username.startsWith('ana-t2-')
    && l[0].username !== l[1].username;
});
await t('a entrada fica registrada como ativacao_3x', async () =>
  Number((await q(`select count(*) n from expansao_confirmacao
                    where origem = 'ativacao_3x' and patrocinador_id = $1`, [u.ana]))[0].n) === 2);

// ── reconfirmação ──────────────────────────────────────────────────────────
await t('confirmar de novo não duplica conta, compra nem volume', async () => {
  await q(`select * from public.confirm_payment_intent($1, 'pag-3x-1')`, [i1]);
  const sats = Number((await q(`select count(*) n from expansao_satelite`))[0].n);
  const compras = Number((await q(`select count(*) n from presale_purchase`))[0].n);
  const vol = (await q(`select sum(volume) s from expansao_perna
                         where user_id = $1 and trilho = 'equiparacao'`, [u.ana]))[0].s;
  return sats === 2 && compras === 3 && Number(vol) === 20;
});

// ── derramamento ───────────────────────────────────────────────────────────
await t('a segunda 3× derrama: entra ABAIXO das primeiras satélites', async () => {
  const i2 = await criar3x('3x-ana-2', u.ana);
  await q(`select * from public.confirm_payment_intent($1, 'pag-3x-2')`, [i2]);
  const l = await q(`select s.ref, n.pai_id from expansao_satelite s
                      join expansao_no n on n.user_id = s.user_id
                     where s.ref like '3x-ana-2%' order by s.ref`);
  const pais = await q(`select s.lado, s.user_id from expansao_satelite s
                         where s.ref like '3x-ana-1%' order by s.lado`);
  return l.length === 2 && l[0].pai_id === pais[0].user_id && l[1].pai_id === pais[1].user_id;
});
await t('depois da segunda: 20 OLEXP em cada perna da Ana', async () => {
  const l = await q(`select lado, volume from expansao_perna
                      where user_id = $1 and trilho = 'equiparacao' order by lado`, [u.ana]);
  return l.length === 2 && l.every((x) => Number(x.volume) === 20);
});

// ── o ciclo paga ───────────────────────────────────────────────────────────
await t('o ciclo equipara os 20 pontos e paga $5,00 (ponto fixo $0,25)', async () => {
  const hora = (await q(`select date_trunc('hour', now() - interval '1 hour') h`))[0].h;
  await q(`update presale_purchase set paga_em = $1::timestamptz + interval '10 minutes'`, [hora]);
  const r = (await q(`select * from public.expansao_fechar_ciclo($1::timestamptz)`, [hora]))[0];
  const liq = (await q(`select bonus_contabil, equiparado from expansao_liquidacao
                         where user_id = $1`, [u.ana]))[0];
  return r.status === 'SETTLED' && Number(liq.equiparado) === 20 && Number(liq.bonus_contabil) === 500;
});
await t('as satélites não recebem bônus (sem diretos = inativas)', async () => {
  const l = await q(`select l.retido_inativo from expansao_liquidacao l
                      join expansao_satelite s on s.user_id = l.user_id`);
  return l.every((x) => x.retido_inativo === true);
});

// ── placar ─────────────────────────────────────────────────────────────────
let falhas = 0;
for (const [n, ok, err] of T) {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${err ? ` — ${err}` : ''}`);
  if (!ok) falhas++;
}
console.log(falhas === 0 ? `\n🟢 ${T.length} passaram, 0 falharam` : `\n🔴 ${falhas} de ${T.length} falharam`);
process.exit(falhas === 0 ? 0 : 1);
