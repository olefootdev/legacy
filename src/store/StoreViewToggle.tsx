/**
 * Toggle de visualização Grid/Lista para a Store (DS 2027: foco em rua, canto vivo)
 * Grid: 3 colunas, cards grandes com emoção
 * Lista: compacta, máximo de itens visíveis, menos rolagem
 */

import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

export type StoreViewMode = 'grid' | 'list';

interface StoreViewToggleProps {
  mode: StoreViewMode;
  onChange: (mode: StoreViewMode) => void;
}

export function StoreViewToggle({ mode, onChange }: StoreViewToggleProps) {
  return (
    <div className="flex shrink-0 items-center border-2 border-linha">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          'flex min-h-[44px] items-center gap-1.5 px-3 font-impact text-[15px] uppercase leading-none transition-colors',
          mode === 'grid'
            ? 'bg-rua text-asfalto-27'
            : 'text-mudo hover:text-papel'
        )}
        aria-label={L('Visualização em grade', 'Grid view')}
      >
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'flex min-h-[44px] items-center gap-1.5 px-3 font-impact text-[15px] uppercase leading-none transition-colors',
          mode === 'list'
            ? 'bg-rua text-asfalto-27'
            : 'text-mudo hover:text-papel'
        )}
        aria-label={L('Visualização em lista', 'List view')}
      >
        <List className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">{L('Lista', 'List')}</span>
      </button>
    </div>
  );
}
