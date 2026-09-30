import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { fetchUsdBrlVenda } from '../lib/usdBrlQuote.js';
import {
  PACKS_USD_CENTS, MINIMO_USD_CENTS, ALOCACAO_PRESALE, UNIDADE,
  PRECO_USD_POR_TOKEN, orcar, metaDaPresaleUsdCents,
} from '../lib/presale/packs.js';

/**
 * GET /api/presale/estado — o que a tela da pré-venda precisa, num request.
 *
 * Pública de leitura: catálogo, cotação e quanto resta. A compra é no
 * /api/payments/pix/create com product_kind='presale_pack', reusando o Pix que
 * já funciona (intent, webhook e estorno inclusos).
 *
 * 🔴 Todo valor aqui é calculado NO SERVIDOR. A tela mostra, não decide.
 */
export const presaleRoutes = new Hono();

presaleRoutes.get('/api/presale/estado', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  let brlPorUsd: number;
  try {
    brlPorUsd = await fetchUsdBrlVenda();
  } catch {
    return c.json({ ok: false, error: 'Cotação do dólar indisponível.' }, 502);
  }

  const { data: cfg } = await sb.from('presale_config')
    .select('aberta, teto_conta_usd_cents, degrau_vendido_bps, teto_apos_degrau_usd_cents, tokens_vendidos')
    .eq('id', true).maybeSingle();

  const vendidos = BigInt(String(cfg?.tokens_vendidos ?? '0'));
  const alocacao = ALOCACAO_PRESALE * UNIDADE;
  const restamTokens = alocacao > vendidos ? (alocacao - vendidos) / UNIDADE : 0n;
  const vendidoBps = Number((vendidos * 10_000n) / alocacao);

  const cotacao = {
    brlPorUsdMicro: BigInt(Math.round(brlPorUsd * 1_000_000)),
    lidaEm: new Date().toISOString(),
  };
  const limites = {
    tetoPorContaUsdCents: (vendidoBps >= (cfg?.degrau_vendido_bps ?? 5_000)
      ? (cfg?.teto_apos_degrau_usd_cents ?? cfg?.teto_conta_usd_cents)
      : cfg?.teto_conta_usd_cents) ?? null,
    jaCompradoUsdCents: 0,
    restamTokens,
  };

  const packs = PACKS_USD_CENTS.map((usdCents) => {
    const r = orcar(usdCents, cotacao, limites);
    if (!r.ok) return { usdCents, disponivel: false as const, motivo: r.motivo };
    const o = r.orcamento;
    return {
      usdCents,
      disponivel: true as const,
      // 🔑 `recebe` é o que CHEGA na wallet. É este o número que a tela anuncia:
      // a casa cobre a taxa de 5% (opção 2), então anunciado = entregue.
      recebe: String(o.tokensEntregues),
      brlCents: String(o.brlCents),
    };
  });

  // A Ativação 3× não é um pack do catálogo — é um PLANO: o pack próprio de
  // $10 + uma conta de $10 em cada time (satélites do comprador). O orçamento
  // são três packs de $10; as contas são distintas, então o teto por conta
  // não soma — mas a alocação precisa caber os três.
  const plano3x = (() => {
    const um = orcar(1_000, cotacao, limites);
    if (!um.ok) {
      return { kind: 'ativacao_3x' as const, usdCents: 3_000, disponivel: false as const, motivo: um.motivo };
    }
    if (restamTokens < um.orcamento.tokensEntregues * 3n) {
      return { kind: 'ativacao_3x' as const, usdCents: 3_000, disponivel: false as const, motivo: 'alocacao_insuficiente' };
    }
    return {
      kind: 'ativacao_3x' as const,
      usdCents: 3_000,
      disponivel: true as const,
      recebePorConta: String(um.orcamento.tokensEntregues),
      brlCents: String(um.orcamento.brlCents * 3n),
    };
  })();

  return c.json({
    ok: true,
    aberta: cfg?.aberta === true,
    preco: PRECO_USD_POR_TOKEN,
    cotacaoBrlPorUsd: brlPorUsd,
    minimoUsdCents: MINIMO_USD_CENTS,
    tetoPorContaUsdCents: limites.tetoPorContaUsdCents,
    alocacao: String(ALOCACAO_PRESALE),
    vendidos: String(vendidos / UNIDADE),
    restam: String(restamTokens),
    vendidoBps,
    metaUsdCents: metaDaPresaleUsdCents(),
    packs,
    planos: [plano3x],
  });
});
