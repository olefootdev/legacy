/**
 * Toggle de visualização Grid/Lista para a Store
 * Grid: 3 colunas, cards grandes com emoção
 * Lista: compacta, máximo de itens visíveis, menos rolagem
 */

import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StoreViewMode = 'grid' | 'list';

interface StoreViewToggleProps {
  mode: StoreViewMode;
  onChange: (mode: StoreViewMode) => void;
}

export function StoreViewToggle({ mode, onChange }: StoreViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-all',
          mode === 'grid'
            ? 'bg-neon-yellow text-black shadow-[0_2px_8px_rgba(253,225,0,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
        )}
        aria-label="Visualização em grade"
      >
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-all',
          mode === 'list'
            ? 'bg-neon-yellow text-black shadow-[0_2px_8px_rgba(253,225,0,0.3)]'
            : 'text-gray-500 hover:text-gray-300'
        )}
        aria-label="Visualização em lista"
      >
        <List className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Lista</span>
      </button>
    </div>
  );
}
