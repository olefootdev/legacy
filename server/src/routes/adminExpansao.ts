import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { adminQuemAge, requireAdminFresco, requireAdminToken } from '../lib/adminAuth.js';
import { idPorUsername, usernamesDe } from '../lib/perfilLookup.js';

/**
 * Admin da EXPANSÃO — P1 do raio-x 30/09. Até aqui ciclos, liquidações,
 * árvore, satélites, prêmios e claims só existiam via SQL Editor.
 *
 *   GET  /expansao/resumo                 — ciclos recentes + totais + horas por fechar
 *   POST /expansao/ciclos/fechar          — roda o mesmo fechamento do cron (step-up)
 *   GET  /expansao/ciclos/:id/liquidacoes — quem o ciclo pagou, cortou ou reteve
 *   GET  /expansao/pessoa/:username       — raio-x de uma conta (teto do dia incluso)
 *   GET  /expansao/arvore/:username       — árvore read-only a partir de qualquer conta
 *   GET  /expansao/satelites              — contas-satélite com dono
 *   GET  /expansao/premios                — prêmios de carreira pagos
 *   GET  /expansao/claims                 — a fila de saques
 *   POST /expansao/claims/:id/(aprovar|recusar|pagar) — step-up de login recente
 *
 * Leitura usa o service role direto (RLS não vale pra ele); escrita passa
 * pelas funções do banco, que guardam QUEM agiu.
 */
export const adminExpansaoRoutes = new Hono();

// Gate no router inteiro: rota nova aqui já nasce protegida.
adminExpansaoRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

/** Erro do banco com prefixo CLAIM_ vira 400 com a frase; o resto é 500. */
function erroDoBanco(msg: string): { status: 400 | 500; error: string } {
  const m = /CLAIM_[A-Z]+: (.*)/.exec(msg);
  return m ? { status: 400, error: m[1]! } : { status: 500, error: msg };
}

const HORA_MS = 3_600_000;

/** GET /expansao/resumo?limite=72 — ciclos recentes + agregados da janela. */
adminExpansaoRoutes.get('/expansao/resumo', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const limite = Math.min(Math.max(Number(c.req.query('limite')) || 72, 1), 500);

  const { data, error } = await sb
    .from('expansao_ciclo')
    .select('id, abre_em, status, receita_menor_unid, percentual_bps, pool, equiparado_total, bonus_total, cortado_total, teto_diario, preco_micro, motivo, fechado_em')
    .order('abre_em', { ascending: false })
    .limit(limite);
  if (error) return c.json({ error: error.message }, 500);
  const ciclos = data ?? [];

  // Horas que o cron ainda não fechou: a próxima abre em max(abre_em)+1h e só
  // fecha quando a janela TERMINA. Sem ciclo nenhum, o bootstrap é do banco.
  let horasPendentes: number | null = null;
  if (ciclos.length > 0) {
    const maxAbre = new Date(String(ciclos[0]!.abre_em)).getTime();
    horasPendentes = Math.max(0, Math.floor((Date.now() - (maxAbre + 2 * HORA_MS)) / HORA_MS) + 1);
  }

  const soma = (campo: string) =>
    ciclos.reduce((s, x) => s + BigInt(String((x as Record<string, unknown>)[campo] ?? '0').split('.')[0] || '0'), 0n);
  return c.json({
    ciclos,
    horasPendentes,
    janela: {
      ciclos: ciclos.length,
      settled: ciclos.filter((x) => x.status === 'SETTLED').length,
      held: ciclos.filter((x) => x.status === 'HELD').length,
      poolUsdCents: String(soma('pool')),
      pagoUsdCents: String(soma('bonus_total')),
      cortadoUsdCents: String(soma('cortado_total')),
    },
  });
});

/** POST /expansao/ciclos/fechar — o botão do cron. Idempotente e com lock no banco. */
adminExpansaoRoutes.post('/expansao/ciclos/fechar', async (c) => {
  // 🔒 Mexe em dinheiro (liquida horas): exige login recente, como o estorno.
  const fresco = await requireAdminFresco(c);
  if (fresco) return fresco;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const { data, error } = await sb.rpc('expansao_fechar_ciclos_pendentes', { p_max: 168 });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ fechados: Number(data ?? 0) });
});

