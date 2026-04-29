import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Spotlight do tutorial: backdrop escuro full-screen com "buraco" iluminado em
 * volta de um elemento marcado com `data-tutorial-anchor="<id>"`.
 *
 * Tratamento agressivo (product-tour clássico): backdrop a 75%, halo neon-yellow
 * pulsando ao redor do alvo, pointer-events: none pra não bloquear cliques no
 * conteúdo abaixo.
 *
 * O elemento alvo NÃO é movido nem clonado — só medido com `getBoundingClientRect()`.
 * Re-mede em scroll/resize/mutation pra acompanhar layouts dinâmicos.
 */

const PADDING = 12;
const RADIUS = 14;

export function TutorialSpotlight(props: { anchorId: string | undefined }) {
  const { anchorId } = props;
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!anchorId) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tutorial-anchor="${anchorId}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();

    const ro = new ResizeObserver(schedule);
    const el = document.querySelector(`[data-tutorial-anchor="${anchorId}"]`);
    if (el) ro.observe(el);

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [anchorId]);

  // Auto-scroll suave pro alvo se ele estiver fora da viewport.
  useEffect(() => {
    if (!rect) return;
    const outOfView =
      rect.top < 64 || rect.bottom > window.innerHeight - 64;
    if (!outOfView) return;
    const el = anchorId
      ? document.querySelector(`[data-tutorial-anchor="${anchorId}"]`)
      : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [anchorId, rect]);

  if (!anchorId || !rect) return null;

  const top = Math.max(rect.top - PADDING, 0);
  const left = Math.max(rect.left - PADDING, 0);
  const width = rect.width + PADDING * 2;
  const height = rect.height + PADDING * 2;

  return (
    <div
      className="fixed inset-0 z-[9985] pointer-events-none"
      aria-hidden
    >
      <div
        style={{
          position: 'absolute',
          top,
          left,
          width,
          height,
          borderRadius: RADIUS,
          boxShadow:
            '0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px rgba(253,225,0,0.85), 0 0 32px rgba(253,225,0,0.55)',
          animation: 'olefoot-spotlight-pulse 1.8s ease-in-out infinite',
        }}
      />
    </div>
  );
}
