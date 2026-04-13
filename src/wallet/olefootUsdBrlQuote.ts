/** Margem Olefoot sobre a cotação de referência (custos operacionais). */
export const OLEFOOT_BRL_MARKUP = 0.05;

const BR_DOLAR_API_URL = 'https://br.dolarapi.com/v1/cotacoes';

type BrCotacaoRow = {
  moeda: string;
  nome?: string;
  compra: number;
  venda: number;
  dataAtualizacao?: string;
};

export type OlefootUsdBrlQuoteOk = {
  status: 'ok';
  apiCompra: number;
  apiVenda: number;
  /** Compra API + margem Olefoot (BRL por 1 USD). */
  olefootCompra: number;
  /** Venda API + margem Olefoot (BRL por 1 USD) — referência principal para depósito PIX. */
  olefootVenda: number;
  updatedAt: string | null;
};

export type OlefootUsdBrlQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | OlefootUsdBrlQuoteOk;

export function applyOlefootMarkup(brlPerUsd: number): number {
  return Math.round(brlPerUsd * (1 + OLEFOOT_BRL_MARKUP) * 10_000) / 10_000;
}

export async function fetchBrUsdCotacao(): Promise<{
  compra: number;
  venda: number;
  updatedAt: string | null;
}> {
  const res = await fetch(BR_DOLAR_API_URL);
  if (!res.ok) {
    throw new Error(`Cotação indisponível (${res.status})`);
  }
  const rows = (await res.json()) as BrCotacaoRow[];
  const usd = rows.find((r) => r.moeda === 'USD');
  if (!usd || typeof usd.compra !== 'number' || typeof usd.venda !== 'number') {
    throw new Error('Resposta da API sem USD');
  }
  return {
    compra: usd.compra,
    venda: usd.venda,
    updatedAt: usd.dataAtualizacao ?? null,
  };
}

export async function fetchOlefootUsdBrlQuote(): Promise<OlefootUsdBrlQuoteOk> {
  const raw = await fetchBrUsdCotacao();
  return {
    status: 'ok',
    apiCompra: raw.compra,
    apiVenda: raw.venda,
    olefootCompra: applyOlefootMarkup(raw.compra),
    olefootVenda: applyOlefootMarkup(raw.venda),
    updatedAt: raw.updatedAt,
  };
}
