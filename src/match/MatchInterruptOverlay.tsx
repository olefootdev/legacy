import { motion } from 'motion/react';
import type { SpiritOverlayKind } from '@/gamespirit/spiritSnapshotTypes';
import { cn } from '@/lib/utils';

export interface MatchInterruptOverlayProps {
  kind: SpiritOverlayKind;
  title: string;
  lines: string[];
  /** Contagem regressiva grande (intervalo); omitir para golo/penálti. */
  countdown?: number | null;
  className?: string;
  /**
   * Sem animação Framer no painel — usar quando o pai já é um `motion` fullscreen
   * (evita “duplo” pop-in e banner fantasma no fluxo da página).
   */
  motionless?: boolean;
}

/**
 * Conteúdo do painel central (glass). O pai deve envolver com `AnimatePresence` + `key` estável
 * (ex.: intervalo vs `spiritOverlay.startedAtMs`).
 */
export function MatchInterruptOverlay({
  kind,
  title,
  lines,
  countdown,
  className,
  motionless = false,
}: MatchInterruptOverlayProps) {
  const accent =
    kind === 'goal'
      ? 'border-neon-yellow/50 shadow-[0_0_36px_rgba(234,255,0,0.15)]'
      : kind === 'penalty'
        ? 'border-amber-400/40 shadow-[0_0_28px_rgba(251,191,36,0.12)]'
        : kind === 'red_card'
          ? 'border-red-500/45 shadow-[0_0_32px_rgba(239,68,68,0.18)]'
          : kind === 'halftime'
            ? 'border-neon-yellow/30'
            : 'border-white/20';

  const panelClass = cn('glass-panel p-5 border text-center w-full', accent, className);

  const inner = (
    <>
      <p
        className={cn(
          'font-display font-black text-xl uppercase tracking-wide',
          kind === 'goal' && 'text-neon-yellow',
          kind === 'penalty' && 'text-amber-300',
          kind === 'red_card' && 'text-red-400',
          kind === 'halftime' && 'text-neon-yellow',
          kind === 'scene' && 'text-white',
        )}
      >
        {title}
      </p>
      {countdown != null && (
        <p className="mt-4 font-display font-black text-6xl tabular-nums text-white">{countdown}</p>
      )}
      {lines.length > 0 && (
        <div className={cn('space-y-2 text-sm text-gray-300 leading-relaxed', countdown != null ? 'mt-4' : 'mt-3')}>
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </>
  );

  if (motionless) {
    return (
      <div className={panelClass} role="dialog" aria-live="polite">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 6 }}
      className={panelClass}
      role="dialog"
      aria-live="polite"
    >
      {inner}
    </motion.div>
  );
}
