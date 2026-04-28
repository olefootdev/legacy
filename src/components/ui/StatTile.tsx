import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_VALUE: Record<Tone, string> = {
  default: 'text-white',
  accent: 'text-neon-yellow',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
};

const TONE_RULE: Record<Tone, string> = {
  default: 'bg-white/15',
  accent: 'bg-neon-yellow',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

/**
 * Bloco de estatística — número grande MORET + label Agency FB pequeno.
 * Substitui os blocos pretos minúsculos com texto pequeno (Wallet, Home).
 *
 * Pensado para grids responsivos (2/3/4 colunas). Hierarquia explícita:
 *  - Valor grande, peso editorial
 *  - Régua amarela curta
 *  - Label uppercase tracking
 *  - Sem ícones pequenos: o número É o ícone.
 */
export function StatTile({
  value,
  label,
  hint,
  tone = 'default',
  align = 'center',
  size = 'md',
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  /** Texto extra pequeno (ex.: "vs. último mês"). */
  hint?: ReactNode;
  tone?: Tone;
  align?: 'center' | 'start';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const valueSize =
    size === 'sm'
      ? 'text-[28px]'
      : size === 'lg'
        ? 'text-[clamp(40px,7vw,72px)]'
        : 'text-[clamp(32px,5vw,52px)]';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-card)] border border-white/[0.04] bg-[var(--color-panel-elevated)] px-5 py-4 shadow-[var(--shadow-card)]',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      <span
        className={cn(
          'leading-none tracking-tight',
          TONE_VALUE[tone],
          valueSize,
        )}
        style={{ fontFamily: 'var(--font-serif-hero)' }}
      >
        {value}
      </span>
      <span
        className={cn('h-[2px] w-8 rounded-full', TONE_RULE[tone])}
        aria-hidden
      />
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-white/65">
        {label}
      </span>
      {hint ? (
        <span className="text-[11px] text-white/40">{hint}</span>
      ) : null}
    </div>
  );
}
