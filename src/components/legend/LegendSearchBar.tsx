/**
 * LegendSearchBar — botão compacto que abre o LegendSearchModal.
 *
 * Renderizada na topbar do hero (lado direito, alinhada com o "Voltar"
 * do lado esquerdo). Texto: "Buscar lenda".
 */
import { Search } from 'lucide-react';

interface LegendSearchBarProps {
  onOpen: () => void;
  /** Total de lendas cadastradas (badge discreto). */
  totalCount?: number;
}

export function LegendSearchBar({ onOpen, totalCount }: LegendSearchBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group inline-flex items-center gap-2 text-black/70 hover:text-black font-display uppercase font-black transition-colors"
      style={{ fontSize: '11px', letterSpacing: '0.22em' }}
      aria-label="Buscar lenda"
    >
      <Search className="w-4 h-4" strokeWidth={2.5} />
      Buscar lenda
      {totalCount && totalCount > 1 ? (
        <span
          className="ml-1 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 bg-black text-neon-yellow font-display font-black tabular-nums leading-none group-hover:bg-deep-black"
          style={{
            fontSize: '9px',
            letterSpacing: '0.04em',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          {totalCount}
        </span>
      ) : null}
    </button>
  );
}