/** GET /expansao/ciclos/:id/liquidacoes — quem recebeu o quê naquela hora. */
adminExpansaoRoutes.get('/expansao/ciclos/:id/liquidacoes', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'id inválido' }, 400);

  const [{ data: ciclo }, { data, error }] = await Promise.all([
    sb.from('expansao_ciclo').select('*').eq('id', id).maybeSingle(),
    sb.from('expansao_liquidacao')
      .select('user_id, equiparado, sobra_t1, sobra_t2, bonus_contabil, cortado_teto, retido_inativo, criado_em')
      .eq('ciclo_id', id)
      .order('bonus_contabil', { ascending: false }),
  ]);
  if (error) return c.json({ error: error.message }, 500);
  const linhas = data ?? [];
  const nomes = await usernamesDe(sb, linhas.map((l) => String(l.user_id)));
  return c.json({
    ciclo,
    liquidacoes: linhas.map((l) => ({ ...l, username: nomes.get(String(l.user_id)) || null })),
  });
});

/** GET /expansao/pessoa/:username — a conta inteira: liquidações, teto, prêmios, claims. */
adminExpansaoRoutes.get('/expansao/pessoa/:username', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const username = c.req.param('username');
  const userId = await idPorUsername(sb, username);
  if (!userId) return c.json({ error: `Não existe o usuário @${username.replace(/^@/, '')}.` }, 404);

  const [no, pernas, liq, premios, claims, satelites, wallet, disp] = await Promise.all([
    sb.from('expansao_no').select('patrocinador_id, pai_id, lado, nivel, perna_padrao, equiparado_acumulado, criado_em').eq('user_id', userId).maybeSingle(),
    sb.from('expansao_perna').select('lado, trilho, volume').eq('user_id', userId),
    sb.from('expansao_liquidacao')
      .select('ciclo_id, equiparado, bonus_contabil, cortado_teto, retido_inativo, criado_em')
      .eq('user_id', userId).order('criado_em', { ascending: false }).limit(100),
    sb.from('expansao_premio_carreira').select('degrau, olefoot, acumulado, criado_em').eq('user_id', userId).order('criado_em', { ascending: false }),
    sb.from('expansao_claim').select('id, olefoot_liquido, olefoot_bruto, wallet, status, criado_em, pago_em').eq('user_id', userId).order('criado_em', { ascending: false }).limit(50),
    sb.from('expansao_satelite').select('user_id, lado, ref, criado_em').eq('dono_id', userId),
    sb.from('solana_wallet_links').select('wallet_address, verified').eq('user_id', userId).maybeSingle(),
    sb.rpc('expansao_claim_disponivel_interno', { p_user: userId }),
  ]);

  // O "hoje" do teto segue o mesmo relógio do banco: o dia de São Paulo da
  // ABERTURA do ciclo. Tradução aqui pra não criar uma segunda régua.
  const liquidacoes = liq.data ?? [];
  const ciclosIds = [...new Set(liquidacoes.map((l) => Number(l.ciclo_id)))];
  const abrePorCiclo = new Map<number, string>();
  if (ciclosIds.length > 0) {
    const { data: cs } = await sb.from('expansao_ciclo').select('id, abre_em').in('id', ciclosIds);
    for (const x of cs ?? []) abrePorCiclo.set(Number(x.id), String(x.abre_em));
  }
  const diaSP = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hoje = diaSP(new Date().toISOString());
  const int = (v: unknown) => BigInt(String(v ?? '0').split('.')[0] || '0');
  const hojeUsdCents = liquidacoes
    .filter((l) => diaSP(abrePorCiclo.get(Number(l.ciclo_id)) ?? String(l.criado_em)) === hoje)
    .reduce((s, l) => s + int(l.bonus_contabil), 0n);

  const nomesSat = await usernamesDe(sb, (satelites.data ?? []).map((s) => String(s.user_id)));
  const nomesRede = await usernamesDe(
    sb,
    [no.data?.patrocinador_id, no.data?.pai_id].filter(Boolean).map(String),
  );
  return c.json({
    username: username.replace(/^@/, ''),
    userId,
    no: no.data
      ? {
          ...no.data,
          patrocinador: nomesRede.get(String(no.data.patrocinador_id)) || null,
          pai: nomesRede.get(String(no.data.pai_id)) || null,
        }
      : null,
    pernas: pernas.data ?? [],
    liquidacoes: liquidacoes.map((l) => ({ ...l, abre_em: abrePorCiclo.get(Number(l.ciclo_id)) ?? null })),
    totalUsdCents: String(liquidacoes.reduce((s, l) => s + int(l.bonus_contabil), 0n)),
    cortadoUsdCents: String(liquidacoes.reduce((s, l) => s + int(l.cortado_teto), 0n)),
    hojeUsdCents: String(hojeUsdCents),
    premios: premios.data ?? [],
    claims: claims.data ?? [],
    satelites: (satelites.data ?? []).map((s) => ({ ...s, username: nomesSat.get(String(s.user_id)) || null })),
    carteira: wallet.data ?? null,
    disponivelOlefoot: String(disp.data ?? '0').split('.')[0],
  });
});

