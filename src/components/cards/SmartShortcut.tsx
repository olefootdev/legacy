/**
 * SmartShortcut — Atalho contextual ÉPICO BVB com split diagonal.
 *
 * PADRÃO VISUAL BVB:
 * - Split diagonal sutil (15% colorido, 85% preto)
 * - Ícone com glow pulsante
 * - Tipografia Druk Wide Bold
 * - Hover lift + glow intenso
 * - Animação cinematográfica
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SmartShortcutProps {
  /** Ícone do atalho. */
  icon: LucideIcon;
  /** Label principal (ex: "Resgatar 3 missões"). */
  label: string;
  /** Subtítulo/descrição (ex: "+1.5K EXP prontos"). */
  sub: string;
  /** Tom de cor. */
  tone?: 'yellow' | 'fuchsia' | 'cyan' | 'emerald' | 'rose';
  /** Link de navegação (se for link). */
  to?: string;
  /** Callback de clique (se for botão). */
  onClick?: () => void;
}

const TONE_STYLES = {
  yellow: {
    splitBg: 'bg-neon-yellow',
    mainBg: 'bg-black',
    border: 'border-neon-yellow/50',
    borderHover: 'group-hover:border-neon-yellow/90',
    glow: 'group-hover:shadow-[0_0_32px_rgba(253,225,0,0.3)]',
    iconBg: 'bg-neon-yellow',
    iconText: 'text-black',
    iconGlow: 'shadow-[0_0_20px_rgba(253,225,0,0.5)]',
    text: 'text-neon-yellow',
    pulse: 'group-hover:animate-pulse',
  },
  fuchsia: {
    splitBg: 'bg-fuchsia-500',
    mainBg: 'bg-black',
    border: 'border-fuchsia-500/50',
    borderHover: 'group-hover:border-fuchsia-500/90',
    glow: 'group-hover:shadow-[0_0_32px_rgba(217,70,239,0.3)]',
    iconBg: 'bg-fuchsia-500',
    iconText: 'text-white',
    iconGlow: 'shadow-[0_0_20px_rgba(217,70,239,0.5)]',
    text: 'text-fuchsia-300',
    pulse: 'group-hover:animate-pulse',
  },
  cyan: {
    splitBg: 'bg-cyan-500',
    mainBg: 'bg-black',
    border: 'border-cyan-500/50',
    borderHover: 'group-hover:border-cyan-500/90',
    glow: 'group-hover:shadow-[0_0_32px_rgba(6,182,212,0.3)]',
    iconBg: 'bg-cyan-500',
    iconText: 'text-black',
    iconGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    text: 'text-cyan-300',
    pulse: 'group-hover:animate-pulse',
  },
  emerald: {
    splitBg: 'bg-emerald-500',
    mainBg: 'bg-black',
    border: 'border-emerald-500/50',
    borderHover: 'group-hover:border-emerald-500/90',
    glow: 'group-hover:shadow-[0_0_32px_rgba(16,185,129,0.3)]',
    iconBg: 'bg-emerald-500',
    iconText: 'text-black',
    iconGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-300',
    pulse: 'group-hover:animate-pulse',
  },
  rose: {
    splitBg: 'bg-rose-500',
    mainBg: 'bg-black',
    border: 'border-rose-500/50',
    borderHover: 'group-hover:border-rose-500/90',
    glow: 'group-hover:shadow-[0_0_32px_rgba(244,63,94,0.3)]',
    iconBg: 'bg-rose-500',
    iconText: 'text-white',
    iconGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]',
    text: 'text-rose-300',
    pulse: 'group-hover:animate-pulse',
  },
};

export function SmartShortcut({
  icon: Icon,
  label,
  sub,
  tone = 'yellow',
  to,
  onClick,
}: SmartShortcutProps) {
  const style = TONE_STYLES[tone];

  const inner = (
    <>
      {/* Split diagonal sutil — 15% colorido no topo */}
      <div
        className={cn(
          'absolute inset-0 transition-all duration-500',
          style.splitBg,
        )}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 15%, 0 18%)',
          opacity: 0.08,
        }}
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-0',
          style.mainBg,
        )}
        style={{
          clipPath: 'polygon(0 18%, 100% 15%, 100% 100%, 0 100%)',
        }}
        aria-hidden
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Ícone com glow pulsante */}
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center',
            'transition-all duration-300',
            'group-hover:scale-110 group-hover:rotate-3',
            style.iconBg,
            style.iconText,
            style.iconGlow,
            style.pulse,
          )}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              'font-bold uppercase leading-tight truncate',
              style.text,
            )}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(12px, 1.3vw, 14px)',
              letterSpacing: '0.12em',
            }}
          >
            {label}
          </p>
          <p className="mt-1 text-[11px] text-white/60 leading-snug truncate">{sub}</p>
        </div>

        {/* Seta */}
        <ChevronRight
          className={cn(
            'h-5 w-5 shrink-0 transition-all duration-300',
            'group-hover:translate-x-1',
            style.text,
          )}
          aria-hidden
        />
      </div>
    </>
  );

  const baseClasses = cn(
    'group relative isolate overflow-hidden',
    'flex items-center px-5 py-4',
    'border-2 transition-all duration-300',
    'hover:scale-[1.01] active:scale-[0.99]',
    style.border,
    style.borderHover,
    style.glow,
  );

  const baseStyle = { borderRadius: 'var(--radius-sm)' };

  if (to) {
    return (
      <Link to={to} className={baseClasses} style={baseStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses} style={baseStyle}>
      {inner}
    </button>
  );
}
