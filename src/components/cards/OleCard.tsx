/**
 * OleCard — Sistema de cards unificado Olefoot.
 *
 * Padrão visual BVB:
 * - Bordas sharp (4px radius máximo)
 * - Border-left accent (2-4px colorido)
 * - Gradientes sutis (5-10% opacity)
 * - Hover lift + glow
 * - Skew decorativo opcional (-6deg)
 *
 * Variantes:
 * - default: card básico preto com borda branca/8
 * - accent: border-left amarela + glow hover
 * - gradient: gradiente sutil de tom
 * - glass: backdrop-blur + transparência
 * - elevated: sombra forte + hover lift
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
  /** Adiciona hover interativo (lift + glow). */
  interactive?: boolean;
  /** Adiciona skew decorativo -6deg no ícone/badge. */
  skewed?: boolean;
  /** Classes adicionais. */
  className?: string;
  /** Callback de clique (torna o card clickable). */
  onClick?: () => void;
  /** Props HTML nativas. */
  [key: string]: unknown;
}

const TONE_CLASSES: Record<OleCardTone, {
  border: string;
  bg: string;
  glow: string;
  text: string;
}> = {
  yellow: {
    border: 'border-neon-yellow/25',
    bg: 'bg-gradient-to-br from-neon-yellow/5 to-black/40',
    glow: 'hover:shadow-[0_0_20px_rgba(253,225,0,0.12)]',
    text: 'text-neon-yellow',
  },
  fuchsia: {
    border: 'border-fuchsia-500/25',
    bg: 'bg-gradient-to-br from-fuchsia-500/5 to-black/40',
    glow: 'hover:shadow-[0_0_20px_rgba(217,70,239,0.12)]',
    text: 'text-fuchsia-300',
  },
  cyan: {
    border: 'border-cyan-500/25',
    bg: 'bg-gradient-to-br from-cyan-500/5 to-black/40',
    glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.12)]',
    text: 'text-cyan-300',
  },
  emerald: {
    border: 'border-emerald-500/25',
    bg: 'bg-gradient-to-br from-emerald-500/5 to-black/40',
    glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]',
    text: 'text-emerald-300',
  },
  rose: {
    border: 'border-rose-500/25',
    bg: 'bg-gradient-to-br from-rose-500/5 to-black/40',
    glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]',
    text: 'text-rose-300',
  },
  neutral: {
    border: 'border-white/10',
    bg: 'bg-[var(--color-card)]',
    glow: 'hover:shadow-[0_0_16px_rgba(255,255,255,0.04)]',
    text: 'text-white',
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
  skewed = false,
  className,
  onClick,
  ...props
}: OleCardProps) {
  const toneStyle = TONE_CLASSES[tone];
  const isClickable = Boolean(onClick);

  // Base classes (sempre aplicadas)
  const baseClasses = cn(
    'relative overflow-hidden border transition-all',
    SIZE_PADDING[size],
  );

  // Variant-specific classes
  const variantClasses = cn(
    // Default: card básico preto
    variant === 'default' && 'bg-[var(--color-card)] border-white/8',

    // Accent: border-left colorida + fundo sutil
    variant === 'accent' && cn(
      'border-l-4',
      toneStyle.border,
      toneStyle.bg,
    ),

    // Gradient: gradiente completo do tom
    variant === 'gradient' && cn(
      toneStyle.border,
      toneStyle.bg,
    ),

    // Glass: backdrop-blur + transparência
    variant === 'glass' && 'bg-black/40 backdrop-blur-sm border-white/15',

    // Elevated: sombra forte
    variant === 'elevated' && cn(
      'bg-[var(--color-card)] border-white/10',
      'shadow-[0_8px_24px_rgba(0,0,0,0.25)]',
    ),
  );

  // Interactive classes (hover/active)
  const interactiveClasses = cn(
    interactive && 'hover:scale-[1.01] active:scale-[0.99]',
    interactive && variant === 'accent' && 'hover:border-l-neon-yellow/60',
    interactive && toneStyle.glow,
    isClickable && 'cursor-pointer',
  );

  // Border radius (sempre 4px — sharp esportivo)
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
              'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
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
        'font-display text-[10px] font-black text-white',
        'shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
        tone === 'rose' && 'bg-rose-500',
        tone === 'yellow' && 'bg-neon-yellow text-black',
        tone === 'fuchsia' && 'bg-fuchsia-500',
        tone === 'cyan' && 'bg-cyan-500',
        tone === 'emerald' && 'bg-emerald-500',
        positionClasses[position],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * OleCardIcon — ícone decorativo com skew opcional.
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
  skewed = false,
  size = 'md',
  className,
}: OleCardIconProps) {
  const toneStyle = TONE_CLASSES[tone];

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
        'flex items-center justify-center shrink-0 transition-transform group-hover:scale-110',
        sizeClasses[size],
        skewed && '-skew-x-6',
        tone === 'yellow' && 'bg-neon-yellow text-black',
        tone === 'fuchsia' && 'bg-fuchsia-500/20 border-2 border-fuchsia-500/40 text-fuchsia-300',
        tone === 'cyan' && 'bg-cyan-500/20 border-2 border-cyan-500/40 text-cyan-300',
        tone === 'emerald' && 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300',
        tone === 'rose' && 'bg-rose-500/20 border-2 border-rose-500/40 text-rose-300',
        tone === 'neutral' && 'bg-white/5 border-2 border-white/15 text-white/70',
        className,
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      <Icon
        className={cn(iconSizes[size], skewed && 'skew-x-6')}
        strokeWidth={2.2}
        aria-hidden
      />
    </div>
  );
}
