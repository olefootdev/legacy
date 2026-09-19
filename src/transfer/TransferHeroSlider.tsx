/**
 * Hero slider promocional para /transfer — rotaciona 3-5 slides por aba.
 *
 * Cada slide usa imagem promocional em `/public/transfer-heroes/{tab}-{n}.webp`.
 * Enquanto o designer não entrega a arte, renderiza um fallback chapado
 * (bg-card + rótulo da aba) + título/subtítulo (nunca quebra o layout).
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

/** Rótulo de fallback por aba — placeholder chapado enquanto a arte real não chega (VOLT2). */
const TAB_THEME: Record<HeroTab, { label: string }> = {
  genesis:          { label: 'GENESIS' },
  legacies:         { label: 'LEGACIES' },
  newbies:          { label: 'NEWBIES' },
  highlights:       { label: 'HIGHLIGHTS' },
  'store-all':      { label: 'LOJA' },
  'store-packs':    { label: 'PACKS' },
  'store-boosters': { label: 'BOOSTERS' },
  'store-extra':    { label: 'EXTRA' },
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
  // Clamp: index pode estar stale quando slides muda (race com setIndex(0))
  const slide = slides[index] ?? slides[0]!;

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
              <div className="flex h-full w-full items-center justify-center bg-card">
                {/* Fallback: rótulo da aba em Anton, fundo chapado */}
                <p
                  className="font-impact uppercase text-neon-yellow/35 select-none"
                  style={{
                    fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.1,
                  }}
                >
                  {theme.label}
                </p>
              </div>
            )}

            {/* Scrim sobre a foto — legibilidade do título (gradiente permitido no VOLT2) */}
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

              {/* TÍTULO — Anton, sem serifa nem itálico (VOLT2) */}
              <h2
                className="font-impact uppercase text-white leading-[1.1] [overflow-wrap:anywhere] max-w-2xl"
                style={{
                  fontSize: 'clamp(1.65rem, 4.2vw, 3rem)',
                  letterSpacing: '-0.01em',
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
                  className="mt-4 inline-flex w-fit items-center gap-2 bg-neon-yellow px-5 py-2.5 text-black font-bold uppercase hover:bg-white transition-colors"
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
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center border border-[var(--color-border)] bg-deep-black text-white/70 transition-colors hover:border-neon-yellow/60 hover:text-neon-yellow"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Próximo slide"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 grid h-8 w-8 place-items-center border border-[var(--color-border)] bg-deep-black text-white/70 transition-colors hover:border-neon-yellow/60 hover:text-neon-yellow"
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
