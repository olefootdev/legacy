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
  const heroMinH =
    heroVariant === 'compact'
      ? 'min-h-[52vh] sm:min-h-[58vh]'
      : 'min-h-[78vh] sm:min-h-[88vh]';
  const titleSize =
    heroVariant === 'compact'
      ? 'clamp(48px, 10vw, 88px)'
      : 'clamp(64px, 14vw, 120px)';
  return (
    <div className="min-h-screen bg-deep-black">
      {/* ── HERO CINEMATOGRÁFICO ──────────────────────────────────── */}
      <section className={`relative w-full overflow-hidden bg-neon-yellow ${heroMinH}`}>
        {/* Camada amarela sólida */}
        <div className="absolute inset-0 bg-neon-yellow" aria-hidden />

        {/* Linhas verticais sutis (textura de campo) */}
        <svg
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <g stroke="#000" strokeOpacity="0.06" strokeWidth="0.15">
            <line x1="20" y1="0" x2="20" y2="100" />
            <line x1="40" y1="0" x2="40" y2="100" />
            <line x1="60" y1="0" x2="60" y2="100" />
            <line x1="80" y1="0" x2="80" y2="100" />
          </g>
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 py-5 sm:py-7">
          {/* Top bar — Sprint B-4: toggle centralizado pílulas arredondadas */}
          <div className="flex items-center justify-center mb-8 sm:mb-12">
            <WalletSpotToggle />
          </div>

          {/* Grid: esquerda + direita */}
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
              heroVariant === 'compact' ? 'min-h-[28vh]' : 'min-h-[50vh]'
            }`}
          >
            {/* ── ESQUERDA: Título + Descrição ────────────────────────── */}
            <div className="space-y-6 sm:space-y-8">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex items-center justify-center gap-3 lg:justify-start"
              >
                <span className="h-px w-8 bg-black/40" aria-hidden />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-black/70">
                  Wallet Olefoot
                </span>
                <span className="h-px w-8 bg-black/40" aria-hidden />
              </motion.div>

              {/* Título Moret italic */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="ole-headline-italic text-black text-center lg:text-left leading-[0.9]"
                style={{ fontSize: titleSize }}
              >
                {title}
              </motion.h1>

              {/* Subtítulo */}
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-black/70 text-sm sm:text-base leading-relaxed text-center lg:text-left max-w-md mx-auto lg:mx-0"
                >
                  {subtitle}
                </motion.p>
              )}
            </div>

            {/* ── DIREITA: Stats grid ──────────────── */}
            {heroStats && heroStats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="grid grid-cols-2 gap-3 sm:gap-4"
              >
                {heroStats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                    className="bg-black px-4 py-4 text-center"
                  >
                    <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
                      {stat.label}
                    </p>
                    <p
                      className={`ole-headline-italic mt-2 tabular-nums ${
                        stat.highlight ? 'text-neon-yellow' : 'text-white'
                      }`}
                      style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}
                    >
                      {stat.value}
                    </p>
                    {stat.subValue ? (
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 tabular-nums">
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
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* (Scroll cue "Ver detalhes" removido — desnecessário no hero) */}
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div id="wallet-content" className="mx-auto min-w-0 w-full max-w-3xl space-y-8 px-4 sm:px-8 py-8 sm:py-12 pb-28 md:pb-12">
        {children}

      </div>
    </div>
  );
}
