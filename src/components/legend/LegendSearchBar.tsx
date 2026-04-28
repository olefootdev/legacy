/**
 * LegendSearchBar — pill destacada e centralizada que abre o LegendSearchModal.
 *
 * Renderizada abaixo da topbar do hero, centralizada com borda preta sólida
 * pra sinalizar com clareza que existe uma galeria de lendas pra explorar.
 */
import { Search, ChevronDown } from 'lucide-react';

interface LegendSearchBarProps {
  onOpen: () => void;
  /** Total de lendas cadastradas (badge discreto). */
  totalCount?: number;
}

export function LegendSearchBar({ onOpen, totalCount }: LegendSearchBarProps) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        className="group inline-flex items-center gap-3 sm:gap-4 border-2 border-black bg-black/5 backdrop-blur-sm px-5 sm:px-7 py-3 sm:py-3.5 transition-all hover:bg-black hover:text-neon-yellow active:scale-[0.98] shadow-[0_4px_18px_rgba(0,0,0,0.18)]"
        style={{ borderRadius: 'var(--radius-pill)' }}
        aria-label="Buscar lenda"
      >
        <Search
          className="w-4 h-4 sm:w-5 sm:h-5 text-black group-hover:text-neon-yellow transition-colors"
          strokeWidth={2.5}
        />
        <span
          className="font-display font-black uppercase text-black group-hover:text-neon-yellow transition-colors"
          style={{
            fontSize: 'clamp(12px, 1.4vw, 14px)',
            letterSpacing: '0.26em',
          }}
        >
          Buscar lenda
        </span>
        {totalCount && totalCount > 1 ? (
          <span
            className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 bg-black text-neon-yellow font-display font-black tabular-nums leading-none group-hover:bg-neon-yellow group-hover:text-black transition-colors"
            style={{
              fontSize: '11px',
              letterSpacing: '0.04em',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {totalCount}
          </span>
        ) : null}
        <ChevronDown
          className="w-4 h-4 text-black/65 group-hover:text-neon-yellow/85 transition-colors"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
