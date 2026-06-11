/**
 * Strip do narrador reativo (quick-match-revolution.md §6).
 *
 * Legenda cinética curta que aparece sobre o lance: explode no acerto, treme na
 * zoeira, esfria na consequência. Pulável (some sozinho). NÃO compete com o feed
 * — é o "julgamento com peso" que dá ardência e replay.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { NarratorLine, NarratorTone } from '@/match/quickNarrator';

interface Props {
  /** Linha + um nonce que muda a cada nova fala (mesmo texto pode repetir). */
  line: (NarratorLine & { nonce: number }) | null;
  /** ms que a fala fica na tela antes de sumir. */
  holdMs?: number;
}

const TONE_STYLE: Record<NarratorTone, { ring: string; text: string; glow: string }> = {
  exalta: { ring: 'border-neon-yellow/60', text: 'text-neon-yellow', glow: 'shadow-[0_0_30px_rgba(234,255,0,0.35)]' },
  cutuca: { ring: 'border-orange-400/50', text: 'text-orange-300', glow: 'shadow-[0_0_22px_rgba(251,146,60,0.25)]' },
  frieza: { ring: 'border-red-500/60', text: 'text-red-300', glow: 'shadow-[0_0_26px_rgba(239,68,68,0.30)]' },
  tensao: { ring: 'border-amber-400/50', text: 'text-amber-200', glow: 'shadow-[0_0_22px_rgba(251,191,36,0.22)]' },
  alivio: { ring: 'border-cyan-400/50', text: 'text-cyan-200', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.20)]' },
  neutro: { ring: 'border-white/20', text: 'text-white/85', glow: '' },
};

export function QuickReactiveNarrator({ line, holdMs = 4200 }: Props) {
  const [visible, setVisible] = useState<(NarratorLine & { nonce: number }) | null>(null);

  useEffect(() => {
    if (!line) return;
    setVisible(line);
    const t = window.setTimeout(() => setVisible(null), holdMs);
    return () => window.clearTimeout(t);
  }, [line?.nonce, holdMs]);

  const tone = visible ? TONE_STYLE[visible.tone] : TONE_STYLE.neutro;
  const shake = visible?.tone === 'cutuca' || visible?.tone === 'frieza';

  return (
    <div className="pointer-events-none flex min-h-[2.75rem] w-full items-center justify-center px-2">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.button
            key={visible.nonce}
            type="button"
            onClick={() => setVisible(null)}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: shake ? [0, -3, 3, -2, 2, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 24, x: { duration: 0.35 } }}
            className={cn(
              'pointer-events-auto inline-flex max-w-full items-baseline gap-2 rounded-full border bg-black/70 px-4 py-1.5 backdrop-blur-sm',
              tone.ring,
              tone.glow,
            )}
            aria-live="polite"
          >
            {visible.punch && (
              <span
                className={cn('font-display text-sm font-black uppercase tracking-tight', tone.text)}
                style={{ fontStyle: 'italic' }}
              >
                {visible.punch}
              </span>
            )}
            <span
              className={cn('truncate text-[13px] font-bold leading-tight', tone.text)}
              style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic' }}
            >
              {visible.text}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
