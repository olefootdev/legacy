/**
 * O ciclo horário em SQL faz a MESMA conta do motor em TS.
 *   npm run test:ciclo-paridade
 *
 * O motor da equiparação (`server/src/lib/expansao/equiparacao.ts`) tem 162
 * checagens. O fechamento que roda em produção é SQL. Se os dois divergirem,
 * os testes passam e o bônus sai errado — então este arquivo simula horas de
 * rede com compras aleatórias, fecha cada hora no SQL e confere, ciclo a
 * ciclo e pessoa a pessoa, contra as funções do TS:
 *
 *   status, pool, equiparado total, valor por OLEXP, bônus, sobra das pernas,
 *   retenção por inatividade e a carreira acumulada.
 *
 * Semente fixa: a mesma rede sai toda vez, e uma falha se reproduz.
 */
import { MIGRATIONS_DA_FASE0, montarBanco } from './lib/bancoDescartavel.mjs';
import {
  aplicarTetoDiario, bonusContabil, equipararSeAtivo, fecharCiclo, poolDoCiclo, PERCENTUAL_BPS_PADRAO,
  TETO_DIARIO_CENTAVOS,
} from '../server/src/lib/expansao/equiparacao.js';
import { olexpDaCompra } from '../server/src/lib/expansao/unidade.js';

// ── números previsíveis ─────────────────────────────────────────────────────
let semente = 20260930;
const sorteio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const um = <T,>(xs: readonly T[]): T => xs[Math.floor(sorteio() * xs.length)] as T;

// O pack de $10.000 existe pra simulação bater no teto diário de $2.500.
const PACKS = [1_000, 5_000, 25_000, 50_000, 125_000, 1_599, 1_000_000] as const;
const USUARIOS = 24;
const HORAS = 40;

const criarUsuarios = async (db: any, n: number) => {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`u${i}@t`])).rows[0].id;
    await db.query(`insert into public.profiles (id, username, display_name) values ($1,$2,$2)`, [id, `u${i}`]);
    ids.push(id);
  }
  return ids;
};

let usuarios: string[] = [];
const db: any = await montarBanco({
  extras: [...MIGRATIONS_DA_FASE0, '20260930100000_expansao_ciclo_horario.sql',
           '20260930180000_expansao_ponto_fixo_teto_diario.sql'],
  // A verificação de dentro da migration do ciclo precisa de contas pra montar
  // a rede dela. Criadas antes, ficam disponíveis pra simulação também.
  antesDosExtras: async (d: any) => { usuarios = await criarUsuarios(d, USUARIOS); },
});

const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const T: [string, boolean, string?][] = [];
const t = async (n: string, f: () => Promise<boolean> | boolean) => {
  try { T.push([n, await f()]); } catch (e) { T.push([n, false, (e as Error).message]); }
};

// ── a rede ─────────────────────────────────────────────────────────────────
const [raiz, ...resto] = usuarios as [string, ...string[]];
await q(`select public.expansao_inserir($1,null,null,null)`, [raiz]);
const naArvore: string[] = [raiz];
for (const u of resto) {
  // Patrocinador sorteado entre quem já entrou: dá árvore funda e desbalanceada,
  // que é onde a perna menor troca de lado.
  const pat = um(naArvore);
  const r = (await q(`select * from public.expansao_entrar($1,$2)`, [u, pat]))[0];
  if (!r.entrou) throw new Error(`não entrou: ${r.motivo}`);
  naArvore.push(u);
}

// ── as horas ───────────────────────────────────────────────────────────────
const agora = Date.now();
const hora0 = Math.floor(agora / 3_600_000) * 3_600_000 - (HORAS + 2) * 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const carreiraTs = new Map<string, bigint>();
let divergencias: string[] = [];
let ciclosPagos = 0, ciclosRetidos = 0, retencoesPorInatividade = 0, trocasDeLado = 0, cortes = 0, horasSemReceitaPagas = 0;
// O que cada um já recebeu no dia de São Paulo — a mesma chave do SQL.
const diaSP = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const noDia = new Map<string, bigint>();
const ladoMenorAntes = new Map<string, 1 | 2>();

