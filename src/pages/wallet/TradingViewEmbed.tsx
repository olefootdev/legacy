import { useEffect, useState } from 'react';
import { TRADINGVIEW_SYMBOL } from '@/wallet/constants';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

/**
 * Widget TradingView (iframe oficial), lazy após idle para não bloquear LCP.
 */
export function TradingViewEmbed() {
  const [src, setSrc] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const run = () => {
      const q = new URLSearchParams({
        locale: 'br',
        symbol: TRADINGVIEW_SYMBOL,
        theme: 'dark',
        hide_top_toolbar: '1',
        hide_legend: '0',
        save_image: '0',
      });
      setSrc(`https://www.tradingview-widget.com/embed-widget/mini-symbol-overview/?${q.toString()}`);
    };
    if (reduced) {
      const t = window.setTimeout(run, 100);
      return () => window.clearTimeout(t);
    }
    const id = window.requestIdleCallback?.(run) ?? window.setTimeout(run, 400);
    return () => {
      if (typeof id === 'number' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id as number);
      }
    };
  }, [reduced]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden backdrop-blur-md">
      <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-display font-bold">
          Mercado (referência)
        </span>
        <span className="text-[10px] text-gray-600 font-mono truncate max-w-[50%]" title={TRADINGVIEW_SYMBOL}>
          {TRADINGVIEW_SYMBOL}
        </span>
      </div>
      <div className="relative w-full h-[320px] md:h-[380px] bg-black/40">
        {!src ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">A carregar…</div>
        ) : (
          <iframe
            title="TradingView — visão geral do símbolo"
            className="absolute inset-0 w-full h-full border-0"
            src={src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}
