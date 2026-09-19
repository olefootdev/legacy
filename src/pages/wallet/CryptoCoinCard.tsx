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
        highlight ? 'border-white/16 bg-card' : 'border-white/10 bg-panel'
      }`}
      style={{ borderRadius: 'var(--radius-card)' }}
    >
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
                className="font-impact text-[16px] uppercase leading-[1.1] text-white sm:text-[18px]"
              >
                {ticker}
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-cimento">
                {name}
              </p>
              {spotPrice ? (
                <p className="mt-1 font-mono text-[10.5px] tabular-nums text-cimento">
                  {spotPrice} <span className="text-poeira">spot</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {badge ? (
              <span
                className="border border-white/16 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-cimento"
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
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">
            Saldo
          </p>
          <p
            className="mt-1 font-mono font-medium tabular-nums leading-none text-white [overflow-wrap:anywhere]"
            style={{ fontSize: 'clamp(22px, 4vw, 30px)' }}
          >
            {balance}
          </p>
          {fiatRef ? (
            <p className="mt-1.5 font-mono text-[10.5px] leading-tight text-poeira tabular-nums">{fiatRef}</p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
