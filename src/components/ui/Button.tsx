import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'angular' | 'on-yellow';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-neon-yellow text-black hover:bg-white hover:scale-105 hover:shadow-[0_8px_24px_rgba(253,225,0,0.3)] -skew-x-6',
  secondary:
    'bg-transparent text-white border border-[var(--border)] hover:border-neon-yellow hover:text-neon-yellow -skew-x-6',
  angular:
    'bg-neon-yellow text-black clip-angular-btn hover:bg-white hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(253,225,0,0.3)]',
  'on-yellow':
    'bg-black text-neon-yellow hover:bg-deep-black -skew-x-6',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-[12px] px-4 py-1.5',
  md: 'text-[14px] px-6 py-2.5',
  lg: 'text-[16px] px-10 py-3.5',
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
        <span className="block flex items-center justify-center gap-2 skew-x-6">
          {children}
        </span>
      );
  return (
    <button
      ref={ref}
      className={cn(
        'font-display font-bold uppercase tracking-[0.12em] transition-all',
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