for (let h = 0; h < HORAS; h++) {
  const abre = hora0 + h * 3_600_000;

  // Compras da hora. Um terço das horas não tem compra nenhuma: é onde o
  // ciclo tem que ficar HELD e não debitar.
  let receita = 0n;
  const compras = sorteio() < 0.33 ? 0 : 1 + Math.floor(sorteio() * 4);
  for (let c = 0; c < compras; c++) {
    const quem = um(resto);
    const usd = um(PACKS);
    const ref = `h${h}-c${c}`;
    const quando = iso(abre + 60_000 * (1 + c));
    await q(`insert into public.presale_purchase (user_id, ref, usd_cents, brl_cents, brl_por_usd_micro,
               tokens_entregues, tokens_brutos, status, criada_em, paga_em)
             values ($1,$2,$3,$4,5500000,$5,$6,'pago',$7,$7)`,
      [quem, ref, usd, Math.ceil(usd * 5.5), usd * 80, usd * 85, quando]);
    await q(`select public.expansao_creditar($1,$2,'compra_olefoot',$3)`,
      [quem, String(olexpDaCompra(BigInt(usd))), ref]);
    receita += BigInt(usd);
  }

  // O que o TS espera, a partir das pernas como estão AGORA.
  const pernas = await q(`select user_id,
      coalesce(sum(volume) filter (where lado=1),0)::text t1,
      coalesce(sum(volume) filter (where lado=2),0)::text t2
    from public.expansao_perna where trilho='equiparacao' group by user_id`);
  const esperado = new Map<string, { eq: bigint; t1: bigint; t2: bigint; retido: boolean }>();
  let total = 0n;
  for (const p of pernas) {
    const t1 = BigInt(p.t1), t2 = BigInt(p.t2);
    if (t1 === 0n || t2 === 0n) continue;
    const ativo = (await q(`select public.expansao_ativo_interno($1) a`, [p.user_id]))[0].a as boolean;
    const e = equipararSeAtivo({ time1: t1, time2: t2 },
      { ativo, diretosTime1: 0, diretosTime2: 0, faltaNaPerna: ativo ? null : 1 });
    esperado.set(p.user_id, { eq: e.equiparado, t1, t2, retido: e.retidoPorInatividade });
    total += e.equiparado;
    const menor: 1 | 2 = t1 <= t2 ? 1 : 2;
    if (ladoMenorAntes.has(p.user_id) && ladoMenorAntes.get(p.user_id) !== menor) trocasDeLado++;
    ladoMenorAntes.set(p.user_id, menor);
  }
  const pool = poolDoCiclo(receita, { percentualBps: PERCENTUAL_BPS_PADRAO });
  const liq = fecharCiclo(pool, total);

  // O SQL fecha.
  const c = (await q(`select * from public.expansao_fechar_ciclo($1)`, [iso(abre)]))[0];
  const ciclo = (await q(`select * from public.expansao_ciclo where id=$1`, [c.ciclo_id]))[0];

  const onde = `hora ${h}`;
  const statusTs = liq.status === 'READY' ? 'SETTLED' : 'HELD';
  if (c.status !== statusTs) divergencias.push(`${onde}: status SQL ${c.status}, TS ${statusTs}`);
  if (BigInt(ciclo.pool) !== pool) divergencias.push(`${onde}: pool SQL ${ciclo.pool}, TS ${pool}`);
  if (BigInt(ciclo.equiparado_total) !== total) divergencias.push(`${onde}: total SQL ${ciclo.equiparado_total}, TS ${total}`);
  if ((ciclo.valor_por_olexp_micro == null ? null : BigInt(ciclo.valor_por_olexp_micro)) !== liq.valorPorOlexpMicro) {
    divergencias.push(`${onde}: valor SQL ${ciclo.valor_por_olexp_micro}, TS ${liq.valorPorOlexpMicro}`);
  }

  if (liq.status === 'READY') {
    ciclosPagos++;
    if (receita === 0n) horasSemReceitaPagas++;
    const linhas = await q(`select user_id, equiparado::text eq, bonus_contabil::text b, retido_inativo r,
                                   sobra_t1::text s1, sobra_t2::text s2, cortado_teto::text ct
                              from public.expansao_liquidacao where ciclo_id=$1`, [c.ciclo_id]);
    if (linhas.length !== esperado.size) divergencias.push(`${onde}: ${linhas.length} linhas SQL, ${esperado.size} TS`);
    for (const l of linhas) {
      const e = esperado.get(l.user_id);
      if (!e) { divergencias.push(`${onde}: SQL liquidou quem o TS não esperava`); continue; }
      const chave = `${l.user_id}|${diaSP(abre)}`;
      const bruto = e.retido ? 0n : bonusContabil(e.eq, liq.valorPorOlexpMicro as bigint);
      const teto = aplicarTetoDiario(bruto, noDia.get(chave) ?? 0n);
      noDia.set(chave, (noDia.get(chave) ?? 0n) + teto.pago);
      if (teto.cortado > 0n) cortes++;
      if (BigInt(l.eq) !== e.eq) divergencias.push(`${onde}: equiparado ${l.eq} ≠ ${e.eq}`);
      if (BigInt(l.b) !== teto.pago) divergencias.push(`${onde}: bônus ${l.b} ≠ ${teto.pago}`);
      if (BigInt(l.ct) !== teto.cortado) divergencias.push(`${onde}: cortado ${l.ct} ≠ ${teto.cortado}`);
      if (l.r !== e.retido) divergencias.push(`${onde}: retido ${l.r} ≠ ${e.retido}`);
      if (BigInt(l.s1) !== e.t1 - e.eq || BigInt(l.s2) !== e.t2 - e.eq) divergencias.push(`${onde}: sobra errada`);
      if (e.retido) retencoesPorInatividade++;
      carreiraTs.set(l.user_id, (carreiraTs.get(l.user_id) ?? 0n) + e.eq);
    }
    // As pernas depois do débito são as sobras.
    const depois = await q(`select user_id,
        coalesce(sum(volume) filter (where lado=1),0)::text t1,
        coalesce(sum(volume) filter (where lado=2),0)::text t2
      from public.expansao_perna where trilho='equiparacao' group by user_id`);
    for (const d of depois) {
      const e = esperado.get(d.user_id);
      if (!e) continue;
      if (BigInt(d.t1) !== e.t1 - e.eq || BigInt(d.t2) !== e.t2 - e.eq) {
        divergencias.push(`${onde}: perna depois do débito ${d.t1}/${d.t2}, TS ${e.t1 - e.eq}/${e.t2 - e.eq}`);
      }
    }
  } else {
    ciclosRetidos++;
    const n = (await q(`select count(*)::int n from public.expansao_liquidacao where ciclo_id=$1`, [c.ciclo_id]))[0].n;
    if (n !== 0) divergencias.push(`${onde}: ciclo HELD escreveu ${n} liquidação(ões)`);
  }
}

