import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';
import { SecaoVolt } from '@/components/ui';

type SquadValuationCardProps = {
  /** Valor total do plantel em OLE, somado do plantel real. */
  totalOle: number;
  change24h: number;
  playerCount: number;
  spark: number[];
  /** Capitão ou jogador mais valioso pra ilustrar visualmente. */
  highlight?: { name: string; position: string; valueOle: number };
};

function formatOle(n: number): string {
  if (n >= 1e6) return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(Math.floor(n / 1e2) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('pt-BR');
}

export function SquadValuationCard({
  totalOle,
  change24h,
  playerCount,
  spark,
  highlight,
}: SquadValuationCardProps) {
  const navigate = useNavigate();
  const positive = change24h >= 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label="Valor do plantel" tone="neutro" className="min-w-0 grow" />
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento transition-colors hover:text-white"
        >
          Plantel →
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative isolate overflow-hidden border border-white/10 bg-panel"
        style={{ borderRadius: 'var(--radius-card)' }}
      >
        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] items-stretch gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-cimento">
                Total · {playerCount} jogadores
              </span>
              <ChangePill change={change24h} compact />
            </div>

            <p
              className="ole-num tabular-nums leading-none text-white"
              style={{ fontSize: 'clamp(30px, 7vw, 48px)' }}
            >
              {formatOle(totalOle)} EXP
            </p>

            <p className="font-mono text-[11px] text-cimento tabular-nums">
              {totalOle.toLocaleString('pt-BR')} EXP · valor de mercado
            </p>

            {highlight ? (
              <div className="mt-2 flex items-center gap-3 border border-white/10 bg-card px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center bg-card-hi text-[12px] text-white">
                  ★
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-poeira">
                    Maior valor
                  </p>
                  <p className="text-[12px] font-bold text-white truncate">
                    {highlight.name}{' '}
                    <span className="text-cimento">· {highlight.position}</span>
                  </p>
                </div>
                <p className="font-mono text-[12px] font-medium text-white tabular-nums">
                  {formatOle(highlight.valueOle)} EXP
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center sm:items-stretch sm:w-[180px]">
            <Sparkline
              data={spark}
              positive={positive}
              width={180}
              height={80}
              className="w-full h-full opacity-90"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
