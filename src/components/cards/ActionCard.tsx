/**
 * ActionCard — Card de ação ÉPICO BVB com split diagonal.
 *
 * PADRÃO VISUAL BVB:
 * - Split diagonal amarelo/preto (inspirado no hero)
 * - Watermark sutil do ícone em fundo
 * - Tipografia Druk Wide Bold
 * - Glow amarelo neon intenso
 * - Animações cinematográficas
 */

import { ChevronRight, Lock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  /** Ícone principal do card. */
  icon: LucideIcon;
  /** Título do card (ex: "Carreira"). */
  title: string;
  /** Subtítulo/descrição (ex: "Profissional"). */
  subtitle: string;
  /** Métrica principal (ex: "1.2K EXP"). */
  metric: ReactNode;
  /** Texto do rodapé (ex: "Próximo: Campeão"). */
  footer: string;
  /** Callback de clique. */
  onClick: () => void;
  /** Tom de cor. */
  tone?: 'yellow' | 'fuchsia' | 'cyan' | 'emerald' | 'rose';
  /** Badge de notificação (ex: "3"). */
  badge?: string;
  /** Card bloqueado (mostra cadeado). */
  locked?: boolean;
}

const TONE_STYLES = {
  yellow: {
    splitBg: 'bg-neon-yellow',
    splitText: 'text-black',
    mainBg: 'bg-black',
    mainText: 'text-neon-yellow',
    border: 'border-neon-yellow/40',
    borderHover: 'group-hover:border-neon-yellow/80',
    glow: 'group-hover:shadow-[0_0_40px_rgba(253,225,0,0.35)]',
    watermark: 'text-neon-yellow/[0.03]',
    badge: 'bg-rose-500',
  },
  fuchsia: {
    splitBg: 'bg-fuchsia-500',
    splitText: 'text-white',
    mainBg: 'bg-black',
    mainText: 'text-fuchsia-300',
    border: 'border-fuchsia-500/40',
    borderHover: 'group-hover:border-fuchsia-500/80',
    glow: 'group-hover:shadow-[0_0_40px_rgba(217,70,239,0.35)]',
    watermark: 'text-fuchsia-500/[0.03]',
    badge: 'bg-rose-500',
  },
  cyan: {
    splitBg: 'bg-cyan-500',
    splitText: 'text-black',
    mainBg: 'bg-black',
    mainText: 'text-cyan-300',
    border: 'border-cyan-500/40',
    borderHover: 'group-hover:border-cyan-500/80',
    glow: 'group-hover:shadow-[0_0_40px_rgba(6,182,212,0.35)]',
    watermark: 'text-cyan-500/[0.03]',
    badge: 'bg-rose-500',
  },
  emerald: {
    splitBg: 'bg-emerald-500',
    splitText: 'text-black',
    mainBg: 'bg-black',
    mainText: 'text-emerald-300',
    border: 'border-emerald-500/40',
    borderHover: 'group-hover:border-emerald-500/80',
    glow: 'group-hover:shadow-[0_0_40px_rgba(16,185,129,0.35)]',
    watermark: 'text-emerald-500/[0.03]',
    badge: 'bg-rose-500',
  },
  rose: {
    splitBg: 'bg-rose-500',
    splitText: 'text-white',
    mainBg: 'bg-black',
    mainText: 'text-rose-300',
    border: 'border-rose-500/40',
    borderHover: 'group-hover:border-rose-500/80',
    glow: 'group-hover:shadow-[0_0_40px_rgba(244,63,94,0.35)]',
    watermark: 'text-rose-500/[0.03]',
    badge: 'bg-rose-500',
  },
};

export function ActionCard({
  icon: Icon,
  title,
  subtitle,
  metric,
  footer,
  onClick,
  tone = 'yellow',
  badge,
  locked = false,
}: ActionCardProps) {
  const style = TONE_STYLES[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative isolate overflow-hidden',
        'flex flex-col h-full min-h-[200px]',
        'border-2 transition-all duration-300',
        'hover:scale-[1.02] active:scale-[0.98]',
        style.border,
        style.borderHover,
        style.glow,
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {/* Split diagonal — 30% amarelo, 70% preto */}
      <div
        className={cn(
          'absolute inset-0 transition-all duration-500',
          style.splitBg,
        )}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 35%)',
        }}
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-0',
          style.mainBg,
        )}
        style={{
          clipPath: 'polygon(0 35%, 100% 30%, 100% 100%, 0 100%)',
        }}
        aria-hidden
      />

      {/* Watermark gigante do ícone */}
      <div
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <Icon
          className={cn(
            'transition-all duration-500 group-hover:scale-110',
            style.watermark,
          )}
          style={{
            width: 'clamp(120px, 18vw, 180px)',
            height: 'clamp(120px, 18vw, 180px)',
            strokeWidth: 1.5,
          }}
        />
      </div>

      {/* Badge de notificação */}
      {badge && (
        <span className={cn(
          'absolute right-3 top-3 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full px-2',
          'font-display text-[11px] font-black text-white shadow-[0_4px_12px_rgba(244,63,94,0.5)] animate-pulse',
          style.badge,
        )}>
          {badge}
        </span>
      )}

      {/* Conteúdo */}
      <div className="relative z-10 flex flex-col gap-4 p-5 h-full">
        {/* Header: ícone + título */}
        <div className="flex items-start gap-3">
          {/* Ícone compacto */}
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center',
              'transition-all duration-300 group-hover:scale-110',
              style.splitBg,
              style.splitText,
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Icon className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </div>

          {/* Título + subtítulo */}
          <div className="flex-1 min-w-0 text-left pt-1">
            <h3
              className={cn(
                'font-bold uppercase leading-tight truncate',
                style.splitText,
              )}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(11px, 1.2vw, 13px)',
                letterSpacing: '0.15em',
              }}
            >
              {title}
            </h3>
            <p className={cn(
              'mt-1 text-[11px] leading-snug truncate',
              tone === 'yellow' ? 'text-black/60' : 'text-white/50',
            )}>
              {subtitle}
            </p>
          </div>

          {locked && <Lock className="h-4 w-4 text-white/30 shrink-0" aria-hidden />}
        </div>

        {/* Métrica GIGANTE em Druk Wide Bold */}
        <div className="relative z-10 flex-1 flex items-center">
          <div
            className={cn(
              'font-black uppercase leading-none transition-all duration-300',
              'group-hover:scale-105',
              style.mainText,
            )}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              letterSpacing: '-0.02em',
            }}
          >
            {metric}
          </div>
        </div>

        {/* Footer: texto + seta */}
        <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
            {footer}
          </span>
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-all duration-300',
              'group-hover:translate-x-1',
              style.mainText,
            )}
            aria-hidden
          />
        </div>
      </div>
    </button>
  );
}
