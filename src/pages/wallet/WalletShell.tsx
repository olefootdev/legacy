import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import { WalletSpotToggle } from './WalletSpotToggle';
import { Sparkline } from './Sparkline';

export function WalletShell({
  title,
  subtitle,
  heroStats,
  heroVariant = 'cinematic',
  children,
}: {
  title: string;
  subtitle?: string;
  heroStats?: {
    label: string;
    value: string;
    subValue?: string;
    highlight?: boolean;
    spark?: number[];
    sparkPositive?: boolean;
  }[];
  /** 'cinematic' = hero alto (88vh). 'compact' = hero menor (~50vh) quando o conteúdo abaixo é rico. */
  heroVariant?: 'cinematic' | 'compact';
  children: ReactNode;
}) {
  const heroMinH = heroVariant === 'compact' ? '' : 'min-h-[60vh]';
  const titleSize =
    heroVariant === 'compact'
      ? 'clamp(44px, 10vw, 80px)'
      : 'clamp(56px, 13vw, 112px)';
  return (
    <div className="min-h-screen bg-deep-black">
      {/* ── HERO — VOLT2: asfalto chapado, título em Anton, saldo em bloco ── */}
      <section className={`relative w-full border-b border-white/10 bg-deep-black ${heroMinH}`}>
        {/* Conteúdo */}
        <div className="relative mx-auto max-w-6xl px-4 sm:px-8 py-5 sm:py-7">
          <div className="mb-8 flex items-center justify-center sm:mb-10">
            <WalletSpotToggle />
          </div>

          {/* Grid: esquerda + direita */}
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* ── ESQUERDA: Título ────────────────────────── */}
            <div className="min-w-0 space-y-3">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-center font-mono text-[11.5px] font-medium text-cimento lg:text-left"
              >
                #carteira
              </motion.p>

              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="text-center font-impact uppercase leading-[0.95] text-white lg:text-left"
                style={{ fontSize: titleSize }}
              >
                {title}
              </motion.h1>

              {/* Subtítulo */}
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="mx-auto max-w-md text-center text-sm leading-relaxed text-cimento lg:mx-0 lg:text-left"
                >
                  {subtitle}
                </motion.p>
              )}
            </div>

            {/* ── DIREITA: Stats grid ──────────────── */}
            {heroStats && heroStats.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="grid grid-cols-2 gap-2 sm:gap-3"
              >
                {heroStats.map((stat, i) => (
                  <div
                    key={i}
                    className="min-w-0 border border-white/10 bg-panel px-3 py-4 text-center"
                  >
                    <p className="truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cimento">
                      {stat.label}
                    </p>
                    <p
                      className={`mt-2 font-mono font-medium tabular-nums leading-none [overflow-wrap:anywhere] ${
                        stat.highlight ? 'text-white' : 'text-giz'
                      }`}
                      style={{ fontSize: 'clamp(18px, 5vw, 32px)' }}
                    >
                      {stat.value}
                    </p>
                    {stat.subValue ? (
                      <p className="mt-1.5 truncate font-mono text-[10.5px] text-poeira tabular-nums">
                        {stat.subValue}
                      </p>
                    ) : null}
                    {stat.spark && stat.spark.length > 1 ? (
                      <div className="mt-3 flex justify-center">
                        <Sparkline
                          data={stat.spark}
                          positive={stat.sparkPositive ?? true}
                          width={140}
                          height={28}
                          className="opacity-80"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div id="wallet-content" className="mx-auto min-w-0 w-full max-w-3xl space-y-8 px-4 sm:px-8 py-8 sm:py-12 pb-28 md:pb-12">
        {children}

      </div>
    </div>
  );
}
