import { motion } from 'motion/react';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';

export type CryptoCoinCardProps = {
  logoSrc: string;
  ticker: string;
  name: string;
  balance: string;
  fiatRef?: string;
  highlight?: boolean;
  badge?: string;
  delay?: number;
  change24h?: number;
  spark?: number[];
  /** Preço spot formatado pra exibição estilo exchange (ex: "$43,250"). */
  spotPrice?: string;
};

export function CryptoCoinCard({
  logoSrc,
  ticker,
  name,
  balance,
  fiatRef,
  highlight,
  badge,
  delay = 0,
  change24h,
  spark,
  spotPrice,
}: CryptoCoinCardProps) {
  const hasChange = typeof change24h === 'number';
  const positive = hasChange ? change24h! >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`relative isolate flex h-full flex-col overflow-hidden border text-left transition-colors ${
        highlight
          ? 'border-neon-yellow/30 bg-gradient-to-br from-neon-yellow/[0.08] to-transparent'
          : 'border-white/[0.06] bg-[var(--color-panel-elevated,#0b0b0b)]'
      }`}
      style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}
    >
      {highlight ? (
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
      ) : null}

      <div className="relative flex h-full flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/[0.05] sm:h-12 sm:w-12">
              <img
                src={logoSrc}
                alt={`${name} logo`}
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                loading="lazy"
              />
            </div>
            <div className="min-w-0">
              <p
                className="font-display text-[15px] font-black uppercase leading-none tracking-tight text-white sm:text-[16px]"
                style={{ letterSpacing: '0.005em' }}
              >
                {ticker}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                {name}
              </p>
              {spotPrice ? (
                <p className="mt-1 text-[10px] tabular-nums text-white/55">
                  {spotPrice} <span className="text-white/30">spot</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {badge ? (
              <span
                className={`font-display text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                  highlight
                    ? 'border-neon-yellow/40 text-neon-yellow bg-neon-yellow/[0.08]'
                    : 'border-white/15 text-white/55 bg-white/[0.03]'
                }`}
              >
                {badge}
              </span>
            ) : null}
            {hasChange ? <ChangePill change={change24h!} compact /> : null}
          </div>
        </div>

        {spark && spark.length > 1 ? (
          <div className="-mx-1">
            <Sparkline data={spark} positive={positive} width={220} height={28} className="w-full h-7 opacity-90" />
          </div>
        ) : null}

        <div className="mt-auto">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
            Saldo
          </p>
          <p
            className={`mt-1 tabular-nums leading-none ${
              highlight ? 'text-neon-yellow' : 'text-white'
            }`}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(22px, 4vw, 30px)',
            }}
          >
            {balance}
          </p>
          {fiatRef ? (
            <p className="mt-1 text-[10px] leading-tight text-white/35 tabular-nums">{fiatRef}</p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