// ── o que tem que ter acontecido ────────────────────────────────────────────
await t(`🔑 ${HORAS} horas fechadas, SQL e TS iguais em tudo`, () => {
  if (divergencias.length) console.log(divergencias.slice(0, 10).map((d) => '       ' + d).join('\n'));
  return divergencias.length === 0;
});
await t(`   a simulação passou por ciclos pagos (${ciclosPagos}) e retidos (${ciclosRetidos})`,
  () => ciclosPagos > 0 && ciclosRetidos > 0);
await t(`   e por retenção de quem não tinha 1 indicado em cada time (${retencoesPorInatividade})`,
  () => retencoesPorInatividade > 0);
await t(`   e pela perna menor trocando de lado (${trocasDeLado} vezes)`, () => trocasDeLado > 0);

await t('🔑 a carreira de cada um é a soma do que o TS equiparou', async () => {
  const nos = await q(`select user_id, equiparado_acumulado::text a from public.expansao_no`);
  return nos.every((n: any) => BigInt(n.a) === (carreiraTs.get(n.user_id) ?? 0n));
});
await t(`   e pelo teto diário cortando (${cortes} vezes)`, () => cortes > 0);
// Hora SEM receita e com ponto a equiparar. Na rede de verdade acontece quando
// alguém ativa (ganha o 2º direto) numa hora sem venda. A simulação aleatória
// quase nunca cai nisso, então o caso é montado: volume nas duas pernas da raiz
// e uma hora antiga, sem compra nenhuma.
await t(`🔑 hora sem receita paga pelo valor fixo (sorteadas: ${horasSemReceitaPagas})`, async () => {
  const [a1, b1] = (await q(`select user_id, lado from public.expansao_no where pai_id=$1 order by lado`, [raiz]));
  await q(`select public.expansao_creditar($1, 300, 'compra_olefoot', 'sem-receita-1')`, [a1.user_id]);
  await q(`select public.expansao_creditar($1, 300, 'compra_olefoot', 'sem-receita-2')`, [b1.user_id]);
  const hora = iso(hora0 - 5 * 3_600_000);
  const c = (await q(`select * from public.expansao_fechar_ciclo($1)`, [hora]))[0];
  const ciclo = (await q(`select * from public.expansao_ciclo where id=$1`, [c.ciclo_id]))[0];
  const l = (await q(`select equiparado::text eq, (bonus_contabil + cortado_teto)::text bruto
                        from public.expansao_liquidacao where ciclo_id=$1 and user_id=$2`, [c.ciclo_id, raiz]))[0];
  return c.status === 'SETTLED' && BigInt(ciclo.receita_menor_unid) === 0n
    && l && BigInt(l.bruto) === BigInt(l.eq) * 25n && BigInt(l.eq) >= 300n;
});
await t('🔒 ninguém passou de $2.500 num dia de São Paulo', async () =>
  (await q(`select count(*)::int n from (
     select l.user_id from public.expansao_liquidacao l join public.expansao_ciclo c on c.id=l.ciclo_id
      group by l.user_id, public.expansao_dia_do_teto(c.abre_em)
     having sum(l.bonus_contabil) > $1) x`, [String(TETO_DIARIO_CENTAVOS)]))[0].n === 0);
