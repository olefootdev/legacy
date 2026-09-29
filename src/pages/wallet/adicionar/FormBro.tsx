import { useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
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
/** Igual ao `RECHARGE_MIN_CENTS` do servidor (payments.ts). */
const MIN_BRL = 5;

/**
 * Depósito em BRO — o valor.
 *
 * 1 BRO = 1 dólar, comprado a dólar + margem. A prévia divide pela cotação, que
 * é a mesma conta do servidor (`recarga.ts`); o número que VALE aparece no
 * checkout, depois que a cobrança é criada com a cotação congelada.
 */
export function FormBro({
  quote,
  onPagar,
}: {
  quote: OlefootUsdBrlQuoteState;
  onPagar: (brlCents: number) => void;
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
      ? Math.floor((numericAmount! / quote.olefootVenda) * 100) / 100
      : null;

  const submit = () => {
    if (!valid || numericAmount === null) return;
    onPagar(Math.round(numericAmount * 100));
  };

  return (
    <div className="space-y-4">
      {(quote.status === 'loading' || quote.status === 'idle') && (
        <div className="border border-white/10 bg-card px-3 py-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-cimento">Nossa cotação</p>
          <p className="mt-1 text-sm text-poeira">Carregando…</p>
        </div>
      )}
      {quote.status === 'error' && (
        <div className="border border-atencao/40 bg-atencao/10 px-3 py-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-atencao">Nossa cotação</p>
          <p className="mt-1 text-xs text-giz">{quote.message}</p>
        </div>
      )}
      {quote.status === 'ok' && (
        <div className="space-y-2 border border-white/10 bg-card px-3 py-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-alta">
            Nossa cotação (PIX → BRO)
          </p>
          <p className="font-mono text-lg font-medium leading-tight text-white tabular-nums">
            1 BRO = R$ {fmtBrl(quote.olefootVenda)}
          </p>
          <p className="text-[10px] leading-relaxed text-cimento">
            {/* A margem sai da própria cotação (servidor), não de uma constante
                copiada aqui — copiada, ela divergiria em silêncio. Uma casa
                decimal: a margem é 2,5%, e arredondada pra inteiro a tela
                dizia "2%" ou "3%" conforme o dia. */}
            Dólar a R$ {fmtBrl(quote.apiVenda)} +{' '}
            {((quote.olefootVenda / quote.apiVenda - 1) * 100).toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}
            % de custos. 1 BRO = 1 USD.
          </p>
          {quote.fetchedAt && (
            <p className="font-mono text-[9.5px] text-poeira">
              Cotação consultada: {fmtQuoteUpdated(quote.fetchedAt)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
          Quanto quer depositar?
        </label>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_AMOUNTS_BRL.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => { setSelectedChip(amount); setBrl(amount.toString()); }}
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

      <div>
        <label className="mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
          Ou outro valor, em reais
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-poeira">R$</span>
          <input
            value={brl}
            onChange={(e) => { setBrl(e.target.value); setSelectedChip(null); }}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full border border-white/16 bg-deep-black py-2.5 pl-10 pr-3 font-mono text-lg tabular-nums text-white focus:border-neon-yellow/60 focus:outline-none"
          />
        </div>
        {numericAmount !== null && numericAmount < MIN_BRL && (
          <p className="mt-1 text-[10px] text-baixa">Mínimo de R$ {MIN_BRL.toFixed(2).replace('.', ',')}</p>
        )}
      </div>

      {broPreview !== null && (
        <div className="flex items-center justify-between gap-3 border border-white/10 bg-card px-3 py-2.5">
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
            Você recebe ≈
          </span>
          <span className="font-mono text-lg font-medium text-white tabular-nums">
            {fmtBrl(broPreview)} BRO
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className={cn(
          'ole-num inline-flex h-[50px] w-full items-center justify-center gap-2 whitespace-nowrap text-[13px] uppercase transition-colors [--corte:12px] [clip-path:var(--clip-corte)]',
          valid ? 'bg-neon-yellow text-black hover:bg-white' : 'cursor-not-allowed bg-card-hi text-poeira',
        )}
      >
        <Zap className="h-4 w-4" />
        {valid && numericAmount !== null ? `Pagar R$ ${fmtBrl(numericAmount)} no Pix` : 'Escolha o valor'}
      </button>
    </div>
  );
}
