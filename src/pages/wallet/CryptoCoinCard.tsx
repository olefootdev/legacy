import { motion } from 'motion/react';
import { ChangePill } from './ChangePill';
import { Sparkline } from './Sparkline';
import { L } from '@/i18n/L';

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
      // DS 2027: o saldo que é TEU de verdade é RESPEITO (asfalto + fio de
      // ouro); o resto é concreto chapado.
      className={`relative isolate flex h-full flex-col overflow-hidden text-left transition-colors ${
        highlight ? 'border-[3px] border-ouro-27 bg-asfalto-27' : 'bg-concreto'
      }`}
    >
      <div className="relative flex h-full flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black sm:h-12 sm:w-12">
              <img
                src={logoSrc}
                alt={`${name} logo`}
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                loading="lazy"
              />
            </div>
            <div className="min-w-0">
              <p className="font-impact text-[22px] uppercase leading-none text-papel">{ticker}</p>
              <p className="mt-1 truncate font-prova text-[11.5px] text-mudo">
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
              <span className="bg-ouro-27 px-2 py-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-asfalto-27">
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
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            — {L('Saldo', 'Balance')}
          </p>
          <p
            className={`mt-1.5 font-impact tabular-nums leading-none [overflow-wrap:anywhere] ${highlight ? 'text-ouro-27' : 'text-papel'}`}
            style={{ fontSize: 'clamp(28px, 6vw, 38px)' }}
          >
            {balance}
          </p>
          {fiatRef ? (
            <p className="mt-2 font-prova text-[11px] leading-snug text-suave tabular-nums">{fiatRef}</p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
