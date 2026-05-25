import { motion } from 'motion/react';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';

export type WatchlistEntry = {
  id: string;
  name: string;
  position: string;
  club: string;
  ovr: number;
  priceOle: number;
  change24h: number;
  spark?: number[];
};

type PlayerWatchlistProps = {
  players: WatchlistEntry[];
  onScout?: () => void;
  /** 'watchlist' = jogadores observados externos · 'topSquad' = melhores do seu plantel */
  variant?: 'watchlist' | 'topSquad';
};

const COPY = {
  watchlist: {
    eyebrow: 'Watchlist',
    title: 'Jogadores observados',
    cta: '+ scoutar →',
    empty: 'Você ainda não scoutou nenhum jogador. Comece pelo Mercado.',
  },
  topSquad: {
    eyebrow: 'Top do Plantel',
    title: 'Mais valiosos',
    cta: 'Ver plantel →',
    empty: 'Nenhum jogador com valor de mercado registrado.',
  },
} as const;

function formatOle(n: number): string {
  if (n >= 1e6) return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(Math.floor(n / 1e2) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('pt-BR');
}

export function PlayerWatchlist({
  players,
  onScout,
  variant = 'watchlist',
}: PlayerWatchlistProps) {
  const copy = COPY[variant];
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            {copy.eyebrow}
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            {copy.title}
          </h2>
        </div>
        {onScout ? (
          <button
            type="button"
            onClick={onScout}
            className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/55 hover:text-neon-yellow transition-colors"
          >
            {copy.cta}
          </button>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border border-white/[0.06] divide-y divide-white/[0.04]"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-panel-elevated,#0b0b0b)',
        }}
      >
        {players.length === 0 ? (
          <div className="p-5 text-center text-[12px] text-white/55">{copy.empty}</div>
        ) : (
          players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neon-yellow/15 font-display text-[12px] font-black text-neon-yellow tabular-nums">
                {p.ovr}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                  {p.position} · {p.club}
                </p>
              </div>
              {p.spark && p.spark.length > 1 ? (
                <div className="hidden sm:block shrink-0">
                  <Sparkline
                    data={p.spark}
                    positive={p.change24h >= 0}
                    width={60}
                    height={20}
                    className="opacity-70"
                  />
                </div>
              ) : null}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-[13px] font-bold text-white tabular-nums">
                  {formatOle(p.priceOle)} OLE
                </p>
                <ChangePill change={p.change24h} compact />
              </div>
            </div>
          ))
        )}
      </motion.div>
    </section>
  );
}
