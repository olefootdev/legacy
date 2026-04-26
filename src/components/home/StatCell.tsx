import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatCellProps {
  /** Valor grande (string ou node — aceita "11", "∞", "AI", etc.). */
  n: ReactNode;
  label: string;
  className?: string;
}

/**
 * Célula de estatística do hero:
 *   Número grande Agency FB bold em amarelo neon
 *   Label Inter em cinza claro
 * Composição em linha — separadores verticais ficam por conta do container.
 */
export function StatCell({ n, label, className }: StatCellProps) {
  return (
    <div className={cn('flex flex-col items-start gap-1 px-6 first:pl-0', className)}>
      <span
        className="text-[var(--color-neon-yellow)] font-bold leading-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          letterSpacing: '0.02em',
        }}
      >
        {n}
      </span>
      <span
        className="text-[var(--color-text-soft)] uppercase"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          letterSpacing: '0.15em',
        }}
      >
        {label}
      </span>
    </div>
  );
}
