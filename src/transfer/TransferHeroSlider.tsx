/**
 * Hero slider promocional para /transfer — rotaciona 3-5 slides por aba.
 *
 * Cada slide usa imagem promocional em `/public/transfer-heroes/{tab}-{n}.webp`.
 * Enquanto o designer não entrega a arte, renderiza um fallback com gradiente
 * temático + título/subtítulo (nunca quebra o layout).
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HeroTab =
  | 'genesis' | 'legacies' | 'newbies' | 'highlights'
  | 'store-all' | 'store-packs' | 'store-boosters' | 'store-extra';

interface HeroSlide {
  /** Caminho final da arte promocional — designer vai popular. */
  imageUrl?: string;
  title: string;
  subtitle: string;
  /** Rótulo do CTA — opcional (se ausente, só mostra info). */
  ctaLabel?: string;
  /** Callback do CTA — usar pra scrollar pra rail ou abrir filtro. */
  onCta?: () => void;
  /** Chip categoria no canto (ex: "Drop novo", "Lote premium"). */
  tag?: string;
}

interface TransferHeroSliderProps {
  tab: HeroTab;
  slides: HeroSlide[];
  /** Troca automática (ms). 0 desativa. */
  autoPlayMs?: number;
}

/** Paletas de fallback por aba — placeholder enquanto a arte real não chega. */
const TAB_THEME: Record<HeroTab, { from: string; via: string; to: string; accent: string; label: string }> = {
  genesis:          { from: 'from-neon-yellow/30', via: 'via-amber-500/20',  to: 'to-black', accent: 'text-neon-yellow', label: 'GENESIS' },
  legacies:         { from: 'from-amber-400/30',   via: 'via-orange-500/20', to: 'to-black', accent: 'text-amber-300',   label: 'LEGACIES' },
  newbies:          { from: 'from-emerald-400/25', via: 'via-cyan-500/15',   to: 'to-black', accent: 'text-emerald-300', label: 'NEWBIES' },
  highlights:       { from: 'from-fuchsia-500/25', via: 'via-violet-600/20', to: 'to-black', accent: 'text-fuchsia-300', label: 'HIGHLIGHTS' },
  'store-all':      { from: 'from-neon-yellow/25', via: 'via-amber-500/15',  to: 'to-black', accent: 'text-neon-yellow', label: 'LOJA' },
  'store-packs':    { from: 'from-amber-500/30',   via: 'via-orange-500/15', to: 'to-black', accent: 'text-amber-300',   label: 'PACKS' },
  'store-boosters': { from: 'from-cyan-400/25',    via: 'via-sky-500/15',    to: 'to-black', accent: 'text-cyan-300',    label: 'BOOSTERS' },
  'store-extra':    { from: 'from-fuchsia-400/25', via: 'via-violet-600/15', to: 'to-black', accent: 'text-fuchsia-300', label: 'EXTRA' },
};

export function TransferHeroSlider({ tab, slides, autoPlayMs = 6500 }: TransferHeroSliderProps) {
  const [index, setIndex] = useState(0);
  const theme = TAB_THEME[tab];

  useEffect(() => {
    setIndex(0);
  }, [tab]);

  useEffect(() => {
    if (!autoPlayMs || slides.length <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, autoPlayMs);
    return () => window.clearInterval(t);
  }, [autoPlayMs, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index]!;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="relative h-[200px] sm:h-[260px] md:h-[320px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${index}`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            {slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={cn(
                'flex h-full w-full items-center justify-center bg-gradient-to-br',
                theme.from, theme.via, theme.to,
              )}>
                <p className={cn(
                  'font-display text-4xl font-black italic uppercase tracking-[0.3em] opacity-60 sm:text-6xl',
                  theme.accent,
                )}>
                  {theme.label}
                </p>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8">
              {slide.tag ? (
                <span className={cn(
                  'mb-2 inline-block w-fit rounded-full border px-2.5 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.25em]',
                  'border-white/20 bg-black/40 backdrop-blur', theme.accent,
                )}>
                  {slide.tag}
                </span>
              ) : null}
              <h2 className="font-display text-xl font-black italic uppercase leading-tight tracking-wider text-white sm:text-3xl md:text-4xl [overflow-wrap:anywhere]">
                {slide.title}
              </h2>
              <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-gray-300 sm:text-sm">
                {slide.subtitle}
              </p>
              {slide.ctaLabel && slide.onCta ? (
                <button
                  type="button"
                  onClick={slide.onCta}
                  className={cn(
                    'mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg px-3.5 py-2 font-display text-[10px] font-black uppercase tracking-[0.25em] transition-colors sm:text-[11px]',
                    'bg-white text-black hover:bg-neon-yellow',
                  )}
                >
                  {slide.ctaLabel}
                </button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="Slide anterior"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-1.5 text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white sm:left-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Próximo slide"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-1.5 text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white sm:right-3"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-3">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para slide ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
