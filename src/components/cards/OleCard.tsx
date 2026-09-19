/**
 * OleCard — Sistema de cards unificado Olefoot.
 *
 * VOLT2 (2026-09-19) — sólido, sem enfeite:
 * - Raio do token (2px), cor chapada, borda como única marcação
 * - Sem gradiente, sem vidro fosco, sem sombra, sem crescer no hover
 * - `skewed` é aceito por compatibilidade e não inclina mais nada
 *
 * Variantes (nomes mantidos por compatibilidade):
 * - default: card chapado com borda branca/10
 * - accent: border-left na cor do tom
 * - gradient: superfície chapada com borda do tom (sem degradê)
 * - glass: superfície chapada (sem vidro fosco)
 * - elevated: superfície elevada (bg-card) com borda — sem sombra
 */

import { cn } from '@/lib/utils';
import type { ComponentType, ReactNode } from 'react';

export type OleCardVariant = 'default' | 'accent' | 'gradient' | 'glass' | 'elevated';
export type OleCardTone = 'yellow' | 'fuchsia' | 'cyan' | 'emerald' | 'rose' | 'neutral';
export type OleCardSize = 'sm' | 'md' | 'lg';

interface OleCardProps {
  children: ReactNode;
  /** Variante visual do card. */
  variant?: OleCardVariant;
  /** Tom de cor (usado em accent/gradient). */
  tone?: OleCardTone;
  /** Tamanho do padding interno. */
  size?: OleCardSize;
  /** Adiciona hover interativo (a borda acende). */
  interactive?: boolean;
  /** Compatibilidade: não inclina mais nada (VOLT2). */
  skewed?: boolean;
  /** Classes adicionais. */
  className?: string;
  /** Callback de clique (torna o card clickable). */
  onClick?: () => void;
  /** Props HTML nativas. */
  [key: string]: unknown;
}

/** Tons mapeados para a paleta VOLT2 (nomes mantidos por compatibilidade). */
const TONE_CLASSES: Record<OleCardTone, {
  border: string;
  bg: string;
  text: string;
  /** Etiqueta/ícone chapado no tom. */
  solid: string;
}> = {
  yellow: {
    border: 'border-neon-yellow/40',
    bg: 'bg-panel',
    text: 'text-neon-yellow',
    solid: 'bg-neon-yellow text-black',
  },
  fuchsia: {
    border: 'border-lenda/40',
    bg: 'bg-panel',
    text: 'text-lenda',
    solid: 'bg-lenda text-white',
  },
  cyan: {
    border: 'border-white/30',
    bg: 'bg-panel',
    text: 'text-giz',
    solid: 'bg-giz text-black',
  },
  emerald: {
    border: 'border-alta/40',
    bg: 'bg-panel',
    text: 'text-alta',
    solid: 'bg-alta text-black',
  },
  rose: {
    border: 'border-baixa/40',
    bg: 'bg-panel',
    text: 'text-baixa',
    solid: 'bg-baixa text-white',
  },
  neutral: {
    border: 'border-white/10',
    bg: 'bg-[var(--color-card)]',
    text: 'text-white',
    solid: 'bg-card-hi text-white',
  },
};

const SIZE_PADDING: Record<OleCardSize, string> = {
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6 lg:p-8',
};

