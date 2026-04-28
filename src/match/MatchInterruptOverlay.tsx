/**
 * MatchInterruptOverlay (F3 — Olefoot Broadcast)
 *
 * Painel central diegético para gol / pênalti / cartão vermelho / intervalo / cena.
 * Mantém compatibilidade da API; visualmente refeito com tokens do design system,
 * letterbox sutil, eyebrow editorial, contagem em font-display monumental.
 */
import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import type { SpiritOverlayKind } from '@/gamespirit/spiritSnapshotTypes';
import { cn } from '@/lib/utils';

export interface MatchInterruptOverlayProps {
  kind: SpiritOverlayKind;
  title: string;
  lines: string[];
  /** Contagem regressiva (intervalo); omitir para golo/penalty. */
  countdown?: number | null;
  className?: string;
  motionless?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

interface KindStyle {
  accent: string;          // cor do título + accent border
  glow: string;             // box-shadow
  eyebrow: string;          // texto eyebrow ("LANCE" / "INTERVALO" etc)
  borderRGB: string;        // r,g,b para borda transparente
}

function kindStyle(kind: SpiritOverlayKind): KindStyle {
  switch (kind) {
    case 'goal':
      return {
        accent: 'var(--color-event-goal)',
        glow: 'var(--glow-goal)',
        eyebrow: 'Lance',
        borderRGB: '253,225,0',
      };
    case 'penalty':
      return {
        accent: 'var(--color-event-card-yellow)',
        glow: 'var(--glow-card-yellow)',
        eyebrow: 'Pênalti',
        borderRGB: '245,197,24',
      };
    case 'red_card':
      return {
        accent: 'var(--color-event-card-red)',
        glow: 'var(--glow-card-red)',
        eyebrow: 'Expulsão',
        borderRGB: '225,29,42',
      };
    case 'halftime':
      return {
        accent: 'var(--color-event-goal)',
        glow: 'var(--glow-goal-soft)',
        eyebrow: 'Intervalo',
        borderRGB: '253,225,0',
      };
    default:
      return {
        accent: '#FFFFFF',
        glow: '0 0 24px rgba(255,255,255,0.12)',
        eyebrow: 'Cena',
        borderRGB: '255,255,255',
      };
  }
}

export function MatchInterruptOverlay({
  kind,
  title,
  lines,
  countdown,
  className,
  motionless = false,
}: MatchInterruptOverlayProps) {
  const style = kindStyle(kind);

  const panelStyle: CSSProperties = {
    background:
      'linear-gradient(180deg, rgba(13,13,13,0.92) 0%, rgba(13,13,13,0.72) 100%)',
    border: `1px solid rgba(${style.borderRGB}, 0.32)`,
    borderTop: `2px solid ${style.accent}`,
    boxShadow: `${style.glow}, 0 24px 60px rgba(0,0,0,0.6)`,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  };

  const inner = (
    <>
      {/* Eyebrow */}
      <div
        className="flex items-center justify-center gap-3 mb-3 opacity-85"
        aria-hidden
      >
        <span
          style={{
            width: '28px',
            height: '1px',
            background: `rgba(${style.borderRGB}, 0.6)`,
          }}
        />
        <span
          className="font-ui font-bold uppercase"
          style={{
            color: style.accent,
            fontSize: '10px',
            letterSpacing: '0.42em',
          }}
        >
          {style.eyebrow}
        </span>
        <span
          style={{
            width: '28px',
            height: '1px',
            background: `rgba(${style.borderRGB}, 0.6)`,
          }}
        />
      </div>

      {/* Título — font-display black */}
      <p
        className="font-display font-black uppercase leading-tight"
        style={{
          color: style.accent,
          fontSize: 'clamp(20px, 3.4vw, 28px)',
          letterSpacing: '0.06em',
          textShadow: `0 0 16px rgba(${style.borderRGB}, 0.45)`,
        }}
      >
        {title}
      </p>

      {/* Countdown monumental — só quando aplicável */}
      {countdown != null && (
        <p
          className="font-display font-black tabular-nums leading-none mt-5 mb-1"
          style={{
            color: '#FFF',
            fontSize: 'clamp(64px, 12vw, 96px)',
            letterSpacing: '-0.04em',
            textShadow: '0 4px 24px rgba(0,0,0,0.7)',
          }}
        >
          {countdown}
        </p>
      )}

      {/* Linhas auxiliares */}
      {lines.length > 0 && (
        <div
          className={cn(
            'space-y-1.5 leading-relaxed',
            countdown != null ? 'mt-4' : 'mt-3',
          )}
          style={{
            fontFamily: 'var(--font-ui)',
            color: 'rgba(255,255,255,0.78)',
            fontSize: 'clamp(13px, 1.6vw, 15px)',
          }}
        >
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </>
  );

  const panelClass = cn(
    'p-6 sm:p-7 text-center w-full max-w-md mx-auto',
    className,
  );

  if (motionless) {
    return (
      <div className={panelClass} style={panelStyle} role="dialog" aria-live="polite">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -4 }}
      transition={{ duration: 0.42, ease: EASE }}
      className={panelClass}
      style={panelStyle}
      role="dialog"
      aria-live="polite"
    >
      {inner}
    </motion.div>
  );
}
