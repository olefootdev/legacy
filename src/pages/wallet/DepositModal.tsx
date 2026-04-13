import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';
import { OLEFOOT_BRL_MARKUP } from '@/wallet/olefootUsdBrlQuote';

function fmtBrl4(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtQuoteUpdated(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function DepositModal({
  open,
  onClose,
  onDeposit,
  quote,
}: {
  open: boolean;
  onClose: () => void;
  /** Hook futuro para API de pagamento */
  onDeposit?: (payload: { brlAmount: string; note: string }) => void;
  /** Cotação USD/BRL (API + margem Olefoot), vinda do ecrã Wallet. */
  quote: OlefootUsdBrlQuoteState;
}) {
  const [brl, setBrl] = useState('');
  const [note, setNote] = useState('');
  const n = parseFloat(brl.replace(',', '.'));
  const valid = !Number.isNaN(n) && n > 0;
  const broPreview =
    quote.status === 'ok' && valid && quote.olefootVenda > 0 ? n / quote.olefootVenda : null;

  if (!open) return null;

  const submit = () => {
    if (!valid) return;
    onDeposit?.({ brlAmount: brl, note });
    onClose();
    setBrl('');
    setNote('');
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[#0c0c0c] shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-neon-yellow" />
            <h2 className="font-display font-bold text-lg">Depositar</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {quote.status === 'loading' || quote.status === 'idle' ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Nossa cotação</p>
              <p className="text-sm text-gray-500 mt-1">A carregar…</p>
            </div>
          ) : null}
          {quote.status === 'error' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Nossa cotação</p>
              <p className="text-xs text-amber-100/90 mt-1">{quote.message}</p>
            </div>
          ) : null}
          {quote.status === 'ok' ? (
            <div className="rounded-xl border border-neon-green/30 bg-gradient-to-br from-neon-green/10 to-black/40 px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neon-green">Nossa cotação (PIX → BRO)</p>
              <p className="text-lg font-display font-black leading-tight text-white">
                1 USD ≈ R$ {fmtBrl4(quote.olefootVenda)}
              </p>
              <p className="text-[10px] leading-relaxed text-gray-400">
                Referência de mercado (venda API): R$ {fmtBrl4(quote.apiVenda)} + {(OLEFOOT_BRL_MARKUP * 100).toFixed(0)}% custos
                operacionais Olefoot. Base 1 BRO ≈ 1 USD.
              </p>
              {quote.updatedAt ? (
                <p className="text-[9px] text-gray-600">Dados da referência: {fmtQuoteUpdated(quote.updatedAt)}</p>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-gray-400 leading-relaxed">
            MVP: simula pedido de depósito em BRL com conversão para BRO. Integração bancária virá numa próxima fase.
          </p>
          {broPreview != null ? (
            <p className="text-xs text-neon-yellow/90">
              Estimativa com nossa cotação: <span className="font-display font-bold text-white">{broPreview.toFixed(2)} BRO</span>{' '}
              <span className="text-gray-500">(referência, sem taxas de gateway)</span>
            </p>
          ) : null}
          <label className="block text-xs text-gray-400">
            Valor em BRL
            <input
              value={brl}
              onChange={(e) => setBrl(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Nota (opcional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm',
              valid ? 'bg-neon-yellow text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
            )}
          >
            Continuar (mock)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
