/**
 * Valida a trava do login do painel admin. `npm run test:admin-login`
 *
 * O que precisa ficar provado:
 *   1. só existe UMA assinatura de admin_panel_login (a de 5 argumentos) — as
 *      overloads de 2 e 4 que davam brute-force anônimo morreram;
 *   2. 5 erros por e-mail travam por 15 minutos; travado, nem a senha certa
 *      entra e a tentativa não é registrada (não estica o cadeado);
 *   3. cada tentativa (erro e acerto) fica em admin_login_attempts;
 *   4. a trava é POR E-MAIL: outro admin continua entrando.
 */
import { readFileSync } from 'node:fs';
import { M, montarBanco } from './lib/bancoDescartavel.mjs';

const db = await montarBanco({
  // A 20260425000000 inteira não aplica no PGlite: o set_password antigo tem um
  // `%` solto numa mensagem de RAISE (placeholder sem argumento) — bug latente
  // que produção nunca viu porque a 000100 substituiu a função antes de alguém
  // errar a senha. Aqui entra fatiada até esse ponto; a 000100 traz a versão viva.
  antesDosExtras: async (d) => {
    const sql = readFileSync(M + '20260425000000_admin_panel_login.sql', 'utf8');
    await d.exec(sql.slice(0, sql.indexOf('create or replace function public.admin_panel_set_password')));
  },
  extras: ['20260425000002_admin_rate_limiting.sql',
           '20260425000100_admin_panel_login_crypt_fix.sql',
           '20260930235000_admin_p0_trava_login.sql'],
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const login = async (email, senha) =>
  (await q(`select * from public.admin_panel_login($1, $2)`, [email, senha]))[0] ?? null;

await q(`insert into admin_panel_users (email, password_hash, display_name)
         values ('a@t', extensions.crypt('Senha-Boa-1', extensions.gen_salt('bf')), 'A'),
                ('b@t', extensions.crypt('Senha-Boa-2', extensions.gen_salt('bf')), 'B')`);

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

await t('só a assinatura de 5 argumentos existe', async () => {
  const l = await q(`select pronargs from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                      where n.nspname='public' and p.proname='admin_panel_login'`);
  return l.length === 1 && Number(l[0].pronargs) === 5;
});
await t('senha certa entra e registra o sucesso', async () => {
  const r = await login('a@t', 'Senha-Boa-1');
  const n = (await q(`select count(*) n from admin_login_attempts where email='a@t' and success`))[0].n;
  return r?.email === 'a@t' && Number(n) === 1;
});
await t('5 erros travam; o 6º (senha certa) volta vazio e não conta', async () => {
  for (let i = 0; i < 5; i++) await login('a@t', 'errada');
  const travado = await login('a@t', 'Senha-Boa-1');
  const n = (await q(`select count(*) n from admin_login_attempts where email='a@t'`))[0].n;
  return travado === null && Number(n) === 6; // 1 sucesso + 5 erros, nada do bloqueio
});
await t('a trava é por e-mail: o outro admin entra normal', async () =>
  (await login('b@t', 'Senha-Boa-2'))?.email === 'b@t');
await t('16 minutos depois a senha certa entra de novo', async () => {
  await q(`update admin_login_attempts set attempted_at = attempted_at - interval '16 minutes'
            where email='a@t'`);
  return (await login('a@t', 'Senha-Boa-1'))?.email === 'a@t';
});
await t('e-mail inexistente não vaza nada (volta vazio, registra erro)', async () => {
  const r = await login('ninguem@t', 'x');
  const n = (await q(`select count(*) n from admin_login_attempts where email='ninguem@t'`))[0].n;
  return r === null && Number(n) === 1;
});

let falhas = 0;
for (const [n, ok, err] of T) {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${err ? ` — ${err}` : ''}`);
  if (!ok) falhas++;
}
console.log(falhas === 0 ? `\n🟢 ${T.length} passaram, 0 falharam` : `\n🔴 ${falhas} de ${T.length} falharam`);
process.exit(falhas === 0 ? 0 : 1);
