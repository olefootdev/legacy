/**
 * TrophyCard — Card de troféu.
 *
 * VOLT2 (2026-09-19):
 * - Faixa reta na cor do tom no topo (quando conquistado) + corpo chapado
 * - Watermark gigante do troféu em fundo
 * - Sem brilho, sem degradê, sem girar nem crescer no hover
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

/**
 * Tons mapeados para a paleta VOLT2 — nomes mantidos por compatibilidade.
 * Troféu do jogo é fictício: volt, nunca ouro (ouro é só ativo na rede).
 */
const TONE_STYLES = {
  yellow: {
    splitBg: 'bg-neon-yellow',
    mainBg: 'bg-panel',
    border: 'border-neon-yellow/70',
    borderHover: 'group-hover:border-neon-yellow',
    iconText: 'text-black',
    mainText: 'text-neon-yellow',
    watermark: 'text-neon-yellow/[0.04]',
    badgeBg: 'bg-deep-black',
    badgeText: 'text-neon-yellow',
  },
  cyan: {
    splitBg: 'bg-giz',
    mainBg: 'bg-panel',
    border: 'border-white/30',
    borderHover: 'group-hover:border-white',
    iconText: 'text-black',
    mainText: 'text-giz',
    watermark: 'text-giz/[0.04]',
    badgeBg: 'bg-deep-black',
    badgeText: 'text-giz',
  },
  emerald: {
    splitBg: 'bg-alta',
    mainBg: 'bg-panel',
    border: 'border-alta/70',
    borderHover: 'group-hover:border-alta',
    iconText: 'text-black',
    mainText: 'text-alta',
    watermark: 'text-alta/[0.04]',
    badgeBg: 'bg-deep-black',
    badgeText: 'text-alta',
  },
  fuchsia: {
    splitBg: 'bg-lenda',
    mainBg: 'bg-panel',
    border: 'border-lenda/70',
    borderHover: 'group-hover:border-lenda',
    iconText: 'text-white',
    mainText: 'text-lenda',
    watermark: 'text-lenda/[0.04]',
    badgeBg: 'bg-deep-black',
    badgeText: 'text-lenda',
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
        'border-2 transition-colors duration-300',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default',
        earned && style
          ? cn(
              style.border,
              style.borderHover,
            )
          : 'border-white/15 bg-panel opacity-75 hover:opacity-90',
      )}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {/* Faixa reta — 28% na cor do tom, 72% chapado (quando conquistado) */}
      {earned && style && (
        <>
          <div
            className={cn(
              'absolute inset-0',
              style.splitBg,
            )}
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 28%, 0 28%)',
            }}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-0',
              style.mainBg,
            )}
            style={{
              clipPath: 'polygon(0 28%, 100% 28%, 100% 100%, 0 100%)',
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
            className={style.watermark}
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
            earned && style
              ? cn(style.splitBg, style.iconText, 'border-2 border-deep-black')
              : 'bg-white/5 text-poeira border-2 border-white/10',
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

    </button>
  );
}
