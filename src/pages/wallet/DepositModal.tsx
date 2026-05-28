import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Landmark, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';
import { OLEFOOT_BRL_MARKUP } from '@/wallet/olefootUsdBrlQuote';

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQuoteUpdated(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const QUICK_AMOUNTS_BRL = [25, 50, 100, 250, 500];
const MIN_BRL = 5;

/**
 * DepositModal — primeira etapa do depósito via PIX.
 *
 * Coleta apenas o VALOR. Quando o user confirma, chama onContinueToPix(cents)
 * que o Wallet usa pra abrir o PixCheckoutModal (que coleta CPF + gera QR).
 *
 * onDeposit é mantido como callback legado opcional pra MVP/mock.
 */
export function DepositModal({
  open,
  onClose,
  onContinueToPix,
  onDeposit,
  quote,
}: {
  open: boolean;
  onClose: () => void;
  /** Próximo passo real: abre PixCheckoutModal no Wallet. */
  onContinueToPix?: (amountCents: number) => void;
  /** Legado/mock — só usado se onContinueToPix não for passado. */
  onDeposit?: (payload: { brlAmount: string; note: string }) => void;
  quote: OlefootUsdBrlQuoteState;
}) {
  const [brl, setBrl] = useState('');
  const [selectedChip, setSelectedChip] = useState<number | null>(null);

  const numericAmount = useMemo(() => {
    const v = parseFloat(brl.replace(',', '.'));
    return Number.isNaN(v) ? null : v;
  }, [brl]);

  const valid = numericAmount !== null && numericAmount >= MIN_BRL;

  const broPreview =
    quote.status === 'ok' && valid && quote.olefootVenda > 0
      ? numericAmount! / quote.olefootVenda
      : null;

  if (!open) return null;

  const pickQuick = (amount: number) => {
    setSelectedChip(amount);
    setBrl(amount.toString());
  };

  const handleCustomInput = (value: string) => {
    setBrl(value);
    setSelectedChip(null);
  };

  const submit = () => {
    if (!valid || numericAmount === null) return;
    const cents = Math.round(numericAmount * 100);

    if (onContinueToPix) {
      // Fluxo real PIX
      onContinueToPix(cents);
      onClose();
      setBrl('');
      setSelectedChip(null);
      return;
    }

    // Fallback legado
    onDeposit?.({ brlAmount: brl, note: '' });
    onClose();
    setBrl('');
    setSelectedChip(null);
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-neon-yellow" />
            <div>
              <h2 className="font-display font-bold text-lg">Depositar via PIX</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                Saldo BRO instantâneo após confirmação
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cotação */}
          {(quote.status === 'loading' || quote.status === 'idle') && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Nossa cotação</p>
              <p className="text-sm text-gray-500 mt-1">A carregar…</p>
            </div>
          )}
          {quote.status === 'error' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Nossa cotação</p>
              <p className="text-xs text-amber-100/90 mt-1">{quote.message}</p>
            </div>
          )}
          {quote.status === 'ok' && (
            <div className="rounded-xl border border-neon-green/30 bg-gradient-to-br from-neon-green/10 to-black/40 px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neon-green">
                Nossa cotação (PIX → BRO)
              </p>
              <p className="text-lg font-display font-black leading-tight text-white">
                R$ 1 ≈ {fmtBrl(1 / quote.olefootVenda)} BRO
              </p>
              <p className="text-[10px] leading-relaxed text-gray-400">
                Referência API: R$ {fmtBrl(quote.apiVenda)} + {(OLEFOOT_BRL_MARKUP * 100).toFixed(0)}% custos operacionais.
                Base 1 BRO ≈ 1 USD.
              </p>
              {quote.updatedAt && (
                <p className="text-[9px] text-gray-600">
                  Cotação atualizada: {fmtQuoteUpdated(quote.updatedAt)}
                </p>
              )}
            </div>
          )}

          {/* Chips de valores rápidos */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block">
              Quanto quer depositar?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_AMOUNTS_BRL.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => pickQuick(amount)}
                  className={cn(
                    'py-2.5 rounded-xl border font-display text-xs font-black uppercase tracking-wider transition-colors',
                    selectedChip === amount
                      ? 'border-neon-yellow bg-neon-yellow text-black'
                      : 'border-white/15 bg-black/40 text-white hover:border-white/30',
                  )}
                >
                  R${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Input custom */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
              Ou valor customizado (BRL)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">R$</span>
              <input
                value={brl}
                onChange={(e) => handleCustomInput(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-white font-display tabular-nums text-lg focus:border-neon-yellow/60 focus:outline-none"
              />
            </div>
            {numericAmount !== null && numericAmount < MIN_BRL && (
              <p className="text-[10px] text-rose-300 mt-1">Mínimo de R$ {MIN_BRL.toFixed(2)}</p>
            )}
          </div>

          {/* Preview BRO */}
          {broPreview !== null && (
            <div className="bg-neon-yellow/10 border border-neon-yellow/30 rounded-xl px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-neon-yellow/80 font-display font-bold">
                Você receberá ≈
              </span>
              <span className="font-display text-lg font-black text-neon-yellow tabular-nums">
                {fmtBrl(broPreview)} BRO
              </span>
            </div>
          )}

          {/* Botão continuar */}
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'w-full py-3.5 rounded-xl font-display font-black uppercase tracking-[0.18em] text-sm inline-flex items-center justify-center gap-2 transition-colors',
              valid
                ? 'bg-neon-yellow text-black hover:bg-white'
                : 'bg-white/10 text-gray-500 cursor-not-allowed',
            )}
          >
            <Zap className="w-4 h-4" />
            Continuar para PIX
          </button>

          <p className="text-[10px] text-white/40 text-center">
            Pagamento instantâneo · QR Code + copia e cola
          </p>
        </div>
      </motion.div>
    </div>
  );
}
