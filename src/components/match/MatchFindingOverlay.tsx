/**
 * MatchFindingOverlay — sequência real "buscando partida → começa a partida".
 *
 * Substitui o mock "A carregar partida...". Mostra ao vivo:
 *   1. Buscando partida...      (enquanto matchmaking roda)
 *   2. Partida encontrada!      (mostra nome do oponente)
 *   3. Times em campo...        (~700ms — engine prepara lineups)
 *   4. Torcida vibra...         (~700ms — Python aquece dados)
 *   5. Começa a partida!        (~500ms — fade out)
 *
 * Auto-completa após step 5: chama `onComplete` e a partida começa.
 *
 * Usado em MatchQuick + MatchClassic.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { OpponentStub } from '@/entities/types';

interface Props {
  /** Stub do oponente. `null` enquanto matchmaking não terminou. */
  opponent: OpponentStub | null;
  /** Nome curto do clube do user (ex.: TIG). */
  homeShort?: string;
  /** Disparado quando a sequência narrativa termina e a partida deve começar. */
  onComplete: () => void;
}

type Step = 'searching' | 'found' | 'teams' | 'crowd' | 'kickoff';

const STEP_DURATIONS: Record<Exclude<Step, 'searching'>, number> = {
  found: 1200, // tempo pra user ler o nome do oponente
  teams: 800,
  crowd: 800,
  kickoff: 600,
};

export function MatchFindingOverlay({ opponent, homeShort, onComplete }: Props) {
  // Inicia em 'searching' se opponent ainda não chegou; se já chegou no mount,
  // pula direto pra 'found'.
  const [step, setStep] = useState<Step>(opponent ? 'found' : 'searching');

  // Quando opponent chega, transiciona pra 'found'
  useEffect(() => {
    if (opponent && step === 'searching') setStep('found');
  }, [opponent, step]);

  // Timer entre steps após 'found'
  useEffect(() => {
    if (step === 'searching') return;
    const next: Record<Exclude<Step, 'searching'>, Step | null> = {
      found: 'teams',
      teams: 'crowd',
      crowd: 'kickoff',
      kickoff: null,
    };
    const duration = STEP_DURATIONS[step];
    const id = setTimeout(() => {
      const n = next[step];
      if (n) {
        setStep(n);
      } else {
        onComplete();
      }
    }, duration);
    return () => clearTimeout(id);
  }, [step, onComplete]);

  // Lista cronológica dos textos já apresentados (efeito empilhamento)
  const lines: { key: Step; text: string; tone: 'searching' | 'found' | 'narrative' }[] = [];
  if (step === 'searching') {
    lines.push({ key: 'searching', text: 'Buscando partida...', tone: 'searching' });
  } else {
    if (opponent) {
      lines.push({
        key: 'found',
        text: `Partida encontrada — ${opponent.shortName ?? opponent.name}`,
        tone: 'found',
      });
    }
    if (step === 'teams' || step === 'crowd' || step === 'kickoff') {
      lines.push({ key: 'teams', text: 'Times em campo...', tone: 'narrative' });
    }
    if (step === 'crowd' || step === 'kickoff') {
      lines.push({ key: 'crowd', text: 'Torcida vibra...', tone: 'narrative' });
    }
    if (step === 'kickoff') {
      lines.push({ key: 'kickoff', text: 'Começa a partida!', tone: 'narrative' });
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-8 bg-deep-black/95 px-6 py-12 backdrop-blur">
      {/* Bola olefoot pulsando no centro */}
      <motion.div
        className="relative"
        animate={{
          scale: step === 'searching' ? [1, 1.08, 1] : [1, 1.04, 1],
          rotate: step === 'searching' ? [0, 360] : [0, 0],
        }}
        transition={{
          scale: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 2.5, repeat: Infinity, ease: 'linear' },
        }}
      >
        <BallSvg className="h-20 w-20 sm:h-24 sm:w-24" />
      </motion.div>

      {/* Linhas narrativas empilhadas */}
      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.p
              key={line.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className={
                line.tone === 'searching'
                  ? 'text-center font-display text-sm font-bold uppercase tracking-[0.18em] text-white/70 sm:text-base'
                  : line.tone === 'found'
                    ? 'text-center font-display text-base font-black uppercase tracking-[0.14em] text-neon-yellow sm:text-lg'
                    : 'text-center font-display text-sm font-bold uppercase tracking-[0.18em] text-white sm:text-base'
              }
            >
              {line.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      {/* Hint de contexto (sutil) */}
      {homeShort && opponent && (
        <p className="text-center text-[10px] uppercase tracking-[0.22em] text-white/40">
          {homeShort} vs {opponent.shortName ?? opponent.name}
        </p>
      )}
    </div>
  );
}

function BallSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="#000" stroke="#FDE100" strokeWidth="3" />
      <polygon
        points="50,22 64,32 60,48 40,48 36,32"
        fill="#FDE100"
      />
      <polygon points="50,52 66,58 60,74 40,74 34,58" fill="#FFF" opacity="0.08" />
      <line x1="50" y1="22" x2="50" y2="6" stroke="#FDE100" strokeWidth="2" />
      <line x1="64" y1="32" x2="76" y2="22" stroke="#FDE100" strokeWidth="2" />
      <line x1="36" y1="32" x2="24" y2="22" stroke="#FDE100" strokeWidth="2" />
      <line x1="40" y1="48" x2="20" y2="58" stroke="#FDE100" strokeWidth="2" />
      <line x1="60" y1="48" x2="80" y2="58" stroke="#FDE100" strokeWidth="2" />
    </svg>
  );
}
