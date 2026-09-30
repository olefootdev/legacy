/**
 * Valida o card no Pix creditando em BRO do servidor. `npm run test:card-bro`
 *
 * O que precisa ficar provado, na ordem de quanto custa errar:
 *   1. o split reparte o preço do card em DÓLAR (= BRO), nunca os centavos de
 *      real do Pix — era o furo de ~5,5×;
 *   2. o jogador entregue vem de `server_data` (service role); o `player` que
 *      o cliente escrever em `metadata` não entra no plantel;
 *   3. intent sem `server_data.card` (servidor antigo) fica PENDENTE — estoura
 *      em vez de creditar 1:1;
 *   4. `card_sales` grava o bruto em BRO de verdade, e venda antiga fica com o
 *      número da época (fallback).
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['lenda', 'clube', 'comprador'];
const u = {};

const db = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0, '20260930200000_card_pix_em_bro_do_servidor.sql'],
  antesDosExtras: async (d) => {
    for (const n of NOMES) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into public.profiles (id, username, display_name) values ($1,$2,$2)`, [id, n]);
      u[n] = id;
    }
    // O que 20260717210000 criou em produção e o stub não tem: card_sales e o
    // trigger no wallet_credits. A função real entra pela migration testada;
    // até lá um placeholder segura o trigger.
    await d.exec(`
      alter table public.legacy_players add column if not exists collection_id text;
      create table public.card_sales (id bigserial primary key, legacy_player_id text,
        collection_id text, beneficiary_user_id uuid, buyer_user_id uuid, currency text,
        gross_cents bigint, owner_cents bigint, payment_method text, role text,
        source_ref text unique, created_at timestamptz default now());
      create or replace function public.trg_record_card_sale_from_split()
      returns trigger language plpgsql as $$ begin return new; end $$;
      create trigger wallet_credits_card_sale after insert on public.wallet_credits
        for each row execute function public.trg_record_card_sale_from_split();
    `);
  },
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// Um card de $5 com split 50/10/40; o Pix cobra R$ 27,68 (cotação 5,536).
await q(`insert into public.legacy_players (id, name, payment_split) values ('juca', 'Juca', $1)`, [
  JSON.stringify([
    { kind: 'player', percent: 50, user_id: u.lenda },
    { kind: 'facilitator', percent: 10, user_id: u.clube },
    { kind: 'olefoot', percent: 40, user_id: u.lenda },
  ]),
]);

const criarIntent = async (externalId, serverData) =>
  (await q(
    `insert into public.payment_intents
       (user_id, external_id, product_kind, product_ref, amount_cents, metadata, server_data)
     values ($1,$2,'card','juca',2768,$3,$4) returning id`,
    [u.comprador, externalId,
     JSON.stringify({ player: { id: 'forjado-pelo-cliente', mintOverall: '99' } }),
     serverData ? JSON.stringify(serverData) : null],
  ))[0].id;

const SERVER_DATA = {
  card: {
    usd_cents: '500',
    brl_por_usd_micro: '5536000',
    player: { id: 'juca-mint-1', name: 'Juca', mintOverall: '82' },
  },
};

const i1 = await criarIntent('venda-1', SERVER_DATA);
await q(`select * from public.confirm_payment_intent($1, 'pag-1')`, [i1]);

await t('o split reparte os $5 do card: 250 + 50 + 200 BRO', async () => {
  const l = await q(`select bro_cents, reason from wallet_credits
                      where reason like 'card_split:' || $1 || ':%' order by bro_cents`, [i1]);
  return l.length === 3 && Number(l[0].bro_cents) === 50
    && Number(l[1].bro_cents) === 200 && Number(l[2].bro_cents) === 250;
});
await t('🔴 nada de 1384 (o furo dos centavos de real): soma é 500', async () => {
  const s = (await q(`select sum(bro_cents) s from wallet_credits
                       where reason like 'card_split:' || $1 || ':%'`, [i1]))[0].s;
  return Number(s) === 500;
});
await t('o jogador entregue é o do server_data', async () => {
  const p = (await q(`select players from manager_squad where user_id=$1`, [u.comprador]))[0].players;
  return p.length === 1 && p[0].id === 'juca-mint-1';
});
await t('🔒 o player do metadata (cliente) não entra no plantel', async () => {
  const p = (await q(`select players from manager_squad where user_id=$1`, [u.comprador]))[0].players;
  return !JSON.stringify(p).includes('forjado-pelo-cliente');
});
await t('card_sales grava o bruto em BRO (500), uma linha por fatia', async () => {
  const l = await q(`select gross_cents, owner_cents, role from card_sales
                      where source_ref like 'pixcard:' || $1 || ':%'`, [i1]);
  return l.length === 3 && l.every((x) => Number(x.gross_cents) === 500);
});
await t('confirmar de novo não credita em dobro', async () => {
  await q(`select * from public.confirm_payment_intent($1, 'pag-1')`, [i1]);
  const n = (await q(`select count(*) n from wallet_credits
                       where reason like 'card_split:' || $1 || ':%'`, [i1]))[0].n;
  return Number(n) === 3;
});

// ── a janela do servidor antigo ────────────────────────────────────────────
await t('intent sem server_data ESTOURA e fica pendente', async () => {
  const i2 = await criarIntent('venda-2', null);
  let estourou = false;
  try { await q(`select * from public.confirm_payment_intent($1, 'pag-2')`, [i2]); }
  catch (e) { estourou = e.message.includes('CARD_SEM_DADOS_DO_SERVIDOR'); }
  const st = (await q(`select status from payment_intents where id=$1`, [i2]))[0].status;
  const n = (await q(`select count(*) n from wallet_credits
                       where reason like 'card_split:' || $1 || ':%'`, [i2]))[0].n;
  return estourou && st === 'pending' && Number(n) === 0;
});
await t('server_data sem preço em dólar também não credita', async () => {
  const i3 = await criarIntent('venda-3', { card: { player: { id: 'x' } } });
  try { await q(`select * from public.confirm_payment_intent($1, 'pag-3')`, [i3]); return false; }
  catch (e) { return e.message.includes('CARD_SEM_PRECO_EM_DOLAR'); }
});
await t('sanidade: BRO acima do pago em real não passa', async () => {
  const i4 = await criarIntent('venda-4',
    { card: { usd_cents: '9999', player: { id: 'x' } } });
  try { await q(`select * from public.confirm_payment_intent($1, 'pag-4')`, [i4]); return false; }
  catch (e) { return e.message.includes('CARD_ACIMA_DO_PAGO'); }
});
await t('venda antiga (sem server_data) fica com o bruto da época', async () => {
  const i5 = await criarIntent('venda-5', null);
  await q(`insert into wallet_credits (user_id, bro_cents, exp_amount, reason, applied_at)
           values ($1, 123, 0, 'card_split:' || $2 || ':player', null)`, [u.lenda, i5]);
  const g = (await q(`select gross_cents from card_sales
                       where source_ref like 'pixcard:' || $1 || ':%'`, [i5]))[0].gross_cents;
  return Number(g) === 2768;
});

// ── placar ─────────────────────────────────────────────────────────────────
let falhas = 0;
for (const [n, ok, err] of T) {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${err ? ` — ${err}` : ''}`);
  if (!ok) falhas++;
}
console.log(falhas === 0 ? `\n🟢 ${T.length} passaram, 0 falharam` : `\n🔴 ${falhas} de ${T.length} falharam`);
process.exit(falhas === 0 ? 0 : 1);
