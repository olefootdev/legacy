import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';

type SquadValuationCardProps = {
  /** Valor total do plantel em OLE (mock por enquanto). */
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Patrimônio Esportivo
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Valor do plantel
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/55 hover:text-neon-yellow transition-colors"
        >
          Ver plantel →
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative isolate overflow-hidden border border-neon-yellow/20 bg-gradient-to-br from-neon-yellow/[0.06] via-transparent to-transparent"
        style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />

        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] items-stretch gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
                Total · {playerCount} jogadores
              </span>
              <ChangePill change={change24h} compact />
            </div>

            <p
              className="tabular-nums leading-none text-neon-yellow"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(36px, 7vw, 56px)',
              }}
            >
              {formatOle(totalOle)} OLE
            </p>

            <p className="text-[11px] text-white/55 tabular-nums">
              {totalOle.toLocaleString('pt-BR')} OLE · valor de mercado
            </p>

            {highlight ? (
              <div className="mt-2 flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/40 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-yellow/15 font-display text-[10px] font-black text-neon-yellow">
                  ★
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Maior valor
                  </p>
                  <p className="text-[12px] font-bold text-white truncate">
                    {highlight.name}{' '}
                    <span className="text-white/45">· {highlight.position}</span>
                  </p>
                </div>
                <p className="text-[12px] font-bold text-neon-yellow tabular-nums">
                  {formatOle(highlight.valueOle)} OLE
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
