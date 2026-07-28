/**
 * HomeImageSlider — faixa de destaques em LARGURA TOTAL, logo abaixo do hero.
 *
 * Pedido do fundador (2026-07-24): o slider ocupa a tela inteira (não um box
 * dentro da coluna) e a navegação é por botões numerados 1 · 2 · 3 — pra virar
 * um banner impactante, não uma miniatura.
 *
 * FONTE DAS IMAGENS: placeholders por enquanto. Quando existir uma fonte real
 * (slot de admin ou tabela de campanhas), troca-se `slides` e o resto segue.
 *
 * FULL-BLEED: a seção usa `.ole-full-bleed` (100vw) pra escapar da coluna de
 * 672px. Cada slide tem 100vw, então o scroll-snap alinha na largura da tela.
 * Altura por `clamp` — cresce com a viewport mas com teto, pra não virar um
 * paredão no desktop nem uma tira fina no mobile.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';

export interface HomeSlide {
  src?: string;
  alt?: string;
  href?: string;
}

const PLACEHOLDERS: HomeSlide[] = [
  { alt: 'Imagem 1' },
  { alt: 'Imagem 2' },
  { alt: 'Imagem 3' },
];

export function HomeImageSlider({ slides = PLACEHOLDERS }: { slides?: HomeSlide[] }) {
  const trilho = useRef<HTMLDivElement | null>(null);
  const [ativo, setAtivo] = useState(0);
  const total = slides.length;

  const onScroll = useCallback(() => {
    const el = trilho.current;
    if (!el) return;
    const largura = el.clientWidth;
    if (largura === 0) return;
    setAtivo(Math.round(el.scrollLeft / largura));
  }, []);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  function irPara(i: number) {
    const el = trilho.current;
    if (!el) return;
    // `smooth` é o ideal, mas com prefers-reduced-motion (ou onde o navegador
    // ignora smooth) o clique pareceria morto. `auto` sempre desloca; o
    // acender do botão vem do onScroll de qualquer jeito.
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduz ? 'auto' : 'smooth' });
    // Garante o estado do botão mesmo se o scroll não disparar o handler.
    setAtivo(i);
  }

  return (
    <section aria-label="Destaques" className="ole-full-bleed flex flex-col gap-3">
      <div
        ref={trilho}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((s, i) => (
          <Slide key={i} slide={s} />
        ))}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2.5" role="tablist" aria-label="Escolher destaque">
          {slides.map((_, i) => {
            const on = i === ativo;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`Destaque ${i + 1}`}
                onClick={() => irPara(i)}
                className="grid place-items-center font-impact tabular-nums transition-all"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: on ? 'var(--color-neon-yellow)' : 'transparent',
                  color: on ? 'var(--color-deep-black)' : 'rgba(255,255,255,0.5)',
                  border: on ? 'none' : '2px solid rgba(255,255,255,0.18)',
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Slide({ slide }: { slide: HomeSlide }) {
  // Altura de banner: sobe com a viewport, com teto pra não estourar no desktop.
  const alturaStyle = { height: 'clamp(150px, 40vw, 300px)' } as const;

  const conteudo = slide.src ? (
    <img
      src={slide.src}
      alt={slide.alt ?? ''}
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    // Placeholder LIMPO — fundo sólido discreto, sem moldura nem sombra.
    <div className="grid h-full w-full place-items-center" style={{ background: '#151510' }}>
      <div className="flex flex-col items-center gap-2 text-center" style={{ color: 'rgba(237,235,228,0.32)' }}>
        <ImageIcon className="h-6 w-6" aria-hidden />
        <span className="font-display font-black uppercase" style={{ fontSize: '10px', letterSpacing: '0.16em' }}>
          {slide.alt ?? 'Sua imagem aqui'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full flex-none snap-center overflow-hidden" style={alturaStyle}>
      {slide.href ? (
        <a href={slide.href} className="block h-full w-full">
          {conteudo}
        </a>
      ) : (
        conteudo
      )}
    </div>
  );
}
