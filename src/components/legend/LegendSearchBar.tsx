/**
 * LegendSearchBar — pílula clicável que abre o LegendSearchModal.
 * Renderizada acima do eyebrow no hero (sobre fundo amarelo).
 */
import { Search, ChevronDown } from 'lucide-react';

interface LegendSearchBarProps {
  onOpen: () => void;
  /** Total de lendas cadastradas (mostra discreto na pílula). */
  totalCount?: number;
}

export function LegendSearchBar({ onOpen, totalCount }: LegendSearchBarProps) {
  return (
    <div className="flex justify-center mb-6 sm:mb-8">
      <button
        type="button"
        onClick={onOpen}
        className="group inline-flex items-center gap-2 sm:gap-3 border-2 border-black/30 bg-black/10 backdrop-blur-sm px-4 sm:px-5 py-2.5 transition-all hover:bg-black hover:text-neon-yellow hover:border-black active:scale-[0.98]"
        style={{ borderRadius: 'var(--radius-pill)' }}
        aria-label="Buscar outras lendas no museu"
      >
        <Search className="w-4 h-4 text-black group-hover:text-neon-yellow transition-colors" strokeWidth={2.5} />
        <span
          className="font-display font-black uppercase text-black group-hover:text-neon-yellow transition-colors"
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
          }}
        >
          Explorar lendas
        </span>
        {totalCount && totalCount > 1 ? (
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-black text-neon-yellow font-display font-black tabular-nums leading-none group-hover:bg-neon-yellow group-hover:text-black transition-colors"
            style={{
              fontSize: '10px',
              letterSpacing: '0.04em',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {totalCount}
          </span>
        ) : null}
        <ChevronDown
          className="w-3.5 h-3.5 text-black/65 group-hover:text-neon-yellow/85 transition-colors"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
