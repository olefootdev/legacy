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
    <section
      className="relative overflow-hidden border border-[var(--color-border)] bg-deep-black"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="relative h-[220px] sm:h-[280px] md:h-[340px]">
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
                {/* Fallback label em Moret italic case mixto (era Agency uppercase fake italic) */}
                <p
                  className="text-neon-yellow/35 italic select-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  {theme.label.charAt(0) + theme.label.slice(1).toLowerCase()}
                </p>
              </div>
            )}

            {/* Gradientes mais leves — não engole imagem, deixa cor respirar */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 md:p-9">
              {/* TAG — padrão ▍ + SF Pro caps (consistente com /legend e Transfer rails) */}
              {slide.tag ? (
                <div
                  className="mb-3 inline-flex items-center gap-2.5 w-fit"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  <span aria-hidden className="block w-[3px] h-4 bg-neon-yellow" />
                  <span
                    className="text-neon-yellow uppercase font-semibold"
                    style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {slide.tag}
                  </span>
                </div>
              ) : null}

              {/* TÍTULO — Moret italic case mixto (carrega a emoção) */}
              <h2
                className="italic text-white leading-[1.05] [overflow-wrap:anywhere] max-w-2xl"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 400,
                  fontSize: 'clamp(1.65rem, 4.2vw, 3rem)',
                  letterSpacing: '-0.015em',
                }}
              >
                {slide.title}
              </h2>

              {/* TEXTO — SF Pro UI, mais peso editorial que o Inter genérico antes */}
              <p
                className="mt-2 max-w-xl text-white/75"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'clamp(12px, 1.1vw, 14px)',
                  lineHeight: 1.55,
                }}
              >
                {slide.subtitle}
              </p>

              {/* CTA — primário amarelo afiado, padrão sistema */}
              {slide.ctaLabel && slide.onCta ? (
                <button
                  type="button"
                  onClick={slide.onCta}
                  className="mt-4 inline-flex w-fit items-center gap-2 bg-neon-yellow px-5 py-2.5 text-black font-bold uppercase hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {slide.ctaLabel}
                  <ChevronRight className="h-3.5 w-3.5" />
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
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center border border-[var(--color-border)] bg-black/55 text-white/70 backdrop-blur transition-colors hover:border-neon-yellow/60 hover:text-neon-yellow"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Próximo slide"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center border border-[var(--color-border)] bg-black/55 text-white/70 backdrop-blur transition-colors hover:border-neon-yellow/60 hover:text-neon-yellow"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Pagination dots: ativo amarelo, inativo branco translucido */}
            <div className="absolute bottom-3 right-4 z-10 flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para slide ${i + 1}`}
                  className={cn(
                    'h-[3px] transition-all',
                    i === index ? 'w-8 bg-neon-yellow' : 'w-2 bg-white/30 hover:bg-white/60',
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