await t('🔑 cada ciclo grava o total pago e o cortado', async () =>
  (await q(`select count(*)::int n from public.expansao_ciclo c
     where c.bonus_total <> (select coalesce(sum(bonus_contabil),0) from public.expansao_liquidacao l where l.ciclo_id=c.id)
        or c.cortado_total <> (select coalesce(sum(cortado_teto),0) from public.expansao_liquidacao l where l.ciclo_id=c.id)`))[0].n === 0);
await t('🔑 o valor gravado em todo ciclo pago é $0,25', async () =>
  (await q(`select count(*)::int n from public.expansao_ciclo where status='SETTLED' and valor_por_olexp_micro <> 25000000`))[0].n === 0);
await t('🔒 o trilho de qualificação nunca é debitado', async () => {
  const q1 = (await q(`select coalesce(sum(volume),0)::text v from public.expansao_perna where trilho='qualificacao'`))[0].v;
  const e1 = (await q(`select coalesce(sum(volume),0)::text v from public.expansao_perna where trilho='equiparacao'`))[0].v;
  return BigInt(q1) >= BigInt(e1);
});

// ── o cron ─────────────────────────────────────────────────────────────────
await t('🔑 o fechamento em lote continua de onde parou e não repete hora', async () => {
  const antes = (await q(`select count(*)::int n from public.expansao_ciclo`))[0].n;
  const n = (await q(`select public.expansao_fechar_ciclos_pendentes() n`))[0].n;
  const depois = (await q(`select count(*)::int n from public.expansao_ciclo`))[0].n;
  const repetidas = (await q(`select count(*)::int n from (select abre_em from public.expansao_ciclo group by abre_em having count(*)>1) x`))[0].n;
  return n >= 1 && depois === antes + n && repetidas === 0;
});
await t('   rodar de novo na mesma hora não fecha nada', async () =>
  (await q(`select public.expansao_fechar_ciclos_pendentes() n`))[0].n === 0);
