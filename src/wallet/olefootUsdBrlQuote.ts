import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

/**
 * A cotação vem do NOSSO servidor (GET /api/quote/usd-brl), não do terceiro.
 * Dois motivos: a CSP bloqueia `br.dolarapi.com` no navegador (relatório real
 * de 2026-09-19 em /mercado/transfer e /wallet — sem isto, o card de R$ some da
 * vitrine e aparece com preço em OLE, que é a moeda errada), e é o mesmo número
 * que o servidor usa pra cobrar: tela e cobrança não podem divergir.
 */
const QUOTE_PATH = '/api/quote/usd-brl';

type QuoteResponse = {
  ok?: boolean;
  apiCompra?: number;
  apiVenda?: number;
  olefootCompra?: number;
  olefootVenda?: number;
  fetchedAt?: string;
};

export type OlefootUsdBrlQuoteOk = {
  status: 'ok';
  apiCompra: number;
  apiVenda: number;
  /** Compra API + margem Olefoot (BRL por 1 USD). */
  olefootCompra: number;
  /** Venda API + margem Olefoot (BRL por 1 USD) — referência principal para depósito PIX. */
  olefootVenda: number;
  /** Quando o servidor buscou a cotação (o carimbo do terceiro é inconfiável). */
  fetchedAt: string | null;
};

export type OlefootUsdBrlQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | OlefootUsdBrlQuoteOk;

export async function fetchOlefootUsdBrlQuote(): Promise<OlefootUsdBrlQuoteOk> {
  const res = await fetch(`${olefootApiBase()}${QUOTE_PATH}`);
  if (!res.ok) {
    throw new Error(`Cotação indisponível (${res.status})`);
  }
  const data = (await res.json()) as QuoteResponse;
  const { apiCompra, apiVenda, olefootCompra, olefootVenda } = data;
  if (
    data.ok !== true ||
    ![apiCompra, apiVenda, olefootCompra, olefootVenda].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
    )
  ) {
    throw new Error('Resposta da cotação inválida');
  }
  return {
    status: 'ok',
    apiCompra: apiCompra!,
    apiVenda: apiVenda!,
    olefootCompra: olefootCompra!,
    olefootVenda: olefootVenda!,
    fetchedAt: data.fetchedAt ?? null,
  };
}
