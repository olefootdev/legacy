/**
 * ActionCard — Card de ação com faixa de cor chapada no topo.
 *
 * VOLT2 (2026-09-19):
 * - Faixa reta (32%) na cor do tom + corpo chapado — nada torto
 * - Watermark sutil do ícone em fundo
 * - Sem brilho, sem sombra, sem crescer no hover (a borda acende)
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

/**
 * VOLT2: tons mapeados para a paleta (sem hex solto, sem brilho). A prop
 * `tone` continua aceitando os mesmos nomes — só o que cada um pinta mudou.
 */
const TONE_STYLES = {
  yellow: {
    splitBg: 'bg-neon-yellow',
    splitText: 'text-black',
    mainBg: 'bg-panel',
    mainText: 'text-neon-yellow',
    border: 'border-neon-yellow/40',
    borderHover: 'group-hover:border-neon-yellow',
    watermark: 'text-neon-yellow/[0.03]',
    badge: 'bg-baixa',
  },
  fuchsia: {
    splitBg: 'bg-lenda',
    splitText: 'text-white',
    mainBg: 'bg-panel',
    mainText: 'text-lenda',
    border: 'border-lenda/40',
    borderHover: 'group-hover:border-lenda',
    watermark: 'text-lenda/[0.03]',
    badge: 'bg-baixa',
  },
  cyan: {
    splitBg: 'bg-giz',
    splitText: 'text-black',
    mainBg: 'bg-panel',
    mainText: 'text-giz',
    border: 'border-white/30',
    borderHover: 'group-hover:border-white',
    watermark: 'text-giz/[0.03]',
    badge: 'bg-baixa',
  },
  emerald: {
    splitBg: 'bg-alta',
    splitText: 'text-black',
    mainBg: 'bg-panel',
    mainText: 'text-alta',
    border: 'border-alta/40',
    borderHover: 'group-hover:border-alta',
    watermark: 'text-alta/[0.03]',
    badge: 'bg-baixa',
  },
  rose: {
    splitBg: 'bg-baixa',
    splitText: 'text-white',
    mainBg: 'bg-panel',
    mainText: 'text-baixa',
    border: 'border-baixa/40',
    borderHover: 'group-hover:border-baixa',
    watermark: 'text-baixa/[0.03]',
    badge: 'bg-baixa',
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
        'border-2 transition-colors duration-300',
        style.border,
        style.borderHover,
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {/* Faixa reta — 32% na cor do tom, 68% chapado */}
      <div
        className={cn(
          'absolute inset-0',
          style.splitBg,
        )}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 32%, 0 32%)',
        }}
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-0',
          style.mainBg,
        )}
        style={{
          clipPath: 'polygon(0 32%, 100% 32%, 100% 100%, 0 100%)',
        }}
        aria-hidden
      />

      {/* Watermark gigante do ícone */}
      <div
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <Icon
          className={style.watermark}
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
          'font-display text-[11px] font-black text-white',
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

        {/* Métrica GIGANTE */}
        <div className="relative z-10 flex-1 flex items-center">
          <div
            className={cn(
              'ole-num uppercase leading-none',
              style.mainText,
            )}
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
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
