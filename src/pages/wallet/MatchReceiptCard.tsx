import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Recibo
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Última partida
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wallet/extract')}
          className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/55 hover:text-neon-yellow transition-colors"
        >
          Recibos anteriores →
        </button>
      </div>

      {!data ? (
        <div
          className="border border-white/[0.06] p-5 text-center"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated,#0b0b0b)',
          }}
        >
          <p className="text-[12px] text-white/55">
            Joga a próxima partida e o recibo aparece aqui.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden border border-white/[0.06]"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated,#0b0b0b)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Header do recibo */}
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.08] px-5 py-4">
            <div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                {data.roundLabel} · {data.isHome ? 'Casa' : 'Fora'}
              </p>
              <p className="mt-1 font-display text-[16px] font-black uppercase tracking-tight text-white">
                vs {data.opponent}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
                Resultado
              </p>
              <p
                className="mt-1 tabular-nums text-neon-yellow"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: '22px',
                  lineHeight: 1,
                }}
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
                  <p className="text-[12px] text-white/75">{line.label}</p>
                  <p
                    className={`text-[12px] font-bold tabular-nums ${
                      positive ? 'text-neon-green' : 'text-red-400'
                    }`}
                  >
                    {fmt(line.amount)} {line.currency}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Líquido */}
          <div className="border-t border-dashed border-white/[0.08] bg-black/40 px-5 py-4">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
              Líquido
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {Object.entries(totalsByCurrency(data.lines)).map(([currency, total]) => {
                const positive = total >= 0;
                return (
                  <p
                    key={currency}
                    className={`tabular-nums ${positive ? 'text-neon-green' : 'text-red-400'}`}
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: '22px',
                      lineHeight: 1,
                    }}
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
