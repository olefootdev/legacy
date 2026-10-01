import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminFresco, requireAdminToken } from '../lib/adminAuth.js';
import { usernamesDe } from '../lib/perfilLookup.js';
import { ALOCACAO_PRESALE, UNIDADE } from '../lib/presale/packs.js';

/**
 * Admin da PRÉ-VENDA — P1 do raio-x 30/09. Abrir/fechar, teto por conta e
 * degrau eram UPDATE manual no SQL Editor; compras e posições não tinham
 * lista nenhuma. (Na medição de 30/09 a pré-venda estava ABERTA e SEM teto
 * por conta — exatamente o que este painel existe pra enxergar.)
 *
 *   GET  /api/admin/presale         — config + vendidos×alocação + compras + posições
 *   POST /api/admin/presale/config  — muda aberta/teto/degrau (step-up de login recente)
 *
 * O caminho do dinheiro NÃO passa por aqui: compra segue no Pix
 * (payments.ts) e o crédito na `presale_creditar`. Aqui é torneira e vitrine.
 */
export const adminPresaleRoutes = new Hono();

adminPresaleRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

const int = (v: unknown) => BigInt(String(v ?? '0').split('.')[0] || '0');

/** GET /presale — o estado inteiro da pré-venda, de uma vez. */
adminPresaleRoutes.get('/presale', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const [{ data: cfg }, compras, posicoes] = await Promise.all([
    sb.from('presale_config').select('*').eq('id', true).maybeSingle(),
    sb.from('presale_purchase')
      .select('id, user_id, ref, usd_cents, brl_cents, tokens_entregues, tokens_brutos, status, criada_em, paga_em')
      .order('criada_em', { ascending: false })
      .limit(300),
    sb.from('presale_position')
      .select('user_id, compra_original_usd_cents, tokens_totais, liberado_por_compra, liberado_por_tempo, sacado, atualizado_em')
      .order('tokens_totais', { ascending: false })
      .limit(200),
  ]);
  if (compras.error) return c.json({ error: compras.error.message }, 500);
  if (posicoes.error) return c.json({ error: posicoes.error.message }, 500);

  const linhasCompra = compras.data ?? [];
  const linhasPos = posicoes.data ?? [];
  const nomes = await usernamesDe(sb, [
    ...linhasCompra.map((x) => String(x.user_id)),
    ...linhasPos.map((x) => String(x.user_id)),
  ]);

  const pagas = linhasCompra.filter((x) => x.paga_em != null);
  const vendidosMenor = int(cfg?.tokens_vendidos);
  const alocacaoMenor = ALOCACAO_PRESALE * UNIDADE;
  return c.json({
    config: cfg ?? null,
    // Vendidos em token INTEIRO (a config guarda a menor unidade, 1e9).
    vendidosTokens: String(vendidosMenor / UNIDADE),
    alocacaoTokens: String(ALOCACAO_PRESALE),
    vendidoBps: alocacaoMenor > 0n ? Number((vendidosMenor * 10_000n) / alocacaoMenor) : 0,
    totais: {
      compras: linhasCompra.length,
      pagas: pagas.length,
      usdCentsPagos: String(pagas.reduce((s, x) => s + int(x.usd_cents), 0n)),
      brlCentsPagos: String(pagas.reduce((s, x) => s + int(x.brl_cents), 0n)),
    },
    compras: linhasCompra.map((x) => ({ ...x, username: nomes.get(String(x.user_id)) || null })),
    posicoes: linhasPos.map((x) => ({ ...x, username: nomes.get(String(x.user_id)) || null })),
  });
});

/**
 * POST /presale/config
 * { aberta?, tetoContaUsdCents?, degrauVendidoBps?, tetoAposDegrauUsdCents?, liquidezAdicionada? }
 * Só muda o que vier no corpo. Teto null = sem teto (explícito, não omissão).
 */
adminPresaleRoutes.post('/presale/config', async (c) => {
  // 🔒 A torneira da venda é dinheiro: exige login recente.
  const fresco = await requireAdminFresco(c);
  if (fresco) return fresco;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  let body: Record<string, unknown>;
  try { body = (await c.req.json()) as Record<string, unknown>; } catch { return c.json({ error: 'JSON inválido' }, 400); }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if ('aberta' in body) {
    if (typeof body.aberta !== 'boolean') return c.json({ error: '`aberta` é true/false.' }, 400);
    patch.aberta = body.aberta;
  }
  // Decisão do fundador (2026-10-01): a pré-venda só LIBERA token quando a
  // liquidez for adicionada na moeda. O flag é a trava que as pontes de
  // unlock são obrigadas a checar.
  if ('liquidezAdicionada' in body) {
    if (typeof body.liquidezAdicionada !== 'boolean') return c.json({ error: '`liquidezAdicionada` é true/false.' }, 400);
    patch.liquidez_adicionada = body.liquidezAdicionada;
  }
  const cents = (campo: string, rotulo: string): string | null => {
    const v = body[campo];
    if (v === null) { patch[campo === 'tetoContaUsdCents' ? 'teto_conta_usd_cents' : 'teto_apos_degrau_usd_cents'] = null; return null; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 100 || n > 100_000_000) return `${rotulo}: inteiro em centavos de dólar, de 100 a 100.000.000 (ou null, sem teto).`;
    patch[campo === 'tetoContaUsdCents' ? 'teto_conta_usd_cents' : 'teto_apos_degrau_usd_cents'] = n;
    return null;
  };
  if ('tetoContaUsdCents' in body) {
    const erro = cents('tetoContaUsdCents', 'Teto por conta');
    if (erro) return c.json({ error: erro }, 400);
  }
  if ('tetoAposDegrauUsdCents' in body) {
    const erro = cents('tetoAposDegrauUsdCents', 'Teto após o degrau');
    if (erro) return c.json({ error: erro }, 400);
  }
  if ('degrauVendidoBps' in body) {
    const n = Number(body.degrauVendidoBps);
    if (!Number.isInteger(n) || n < 0 || n > 10_000) return c.json({ error: 'Degrau em bps, de 0 a 10000.' }, 400);
    patch.degrau_vendido_bps = n;
  }
  if (Object.keys(patch).length === 1) return c.json({ error: 'Nada pra mudar.' }, 400);

  const { data, error } = await sb.from('presale_config').update(patch).eq('id', true).select('*').maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'presale_config sem a linha única — rode a migration da pré-venda.' }, 500);
  return c.json({ config: data });
});