/** GET /expansao/arvore/:username?ate=6 — a rede abaixo de qualquer conta, read-only. */
adminExpansaoRoutes.get('/expansao/arvore/:username', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const username = c.req.param('username');
  const ate = Math.min(Math.max(Number(c.req.query('ate')) || 6, 1), 12);
  const userId = await idPorUsername(sb, username);
  if (!userId) return c.json({ error: `Não existe o usuário @${username.replace(/^@/, '')}.` }, 404);

  const { data: raiz } = await sb
    .from('expansao_no')
    .select('user_id, nivel, y_ordem, lado, pai_id, patrocinador_id, criado_em')
    .eq('user_id', userId)
    .maybeSingle();
  if (!raiz) return c.json({ error: `@${username.replace(/^@/, '')} não está na árvore.` }, 404);

  // `expansao_mapa` autoriza pelo auth.uid() do CHAMADOR — aqui quem chama é o
  // admin, então a leitura é direta pela posição. O `posicao_path` guarda só
  // os ANCESTRAIS (medido em produção: não inclui o próprio nó), então os
  // descendentes saem do contains e a raiz consultada entra à mão.
  const { data, error } = await sb
    .from('expansao_no')
    .select('user_id, nivel, y_ordem, lado, pai_id, patrocinador_id, criado_em')
    .contains('posicao_path', [userId])
    .lte('nivel', Number(raiz.nivel) + ate)
    .order('nivel', { ascending: true })
    .order('y_ordem', { ascending: true })
    .limit(2048);
  if (error) return c.json({ error: error.message }, 500);
  const nos = [raiz, ...(data ?? [])];

  const ids = nos.map((n) => String(n.user_id));
  const [nomes, { data: sats }] = await Promise.all([
    usernamesDe(sb, ids),
    ids.length > 0 ? sb.from('expansao_satelite').select('user_id, dono_id').in('user_id', ids) : Promise.resolve({ data: [] as { user_id: string; dono_id: string }[] }),
  ]);
  const satDe = new Map((sats ?? []).map((s) => [String(s.user_id), String(s.dono_id)]));

  // A perna RELATIVA à raiz: o lado do filho direto da raiz no caminho de cada nó.
  const paiDe = new Map(nos.map((n) => [String(n.user_id), n.pai_id ? String(n.pai_id) : null]));
  const ladoDe = new Map(nos.map((n) => [String(n.user_id), Number(n.lado)]));
  const pernaDe = (id: string): number | null => {
    let atual: string | null = id;
    while (atual && paiDe.get(atual) && paiDe.get(atual) !== userId) atual = paiDe.get(atual) ?? null;
    return atual && paiDe.get(atual) === userId ? (ladoDe.get(atual) ?? null) : null;
  };

  return c.json({
    raiz: { userId, username: username.replace(/^@/, ''), nivel: Number(raiz.nivel) },
    nos: nos.map((n) => ({
      userId: String(n.user_id),
      username: nomes.get(String(n.user_id)) || null,
      nivel: Number(n.nivel) - Number(raiz.nivel),
      yOrdem: Number(n.y_ordem),
      lado: Number(n.lado),
      perna: String(n.user_id) === userId ? null : pernaDe(String(n.user_id)),
      paiId: n.pai_id ? String(n.pai_id) : null,
      patrocinador: nomes.get(String(n.patrocinador_id)) || null,
      satelliteDe: satDe.has(String(n.user_id)) ? (nomes.get(satDe.get(String(n.user_id))!) || 'satélite') : null,
      criadoEm: String(n.criado_em),
    })),
  });
});

