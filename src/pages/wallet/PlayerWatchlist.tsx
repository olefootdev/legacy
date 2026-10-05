import { motion } from 'motion/react';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';
import { SecaoVolt } from '@/components/ui';
import { L, LOCALE } from '@/i18n/L';

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
    title: L('Jogadores observados', 'Watched players'),
    cta: L('+ scoutar →', '+ scout →'),
    empty: L('Você ainda não scoutou nenhum jogador. Comece pelo Mercado.', 'You haven\'t scouted any players yet. Start in the Market.'),
  },
  topSquad: {
    eyebrow: L('Top do Plantel', 'Squad top'),
    title: L('Mais valiosos', 'Most valuable'),
    cta: L('Ver plantel →', 'View squad →'),
    empty: L('Nenhum jogador com valor de mercado registrado.', 'No players with a recorded market value.'),
  },
} as const;

/** Rótulo de posição só pra tela (o valor `pos` não muda). */
const POS_EN: Record<string, string> = {
  GOL: 'GK', ZAG: 'CB', LAT: 'FB', LD: 'RB', LE: 'LB', VOL: 'DM', MEI: 'AM', MC: 'CM', PE: 'LW', PD: 'RW', ATA: 'ST', CA: 'ST',
};
const posLabel = (pos: string): string => L(pos, POS_EN[pos] ?? pos);

function formatOle(n: number): string {
  if (n >= 1e6) return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(Math.floor(n / 1e2) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString(LOCALE);
}

export function PlayerWatchlist({
  players,
  onScout,
  variant = 'watchlist',
}: PlayerWatchlistProps) {
  const copy = COPY[variant];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label={copy.eyebrow} tone="neutro" className="min-w-0 grow" />
        {onScout ? (
          <button
            type="button"
            onClick={onScout}
            className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento transition-colors hover:text-white"
          >
            {copy.cta}
          </button>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border border-white/10 bg-panel divide-y divide-white/[0.07]"
        style={{ borderRadius: 'var(--radius-card)' }}
      >
        {players.length === 0 ? (
          <div className="p-5 text-center text-[12px] text-cimento">{copy.empty}</div>
        ) : (
          players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="ole-num flex h-9 w-9 shrink-0 items-center justify-center bg-card-hi text-[12px] text-white tabular-nums">
                {p.ovr}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
                <p className="truncate font-mono text-[10.5px] text-cimento">
                  {posLabel(p.position)} · {p.club}
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
                <p className="font-mono text-[13px] font-medium text-white tabular-nums">
                  {formatOle(p.priceOle)} EXP
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
