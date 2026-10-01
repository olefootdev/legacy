/**
 * Valida o MERCADO DE ELENCO em OLEFOOT. `npm run test:squad-market`
 *
 * A migration 20261001150000 traz a própria verificação (portas, liquidar,
 * desfazer, saldo em wei×human, índices de anúncio único) — ela RODA aqui
 * dentro do montarBanco, em cima da pilha real. Este arquivo adiciona o que
 * ela não cobre:
 *   1. a pilha aplica em sequência (saldo v1 → fase0 → squad_market);
 *   2. vendedor NOVO (sem linha de saldo) recebe com os defaults novos;
 *   3. a fração de wei do comprador sobrevive a compra e venda em sequência;
 *   4. time e jogador compartilham a mesma liquidação (kind não muda dinheiro).
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['ana', 'bia', 'caio'];
const u = {};

const db = await montarBanco({
  extras: [
    '20260531000000_legacy_v1_olefoot_credits.sql',
    ...MIGRATIONS_DA_FASE0,
    '20261001150000_squad_market_olefoot.sql',
    '20261001200000_rpg_price_live_fundacao.sql',
    '20261001210000_squad_market_v2.sql',
  ],
  antesDosExtras: async (d) => {
    for (const n of NOMES) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into public.profiles (id, username, display_name, my_referral_code)
                     values ($1,$2,$2,$3)`, [id, n, `COD${n.toUpperCase()}`.slice(0, 8).padEnd(6, 'X')]);
      u[n] = id;
    }
  },
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const saldo = async (id) => {
  const r = await q(`select balance_wei::text w, balance_human h from public.legacy_olefoot_credits where user_id=$1`, [id]);
  return r[0] ?? null;
};
const liquidar = async (listing, buyer) =>
  (await q(`select * from public.squad_market_liquidar($1,$2)`, [listing, buyer]))[0];

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// Ana (compradora) tem 50.000,25 OLEFOOT. Bia e Caio (vendedores) nunca tiveram linha.
await q(`insert into public.legacy_olefoot_credits (user_id, balance_wei, balance_human, source)
         values ($1, 50000.25e18, '50000.250000000000000000', 'teste')`, [u.ana]);

const anuncio = async (vendedor, kind, pid, preco) =>
  (await q(`insert into public.squad_listings (kind, seller_user_id, game_player_id, player_snapshot, price_olefoot)
            values ($1,$2,$3,'{"name":"x"}'::jsonb,$4) returning id`, [kind, vendedor, pid, preco]))[0].id;

await t('vendedora NOVA recebe sem linha prévia (defaults da migration)', async () => {
  const id = await anuncio(u.bia, 'player', 'zag-1', 8000);
  const r = await liquidar(id, u.ana);
  const s = await saldo(u.bia);
  return r.ok && s?.w === (8000n * 10n ** 18n).toString() && s?.h === '8000.000000000000000000';
});
await t('a fração de wei da compradora sobrevive ao débito', async () =>
  (await saldo(u.ana))?.h === '42000.250000000000000000');
await t('a vendedora vira compradora: gasta o que recebeu', async () => {
  const id = await anuncio(u.caio, 'player', 'ata-1', 8000);
  const r = await liquidar(id, u.bia);
  const sBia = await saldo(u.bia);
  const sCaio = await saldo(u.caio);
  return r.ok && sBia?.h === '0.000000000000000000' && sCaio?.h === '8000.000000000000000000';
});
await t('time e jogador passam pela MESMA liquidação', async () => {
  const id = await anuncio(u.caio, 'team', null, 5000);
  const r = await liquidar(id, u.ana);
  return r.ok && r.kind === 'team' && (await saldo(u.ana))?.h === '37000.250000000000000000'
    && (await saldo(u.caio))?.h === '13000.000000000000000000';
});
await t('um vendedor só tem UM anúncio de time ativo', async () => {
  await anuncio(u.caio, 'team', null, 1);
  try { await anuncio(u.caio, 'team', null, 2); return false; }
  catch (e) { return e.message.includes('squad_listings_um_time'); }
});
await t('anúncio de player sem game_player_id é recusado pelo check', async () => {
  try { await anuncio(u.bia, 'player', null, 1); return false; }
  catch (e) { return e.message.includes('squad_listings_player_tem_id'); }
});
await t('desfazer só funciona em venda ainda não aplicada pelo vendedor', async () => {
  const id = await anuncio(u.bia, 'player', 'mei-1', 100);
  await liquidar(id, u.ana);
  await q(`update public.squad_listings set seller_applied_at = now() where id=$1`, [id]);
  return (await q(`select public.squad_market_desfazer($1) r`, [id]))[0].r === false;
});

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
