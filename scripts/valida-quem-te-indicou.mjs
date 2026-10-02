/**
 * "Quem te indicou?" — a compra respeita o indicador declarado.
 *   node scripts/valida-quem-te-indicou.mjs
 *
 * O caso que motivou (02/10): a 1ª venda real caiu na ORIGEM porque o código de
 * cadastro do comprador não pertencia a ninguém e ele não abriu o convite.
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const u = {};
const db = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0, '20260930100000_expansao_ciclo_horario.sql',
           '20261002140000_expansao_quem_te_indicou.sql'],
  antesDosExtras: async (d) => {
    for (const n of ['raiz', 'padrinho', 'semativar', 'tiago', 'maria', 'joao', 'livre']) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into profiles (id, username, my_referral_code) values ($1,$2,$3)`,
        [id, n, `COD${n.toUpperCase()}`.slice(0, 8).padEnd(6, 'X')]);
      u[n] = id;
    }
    await d.query(`select expansao_inserir($1,null,null,null)`, [u.raiz]);
    await d.query(`insert into expansao_ativacao_casa (user_id, motivo) values ($1,'t'),($2,'t')`, [u.raiz, u.padrinho]);
    await d.query(`select expansao_inserir($1,$2,$2,1::smallint)`, [u.padrinho, u.raiz]);
    await d.query(`select expansao_inserir($1,$2,$2,2::smallint)`, [u.semativar, u.raiz]);
  },
});
const q = async (s, p = []) => (await db.query(s, p)).rows;
const como = (id) => q(`select set_config('request.jwt.claims', $1, false)`, [id ? JSON.stringify({ sub: id, role: 'authenticated' }) : '']);
const escolher = async (id, nome) => { await como(id); const r = (await q(`select * from expansao_escolher_patrocinador($1)`, [nome]))[0]; await como(null); return r; };
const sugestao = async (id) => { await como(id); const r = (await q(`select * from expansao_meu_indicador()`))[0]; await como(null); return r; };
const comprar = async (id) => (await q(`select * from expansao_entrar_por_compra($1)`, [id]))[0];
const pat = async (id) => (await q(`select (select username from profiles where id=patrocinador_id) p from expansao_no where user_id=$1`, [id]))[0]?.p;

const T = []; const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

await t('@ inexistente é recusado', async () => (await escolher(u.tiago, '@ninguem')).motivo === 'inexistente');
await t('indicar a si mesmo é recusado', async () => (await escolher(u.tiago, 'tiago')).motivo === 'auto_indicacao');
await t('padrinho sem ativação é recusado', async () => (await escolher(u.tiago, 'semativar')).motivo === 'nao_ativado');
await t('🔑 Tiago declara @padrinho (com @ e maiúscula) e é aceito', async () => (await escolher(u.tiago, '@PADRINHO')).ok);
await t('a sugestão do checkout traz a escolha', async () => { const s = await sugestao(u.tiago); return s.sugerido === 'padrinho' && s.fonte === 'escolhido'; });
await t('🔑 a compra coloca o Tiago sob o padrinho, como convite', async () => {
  const r = await comprar(u.tiago);
  const o = (await q(`select origem from expansao_confirmacao where user_id=$1`, [u.tiago]))[0]?.origem;
  return r.entrou && await pat(u.tiago) === 'padrinho' && o === 'convite';
});
await t('depois de entrar, não troca mais', async () => (await escolher(u.tiago, 'raiz')).motivo === 'ja_esta_na_arvore');

// cadastro por link: o código de cadastro aponta pro padrinho
await q(`update profiles set referred_by_code='CODPADRI' where id=$1`, [u.maria]);
await t('cadastro por link: a sugestão vem preenchida pelo código', async () => { const s = await sugestao(u.maria); return s.sugerido === 'padrinho' && s.fonte === 'cadastro'; });
await t('cadastro por link sem escolha: a compra segue o código (como antes)', async () => (await comprar(u.maria)).entrou && await pat(u.maria) === 'padrinho');

// escolha vale mais que o código
await q(`update profiles set referred_by_code='CODPADRI' where id=$1`, [u.joao]);
await escolher(u.joao, 'raiz');
await t('🔑 a escolha do checkout vale mais que o código de cadastro', async () => (await comprar(u.joao)).entrou && await pat(u.joao) === 'raiz');

await t('"ninguém me indicou" limpa a escolha', async () => {
  await escolher(u.livre, 'padrinho'); const r = await escolher(u.livre, '');
  return r.ok && (await q(`select count(*)::int n from expansao_patrocinador_escolhido where user_id=$1`, [u.livre]))[0].n === 0;
});
await t('sem escolha e sem código: cai na ORIGEM (como antes)', async () => (await comprar(u.livre)).entrou && await pat(u.livre) === 'raiz');

await t('código de quem convida sai pro link de cadastro', async () =>
  (await q(`select codigo_de_indicacao_de('@Padrinho') c`))[0].c === 'CODPADRI'
  && (await q(`select codigo_de_indicacao_de('semativar') c`))[0].c === null);

let f = 0; for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`); process.exit(f === 0 ? 0 : 1);
