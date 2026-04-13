import { useEffect, useState } from 'react';
import { fetchOlefootUsdBrlQuote, type OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';

/**
 * Cotação USD/BRL (API br.dolarapi.com) + margem Olefoot.
 * @param enabled — quando falso, não pede à rede (ex. ecrã fechado).
 */
export function useOlefootUsdBrlQuote(enabled = true): OlefootUsdBrlQuoteState {
  const [state, setState] = useState<OlefootUsdBrlQuoteState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => (s.status === 'ok' ? s : { status: 'loading' }));
    fetchOlefootUsdBrlQuote()
      .then((ok) => {
        if (!cancelled) setState(ok);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Erro ao carregar cotação';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
