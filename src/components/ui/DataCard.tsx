import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cartão padrão Legacy Tech — substitui blocos pretos chapados por superfície
 * elevada com sombra e divider amarelo opcional. Mantém densidade compatível
 * com o DS atual (radius-card 14px, panel-elevated #1F1F1F).
 *
 * Variantes:
 *  - default: painel elevado padrão
 *  - soft:    painel mais escuro (recolhe-se em listas longas)
 *  - hero:    painel + glow amarelo (destaque de seção)
 *
 * Slots:
 *  - eyebrow:  label superior (uppercase, tracking)
 *  - title:    título principal (sans bold)
 *  - children: corpo livre
 *  - actions:  rodapé com botões (texto-claro, sem ícones soltos)
 */
export function DataCard({
  eyebrow,
  title,
  description,
  children,
  actions,
  variant = 'default',
  divider = true,
  className,
  onClick,
  as: Tag = 'div',
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'soft' | 'hero';
  /** Régua amarela vertical no topo do título. */
  divider?: boolean;
  className?: string;
  onClick?: () => void;
  as?: 'div' | 'article' | 'section' | 'button';
}) {
  const surface =
    variant === 'soft'
      ? 'bg-[var(--color-panel-soft)]'
      : variant === 'hero'
        ? 'bg-[var(--color-panel-elevated)]'
        : 'bg-[var(--color-panel-elevated)]';

  const shadow =
    variant === 'hero'
      ? 'shadow-[var(--shadow-card-hover)] before:absolute before:inset-0 before:pointer-events-none before:rounded-[var(--radius-card)] before:shadow-[var(--shadow-glow-yellow)]'
      : 'shadow-[var(--shadow-card)]';

  const interactive = typeof onClick === 'function';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'relative isolate rounded-[var(--radius-card)] border border-white/[0.04] overflow-hidden',
        surface,
        shadow,
        interactive && 'cursor-pointer transition-shadow hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
    >
      <div className="relative flex flex-col gap-3 p-5 sm:p-6">
        {(eyebrow || title) && (
          <div className="flex flex-col gap-1.5">
            {eyebrow ? (
              <span className="font-display text-[10px] uppercase tracking-[0.28em] text-neon-yellow/80">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h3 className="flex items-center gap-3 text-[20px] font-semibold leading-tight text-white">
                {divider ? (
                  <span className="h-5 w-1 rounded-full bg-neon-yellow" aria-hidden />
                ) : null}
                <span className="min-w-0">{title}</span>
              </h3>
            ) : null}
            {description ? (
              <p className="text-[13px] leading-relaxed text-white/55">{description}</p>
            ) : null}
          </div>
        )}

        {children ? <div className="min-w-0">{children}</div> : null}

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-divider-yellow)]">
            {actions}
          </div>
        ) : null}
      </div>
    </Tag>
  );
}
