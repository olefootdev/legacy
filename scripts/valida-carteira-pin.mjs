/**
 * Valida o PIN da carteira (Fase 5, servidor). `npm run test:pin`
 *
 * O que precisa ficar provado, na ordem de quanto custa errar:
 *   1. o PIN não fica guardado — só o bcrypt; e conferir é porta do servidor;
 *   2. 5 erros travam por 15 minutos; a trava não estica com mais erro e nem
 *      o PIN certo passa por ela;
 *   3. trocar exige login (amr) dos últimos 5 minutos — e essa troca é também
 *      o caminho de quem esqueceu o PIN;
 *   4. as portas fecham SÓ pra quem criou PIN: a conta sem PIN segue livre, e
 *      o time padrão do NETWORK obedece (assinatura antiga recusa, a nova só
 *      passa com o PIN certo).
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['raiz', 'ana', 'bia'];
const u = {};

const db = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0, '20260930100000_expansao_ciclo_horario.sql',
           '20260930180000_carteira_pin.sql'],
  // A verificação de dentro da migration precisa de uma conta em auth.users.
  antesDosExtras: async (d) => {
    for (const n of NOMES) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into public.profiles (id, username, display_name) values ($1,$2,$2)`, [id, n]);
      u[n] = id;
    }
    await d.query(`select public.expansao_inserir($1,null,null,null)`, [u.raiz]);
    await d.query(`select public.expansao_entrar($1,$2)`, [u.ana, u.raiz]);
  },
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
// `login` = segundos desde a última autenticação de verdade (vai pro amr).
const como = async (id, login = null) => q(`select set_config('request.jwt.claims', $1, false)`, [
  id ? JSON.stringify({
    sub: id, role: 'authenticated',
    ...(login == null ? {} : { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - login }] }),
  }) : '']);

const definir = async (pin) => (await q(`select * from public.carteira_pin_definir($1)`, [pin]))[0];
const verificar = async (pin) => (await q(`select * from public.carteira_pin_verificar($1)`, [pin]))[0];
const estado = async () => (await q(`select * from public.carteira_pin_estado()`))[0];
const perna = async (lado) => q(`select public.expansao_definir_perna_padrao($1::smallint) l`, [lado]);
const pernaPin = async (lado, pin) =>
  (await q(`select * from public.expansao_definir_perna_padrao($1::smallint, $2)`, [lado, pin]))[0];

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// ── sem PIN: nada fecha ────────────────────────────────────────────────────
await como(u.ana);
await t('conta sem PIN: estado diz que não tem e não está travada', async () => {
  const e = await estado();
  return e.tem_pin === false && Number(e.tenta_de_novo_em) === 0;
});
await t('conta sem PIN escolhe o time pela assinatura antiga', async () =>
  Number((await perna(2))[0].l) === 2);
await t('verificar sem ter PIN diz sem_pin (e não conta erro)', async () => {
  const r = await verificar('123456');
  return r.ok === false && r.motivo === 'sem_pin'
    && (await q(`select count(*) n from carteira_pin_tentativa where user_id=$1`, [u.ana]))[0].n == 0;
});

// ── criar e conferir ───────────────────────────────────────────────────────
await t('PIN tem que ser 6 dígitos', async () => {
  const a = await definir('12345'); const b = await definir('abc123'); const c = await definir('1234567');
  return [a, b, c].every((r) => r.ok === false && r.motivo === 'pin_invalido');
});
await t('primeira definição entra sem exigir login recente', async () =>
  (await definir('111222')).ok === true);
await t('🔒 só o bcrypt fica guardado', async () => {
  const l = (await q(`select pin_hash from carteira_pin where user_id=$1`, [u.ana]))[0];
  return l.pin_hash.startsWith('$2') && !l.pin_hash.includes('111222');
});
await t('PIN certo passa; errado não', async () =>
  (await verificar('111222')).ok === true && (await verificar('000000')).ok === false);
await t('PIN da Ana não abre a conta da Bia', async () => {
  await como(u.bia);
  const e = await estado(); const r = await verificar('111222');
  await como(u.ana);
  return e.tem_pin === false && r.motivo === 'sem_pin';
});

// ── a trava: 5 erros, 15 minutos ───────────────────────────────────────────
await t('5 erros travam; o 6º não estica; o certo não passa travado', async () => {
  await q(`delete from carteira_pin_tentativa where user_id=$1`, [u.ana]);
  let r;
  for (let i = 0; i < 5; i++) r = await verificar('999999');
  if (!(r.motivo === 'pin_errado' && Number(r.tenta_de_novo_em) > 0)) return false;
  const travado = await verificar('999999');
  const certo = await verificar('111222');
  const n = (await q(`select count(*) n from carteira_pin_tentativa where user_id=$1`, [u.ana]))[0].n;
  return travado.motivo === 'muitas_tentativas' && certo.ok === false && n == 5;
});
await t('estado mostra a trava pra tela contar o tempo', async () =>
  Number((await estado()).tenta_de_novo_em) > 0);
await t('16 minutos depois destrava, e o acerto zera as tentativas', async () => {
  await q(`update carteira_pin_tentativa set em = em - interval '16 minutes' where user_id=$1`, [u.ana]);
  const r = await verificar('111222');
  const n = (await q(`select count(*) n from carteira_pin_tentativa where user_id=$1`, [u.ana]))[0].n;
  return r.ok === true && n == 0;
});

// ── trocar: só com login dos últimos 5 minutos ─────────────────────────────
await t('troca sem login recente recusa (login_antigo)', async () =>
  (await definir('333444')).motivo === 'login_antigo');
await t('troca com login velho de 6 minutos também recusa', async () => {
  await como(u.ana, 6 * 60);
  return (await definir('333444')).motivo === 'login_antigo';
});
await t('troca com login fresco entra — e é o caminho de quem esqueceu', async () => {
  await como(u.ana, 30);
  const r = await definir('333444');
  return r.ok === true && (await verificar('111222')).ok === false && (await verificar('333444')).ok === true;
});
await t('a troca zera a trava do PIN antigo', async () => {
  for (let i = 0; i < 5; i++) await verificar('000000');
  await como(u.ana, 10);
  const r = await definir('555666');
  const n = (await q(`select count(*) n from carteira_pin_tentativa where user_id=$1`, [u.ana]))[0].n;
  return r.ok === true && n == 0;
});

// ── a porta do NETWORK ─────────────────────────────────────────────────────
await t('com PIN criado, a assinatura antiga fecha (PIN_OBRIGATORIO)', async () => {
  try { await perna(1); return false; }
  catch (e) { return e.message.includes('PIN_OBRIGATORIO'); }
});
await t('PIN errado não muda o time (e conta como erro)', async () => {
  await q(`delete from carteira_pin_tentativa where user_id=$1`, [u.ana]);
  const r = await pernaPin(1, '000000');
  const lado = (await q(`select perna_padrao from expansao_no where user_id=$1`, [u.ana]))[0].perna_padrao;
  const n = (await q(`select count(*) n from carteira_pin_tentativa where user_id=$1`, [u.ana]))[0].n;
  return r.ok === false && r.motivo === 'pin_errado' && Number(lado) === 2 && n == 1;
});
await t('PIN certo muda o time de verdade', async () => {
  const r = await pernaPin(1, '555666');
  const lado = (await q(`select perna_padrao from expansao_no where user_id=$1`, [u.ana]))[0].perna_padrao;
  return r.ok === true && Number(r.lado) === 1 && Number(lado) === 1;
});
await t('null volta pro automático, com PIN', async () => {
  const r = await pernaPin(null, '555666');
  const lado = (await q(`select perna_padrao from expansao_no where user_id=$1`, [u.ana]))[0].perna_padrao;
  return r.ok === true && lado === null;
});
await t('fora da árvore o PIN certo passa da porta mas a árvore recusa', async () => {
  await como(u.bia, 30);
  await definir('777888');
  try { await pernaPin(1, '777888'); return false; }
  catch (e) { return e.message.includes('fora_da_arvore'); }
});

// ── placar ─────────────────────────────────────────────────────────────────
let falhas = 0;
for (const [n, ok, err] of T) {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${err ? ` — ${err}` : ''}`);
  if (!ok) falhas++;
}
console.log(falhas === 0 ? `\n🟢 ${T.length} passaram, 0 falharam` : `\n🔴 ${falhas} de ${T.length} falharam`);
process.exit(falhas === 0 ? 0 : 1);
