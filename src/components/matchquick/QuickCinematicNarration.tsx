/**
 * Narração em TELA CHEIA (quick-match-revolution.md §3.2).
 *
 * Takeover cinematográfico: frases grandes, uma por vez, cadência crescente, o
 * clímax explode (GOOOL / NA TRAVE! / DEFENDEÇÃO! / PRA FORA!). Segue o padrão
 * dos overlays full-screen que já existem (GoalScorerOverlay, RedCardOverlay).
 * Regras §3.2: 3–5 palavras por linha, ~8s no total, SEMPRE pulável com 1 toque,
 * clímax é visual (não frase pra ler).
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { NarrationChain } from '@/match/quickNarrationChain';

interface Props {
  chain: NarrationChain;
  onDone: () => void;
  /** Cor do clímax: 'home' = dourado, 'away' = branco, 'near' = âmbar. */
  accent?: 'home' | 'away' | 'near';
}

const BUILD_MS = 820;
const CLIMAX_MS = 1900;

export function QuickCinematicNarration({ chain, onDone, accent = 'home' }: Props) {
  const [i, setI] = useState(0);
  const beat = chain.beats[i];
  const isClimax = beat?.kind === 'climax';

  useEffect(() => {
    if (!beat) {
      onDone();
      return;
    }
    const dur = isClimax ? CLIMAX_MS : BUILD_MS;
    const t = window.setTimeout(() => setI((n) => n + 1), dur);
    return () => window.clearTimeout(t);
  }, [i, beat, isClimax, onDone]);

  if (!beat) return null;

  const climaxColor =
    accent === 'home' ? 'text-neon-yellow' : accent === 'away' ? 'text-white' : 'text-amber-300';
  const climaxGlow =
    accent === 'home'
      ? 'drop-shadow-[0_0_40px_rgba(234,255,0,0.6)]'
      : accent === 'away'
        ? 'drop-shadow-[0_0_36px_rgba(255,255,255,0.5)]'
        : 'drop-shadow-[0_0_36px_rgba(251,191,36,0.5)]';

  // Cadência crescente: cada build-up um pouco maior que o anterior.
  const buildScale = 0.86 + Math.min(0.22, i * 0.05);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/92 px-6 backdrop-blur-sm"
      role="button"
      aria-label="Pular narração"
    >
      <AnimatePresence mode="wait">
        {isClimax ? (
          <motion.div
            key={`climax-${i}`}
            initial={{ scale: 0.3, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14 }}
            className="text-center"
          >
            <span
              className={cn('block font-display font-black uppercase italic leading-none', climaxColor, climaxGlow)}
              style={{ fontSize: 'clamp(72px, 22vw, 200px)', letterSpacing: '-0.03em' }}
            >
              {chain.climaxWord}
            </span>
          </motion.div>
        ) : (
          <motion.p
            key={`build-${i}`}
            initial={{ opacity: 0, y: 16, scale: buildScale * 0.92 }}
            animate={{ opacity: 1, y: 0, scale: buildScale }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="text-center font-display font-black uppercase italic leading-tight text-white"
            style={{ fontSize: 'clamp(34px, 9vw, 84px)', letterSpacing: '-0.02em' }}
          >
            {beat.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* dica de pular — discreta */}
      <span className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-white/30">
        toque para pular
      </span>
    </motion.div>
  );
}
