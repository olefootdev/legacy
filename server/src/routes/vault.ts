/**
 * Rotas do Vault (A VIRADA · V1).
 *
 * DOIS ROUTERS, e a divisão é o ponto do arquivo.
 *
 * `vaultRoutes` é só LEITURA. Não existe rota em que o jogador diga quanto
 * depositou: cota não nasce de pedido, nasce de entrada verificada. Um
 * `POST /aportar` aberto com `{unidades}` no corpo seria cunhar cota de graça, e
 * passaria por todas as travas que a gente construiu — a soma fecharia, a
 * posição bateria, o NAV estaria certo. O dinheiro é que teria nascido do nada.
 *
 * `vaultAdminRoutes` é a ESCRITA, com gate de admin em `use('*')` pra rota nova
 * já nascer fechada, e `ref` obrigatório em tudo que move dinheiro. O `ref` é a
 * amarra com a origem (assinatura da transação, id do pagamento, id do tick) e
 * o índice `vault_ledger_ref_unico` recusa a segunda entrega do mesmo.
 *
 * Quando existir a mão — a tesouraria que confirma entrada on-chain e o webhook
 * do Pix —, é ela que chama estas rotas com o `ref` da origem. Até lá, quem
 * move o livro é o operador, com o comprovante na mão.
 */
import { Hono } from 'hono';
import { requireAdminToken } from '../lib/adminAuth.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { MICRO_POR_COTA, unidadesPorResgate } from '../lib/vaultBook.js';
import { POLITICA_VAGA_PADRAO, type PoliticaVaga } from '../lib/harvestSplit.js';
import {
  aportar,
  colher,
  lerCotas,
  lerFundo,
  marcarAMercado,
  paraInteiro,
  refJaAplicado,
  sacar,
} from '../lib/vaultStore.js';

export const vaultRoutes = new Hono();
export const vaultAdminRoutes = new Hono();

async function usuarioDaSessao(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

function erro(e: unknown): { status: 400 | 409 | 500; msg: string } {
  const msg = e instanceof Error ? e.message : 'erro desconhecido';
  if (e instanceof TypeError || e instanceof RangeError) return { status: 400, msg };
  if (/conflito de vers|conflitos seguidos/.test(msg)) return { status: 409, msg };
  return { status: 500, msg };
}

// =========================================================== LEITURA ==========

/** GET /api/vault/:slug — o estado do fundo. Público por desenho. */
vaultRoutes.get('/api/vault/:slug', rateLimit(60), async (c) => {
  try {
    const fundo = await lerFundo(c.req.param('slug') ?? '');
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);
    return c.json({
      ok: true,
      fundo: {
        slug: fundo.slug,
        ativo: fundo.ativo,
        decimais: fundo.decimais,
        cotasEmitidas: fundo.livro.cotasEmitidas.toString(),
        patrimonio: fundo.livro.patrimonio.toString(),
        // O NAV por cota inteira, pra exibir. A conta de verdade é por conversão.
        navPorCota: fundo.livro.cotasEmitidas > 0n
          ? ((fundo.livro.patrimonio * MICRO_POR_COTA) / fundo.livro.cotasEmitidas).toString()
          : null,
      },
    });
  } catch (e) { const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status); }
});

/** GET /api/vault/:slug/minha-posicao — cotas e quanto valem AGORA. */
vaultRoutes.get('/api/vault/:slug/minha-posicao', rateLimit(60), async (c) => {
  const uid = await usuarioDaSessao(c.req.header('authorization'));
  if (!uid) return c.json({ ok: false, error: 'Entre na sua conta.' }, 401);
  try {
    const fundo = await lerFundo(c.req.param('slug') ?? '');
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);
    const cotas = await lerCotas(fundo.id, uid);
    return c.json({
      ok: true,
      cotas: cotas.toString(),
      valorAgora: unidadesPorResgate(fundo.livro, cotas).toString(),
      ativo: fundo.ativo,
      decimais: fundo.decimais,
    });
  } catch (e) { const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status); }
});

/**
 * GET /api/vault/:slug/meu-extrato — os meus movimentos e as minhas fatias.
 * A RLS já limita a `auth.uid()`, mas aqui a gente não usa o token do jogador
 * (o client é service role), então o filtro é explícito. Comentário não é
 * evidência: o `.eq('user_id', uid)` é.
 */
