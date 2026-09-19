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
        className="group inline-flex h-12 items-center gap-3 sm:gap-4 border-2 border-black px-5 sm:px-7 transition-colors hover:bg-black hover:text-neon-yellow"
        aria-label="Buscar lenda"
      >
        <Search
          className="w-4 h-4 sm:w-5 sm:h-5 text-black group-hover:text-neon-yellow transition-colors"
          strokeWidth={2.5}
        />
        <span
          className="ole-num whitespace-nowrap uppercase text-black group-hover:text-neon-yellow transition-colors"
          style={{ fontSize: '13px' }}
        >
          Buscar lenda
        </span>
        {totalCount && totalCount > 1 ? (
          <span
            className="ole-num inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 bg-black text-neon-yellow leading-none group-hover:bg-neon-yellow group-hover:text-black transition-colors"
            style={{ fontSize: '11px' }}
          >
            {totalCount}
          </span>
        ) : null}
        <ChevronDown
          className="w-4 h-4 text-black/65 group-hover:text-neon-yellow transition-colors"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
