import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Override do gap padrão (mobile→desktop). */
  gap?: 'sm' | 'md' | 'lg';
}

/**
 * Grid base do dashboard — 12 colunas no tablet+, 1 coluna no mobile.
 * Filhos devem ser <DashboardSection> declarando o `size` (sm | md | lg | wide).
 *
 * Mapeamento:
 *   - mobile (<640px)        : 1 col, tudo stack vertical na ordem do JSX
 *   - tablet (640-1279px)    : 12-col, sm=6 (pares), md=6 (pares), lg=12, wide=12
 *   - desktop (≥1280px)      : 12-col, sm=3 (4 por row), md=6 (2 por row),
 *                              lg=8, wide=12
 *
 * Ordem visual = ordem do JSX. Não há reflow automático além do CSS Grid.
 */
export function DashboardGrid({ children, className, id, gap = 'md' }: DashboardGridProps) {
  const gapCls =
    gap === 'sm' ? 'gap-3 lg:gap-4' : gap === 'lg' ? 'gap-5 lg:gap-8' : 'gap-4 lg:gap-6';
  return (
    <div id={id} className={cn('grid min-w-0 grid-cols-1 sm:grid-cols-12 scroll-mt-4', gapCls, className)}>
      {children}
    </div>
  );
}