await t('🔒 hora que ainda não terminou é recusada', async () => {
  try { await q(`select * from public.expansao_fechar_ciclo(date_trunc('hour', now()))`); return false; }
  catch (e) { return /ainda não terminou/.test((e as Error).message); }
});
await t('🔒 janela fora da hora cheia é recusada', async () => {
  try { await q(`select * from public.expansao_fechar_ciclo(date_trunc('hour', now()) - interval '90 minutes')`); return false; }
  catch (e) { return /hora cheia/.test((e as Error).message); }
});

// ── o que a tela lê ────────────────────────────────────────────────────────
const loga = (id: string | null) => q(`select set_config('request.jwt.claims', $1, false)`,
  [JSON.stringify(id ? { sub: id, role: 'authenticated' } : { role: 'anon' })]);
await t('🔑 o bônus lido pela tela é a soma das liquidações, convertido pelo preço de cada ciclo', async () => {
  await loga(raiz);
  const m = (await q(`select * from public.expansao_meu_bonus()`))[0];
  await loga(null);
  const l = (await q(`select coalesce(sum(bonus_contabil),0)::text usd,
      coalesce(sum(floor(bonus_contabil*1000000/c.preco_micro)),0)::text tok
      from public.expansao_liquidacao li join public.expansao_ciclo c on c.id=li.ciclo_id where li.user_id=$1`, [raiz]))[0];
  return String(m.bonus_usd_cents) === l.usd && String(m.olefoot) === l.tok && BigInt(l.tok) === BigInt(l.usd) * 80n
    && String(m.teto_diario_cents) === '250000' && m.hoje_usd_cents != null;
});
await t('🔒 sem login, o bônus não responde', async () => {
  await loga(null);
  return (await q(`select * from public.expansao_meu_bonus()`)).length === 0;
});
await t('🔑 o dono escolhe o time do próximo indicado', async () => {
  await loga(raiz);
  await q(`select public.expansao_definir_perna_padrao(2::smallint)`);
  const m = (await q(`select perna_padrao p from public.expansao_meu_bonus()`))[0];
  await q(`select public.expansao_definir_perna_padrao(null)`);
  await loga(null);
  return m.p === 2;
});
await t('🔒 lado inválido é recusado', async () => {
  await loga(raiz);
  try { await q(`select public.expansao_definir_perna_padrao(3::smallint)`); return false; }
  catch { return true; } finally { await loga(null); }
});
const priv = async (f: string, r: string) =>
  (await q(`select has_function_privilege($1,$2,'execute') p`, [r, f]))[0].p as boolean;
for (const f of ['public.expansao_fechar_ciclo(timestamptz,integer,numeric,numeric,numeric)',
  'public.expansao_fechar_ciclos_pendentes(integer)', 'public.expansao_ativo_interno(uuid)',
  'public.expansao_receita_da_janela(timestamptz,timestamptz)']) {
  await t(`🔒 ${f.replace('public.', '').split('(')[0]} fechada pro cliente`, async () =>
    !(await priv(f, 'authenticated')) && !(await priv(f, 'anon')));
}

let f = 0;
for (const [n, ok, e] of T) { console.log(`  ${ok ? '✅' : '❌'} ${n}${e ? ' — ' + e : ''}`); if (!ok) f++; }
console.log(`\n${f === 0 ? '🟢' : '🔴'} ${T.length - f} passaram, ${f} falharam`);
process.exit(f === 0 ? 0 : 1);
