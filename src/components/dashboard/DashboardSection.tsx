import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardSectionSize = 'sm' | 'md' | 'lg' | 'wide';

interface DashboardSectionProps {
  children: ReactNode;
  /**
   * Peso visual no grid 12-col (tablet+). No mobile, tudo vira 1 col.
   *
   *   sm   → 6 tablet, 3 desktop  (KPI / card compacto, 4 por row no desktop)
   *   md   → 6 tablet, 6 desktop  (feature block, 2 por row no desktop)
   *   lg   → 12 tablet, 8 desktop (conteúdo principal, ⅔ do row no desktop)
   *   wide → row inteira em todos os breakpoints
   */
  size?: DashboardSectionSize;
  className?: string;
  /** Aplicado ao wrapper externo — útil pra `id`, `aria-label` etc. */
  id?: string;
  ariaLabel?: string;
}

const SIZE_CLS: Record<DashboardSectionSize, string> = {
  sm: 'col-span-1 sm:col-span-6 xl:col-span-3',
  md: 'col-span-1 sm:col-span-6 xl:col-span-6',
  lg: 'col-span-1 sm:col-span-12 xl:col-span-8',
  wide: 'col-span-1 sm:col-span-12 xl:col-span-12',
};

export function DashboardSection({
  children,
  size = 'md',
  className,
  id,
  ariaLabel,
}: DashboardSectionProps) {
  return (
    <div
      id={id}
      aria-label={ariaLabel}
      className={cn('min-w-0 flex flex-col', SIZE_CLS[size], className)}
    >
      {children}
    </div>
  );
}
