import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'angular' | 'on-yellow';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  // VOLT2: cor chapada + corte do escudo. Sem sombra, sem inclinação, sem
  // crescer no hover. O foco é desenhado por dentro porque o clip-path corta
  // qualquer outline de fora.
  primary:
    'bg-neon-yellow text-black hover:bg-white [clip-path:var(--clip-corte)] focus-visible:outline-2 focus-visible:outline-black focus-visible:-outline-offset-4',
  secondary:
    'bg-transparent text-white border border-white/30 hover:border-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-neon-yellow focus-visible:outline-offset-2',
  angular:
    'bg-neon-yellow text-black clip-angular-btn hover:bg-white focus-visible:outline-2 focus-visible:outline-black focus-visible:-outline-offset-4',
  'on-yellow':
    'bg-black text-neon-yellow hover:bg-deep-black [clip-path:var(--clip-corte)] focus-visible:outline-2 focus-visible:outline-neon-yellow focus-visible:-outline-offset-4',
};

// O corte acompanha a altura: 14px num botão de 28px comeria metade dele.
const SIZE: Record<ButtonSize, string> = {
  sm: 'text-[12px] px-4 py-1.5 [--corte:8px]',
  md: 'text-[14px] px-6 py-2.5 [--corte:12px]',
  lg: 'text-[16px] px-10 py-3.5 [--corte:14px]',
};

/**
 * Botão esportivo padrão Olefoot — wrapper sobre `.btn-primary` / `.btn-on-yellow`
 * com tipagem React e variantes adicionais (angular via clip-path).
 *
 * Para botões já existentes que usam `.btn-primary` direto no JSX, não há
 * obrigação de migrar — este componente serve para JSX novo.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}>(function Button({ variant = 'primary', size = 'md', className, children, ...rest }, ref) {
  const inner =
    variant === 'angular'
      ? children
      : (
        <span className="block flex items-center justify-center gap-2">
          {children}
        </span>
      );
  return (
    <button
      ref={ref}
      className={cn(
        'font-display font-bold uppercase tracking-[0.12em] transition-colors',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {inner}
    </button>
  );
});