vaultRoutes.get('/api/vault/:slug/meu-extrato', rateLimit(30), async (c) => {
  const uid = await usuarioDaSessao(c.req.header('authorization'));
  if (!uid) return c.json({ ok: false, error: 'Entre na sua conta.' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'servidor sem service role' }, 500);
  try {
    const fundo = await lerFundo(c.req.param('slug') ?? '');
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);

    const { data: mov } = await sb
      .from('vault_ledger')
      .select('id, tipo, unidades, cotas, motivo, ref, criado_em')
      .eq('fund_id', fundo.id)
      .eq('user_id', uid)
      .order('id', { ascending: false })
      .limit(100);

    const { data: fatias } = await sb
      .from('vault_harvest_slice')
      .select('fatia, papel, unidades, harvest_id')
      .eq('destino', uid)
      .order('harvest_id', { ascending: false })
      .limit(100);

    return c.json({ ok: true, movimentos: mov ?? [], fatiasRecebidas: fatias ?? [] });
  } catch (e) { const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status); }
});

// ============================================================ ESCRITA =========

/**
 * GATE DE ADMIN NESTE ROUTER. Middleware, não checagem por handler: rota nova
 * neste arquivo já nasce protegida (mesmo padrão de adminPayments.ts).
 *
 * ⚠️ ESCOPADO NO PREFIXO, e não em '*'. A primeira versão usava '*', e como
 * este router é montado em `app.route('/', …)` — porque as rotas carregam o
 * caminho inteiro —, o gate virou middleware GLOBAL: toda requisição que não
 * casava com rota nenhuma caía nele e voltava 403 "Acesso de admin negado" em
 * vez de 404. Pior que a mensagem errada, cada caminho inventado disparava uma
 * consulta de sessão no Supabase — amplificação de graça pra quem quisesse
 * bater no servidor.
 *
 * Os outros routers de admin não tinham isso porque são montados em
 * `/api/admin`, o que já escopa o '*' deles. Aqui o escopo é explícito. Os dois
 * padrões cobrem a rota-raiz e tudo abaixo dela.
 */
const GATE: Parameters<typeof vaultAdminRoutes.use>[0][] = ['/api/admin/vault', '/api/admin/vault/*'];
for (const caminho of GATE) {
  vaultAdminRoutes.use(caminho, async (c, next) => {
    const authErr = await requireAdminToken(c);
    if (authErr) return authErr;
    await next();
  });
}

/** POST /api/admin/vault/criar — { slug, ativo, decimais } */
vaultAdminRoutes.post('/api/admin/vault/criar', async (c) => {
  const body = await c.req.json().catch(() => null) as
    { slug?: unknown; ativo?: unknown; decimais?: unknown } | null;
  if (typeof body?.slug !== 'string' || typeof body.ativo !== 'string' || typeof body.decimais !== 'number') {
    return c.json({ ok: false, error: 'campos: slug, ativo, decimais' }, 400);
  }
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'servidor sem service role' }, 500);
  const { data, error } = await sb
    .from('vault_fund')
    .insert({ slug: body.slug, ativo: body.ativo, decimais: body.decimais })
    .select('id, slug')
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 400);
  return c.json({ ok: true, fundo: data });
});

/**
 * POST /api/admin/vault/:slug/aportar — { userId, unidades, ref }
 * `ref` = a origem da entrada (assinatura da transação, id do pagamento). Sem
 * ele, reentrega credita duas vezes.
 */
vaultAdminRoutes.post('/api/admin/vault/:slug/aportar', async (c) => {
  const slug = c.req.param('slug') ?? '';
  const body = await c.req.json().catch(() => null) as
    { userId?: unknown; unidades?: unknown; ref?: unknown } | null;
  if (typeof body?.userId !== 'string' || typeof body.ref !== 'string' || !body.ref.trim()) {
    return c.json({ ok: false, error: 'campos: userId, unidades (string), ref' }, 400);
  }
  try {
    const unidades = paraInteiro(body.unidades, 'unidades');
    const fundo = await lerFundo(slug);
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);
    if (await refJaAplicado(fundo.id, body.ref)) {
      return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    }
    const { plano, versao } = await aportar(slug, body.userId, unidades, body.ref);
    return c.json({
      ok: true, versao: versao.toString(),
      cotasEmitidas: plano.cotasEmitidas.toString(),
      patrimonio: plano.livro.patrimonio.toString(),
    });
  } catch (e) {
    if ((e as { duplicado?: boolean }).duplicado) return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status);
  }
});

