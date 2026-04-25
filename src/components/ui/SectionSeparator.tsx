import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Divisor —— LABEL —— para separar seções de página.
 */
export function SectionSeparator({
  label,
  className,
}: {
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 my-12', className)}>
      <div className="flex-1 h-px bg-[var(--border)]" />
      <span
        className="uppercase tracking-[0.2em] text-[11px] font-semibold text-yellow"
        style={{ fontFamily: 'var(--font-ui)', color: 'var(--yellow)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}
