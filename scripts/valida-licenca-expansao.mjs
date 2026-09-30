/**
 * Valida a licença de ativação da expansão. `npm run test:licenca-expansao`
 *
 * O que precisa ficar provado, na ordem de quanto custa errar:
 *   1. a licença ativa SEM dinheiro — nenhuma compra, posição, OLEXP, volume
 *      ou receita. O pool é 25% do que entrou; licença não entra;
 *   2. o código não fica guardado, e só o servidor gera, revoga e lista;
 *   3. cada licença ativa uma conta, uma vez, e quem já está ativado não gasta;
 *   4. a conta entra debaixo do patrocinador da licença, ou pela indicação do
 *      jogo, e conta como direto dele pra regra "1 em cada time".
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';

const NOMES = ['raiz', 'ana', 'bia', 'caio', 'davi', 'eva', 'fabio', 'gil', 'hugo', 'iris', 'livre'];
const u = {};

const db = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0, '20260930100000_expansao_ciclo_horario.sql',
           '20260930160000_expansao_licenca.sql'],
  // A verificação de dentro da migration precisa de raiz e de uma conta livre.
  antesDosExtras: async (d) => {
    for (const n of NOMES) {
      const id = (await d.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t`])).rows[0].id;
      await d.query(`insert into public.profiles (id, username, display_name, my_referral_code)
                     values ($1,$2,$2,$3)`, [id, n, `COD${n.toUpperCase()}`.slice(0, 8).padEnd(6, 'X')]);
      u[n] = id;
    }
    await d.query(`select public.expansao_inserir($1,null,null,null)`, [u.raiz]);
    await d.query(`insert into public.expansao_ativacao_casa (user_id, motivo, ativado_por)
                   values ($1,'origem','teste')`, [u.raiz]);
  },
});

const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const como = async (id) => q(`select set_config('request.jwt.claims', $1, false)`,
  [id ? JSON.stringify({ sub: id, role: 'authenticated' }) : '']);
const resgatar = async (id, codigo) => {
  await como(id);
  const r = (await q(`select * from public.expansao_resgatar_licenca($1)`, [codigo]))[0];
  await como(null);
  return r;
};
const gerar = async (n, pat = null, expira = null, lote = 'teste') =>
  q(`select * from public.expansao_licenca_gerar($1,$2,$3,$4,'fundador@t')`, [n, lote, pat, expira]);
const estoura = async (f, prefixo) => {
  try { await f(); return false; } catch (e) { return e.message.includes(prefixo); }
};
const pode = async (id) => (await q(`select public.expansao_pode_convidar_interno($1) p`, [id]))[0].p;

const T = [];
const t = async (n, f) => { try { T.push([n, await f()]); } catch (e) { T.push([n, false, e.message]); } };

// ── a Ana entra e é ativada pela casa: é a patrocinadora das licenças ──────
await q(`select * from public.expansao_entrar($1,$2)`, [u.ana, u.raiz]);
await q(`insert into public.expansao_ativacao_casa (user_id, motivo, ativado_por) values ($1,'x','teste')`, [u.ana]);

// ── gerar ──────────────────────────────────────────────────────────────────
const lote = await gerar(3, u.ana);
await t('gera 3 códigos no formato OLE-XXXX-XXXX-XXXX', () =>
  lote.length === 3 && lote.every((l) => /^OLE-[2-9A-HJKMNP-TV-Z]{4}(-[2-9A-HJKMNP-TV-Z]{4}){2}$/.test(l.codigo)));
await t('🔒 o código NÃO fica guardado — só o hash e os 4 finais', async () => {
  const linhas = await q(`select * from public.expansao_licenca`);
  const tudo = JSON.stringify(linhas);
  return lote.every((l) => !tudo.includes(l.codigo.replace(/-/g, '').slice(3)))
    && linhas.every((l) => /^[0-9a-f]{64}$/.test(l.codigo_hash));
});
await t('os 4 finais batem com o código', async () => {
  const f = await q(`select id, final from public.expansao_licenca order by id`);
  return lote.every((l) => f.find((x) => Number(x.id) === Number(l.licenca_id))?.final === l.codigo.slice(-4));
});
await t('recusa lote de 0 e de 501', async () =>
  await estoura(() => gerar(0), 'LICENCA_QUANTIDADE') && await estoura(() => gerar(501), 'LICENCA_QUANTIDADE'));
await t('recusa patrocinador que não está ativado', () => estoura(() => gerar(1, u.hugo), 'LICENCA_PATROCINADOR'));
await t('recusa validade no passado', () =>
  estoura(() => gerar(1, null, new Date(Date.now() - 1000).toISOString()), 'LICENCA_VALIDADE'));
await t('recusa lote sem nome', () =>
  estoura(() => q(`select * from public.expansao_licenca_gerar(1,'  ',null,null,'x')`), 'LICENCA_LOTE'));

await t('500 códigos, todos diferentes, alfabeto sem viés grosseiro', async () => {
  const cs = (await gerar(500, null, null, 'volume')).map((l) => l.codigo.replace(/^OLE-|-/g, ''));
  if (new Set(cs).size !== 500) return false;
  const freq = {};
  for (const c of cs.join('')) freq[c] = (freq[c] ?? 0) + 1;
  const esperado = 6000 / 30;
  const qui = Object.values(freq).reduce((s, o) => s + (o - esperado) ** 2 / esperado, 0);
  // 29 graus de liberdade: p=0,001 ≈ 58. O viés do módulo sem rejeição dava ~150.
  return Object.keys(freq).length === 30 && qui < 58;
});

// ── resgatar ───────────────────────────────────────────────────────────────
const receitaAntes = (await q(`select coalesce(sum(usd_cents),0) s from public.presale_purchase`))[0].s;
const volumeAntes = (await q(`select coalesce(sum(volume),0) s from public.expansao_perna`))[0].s;

const colado = ' ' + lote[0].codigo.toLowerCase().replace(/-/g, ' ') + ' ';
const rBia = await resgatar(u.bia, colado);
await t('Bia resgata colando em minúscula e com espaço', () => rBia.ativou === true && rBia.patrocinador === 'ana');
await t('Bia entrou debaixo da Ana, com origem licença', async () =>
  (await q(`select 1 from public.expansao_no n join public.expansao_confirmacao c using (user_id)
             where n.user_id=$1 and n.patrocinador_id=$2 and c.origem='licenca'`, [u.bia, u.ana])).length === 1);
await t('Bia pode convidar', () => pode(u.bia));
await t('🔴 nenhuma compra, posição, OLEXP ou BRO', async () =>
  (await q(`select 1 from public.presale_purchase where user_id=$1
            union all select 1 from public.presale_position where user_id=$1 and tokens_totais > 0
            union all select 1 from public.expansao_olexp where user_id=$1
            union all select 1 from public.wallet_credits where user_id=$1`, [u.bia])).length === 0);
await t('🔴 a receita e o volume das pernas não andaram', async () =>
  (await q(`select coalesce(sum(usd_cents),0) s from public.presale_purchase`))[0].s === receitaAntes
  && (await q(`select coalesce(sum(volume),0) s from public.expansao_perna`))[0].s === volumeAntes);
await t('🔴 e a janela do ciclo continua sem receita', async () =>
  Number((await q(`select public.expansao_receita_da_janela(now() - interval '1 day', now() + interval '1 day') r`))[0].r) === 0);
await t('a licença ficou marcada como usada pela Bia', async () =>
  (await q(`select usada_por from public.expansao_licenca where id=$1`, [lote[0].licenca_id]))[0].usada_por === u.bia);

await t('Bia repetindo o código: "já ativada por esta licença"', async () =>
  (await resgatar(u.bia, lote[0].codigo)).motivo === 'ja_ativada_por_esta_licenca');
await t('Caio com o código da Bia: "já usada"', async () =>
  (await resgatar(u.caio, lote[0].codigo)).motivo === 'licenca_ja_usada');
await t('uma conta não usa duas licenças', async () =>
  (await resgatar(u.bia, lote[1].codigo)).motivo === 'conta_ja_ativada');

await t('quem já está ativado não gasta licença (e ela segue livre)', async () => {
  const r = await resgatar(u.ana, lote[1].codigo);
  const livre = (await q(`select usada_por from public.expansao_licenca where id=$1`, [lote[1].licenca_id]))[0].usada_por === null;
  return r.motivo === 'conta_ja_ativada' && livre;
});

await t('licença expirada não ativa', async () => {
  await q(`update public.expansao_licenca set expira_em = now() - interval '1 minute' where id=$1`, [lote[1].licenca_id]);
  const r = await resgatar(u.caio, lote[1].codigo);
  await q(`update public.expansao_licenca set expira_em = null where id=$1`, [lote[1].licenca_id]);
  return r.motivo === 'licenca_expirada' && !(await pode(u.caio));
});

await t('licença revogada antes do uso não ativa', async () => {
  await q(`select public.expansao_licenca_revogar($1,'fundador@t','perdida')`, [lote[2].licenca_id]);
  return (await resgatar(u.caio, lote[2].codigo)).motivo === 'licenca_revogada';
});

await t('🔒 10 erros na hora travam — nem o código certo passa depois', async () => {
  for (let i = 0; i < 10; i++) await resgatar(u.davi, `OLE-2222-2222-${String(2222 + i).replace(/[01]/g, '2')}`);
  const r = await resgatar(u.davi, lote[1].codigo);
  const livre = (await q(`select usada_por from public.expansao_licenca where id=$1`, [lote[1].licenca_id]))[0].usada_por === null;
  return r.motivo === 'muitas_tentativas' && livre && !(await pode(u.davi));
});

await t('Caio usa a licença livre e fica ativo', async () => (await resgatar(u.caio, lote[1].codigo)).ativou);

// ── a regra "1 em cada time" da Ana ────────────────────────────────────────
await t('Bia e Caio contam como diretos da Ana, um em cada time', async () =>
  (await q(`select public.expansao_ativo_interno($1) a`, [u.ana]))[0].a === true);

// ── sem patrocinador: sobe a indicação do jogo ─────────────────────────────
await t('licença sem patrocinador segue o código de cadastro (Eva → Bia)', async () => {
  const codBia = (await q(`select my_referral_code c from public.profiles where id=$1`, [u.bia]))[0].c;
  await q(`update public.profiles set referred_by_code=$1 where id=$2`, [codBia, u.eva]);
  const [l] = await gerar(1);
  const r = await resgatar(u.eva, l.codigo);
  const pat = (await q(`select patrocinador_id from public.expansao_no where user_id=$1`, [u.eva]))[0]?.patrocinador_id;
  const orig = (await q(`select origem from public.expansao_confirmacao where user_id=$1`, [u.eva]))[0]?.origem;
  return r.ativou && pat === u.bia && orig === 'licenca';
});
await t('licença sem patrocinador e sem indicação cai na ORIGEM', async () => {
  const [l] = await gerar(1);
  const r = await resgatar(u.fabio, l.codigo);
  const pat = (await q(`select patrocinador_id from public.expansao_no where user_id=$1`, [u.fabio]))[0]?.patrocinador_id;
  return r.ativou && pat === u.raiz;
});
await t('quem já estava na árvore sem ativação é ativado sem ser movido', async () => {
  await q(`select * from public.expansao_entrar($1,$2)`, [u.gil, u.raiz]);
  const antes = (await q(`select pai_id, lado from public.expansao_no where user_id=$1`, [u.gil]))[0];
  const [l] = await gerar(1, u.ana);
  const r = await resgatar(u.gil, l.codigo);
  const depois = (await q(`select pai_id, lado, patrocinador_id from public.expansao_no where user_id=$1`, [u.gil]))[0];
  return r.ativou && await pode(u.gil) && depois.pai_id === antes.pai_id && depois.patrocinador_id === u.raiz;
});

// ── revogar depois do uso ──────────────────────────────────────────────────
await t('revogar licença USADA tira a ativação e mantém a posição', async () => {
  const ok = (await q(`select public.expansao_licenca_revogar($1,'fundador@t','teste') r`, [lote[0].licenca_id]))[0].r;
  const naArvore = (await q(`select 1 from public.expansao_no where user_id=$1`, [u.bia])).length === 1;
  return ok && !(await pode(u.bia)) && naArvore;
});
await t('revogar duas vezes devolve false', async () =>
  (await q(`select public.expansao_licenca_revogar($1,'fundador@t','de novo') r`, [lote[0].licenca_id]))[0].r === false);

// ── listar ─────────────────────────────────────────────────────────────────
await t('a lista mostra situação, patrocinador e quem usou', async () => {
  const l = await q(`select * from public.expansao_licenca_listar(1000)`);
  const bia = l.find((x) => Number(x.licenca_id) === Number(lote[0].licenca_id));
  const caio = l.find((x) => Number(x.licenca_id) === Number(lote[1].licenca_id));
  return bia.situacao === 'revogada' && bia.usada_por === 'bia' && bia.patrocinador === 'ana'
    && caio.situacao === 'usada' && l.some((x) => x.situacao === 'livre');
});

// ── portas ─────────────────────────────────────────────────────────────────
await t('🔒 cliente não gera, não revoga, não lista, não lê o "interno"', async () => {
  const fn = [
    'expansao_licenca_gerar(integer,text,uuid,timestamptz,text)', 'expansao_licenca_revogar(bigint,text,text)',
    'expansao_licenca_listar(integer)', 'expansao_pode_convidar_interno(uuid)',
    'expansao_licenca_hash(text)', 'expansao_licenca_normalizar(text)',
  ];
  for (const f of fn) for (const r of ['anon', 'authenticated']) {
    if ((await q(`select has_function_privilege($1, $2, 'execute') p`, [r, `public.${f}`]))[0].p) return false;
  }
  return !(await q(`select has_function_privilege('anon','public.expansao_resgatar_licenca(text)','execute') p`))[0].p
    && (await q(`select has_function_privilege('authenticated','public.expansao_resgatar_licenca(text)','execute') p`))[0].p;
});
await t('🔒 sem sessão, resgatar estoura', () =>
  estoura(() => q(`select * from public.expansao_resgatar_licenca('OLE-2222-2222-2222')`), 'must be authenticated'));
await t('🔒 a tabela só mostra ao dono a licença que ele usou', async () =>
  (await q(`select count(*) c from pg_policy p join pg_class k on k.oid = p.polrelid
             where k.relname = 'expansao_licenca'`))[0].c === 1n
  || Number((await q(`select count(*) c from pg_policy p join pg_class k on k.oid = p.polrelid
             where k.relname = 'expansao_licenca'`))[0].c) === 1);

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
