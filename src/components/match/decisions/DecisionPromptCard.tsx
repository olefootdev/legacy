/**
 * DecisionPromptCard — UI canônica de decision moments do Olefoot.
 *
 * Card amarelo neon (#FDE100) sobre fundo preto, com escolhas como ícones/setas.
 * Texto, quando houver, é UMA palavra em Oswald uppercase. Estilo Legacy Tech.
 *
 * Cada decision moment do catálogo (saída do goleiro, falta, escanteio,
 * 1×1 ponta, etc) reusa este componente — só varia o título, os choices,
 * e o handler de outcome.
 */
import { memo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const NEON = '#FDE100';

export type DecisionArrow =
  | 'short-down' | 'short-up' | 'short-left' | 'short-right'
  | 'long-up' | 'long-down' | 'long-left' | 'long-right'
  | 'curve-left' | 'curve-right' | 'fan-left' | 'fan-right'
  | 'cross' | 'tap-back';

export interface DecisionChoice {
  id: string;
  /** ONE word, max — Oswald uppercase. Omit if icon/arrow speaks alone. */
  label?: string;
  /** Pre-built arrow direction. Mutually exclusive with `icon`. */
  arrow?: DecisionArrow;
  /** Custom icon (svg/text). Use for non-arrow symbols. */
  icon?: ReactNode;
  /** Tone tweaks the choice color: 'safe' (default yellow) | 'risk' (red-ish) | 'mid' (orange). */
  tone?: 'safe' | 'risk' | 'mid';
}

export interface DecisionPromptCardProps {
  /** Header text — short uppercase phrase, e.g. "DISTRIBUIÇÃO". */
  title: string;
  /** 2-4 choices. */
  choices: DecisionChoice[];
  /** Auto-resolve after this many ms. Default 8000. */
  timeoutMs?: number;
  onChoose: (choiceId: string) => void;
  /** Fired when timer hits zero with no choice. */
  onTimeout?: () => void;
}

/** SVG arrow primitives for the choice icons. 32×32 box, currentColor stroke. */
function Arrow({ kind }: { kind: DecisionArrow }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'short-down':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 6 L16 22" {...common} />
          <path d="M10 18 L16 24 L22 18" {...common} />
        </svg>
      );
    case 'short-up':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 26 L16 10" {...common} />
          <path d="M10 14 L16 8 L22 14" {...common} />
        </svg>
      );
    case 'long-up':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 30 L16 4" {...common} />
          <path d="M9 11 L16 4 L23 11" {...common} />
        </svg>
      );
    case 'long-down':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 2 L16 28" {...common} />
          <path d="M9 21 L16 28 L23 21" {...common} />
        </svg>
      );
    case 'short-left':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M26 16 L10 16" {...common} />
          <path d="M14 10 L8 16 L14 22" {...common} />
        </svg>
      );
    case 'short-right':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M6 16 L22 16" {...common} />
          <path d="M18 10 L24 16 L18 22" {...common} />
        </svg>
      );
    case 'long-left':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M30 16 L4 16" {...common} />
          <path d="M11 9 L4 16 L11 23" {...common} />
        </svg>
      );
    case 'long-right':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M2 16 L28 16" {...common} />
          <path d="M21 9 L28 16 L21 23" {...common} />
        </svg>
      );
    case 'curve-left':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M22 28 Q 4 22 8 6" {...common} />
          <path d="M3 11 L8 4 L14 9" {...common} />
        </svg>
      );
    case 'curve-right':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M10 28 Q 28 22 24 6" {...common} />
          <path d="M18 9 L24 4 L29 11" {...common} />
        </svg>
      );
    case 'fan-left':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 26 L6 8" {...common} />
          <path d="M16 26 L16 6" {...common} opacity={0.5} />
          <path d="M16 26 L26 8" {...common} opacity={0.3} />
        </svg>
      );
    case 'fan-right':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M16 26 L26 8" {...common} />
          <path d="M16 26 L16 6" {...common} opacity={0.5} />
          <path d="M16 26 L6 8" {...common} opacity={0.3} />
        </svg>
      );
    case 'cross':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M4 24 Q 16 4 28 24" {...common} />
          <path d="M22 22 L28 24 L26 18" {...common} />
        </svg>
      );
    case 'tap-back':
      return (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <path d="M22 8 Q 16 16 22 24" {...common} />
          <path d="M16 18 L22 24 L20 16" {...common} />
        </svg>
      );
    default:
      return null;
  }
}

const TONE_COLORS: Record<NonNullable<DecisionChoice['tone']>, string> = {
  safe: NEON,
  mid: '#F97316',
  risk: '#EF4444',
};

export const DecisionPromptCard = memo(function DecisionPromptCard({
  title,
  choices,
  timeoutMs = 8000,
  onChoose,
  onTimeout,
}: DecisionPromptCardProps) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / timeoutMs);
      setProgress(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        onTimeout?.();
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [timeoutMs, onTimeout]);

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-[300] pointer-events-auto"
      style={{ top: '6%', width: 'min(92%, 480px)' }}
    >
      <div
        style={{
          background: NEON,
          color: '#000',
          border: '2px solid #000',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 4px rgba(253,225,0,0.18)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 pt-2"
          style={{
            fontFamily: "'Oswald', 'Agency FB', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.28em',
            fontSize: 11,
            textTransform: 'uppercase',
          }}
        >
          <span>{title}</span>
          <span style={{ opacity: 0.65 }}>
            {Math.ceil((timeoutMs * progress) / 1000)}s
          </span>
        </div>

        {/* Choices */}
        <div
          className="grid gap-2 px-3 pt-3 pb-3"
          style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
        >
          {choices.map((c) => {
            const color = TONE_COLORS[c.tone ?? 'safe'];
            const isYellow = (c.tone ?? 'safe') === 'safe';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChoose(c.id)}
                className="flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95"
                style={{
                  background: '#000',
                  color: isYellow ? NEON : color,
                  border: `2px solid ${isYellow ? '#000' : color}`,
                  borderRadius: 4,
                  padding: '14px 6px 10px',
                  minHeight: 88,
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 36, height: 36, color: isYellow ? NEON : color }}>
                  {c.arrow ? <Arrow kind={c.arrow} /> : c.icon}
                </span>
                {c.label && (
                  <span
                    style={{
                      fontFamily: "'Oswald', sans-serif",
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    {c.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Timer bar */}
        <div style={{ background: 'rgba(0,0,0,0.18)', height: 4 }}>
          <div
            style={{
              background: '#000',
              width: `${progress * 100}%`,
              height: '100%',
              transition: 'width 60ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
});