/** POST /api/admin/vault/:slug/sacar — { userId, cotas, ref } */
vaultAdminRoutes.post('/api/admin/vault/:slug/sacar', async (c) => {
  const slug = c.req.param('slug') ?? '';
  const body = await c.req.json().catch(() => null) as
    { userId?: unknown; cotas?: unknown; ref?: unknown } | null;
  if (typeof body?.userId !== 'string' || typeof body.ref !== 'string' || !body.ref.trim()) {
    return c.json({ ok: false, error: 'campos: userId, cotas (string), ref' }, 400);
  }
  try {
    const cotas = paraInteiro(body.cotas, 'cotas');
    const fundo = await lerFundo(slug);
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);
    if (await refJaAplicado(fundo.id, body.ref)) {
      return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    }
    const { plano, versao } = await sacar(slug, body.userId, cotas, body.ref);
    return c.json({
      ok: true, versao: versao.toString(),
      unidadesPagas: plano.unidadesPagas.toString(),
      // A transferência é outro passo: aqui só ficou registrado o direito.
      transferido: false,
    });
  } catch (e) {
    if ((e as { duplicado?: boolean }).duplicado) return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status);
  }
});

/** POST /api/admin/vault/:slug/marcar — { patrimonio, motivo?, ref? } */
vaultAdminRoutes.post('/api/admin/vault/:slug/marcar', async (c) => {
  const body = await c.req.json().catch(() => null) as
    { patrimonio?: unknown; motivo?: unknown; ref?: unknown } | null;
  try {
    const patrimonio = paraInteiro(body?.patrimonio, 'patrimonio');
    const motivo = typeof body?.motivo === 'string' ? body.motivo : undefined;
    const ref = typeof body?.ref === 'string' && body.ref.trim() ? body.ref : undefined;
    const { plano, versao } = await marcarAMercado(c.req.param('slug') ?? '', patrimonio, motivo, ref);
    return c.json({ ok: true, versao: versao.toString(), patrimonio: plano.livro.patrimonio.toString() });
  } catch (e) {
    if ((e as { duplicado?: boolean }).duplicado) return c.json({ ok: true, jaAplicado: true });
    const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status);
  }
});

/**
 * POST /api/admin/vault/:slug/colher — { depositante, colheita, ref, politica? }
 * A tesouraria vem de env: inventar um uuid aqui mandaria 25% pra lugar nenhum.
 */
vaultAdminRoutes.post('/api/admin/vault/:slug/colher', async (c) => {
  const slug = c.req.param('slug') ?? '';
  const casa = process.env.OLEFOOT_TREASURY_USER_ID?.trim();
  if (!casa) {
    return c.json({ ok: false, error: 'OLEFOOT_TREASURY_USER_ID não configurado — sem tesouraria não se colhe' }, 500);
  }
  const body = await c.req.json().catch(() => null) as
    { depositante?: unknown; colheita?: unknown; ref?: unknown; politica?: unknown } | null;
  if (typeof body?.depositante !== 'string' || typeof body.ref !== 'string' || !body.ref.trim()) {
    return c.json({ ok: false, error: 'campos: depositante, colheita (string), ref' }, 400);
  }
  const politica = (['reinvestir', 'depositante', 'casa'] as const)
    .find((p) => p === body.politica) ?? POLITICA_VAGA_PADRAO;
  try {
    const colheita = paraInteiro(body.colheita, 'colheita');
    const fundo = await lerFundo(slug);
    if (!fundo) return c.json({ ok: false, error: 'fundo não encontrado' }, 404);
    if (await refJaAplicado(fundo.id, body.ref)) {
      return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    }
    const { plano, harvestId } = await colher(slug, body.depositante, colheita, casa, body.ref, politica as PoliticaVaga);
    return c.json({
      ok: true,
      harvestId,
      politica,
      aPagar: plano.aPagar.toString(),
      reinvestido: plano.rateio.reinvestido.toString(),
      pagamentos: plano.rateio.pagamentos.map((p) => ({ fatia: p.fatia, destino: p.destino, unidades: p.unidades.toString() })),
      vagas: plano.rateio.vagas.map((v) => ({ fatia: v.fatia, unidades: v.unidades.toString(), motivo: v.motivo })),
      // O direito está registrado. Mandar na Solana é outro passo.
      transferido: false,
    });
  } catch (e) {
    if ((e as { duplicado?: boolean }).duplicado) return c.json({ ok: true, jaAplicado: true, ref: body.ref });
    const { status, msg } = erro(e); return c.json({ ok: false, error: msg }, status);
  }
});

/** GET /api/admin/vault/reconciliar — a soma das posições bate com o emitido? */
vaultAdminRoutes.get('/api/admin/vault/reconciliar', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'servidor sem service role' }, 500);
  const { data, error } = await sb.rpc('vault_reconciliar');
  if (error) return c.json({ ok: false, error: error.message }, 500);
  const linhas = (data ?? []) as { fundo: string; diferenca: string }[];
  const furados = linhas.filter((l) => l.diferenca !== '0');
  return c.json({ ok: furados.length === 0, fundos: linhas, furados });
});