export function OleCard({
  children,
  variant = 'default',
  tone = 'neutral',
  size = 'md',
  interactive = false,
  skewed: _skewed = false,
  className,
  onClick,
  ...props
}: OleCardProps) {
  const toneStyle = TONE_CLASSES[tone];
  const isClickable = Boolean(onClick);

  // Base classes (sempre aplicadas)
  const baseClasses = cn(
    'relative overflow-hidden border transition-colors',
    SIZE_PADDING[size],
  );

  // Variant-specific classes
  const variantClasses = cn(
    // Default: card chapado
    variant === 'default' && 'bg-[var(--color-card)] border-white/10',

    // Accent: border-left colorida + fundo sutil
    variant === 'accent' && cn(
      'border-l-4',
      toneStyle.border,
      toneStyle.bg,
    ),

    // Gradient (nome legado): superfície chapada com borda do tom
    variant === 'gradient' && cn(
      toneStyle.border,
      toneStyle.bg,
    ),

    // Glass (nome legado): superfície chapada, sem vidro fosco
    variant === 'glass' && 'bg-panel border-white/16',

    // Elevated: superfície elevada, sem sombra
    variant === 'elevated' && 'bg-card-hi border-white/10',
  );

  // Interactive classes (hover/active)
  const interactiveClasses = cn(
    interactive && 'hover:border-white/30',
    interactive && variant === 'accent' && 'hover:border-l-neon-yellow',
    isClickable && 'cursor-pointer',
  );

  // Border radius (token VOLT2 = 2px)
  const radiusClass = 'rounded-sm';

  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        baseClasses,
        variantClasses,
        interactiveClasses,
        radiusClass,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * OleCardHeader — cabeçalho padrão com ícone + título.
 */
interface OleCardHeaderProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  tone?: OleCardTone;
  className?: string;
}

export function OleCardHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  tone = 'neutral',
  className,
}: OleCardHeaderProps) {
  const toneStyle = TONE_CLASSES[tone];

  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && (
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              toneStyle.text,
            )}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white/80 transition-colors truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-white/50 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

/**
 * OleCardMetric — métrica grande (número + label).
 */
interface OleCardMetricProps {
  value: ReactNode;
  label?: string;
  tone?: OleCardTone;
  className?: string;
}

export function OleCardMetric({
  value,
  label,
  tone = 'neutral',
  className,
}: OleCardMetricProps) {
  const toneStyle = TONE_CLASSES[tone];

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className={cn('font-display text-lg font-black leading-tight', toneStyle.text)}>
        {value}
      </div>
      {label && (
        <p className="text-[10px] text-white/45 uppercase tracking-wider">{label}</p>
      )}
    </div>
  );
}

/**
 * OleCardFooter — rodapé com ação/link.
 */
interface OleCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function OleCardFooter({ children, className }: OleCardFooterProps) {
  return (
    <div className={cn('mt-auto flex items-center justify-between pt-2 border-t border-white/5', className)}>
      {children}
    </div>
  );
}

/**
 * OleCardBadge — badge absoluto (notificações, status).
 */
interface OleCardBadgeProps {
  children: ReactNode;
  tone?: OleCardTone;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function OleCardBadge({
  children,
  tone = 'rose',
  position = 'top-right',
  className,
}: OleCardBadgeProps) {
  const toneStyle = TONE_CLASSES[tone];

  const positionClasses = {
    'top-right': 'top-3 right-3',
    'top-left': 'top-3 left-3',
    'bottom-right': 'bottom-3 right-3',
    'bottom-left': 'bottom-3 left-3',
  };

  return (
    <span
      className={cn(
        'absolute flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5',
        'font-display text-[10px] font-black',
        toneStyle.solid,
        positionClasses[position],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * OleCardIcon — ícone em bloco chapado. `skewed` mantido só por compatibilidade.
 */
interface OleCardIconProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: OleCardTone;
  skewed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OleCardIcon({
  icon: Icon,
  tone = 'neutral',
  skewed: _skewed = false,
  size = 'md',
  className,
}: OleCardIconProps) {

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        sizeClasses[size],
        tone === 'yellow' && 'bg-neon-yellow text-black',
        tone === 'fuchsia' && 'bg-panel border-2 border-lenda/40 text-lenda',
        tone === 'cyan' && 'bg-panel border-2 border-white/30 text-giz',
        tone === 'emerald' && 'bg-panel border-2 border-alta/40 text-alta',
        tone === 'rose' && 'bg-panel border-2 border-baixa/40 text-baixa',
        tone === 'neutral' && 'bg-panel border-2 border-white/16 text-white/70',
        className,
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      <Icon
        className={iconSizes[size]}
        strokeWidth={2.2}
        aria-hidden
      />
    </div>
  );
}
