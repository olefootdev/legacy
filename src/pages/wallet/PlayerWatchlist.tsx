import { motion } from 'motion/react';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';
import { DEGRAU_CLASSES, SecaoVolt } from '@/components/ui';
import { degrauDe } from '@/components/home/rua/DropLenda';
import { cn } from '@/lib/utils';
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
    eyebrow: L('Tuas joias', 'Your gems'),
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
            className="shrink-0 font-impact text-[16px] uppercase text-rua transition-colors hover:text-papel"
          >
            {copy.cta}
          </button>
        ) : null}
      </div>

      {players.length === 0 ? (
        <div className="border-2 border-dashed border-fio p-5 font-prova text-[12px] text-mudo">{copy.empty}</div>
      ) : (
        // DS 2027 · "Tuas joias": cada carta no degrau do OVR, coladas tortas.
        <motion.ul
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-3 gap-2.5 sm:gap-4"
        >
          {players.map((p, i) => {
            const d = degrauDe(p.ovr);
            return (
              <li
                key={p.id}
                className={cn('flex min-h-[150px] min-w-0 flex-col justify-between gap-2 p-2.5 sm:p-3', DEGRAU_CLASSES[d])}
                style={{ transform: `rotate(${[-1.5, 1, -0.5][i % 3]}deg)` }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      'font-impact text-[clamp(32px,9vw,46px)] leading-[0.85] tabular-nums',
                      d === 'respeito' && 'text-ouro-27',
                      d === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
                    )}
                  >
                    {p.ovr}
                  </span>
                  <span className={cn('font-impact text-[13px] uppercase leading-none', d === 'respeito' && 'text-ouro-27')}>
                    {posLabel(p.position)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="block min-w-0 truncate font-voz text-[clamp(18px,5vw,24px)] leading-none">{p.name}</span>
                  <span className="block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.06em]">
                    {formatOle(p.priceOle)} EXP
                  </span>
                </div>
              </li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}
