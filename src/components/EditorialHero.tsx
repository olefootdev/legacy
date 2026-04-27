/**
 * Hero Editorial — Padrão visual do Staff
 *
 * Hero amarelo com watermark gigante, eyebrow, headline e quote italic
 */

import { motion, AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

interface EditorialHeroProps {
  watermark: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  quote?: string;
  stats?: string;
  icon?: ReactNode;
}

export function EditorialHero({
  watermark,
  eyebrow,
  title,
  subtitle,
  quote,
  stats,
  icon,
}: EditorialHeroProps) {
  return (
    <section
      aria-label={title}
      className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm"
    >
      {/* Watermark gigante */}
      <div
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={watermark}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.4 }}
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{
              fontSize: 'clamp(120px, 24vw, 360px)',
              lineHeight: '0.85',
              letterSpacing: '-0.02em',
            }}
          >
            {watermark}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Composição editorial centrada */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
      >
        {/* Eyebrow */}
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6 truncate">
          <span className="text-black">{eyebrow}</span>
        </div>

        {/* Headline */}
        <h1 className="leading-[0.9]">
          <span
            className="block font-bold uppercase text-black"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.75rem, 8vw, 6rem)',
              letterSpacing: '0.005em',
            }}
          >
            {title}
          </span>
          {subtitle && (
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              {subtitle}
            </motion.span>
          )}
        </h1>

        {/* Régua decorativa */}
        <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

        {/* Ícone (opcional) */}
        {icon && (
          <div className="mt-8 flex justify-center">
            {icon}
          </div>
        )}

        {/* Quote italic — CENTERPIECE editorial */}
        {quote && (
          <motion.blockquote
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
            style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
          >
            "{quote}"
          </motion.blockquote>
        )}

        {/* Stats (opcional) */}
        {stats && (
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            {stats}
          </p>
        )}
      </motion.div>
    </section>
  );
}
