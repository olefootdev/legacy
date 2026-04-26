/**
 * TrophyCard — Card de troféu ÉPICO BVB com split diagonal.
 *
 * PADRÃO VISUAL BVB:
 * - Split diagonal amarelo/preto (quando conquistado)
 * - Watermark gigante do troféu em fundo
 * - Tipografia Druk Wide Bold
 * - Glow dourado intenso
 * - Animação de brilho no hover
 */

import { Trophy, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrophyCardProps {
  /** Nome do troféu. */
  name: string;
  /** Descrição/blurb. */
  description?: string;
  /** Categoria (ex: "Competição", "Missão"). */
  category?: string;
  /** Troféu conquistado? */
  earned: boolean;
  /** Tom de cor (usado quando earned). */
  tone?: 'yellow' | 'cyan' | 'emerald' | 'fuchsia';
  /** Callback de clique (opcional). */
  onClick?: () => void;
}

const TONE_STYLES = {
  yellow: {
    splitBg: 'bg-gradient-to-br from-neon-yellow via-amber-400 to-yellow-600',
    mainBg: 'bg-black',
    border: 'border-neon-yellow/70',
    borderHover: 'group-hover:border-neon-yellow',
    glow: 'shadow-[0_0_32px_rgba(253,225,0,0.4)]',
    glowHover: 'group-hover:shadow-[0_0_48px_rgba(253,225,0,0.6)]',
    iconText: 'text-black',
    mainText: 'text-neon-yellow',
    watermark: 'text-neon-yellow/[0.04]',
    badgeBg: 'bg-neon-yellow/30',
    badgeText: 'text-neon-yellow',
  },
  cyan: {
    splitBg: 'bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-600',
    mainBg: 'bg-black',
    border: 'border-cyan-400/70',
    borderHover: 'group-hover:border-cyan-400',
    glow: 'shadow-[0_0_32px_rgba(6,182,212,0.4)]',
    glowHover: 'group-hover:shadow-[0_0_48px_rgba(6,182,212,0.6)]',
    iconText: 'text-black',
    mainText: 'text-cyan-300',
    watermark: 'text-cyan-500/[0.04]',
    badgeBg: 'bg-cyan-500/30',
    badgeText: 'text-cyan-300',
  },
  emerald: {
    splitBg: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600',
    mainBg: 'bg-black',
    border: 'border-emerald-400/70',
    borderHover: 'group-hover:border-emerald-400',
    glow: 'shadow-[0_0_32px_rgba(16,185,129,0.4)]',
    glowHover: 'group-hover:shadow-[0_0_48px_rgba(16,185,129,0.6)]',
    iconText: 'text-black',
    mainText: 'text-emerald-300',
    watermark: 'text-emerald-500/[0.04]',
    badgeBg: 'bg-emerald-500/30',
    badgeText: 'text-emerald-300',
  },
  fuchsia: {
    splitBg: 'bg-gradient-to-br from-fuchsia-400 via-fuchsia-500 to-fuchsia-600',
    mainBg: 'bg-black',
    border: 'border-fuchsia-400/70',
    borderHover: 'group-hover:border-fuchsia-400',
    glow: 'shadow-[0_0_32px_rgba(217,70,239,0.4)]',
    glowHover: 'group-hover:shadow-[0_0_48px_rgba(217,70,239,0.6)]',
    iconText: 'text-white',
    mainText: 'text-fuchsia-300',
    watermark: 'text-fuchsia-500/[0.04]',
    badgeBg: 'bg-fuchsia-500/30',
    badgeText: 'text-fuchsia-300',
  },
};

export function TrophyCard({
  name,
  description,
  category,
  earned,
  tone = 'yellow',
  onClick,
}: TrophyCardProps) {
  const style = earned ? TONE_STYLES[tone] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative isolate overflow-hidden',
        'flex min-h-[180px] flex-col gap-3 p-5',
        'border-2 transition-all duration-300',
        onClick && 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]',
        !onClick && 'cursor-default',
        earned && style
          ? cn(
              style.border,
              style.borderHover,
              style.glow,
              style.glowHover,
            )
          : 'border-white/15 bg-black/60 opacity-75 hover:opacity-90',
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {/* Split diagonal — 25% colorido, 75% preto (quando conquistado) */}
      {earned && style && (
        <>
          <div
            className={cn(
              'absolute inset-0 transition-all duration-500',
              style.splitBg,
            )}
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 25%, 0 30%)',
            }}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-0',
              style.mainBg,
            )}
            style={{
              clipPath: 'polygon(0 30%, 100% 25%, 100% 100%, 0 100%)',
            }}
            aria-hidden
          />
        </>
      )}

      {/* Watermark gigante do troféu */}
      {earned && style && (
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <Trophy
            className={cn(
              'transition-all duration-500 group-hover:scale-110 group-hover:rotate-6',
              style.watermark,
            )}
            style={{
              width: 'clamp(100px, 16vw, 160px)',
              height: 'clamp(100px, 16vw, 160px)',
              strokeWidth: 1.5,
            }}
          />
        </div>
      )}

      {/* Header: ícone + badge */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        {/* Ícone do troféu */}
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center',
            'transition-all duration-300',
            'group-hover:scale-110 group-hover:-rotate-6',
            earned && style
              ? cn(style.splitBg, style.iconText, 'shadow-[0_0_28px_rgba(250,204,21,0.7)]')
              : 'bg-white/5 text-gray-600 border-2 border-white/10',
          )}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {earned ? (
            <Trophy className="h-8 w-8" strokeWidth={2.5} />
          ) : (
            <Lock className="h-7 w-7" />
          )}
        </div>

        {/* Badge de categoria */}
        {category && (
          <span
            className={cn(
              'px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-wider',
              earned && style
                ? cn(style.badgeBg, style.badgeText)
                : 'bg-white/5 text-gray-500',
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {category}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 min-w-0 flex-1 text-left">
        <p
          className={cn(
            'font-bold uppercase leading-tight',
            earned && style ? style.mainText : 'text-white/70',
          )}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(11px, 1.2vw, 13px)',
            letterSpacing: '0.12em',
          }}
        >
          {name}
        </p>
        {description && (
          <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-gray-400">
            {description}
          </p>
        )}
      </div>

      {/* Brilho decorativo no hover (só quando conquistado) */}
      {earned && (
        <div
          className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/15 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </button>
  );
}
