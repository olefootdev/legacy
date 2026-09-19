import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Landmark, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';

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
 * Sem caminho legado: o depósito só existe via PIX real (onContinueToPix).
 */
export function DepositModal({
  open,
  onClose,
  onContinueToPix,
  quote,
}: {
  open: boolean;
  onClose: () => void;
  /** Abre o PixCheckoutModal no Wallet. Único caminho de depósito. */
  onContinueToPix: (amountCents: number) => void;
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

    onContinueToPix(cents);
    onClose();
    setBrl('');
    setSelectedChip(null);
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md border border-white/16 bg-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-white" />
            <div>
              <h2 className="font-impact text-lg uppercase leading-[1.1] text-white">Depositar via PIX</h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-cimento">
                Saldo BRO instantâneo após confirmação
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-cimento hover:text-white"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cotação */}
          {(quote.status === 'loading' || quote.status === 'idle') && (
            <div className="border border-white/10 bg-card px-3 py-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-cimento">Nossa cotação</p>
              <p className="text-sm text-poeira mt-1">Carregando…</p>
            </div>
          )}
          {quote.status === 'error' && (
            <div className="border border-atencao/40 bg-atencao/10 px-3 py-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-atencao">Nossa cotação</p>
              <p className="text-xs text-giz mt-1">{quote.message}</p>
            </div>
          )}
          {quote.status === 'ok' && (
            <div className="border border-white/10 bg-card px-3 py-3 space-y-2">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-alta">
                Nossa cotação (PIX → BRO)
              </p>
              <p className="font-mono text-lg font-medium leading-tight text-white tabular-nums">
                R$ 1 ≈ {fmtBrl(1 / quote.olefootVenda)} BRO
              </p>
              <p className="text-[10px] leading-relaxed text-cimento">
                {/* A margem sai da própria cotação (servidor), não de uma constante
                    copiada aqui — copiada, ela divergiria em silêncio. */}
                Referência API: R$ {fmtBrl(quote.apiVenda)} +{' '}
                {Math.round((quote.olefootVenda / quote.apiVenda - 1) * 100)}% custos operacionais.
                Base 1 BRO ≈ 1 USD.
              </p>
              {quote.fetchedAt && (
                <p className="font-mono text-[9.5px] text-poeira">
                  Cotação consultada: {fmtQuoteUpdated(quote.fetchedAt)}
                </p>
              )}
            </div>
          )}

          {/* Chips de valores rápidos */}
          <div className="space-y-2">
            <label className="block font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
              Quanto quer depositar?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_AMOUNTS_BRL.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => pickQuick(amount)}
                  className={cn(
                    'min-w-0 border py-2.5 font-mono text-[12px] font-medium tabular-nums transition-colors',
                    selectedChip === amount
                      ? 'border-neon-yellow bg-neon-yellow text-black'
                      : 'border-white/16 bg-deep-black text-white hover:border-white/30',
                  )}
                >
                  R${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Input custom */}
          <div>
            <label className="mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
              Ou valor customizado (BRL)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-poeira">R$</span>
              <input
                value={brl}
                onChange={(e) => handleCustomInput(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full border border-white/16 bg-deep-black py-2.5 pl-10 pr-3 font-mono text-lg tabular-nums text-white focus:border-neon-yellow/60 focus:outline-none"
              />
            </div>
            {numericAmount !== null && numericAmount < MIN_BRL && (
              <p className="text-[10px] text-baixa mt-1">Mínimo de R$ {MIN_BRL.toFixed(2)}</p>
            )}
          </div>

          {/* Preview BRO */}
          {broPreview !== null && (
            <div className="flex items-center justify-between gap-3 border border-white/10 bg-card px-3 py-2.5">
              <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
                Você receberá ≈
              </span>
              <span className="font-mono text-lg font-medium text-white tabular-nums">
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
              'ole-num inline-flex h-[50px] w-full items-center justify-center gap-2 whitespace-nowrap text-[13px] uppercase transition-colors [--corte:12px] [clip-path:var(--clip-corte)]',
              valid
                ? 'bg-neon-yellow text-black hover:bg-white'
                : 'bg-card-hi text-poeira cursor-not-allowed',
            )}
          >
            <Zap className="w-4 h-4" />
            Continuar para PIX
          </button>

          <p className="font-mono text-[10.5px] text-poeira text-center">
            Pagamento instantâneo · QR Code + copia e cola
          </p>
        </div>
      </motion.div>
    </div>
  );
}
