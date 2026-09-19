import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { SecaoVolt } from '@/components/ui';

export type ReceiptLine = {
  label: string;
  amount: number;
  currency: 'EXP' | 'OLE' | 'USDT';
};

export type MatchReceiptData = {
  roundLabel: string;
  opponent: string;
  result: string;
  isHome: boolean;
  /** Receitas (positivas) e despesas (negativas) já com sinal. */
  lines: ReceiptLine[];
};

function fmt(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}${abs.toLocaleString('pt-BR')}`;
}

function totalsByCurrency(lines: ReceiptLine[]): Record<string, number> {
  return lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.currency] = (acc[l.currency] ?? 0) + l.amount;
    return acc;
  }, {});
}

type MatchReceiptCardProps = {
  data: MatchReceiptData | null;
};

export function MatchReceiptCard({ data }: MatchReceiptCardProps) {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label="Última partida" tone="neutro" className="min-w-0 grow" />
        <button
          type="button"
          onClick={() => navigate('/wallet/extract')}
          className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento transition-colors hover:text-white"
        >
          Recibos anteriores →
        </button>
      </div>

      {!data ? (
        <div
          className="border border-white/10 bg-panel p-5 text-center"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          <p className="text-[12px] text-cimento">
            Joga a próxima partida e o recibo aparece aqui.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden border border-white/10 bg-panel"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          {/* Header do recibo */}
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.08] px-5 py-4">
            <div>
              <p className="font-mono text-[10.5px] text-cimento">
                {data.roundLabel} · {data.isHome ? 'Casa' : 'Fora'}
              </p>
              <p className="mt-1 font-impact text-[17px] uppercase leading-[1.1] text-white">
                vs {data.opponent}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-poeira">
                Resultado
              </p>
              <p
                className="ole-num mt-1 tabular-nums text-white"
                style={{ fontSize: '20px', lineHeight: 1 }}
              >
                {data.result}
              </p>
            </div>
          </div>

          {/* Linhas */}
          <div className="divide-y divide-white/[0.04]">
            {data.lines.map((line, i) => {
              const positive = line.amount >= 0;
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <p className="text-[12px] text-giz">{line.label}</p>
                  <p
                    className={`font-mono text-[12px] font-medium tabular-nums ${
                      positive ? 'text-alta' : 'text-baixa'
                    }`}
                  >
                    {fmt(line.amount)} {line.currency}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Líquido */}
          <div className="border-t border-dashed border-white/[0.08] bg-card px-5 py-4">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">
              Líquido
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {Object.entries(totalsByCurrency(data.lines)).map(([currency, total]) => {
                const positive = total >= 0;
                return (
                  <p
                    key={currency}
                    className={`font-mono font-medium tabular-nums ${positive ? 'text-alta' : 'text-baixa'}`}
                    style={{ fontSize: '20px', lineHeight: 1 }}
                  >
                    {fmt(total)} <span className="text-[14px]">{currency}</span>
                  </p>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
