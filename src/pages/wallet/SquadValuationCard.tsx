import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';
import { SecaoVolt } from '@/components/ui';
import { L, LOCALE } from '@/i18n/L';

type SquadValuationCardProps = {
  /** Valor total do plantel em OLE, somado do plantel real. */
  totalOle: number;
  change24h: number;
  playerCount: number;
  spark: number[];
  /** Capitão ou jogador mais valioso pra ilustrar visualmente. */
  highlight?: { name: string; position: string; valueOle: number };
};

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
        <SecaoVolt label={L('Valor do plantel', 'Squad value')} tone="neutro" className="min-w-0 grow" />
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="shrink-0 font-impact text-[16px] uppercase text-rua transition-colors hover:text-papel"
        >
          {L('Plantel →', 'Squad →')}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative isolate overflow-hidden border-l-[5px] border-rua bg-concreto"
      >
        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] items-stretch gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-papel">
                {L(`Total · ${playerCount} jogadores`, `Total · ${playerCount} players`)}
              </span>
              <ChangePill change={change24h} compact />
            </div>

            <p
              className="font-impact tabular-nums leading-none text-papel"
              style={{ fontSize: 'clamp(40px, 11vw, 60px)' }}
            >
              {formatOle(totalOle)} EXP
            </p>

            <p className="font-prova text-[11.5px] text-mudo tabular-nums">
              {totalOle.toLocaleString(LOCALE)} EXP · {L('valor de mercado', 'market value')}
            </p>

            {highlight ? (
              <div className="mt-2 flex -rotate-1 items-center gap-3 bg-ouro-27 px-3 py-2.5 text-asfalto-27 shadow-[4px_4px_0_rgba(0,0,0,0.6)]">
                <div className="min-w-0 flex-1">
                  <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em]">
                    {L('Maior valor', 'Highest value')} · {posLabel(highlight.position)}
                  </p>
                  <p className="truncate font-voz text-[24px] leading-none">{highlight.name}</p>
                </div>
                <p className="font-impact text-[20px] leading-none tabular-nums">
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
