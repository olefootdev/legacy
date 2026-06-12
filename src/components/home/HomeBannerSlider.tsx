/**
 * HomeBannerSlider — carrossel horizontal (scroll-snap) com dots pra Home.
 *
 * Junta banners promocionais (Liga Ole + desafios diários) num espaço só,
 * deixando a Home mais limpa. Swipe nativo + indicadores. Sem libs externas.
 */

import { Children, useRef, useState, type ReactNode } from 'react';

export function HomeBannerSlider({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children).filter(Boolean);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  if (slides.length <= 1) return <>{slides}</>;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(Math.max(0, Math.min(slides.length - 1, i)));
  };
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="snap-start shrink-0 w-full">
            {slide}
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center gap-1.5 mt-3">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para o banner ${i + 1}`}
            onClick={() => goTo(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 22 : 6,
              backgroundColor: i === active ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
