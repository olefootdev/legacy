/**
 * Valida o fluxo de CLAIM do bônus de equiparação. `npm run test:claim-expansao`
 *
 * A migration 20261001000000 traz a própria verificação (portas, máquina de
 * estados, PIN, gross-up da taxa) — ela RODA aqui dentro do montarBanco, em
 * cima da pilha REAL de migrations. O que este arquivo adiciona é o que a
 * verificação de dentro não alcança:
 *   1. a pilha inteira aplica em sequência (solana → fase0 → ciclo → PIN →
 *      teto → prêmio → 3× → claim);
 *   2. o saldo de um NÃO vaza pro claim do outro;
 *   3. recusar devolve o saldo, e o próximo pedido leva prêmio junto;
 *   4. a fila do admin nomeia quem pediu.
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['raiz', 'ana', 'bia', 'livre'];
const u = {};

const db = await montarBanco({
  extras: [
    '20260918210000_solana_wallet_link.sql',
    '20260919110000_solana_link_assinado.sql',
    ...MIGRATIONS_DA_FASE0,
    '20260930100000_expansao_ciclo_horario.sql',
    '20260930180000_carteira_pin.sql',
    '20260930180000_expansao_ponto_fixo_teto_diario.sql',
    '20260930220000_expansao_premio_carreira.sql',
    '20260930230000_expansao_ativacao_3x.sql',
    '20261001000000_expansao_claim_fluxo.sql',
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
const como = async (id) => q(`select set_config('request.jwt.claims', $1, false)`,
  [id ? JSON.stringify({ sub: id, role: 'authenticated' }) : '']);
const pedir = async (id, pin = null) => {
  await como(id);
  const r = (await q(`select * from public.expansao_claim_pedir($1)`, [pin]))[0];
  await como(null);
  return r;
};
const disp = async (id) => Number((await q(`select public.expansao_claim_disponivel_interno($1) d`, [id]))[0].d);

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// ── cenário: um ciclo SETTLED a $0,000125, Ana liquidou $1,00 e Bia $0,50 ───
await q(`select public.expansao_inserir($1,null,null,null)`, [u.raiz]);
await q(`select * from public.expansao_entrar($1,$2)`, [u.ana, u.raiz]);
await q(`select * from public.expansao_entrar($1,$2)`, [u.bia, u.raiz]);
const ciclo = (await q(`insert into public.expansao_ciclo (abre_em, fecha_em, status, preco_micro)
  values ('2002-01-01T00:00:00Z','2002-01-01T01:00:00Z','SETTLED',12500) returning id`))[0].id;
await q(`insert into public.expansao_liquidacao (ciclo_id,user_id,equiparado,bonus_contabil) values ($1,$2,0,100)`, [ciclo, u.ana]);
await q(`insert into public.expansao_liquidacao (ciclo_id,user_id,equiparado,bonus_contabil) values ($1,$2,0,50)`, [ciclo, u.bia]);
for (const n of ['ana', 'bia']) {
  await q(`insert into public.solana_wallet_links (user_id, wallet_address, verified, verified_at, proof_message, proof_signature)
           values ($1,$2,true,now(),'prova','assinatura')`, [u[n], `WALLET${n.toUpperCase()}1111111111111111111111111111111`]);
}

await t('Ana saca 8000 e Bia 4000 — cada um só o seu', async () => {
  const a = await pedir(u.ana);
  const b = await pedir(u.bia);
  return a.ok && Number(a.olefoot) === 8000 && b.ok && Number(b.olefoot) === 4000;
});
await t('o claim da Ana foi pro endereço DELA', async () =>
  (await q(`select wallet from public.expansao_claim where user_id=$1`, [u.ana]))[0].wallet === 'WALLETANA1111111111111111111111111111111');
await t('com claim pendente, Ana não pede de novo', async () =>
  (await pedir(u.ana)).motivo === 'claim_pendente');
await t('quem nunca liquidou não tem o que pedir', async () => {
  await q(`insert into public.solana_wallet_links (user_id, wallet_address, verified, verified_at, proof_message, proof_signature)
           values ($1,'WALLETLIVRE111111111111111111111111111111111',true,now(),'prova','assinatura')`, [u.livre]);
  return (await pedir(u.livre)).motivo === 'sem_saldo';
});

// ── recusar devolve; o próximo pedido leva o prêmio junto ───────────────────
await t('recusar devolve o saldo e grava o motivo', async () => {
  const id = (await q(`select id from public.expansao_claim where user_id=$1 and status='pendente'`, [u.ana]))[0].id;
  await q(`select public.expansao_claim_recusar($1,'fundador@t','teste')`, [id]);
  const motivo = (await q(`select achados->>'motivo_recusa' m from public.expansao_claim where id=$1`, [id]))[0].m;
  return (await disp(u.ana)) === 8000 && motivo === 'teste';
});
await t('prêmio de carreira entra no disponível do próximo pedido', async () => {
  await q(`insert into public.expansao_premio_carreira (user_id,degrau,olefoot,acumulado) values ($1,'CAMPEAO',500,0)`, [u.ana]);
  const r = await pedir(u.ana);
  return r.ok && Number(r.olefoot) === 8500;
});

// ── a fila do admin ─────────────────────────────────────────────────────────
await t('a fila nomeia quem pediu, com líquido e bruto', async () => {
  const fila = await q(`select * from public.expansao_claim_listar('pendente', 50)`);
  const ana = fila.find((c) => c.username === 'ana');
  const bia = fila.find((c) => c.username === 'bia');
  return ana && Number(ana.olefoot_liquido) === 8500 && Number(ana.olefoot_bruto) >= 8948
    && bia && Number(bia.olefoot_liquido) === 4000;
});
await t('aprovar → pagar com tx fica escrito no claim', async () => {
  const id = (await q(`select id from public.expansao_claim where user_id=$1 and status='pendente'`, [u.bia]))[0].id;
  await q(`select public.expansao_claim_aprovar($1,'fundador@t')`, [id]);
  await q(`select public.expansao_claim_pagar($1,'fundador@t','5vJx…assinatura')`, [id]);
  const linha = (await q(`select status, pago_em, achados->>'tx' tx, achados->>'pago_por' por
                          from public.expansao_claim where id=$1`, [id]))[0];
  return linha.status === 'pago' && linha.pago_em != null && linha.tx === '5vJx…assinatura' && linha.por === 'fundador@t';
});
await t('pago segue descontado: Bia não re-saca o que recebeu', async () =>
  (await pedir(u.bia)).motivo === 'sem_saldo');

// ── portas e RLS ────────────────────────────────────────────────────────────
await t('🔒 cliente não lista, não aprova, não recusa, não paga', async () => {
  const fn = [
    'expansao_claim_listar(text,integer)', 'expansao_claim_aprovar(bigint,text)',
    'expansao_claim_recusar(bigint,text,text)', 'expansao_claim_pagar(bigint,text,text)',
    'expansao_claim_disponivel_interno(uuid)',
  ];
  for (const f of fn) for (const r of ['anon', 'authenticated']) {
    if ((await q(`select has_function_privilege($1, $2, 'execute') p`, [r, `public.${f}`]))[0].p) return false;
  }
  return !(await q(`select has_function_privilege('anon','public.expansao_claim_pedir(text)','execute') p`))[0].p
    && (await q(`select has_function_privilege('authenticated','public.expansao_claim_pedir(text)','execute') p`))[0].p;
});
await t('🔒 sem sessão, pedir estoura', async () => {
  try { await q(`select * from public.expansao_claim_pedir(null)`); return false; }
  catch (e) { return e.message.includes('must be authenticated'); }
});
await t('🔒 a tabela só tem a policy do dono (leitura própria)', async () =>
  Number((await q(`select count(*) c from pg_policy p join pg_class k on k.oid = p.polrelid
                   where k.relname = 'expansao_claim'`))[0].c) === 1);
await t('um pendente por conta está garantido por ÍNDICE, não por leitura', async () =>
  (await q(`select 1 from pg_indexes where indexname = 'expansao_claim_um_pendente'`)).length === 1);

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
