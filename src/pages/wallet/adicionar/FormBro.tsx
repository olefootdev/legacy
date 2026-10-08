import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { OlefootUsdBrlQuoteState } from '@/wallet/olefootUsdBrlQuote';
import { L, LOCALE } from '@/i18n/L';

function fmtBrl(n: number): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQuoteUpdated(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        <div className="bg-concreto px-4 py-3.5">
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Nossa cotação', 'Our rate')}</p>
          <p className="mt-1.5 font-prova text-[12px] text-mudo">{L('Carregando…', 'Loading…')}</p>
        </div>
      )}
      {quote.status === 'error' && (
        <div className="border-2 border-dashed border-fio px-4 py-3.5">
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Nossa cotação', 'Our rate')}</p>
          <p className="mt-1.5 text-[13px] text-atencao">{quote.message}</p>
        </div>
      )}
      {quote.status === 'ok' && (
        <div className="space-y-2 bg-concreto px-4 py-3.5">
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            — {L('Nossa cotação (PIX → BRO)', 'Our rate (PIX → BRO)')}
          </p>
          <p className="font-impact text-[clamp(26px,7.5vw,32px)] leading-none text-papel tabular-nums">
            1 BRO = R$ {fmtBrl(quote.olefootVenda)}
          </p>
          <p className="font-prova text-[11px] leading-relaxed text-suave">
            {/* A margem sai da própria cotação (servidor), não de uma constante
                copiada aqui — copiada, ela divergiria em silêncio. Uma casa
                decimal: a margem é 2,5%, e arredondada pra inteiro a tela
                dizia "2%" ou "3%" conforme o dia. */}
            {L('Dólar a', 'Dollar at')} R$ {fmtBrl(quote.apiVenda)} +{' '}
            {((quote.olefootVenda / quote.apiVenda - 1) * 100).toLocaleString(LOCALE, {
              maximumFractionDigits: 1,
            })}
            {L('% de custos. 1 BRO = 1 USD.', '% in costs. 1 BRO = 1 USD.')}
          </p>
          {quote.fetchedAt && (
            <p className="font-prova text-[10.5px] text-mudo">
              {L('Cotação consultada:', 'Rate checked:')} {fmtQuoteUpdated(quote.fetchedAt)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
          — {L('Quanto quer depositar?', 'How much to deposit?')}
        </label>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_AMOUNTS_BRL.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => { setSelectedChip(amount); setBrl(amount.toString()); }}
              className={cn(
                'min-h-[48px] min-w-0 border-2 font-impact text-[16px] leading-none tabular-nums transition-colors',
                selectedChip === amount
                  ? 'border-rua bg-rua text-asfalto-27'
                  : 'border-linha bg-asfalto-27 text-papel hover:border-papel',
              )}
            >
              R${amount}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
          — {L('Ou outro valor, em reais', 'Or another amount, in BRL')}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-prova text-[14px] font-bold text-mudo">R$</span>
          <input
            value={brl}
            onChange={(e) => { setBrl(e.target.value); setSelectedChip(null); }}
            inputMode="decimal"
            placeholder={L('0,00', '0.00')}
            className="w-full min-w-0 border-2 border-linha bg-concreto py-3 pr-3 font-prova text-[18px] font-bold tabular-nums text-papel placeholder:text-fio transition-colors focus:border-rua focus:outline-none pl-11"
          />
        </div>
        {numericAmount !== null && numericAmount < MIN_BRL && (
          <p className="mt-1.5 font-prova text-[11px] text-baixa">{L('Mínimo de', 'Minimum')} R$ {fmtBrl(MIN_BRL)}</p>
        )}
      </div>

      {broPreview !== null && (
        <div className="flex min-w-0 items-baseline justify-between gap-3 border-b-2 border-linha pb-3">
          <span className="shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            {L('Você recebe ≈', 'You get ≈')}
          </span>
          <span className="min-w-0 truncate font-impact text-[26px] leading-none text-papel tabular-nums">
            {fmtBrl(broPreview)} BRO
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className={cn(
          'inline-flex min-h-[54px] w-full items-center justify-center gap-2 whitespace-nowrap px-4 font-impact text-[19px] uppercase leading-none transition-[transform,box-shadow,background-color]',
          valid ? 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]' : 'cursor-not-allowed border-2 border-dashed border-fio text-mudo',
        )}
      >
        {valid && numericAmount !== null ? <>{L(`Pagar R$ ${fmtBrl(numericAmount)} no Pix`, `Pay R$ ${fmtBrl(numericAmount)} with Pix`)} <span aria-hidden>→</span></> : L('Escolha o valor', 'Choose the amount')}
      </button>
    </div>
  );
}
