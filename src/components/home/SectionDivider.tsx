import { cn } from '@/lib/utils';

interface SectionDividerProps {
  label: string;
  className?: string;
}

/**
 * Separador "—— LABEL ——" em amarelo neon, antes de cada título principal.
 * Brief: --color-accent, font-ui, uppercase, letter-spacing alto.
 */
export function SectionDivider({ label, className }: SectionDividerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 text-[var(--color-neon-yellow)]',
        className,
      )}
      style={{
        fontFamily: 'var(--font-ui)',
      }}
    >
      <span
        aria-hidden
        className="h-px w-8 bg-[var(--color-neon-yellow)]"
      />
      <span className="text-xs font-semibold uppercase tracking-[0.2em]">
        {label}
      </span>
      <span
        aria-hidden
        className="h-px w-8 bg-[var(--color-neon-yellow)]"
      />
    </div>
  );
}
