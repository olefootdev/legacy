/**
 * LegendSearchBar — pill destacada e centralizada que abre o LegendSearchModal.
 *
 * Renderizada abaixo da topbar do hero, centralizada com borda preta sólida
 * pra sinalizar com clareza que existe uma galeria de lendas pra explorar.
 */
import { Search, ChevronDown } from 'lucide-react';
import { L } from '@/i18n/L';

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
        className="group inline-flex h-12 items-center gap-3 sm:gap-4 border-2 border-asfalto-27 px-5 sm:px-7 transition-colors hover:bg-asfalto-27"
        aria-label={L('Buscar lenda', 'Search legend')}
      >
        <Search
          className="w-4 h-4 sm:w-5 sm:h-5 text-asfalto-27 group-hover:text-ouro-27 transition-colors"
          strokeWidth={2.5}
        />
        <span
          className="ole-num whitespace-nowrap uppercase text-asfalto-27 group-hover:text-ouro-27 transition-colors"
          style={{ fontSize: '13px' }}
        >
          {L('Buscar lenda', 'Search legend')}
        </span>
        {totalCount && totalCount > 1 ? (
          <span
            className="ole-num inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 bg-asfalto-27 text-ouro-27 leading-none group-hover:bg-ouro-27 group-hover:text-asfalto-27 transition-colors"
            style={{ fontSize: '11px' }}
          >
            {totalCount}
          </span>
        ) : null}
        <ChevronDown
          className="w-4 h-4 text-asfalto-27 group-hover:text-ouro-27 transition-colors"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
