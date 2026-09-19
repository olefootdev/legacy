/**
 * Cotação USD→BRL — fonte única do servidor.
 *
 * O preço em R$ de um card USDT sai daqui (cardPricing.ts) e a tela também
 * mostra o valor daqui (GET /api/quote/usd-brl). Antes o navegador buscava a
 * cotação direto no terceiro: a CSP bloqueava a chamada (relatório real de
 * 2026-09-19, `connect-src` → br.dolarapi.com em /mercado/transfer e /wallet) e,
 * pior, tela e cobrança podiam divergir por buscarem em instantes diferentes.
 *
 * O cache de 60s existe pra não bater no terceiro a cada card renderizado.
 */

const BR_DOLAR_API_URL = 'https://br.dolarapi.com/v1/cotacoes';

/** Margem Olefoot sobre a cotação de referência. Espelha OLEFOOT_BRL_MARKUP no front. */
export const OLEFOOT_BRL_MARKUP = 0.05;

export interface UsdBrlQuote {
  apiCompra: number;
  apiVenda: number;
  /** Compra da API + margem (BRL por 1 USD). */
  olefootCompra: number;
  /** Venda da API + margem (BRL por 1 USD) — é esta que cobra o card. */
  olefootVenda: number;
  /**
   * Quando NÓS buscamos. O `dataAtualizacao` do terceiro vem congelado em
   * 2023-09-18 (conferido em 2026-09-19) enquanto os valores mudam — exibir
   * aquele campo dizia "atualizada 18/09" e parecia de ontem. Este é verdade.
   */
  fetchedAt: string;
}

export function applyOlefootMarkup(brlPerUsd: number): number {
  return Math.round(brlPerUsd * (1 + OLEFOOT_BRL_MARKUP) * 10_000) / 10_000;
}

const CACHE_MS = 60_000;
let cache: { at: number; quote: UsdBrlQuote } | null = null;
/** Chamadas simultâneas esperam a mesma requisição em vez de abrir várias. */
let emVoo: Promise<UsdBrlQuote> | null = null;

async function buscar(): Promise<UsdBrlQuote> {
  const res = await fetch(BR_DOLAR_API_URL);
  if (!res.ok) throw new Error(`cotação indisponível (${res.status})`);
  const rows = (await res.json()) as Array<{
    moeda?: string;
    compra?: number;
    venda?: number;
  }>;
  const usd = Array.isArray(rows) ? rows.find((r) => r.moeda === 'USD') : undefined;
  const venda = usd?.venda;
  const compra = usd?.compra;
  if (typeof venda !== 'number' || !Number.isFinite(venda) || venda <= 0) {
    throw new Error('resposta da API sem USD');
  }
  const compraOk = typeof compra === 'number' && Number.isFinite(compra) && compra > 0 ? compra : venda;
  return {
    apiCompra: compraOk,
    apiVenda: venda,
    olefootCompra: applyOlefootMarkup(compraOk),
    olefootVenda: applyOlefootMarkup(venda),
    fetchedAt: new Date().toISOString(),
  };
}

/** Cotação com cache. Lança se o terceiro estiver fora — quem chama decide. */
export async function fetchUsdBrlQuote(): Promise<UsdBrlQuote> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.quote;
  if (emVoo) return emVoo;
  emVoo = buscar()
    .then((quote) => {
      cache = { at: Date.now(), quote };
      return quote;
    })
    .finally(() => {
      emVoo = null;
    });
  return emVoo;
}

/** Só o valor que cobra (venda + margem). */
export async function fetchUsdBrlVenda(): Promise<number> {
  return (await fetchUsdBrlQuote()).olefootVenda;
}
