/**
 * MatchInterruptOverlay (F3 — Olefoot Broadcast)
 *
 * Painel central diegético para gol / pênalti / cartão vermelho / intervalo / cena.
 * Mantém compatibilidade da API. VOLT2: painel chapado (sem vidro, sem brilho),
 * categoria em #hashtag, título em placa de cor chapada, contagem em ole-num.
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
  accent: string;          // cor da placa do título + accent border
  onAccent: string;        // cor do texto sobre a placa
  eyebrow: string;          // categoria em #hashtag ("#lance" / "#intervalo" etc)
  borderRGB: string;        // r,g,b para borda transparente
}

function kindStyle(kind: SpiritOverlayKind): KindStyle {
  switch (kind) {
    case 'goal':
      return {
        accent: 'var(--color-event-goal)',
        onAccent: 'var(--color-deep-black)',
        eyebrow: '#lance',
        borderRGB: '253,225,0',
      };
    case 'penalty':
      return {
        accent: 'var(--color-event-card-yellow)',
        onAccent: 'var(--color-deep-black)',
        eyebrow: '#pênalti',
        borderRGB: '245,197,24',
      };
    case 'red_card':
      return {
        accent: 'var(--color-event-card-red)',
        onAccent: '#FFFFFF',
        eyebrow: '#expulsão',
        borderRGB: '225,29,42',
      };
    case 'halftime':
      return {
        accent: 'var(--color-event-goal)',
        onAccent: 'var(--color-deep-black)',
        eyebrow: '#intervalo',
        borderRGB: '253,225,0',
      };
    default:
      return {
        accent: '#FFFFFF',
        onAccent: 'var(--color-deep-black)',
        eyebrow: '#cena',
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
    background: 'var(--color-panel)',
    border: `1px solid rgba(${style.borderRGB}, 0.32)`,
    borderTop: `2px solid ${style.accent}`,
  };

  const inner = (
    <>
      {/* Categoria em #hashtag */}
      <p className="mb-3 font-mono text-[11.5px] font-medium text-cimento" aria-hidden>
        {style.eyebrow}
      </p>

      {/* Título — Anton em placa de cor chapada */}
      <p
        className="inline-block font-impact uppercase leading-[1.1] px-3 pt-0.5"
        style={{
          background: style.accent,
          color: style.onAccent,
          fontSize: 'clamp(22px, 3.8vw, 32px)',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </p>

      {/* Countdown monumental — só quando aplicável */}
      {countdown != null && (
        <p
          className="ole-num leading-none mt-5 mb-1"
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(56px, 11vw, 88px)',
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