/** GET /expansao/satelites — todas as contas-satélite, com o dono nomeado. */
adminExpansaoRoutes.get('/expansao/satelites', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const { data, error } = await sb
    .from('expansao_satelite')
    .select('user_id, dono_id, lado, ref, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500);
  if (error) return c.json({ error: error.message }, 500);
  const linhas = data ?? [];
  const nomes = await usernamesDe(sb, linhas.flatMap((s) => [String(s.user_id), String(s.dono_id)]));
  return c.json({
    satelites: linhas.map((s) => ({
      ...s,
      username: nomes.get(String(s.user_id)) || null,
      dono: nomes.get(String(s.dono_id)) || null,
    })),
  });
});

/** GET /expansao/premios — prêmios de carreira, com total. */
adminExpansaoRoutes.get('/expansao/premios', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const { data, error } = await sb
    .from('expansao_premio_carreira')
    .select('user_id, degrau, olefoot, acumulado, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500);
  if (error) return c.json({ error: error.message }, 500);
  const linhas = data ?? [];
  const nomes = await usernamesDe(sb, linhas.map((p) => String(p.user_id)));
  const total = linhas.reduce((s, p) => s + BigInt(String(p.olefoot ?? '0').split('.')[0] || '0'), 0n);
  return c.json({
    premios: linhas.map((p) => ({ ...p, username: nomes.get(String(p.user_id)) || null })),
    totalOlefoot: String(total),
  });
});

/** GET /expansao/claims?status=pendente — a fila de saques. */
adminExpansaoRoutes.get('/expansao/claims', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
  const status = c.req.query('status')?.trim() || null;
  if (status && !['pendente', 'aprovado', 'pago', 'recusado'].includes(status)) {
    return c.json({ error: 'status inválido' }, 400);
  }
  const { data, error } = await sb.rpc('expansao_claim_listar', { p_status: status, p_limite: 300 });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ claims: data ?? [] });
});

/** As três ações da fila. Dinheiro: todas com step-up de login recente. */
for (const acao of ['aprovar', 'recusar', 'pagar'] as const) {
  adminExpansaoRoutes.post(`/expansao/claims/:id/${acao}`, async (c) => {
    const fresco = await requireAdminFresco(c);
    if (fresco) return fresco;
    const sb = getSupabaseAdmin();
    if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);
    const id = Number(c.req.param('id'));
    if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'id inválido' }, 400);

    let corpo: { motivo?: unknown; tx?: unknown } = {};
    try { corpo = (await c.req.json()) as typeof corpo; } catch { /* corpo opcional */ }
    const por = await adminQuemAge(c);

    const { data, error } =
      acao === 'aprovar'
        ? await sb.rpc('expansao_claim_aprovar', { p_id: id, p_por: por })
        : acao === 'recusar'
          ? await sb.rpc('expansao_claim_recusar', {
              p_id: id, p_por: por,
              p_motivo: typeof corpo.motivo === 'string' ? corpo.motivo.trim().slice(0, 300) : null,
            })
          : await sb.rpc('expansao_claim_pagar', {
              p_id: id, p_por: por,
              p_tx: typeof corpo.tx === 'string' ? corpo.tx.trim().slice(0, 200) : '',
            });
    if (error) {
      const e = erroDoBanco(error.message);
      if (e.status === 500) console.error(`[admin/expansao claims ${acao}]`, error.message);
      return c.json({ error: e.error }, e.status);
    }
    return c.json({ ok: data === true });
  });
}
