/**
 * HomeImageSlider — faixa de destaques em LARGURA TOTAL, logo abaixo do hero.
 *
 * Pedido do fundador (2026-07-24): o slider ocupa a tela inteira (não um box
 * dentro da coluna) e a navegação é por botões numerados 1 · 2 · 3 — pra virar
 * um banner impactante, não uma miniatura.
 *
 * FONTE DAS IMAGENS (2026-08-01): as artes oficiais da marca, servidas de
 * `/banners/home/`. Os PNGs originais em `public/` pesam ~2,2 MB cada — seis
 * megabytes na primeira dobra. As versões daqui são JPEG de 1400px geradas a
 * partir deles (originais preservados), e somam menos de 400 KB.
 *
 * São DOIS destaques porque existem duas artes horizontais distintas. A
 * terceira arte da pasta é retrato (941×1672) e é a mesma cena do campeão —
 * cortar pra paisagem só duplicaria o slide 2. Quando existir uma terceira arte
 * de verdade, basta acrescentá-la em DESTAQUES: os botões numerados e o
 * scroll-snap já acompanham qualquer quantidade.
 *
 * FULL-BLEED: a seção usa `.ole-full-bleed` (100vw) pra escapar da coluna de
 * 672px. Cada slide tem 100vw, então o scroll-snap alinha na largura da tela.
 * Altura por `clamp` — cresce com a viewport mas com teto, pra não virar um
 * paredão no desktop nem uma tira fina no mobile.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface HomeSlide {
  src?: string;
  alt?: string;
  /** Rota INTERNA do jogo. Cada destaque leva a uma tela que já existe. */
  href?: string;
}

const DESTAQUES: HomeSlide[] = [
  {
    src: '/banners/home/banner-inicio-liga-ole.jpg',
    alt: 'Time entrando em campo — Liga Global',
    href: '/match/global',
  },
  {
    src: '/banners/home/banner-campeao-game-ole.jpg',
    alt: 'Manager erguido pelo time — campeão',
    href: '/competicao/ranking',
  },
];

export function HomeImageSlider({ slides = DESTAQUES }: { slides?: HomeSlide[] }) {
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

  // Girar o celular muda a largura do trilho, mas o scroll continua no pixel
  // antigo — o botão diria "1" com o destaque 2 na tela. Reancora no slide
  // ativo a cada mudança de largura. Não vira laço: o destino é exatamente
  // ativo × largura, então o onScroll recalcula o mesmo índice.
  useEffect(() => {
    const el = trilho.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      const alvo = ativo * el.clientWidth;
      if (Math.abs(el.scrollLeft - alvo) > 1) el.scrollLeft = alvo;
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ativo]);

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
          // O primeiro destaque está na primeira dobra: carrega junto com a
          // página. Os outros só quando o manager desliza pra eles.
          <Slide key={i} slide={s} eager={i === 0} />
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

function Slide({ slide, eager = false }: { slide: HomeSlide; eager?: boolean }) {
  // Altura de banner: sobe com a viewport, com teto pra não estourar no desktop.
  const alturaStyle = { height: 'clamp(150px, 40vw, 300px)' } as const;

  const conteudo = slide.src ? (
    <img
      src={slide.src}
      alt={slide.alt ?? ''}
      className="h-full w-full object-cover"
      // width/height reservam a proporção antes do byte chegar — sem isso o
      // resto da Home pula quando a imagem carrega.
      width={1400}
      height={933}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
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
        // Link, não <a>: destino interno navega sem recarregar o app inteiro.
        <Link to={slide.href} className="block h-full w-full" aria-label={slide.alt}>
          {conteudo}
        </Link>
      ) : (
        conteudo
      )}
    </div>
  );
}
