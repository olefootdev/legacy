/**
 * LegendStoreCTA — banner editorial no rodapé levando o manager pra Store.
 * Reutilizável: passa nome + slug.
 */
import { Link } from 'react-router-dom';
import { Hashtag } from '@/components/ui';

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
      aria-label="Garanta sua lenda"
      className="relative overflow-hidden bg-neon-yellow"
    >
      <div className="relative mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16 text-center">
        <Hashtag className="text-black/70">#loja · legacy</Hashtag>
        <h2
          className="font-impact uppercase text-black mt-3 leading-[1.1]"
          style={{ fontSize: 'clamp(36px, 6.5vw, 60px)' }}
        >
          Garanta seu Legacy
        </h2>
        <p className="mt-3 truncate font-mono text-[12px] text-black/70">
          Carta de {legendName} · edição limitada
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            to={href}
            className="ole-num inline-flex h-[52px] items-center whitespace-nowrap bg-black px-10 text-[14px] uppercase text-neon-yellow transition-colors hover:bg-deep-black [--corte:12px] [clip-path:var(--clip-corte)]"
          >
            Ver na loja
          </Link>
        </div>
      </div>
    </section>
  );
}
