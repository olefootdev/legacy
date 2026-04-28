/**
 * LegendStoreCTA — banner editorial no rodapé levando o manager pra Store.
 * Reutilizável: passa nome + slug.
 */
import { Link } from 'react-router-dom';

interface LegendStoreCTAProps {
  legendName: string;
  storeHighlightId?: string;
}

export function LegendStoreCTA({ legendName, storeHighlightId }: LegendStoreCTAProps) {
  const href = storeHighlightId
    ? `/mercado/loja?tab=legacies&legend=${storeHighlightId}`
    : `/mercado/loja?tab=legacies`;

  return (
    <section
      aria-label="Garante a tua lenda"
      className="relative overflow-hidden bg-neon-yellow"
    >
      {/* Watermark editorial */}
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
      >
        <span
          className="font-display font-black uppercase tracking-tight whitespace-nowrap text-black/[0.04]"
          style={{ fontSize: 'clamp(140px, 22vw, 320px)', lineHeight: 0.85 }}
        >
          Legacy
        </span>
      </span>
      <div className="relative mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16 text-center">
        <span
          className="inline-flex items-center gap-2 font-display font-black uppercase text-black/75"
          style={{ fontSize: '10px', letterSpacing: '0.32em' }}
        >
          <span aria-hidden className="block h-px w-8 bg-black/55" />
          Olefoot · Store
          <span aria-hidden className="block h-px w-8 bg-black/55" />
        </span>
        <h2
          className="ole-headline-italic text-black mt-4 leading-[0.95]"
          style={{ fontSize: 'clamp(36px, 6.5vw, 60px)' }}
        >
          Garante o teu Legacy
        </h2>
        <span aria-hidden className="mx-auto mt-4 block w-12 h-[3px] bg-black" />
        <p
          className="mt-5 text-black/75 max-w-xl mx-auto leading-relaxed"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
          }}
        >
          A carta de {legendName} ensina os teus jogadores no plantel — atributos,
          mentalidade e bônus de equipa. Edição limitada no Store Olefoot.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            to={href}
            className="inline-flex items-center bg-black text-neon-yellow px-10 py-4 font-display font-black uppercase shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98]"
            style={{
              fontSize: '14px',
              letterSpacing: '0.32em',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Store
          </Link>
        </div>
      </div>
    </section>
  );
}
