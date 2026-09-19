/**
 * QuickMatchHero — Hero cinematográfico para pré-jogo da Partida Rápida.
 *
 * VOLT2: countdown 3-2-1 gigante sobre volt chapado — sem textura, sem itálico.
 * Transição: "Pronto?" → 3 → 2 → 1 → "Bola rolando!"
 */

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export type QuickPreStartPhase = 'ready' | 'c3' | 'c2' | 'c1' | 'kickoff' | null;

interface QuickMatchHeroProps {
  phase: QuickPreStartPhase;
  homeShort: string;
  awayShort: string;
  homeName: string;
  awayName: string;
  /** Brasões reais (opcional) */
  homeCrestUrl?: string | null;
  awayCrestUrl?: string | null;
}

export function QuickMatchHero({
  phase,
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeCrestUrl,
  awayCrestUrl,
}: QuickMatchHeroProps) {
  if (phase === null) return null;

  const isCountdown = phase === 'c3' || phase === 'c2' || phase === 'c1';
  const countdownNumber = phase === 'c3' ? '3' : phase === 'c2' ? '2' : phase === 'c1' ? '1' : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-neon-yellow overflow-hidden"
    >
      {/* Conteúdo centralizado */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 gap-8 sm:gap-12">
        {/* Duelo: Brasões + nomes */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 md:gap-16">
          {/* Casa */}
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            {homeCrestUrl ? (
              <img
                src={homeCrestUrl}
                alt={homeName}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain"
                referrerPolicy="no-referrer"
                draggable={false}
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-[3px] border-black bg-neon-yellow grid place-items-center">
                <span
                  className="font-display font-black uppercase text-black text-sm sm:text-base md:text-lg tracking-[0.06em]"
                >
                  {homeShort}
                </span>
              </div>
            )}
            <p
              className="text-black uppercase font-display font-black text-center leading-tight max-w-[120px] sm:max-w-[160px]"
              style={{
                fontSize: 'clamp(14px, 2vw, 20px)',
                letterSpacing: '0.02em',
              }}
            >
              {homeName}
            </p>
          </div>

          {/* Separador × */}
          <span
            className="font-impact text-black/85 leading-none select-none"
            style={{ fontSize: 'clamp(40px, 8vw, 72px)' }}
          >
            ×
          </span>

          {/* Visitante */}
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            {awayCrestUrl ? (
              <img
                src={awayCrestUrl}
                alt={awayName}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain"
                referrerPolicy="no-referrer"
                draggable={false}
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-[3px] border-black bg-neon-yellow grid place-items-center">
                <span
                  className="font-display font-black uppercase text-black text-sm sm:text-base md:text-lg tracking-[0.06em]"
                >
                  {awayShort}
                </span>
              </div>
            )}
            <p
              className="text-black uppercase font-display font-black text-center leading-tight max-w-[120px] sm:max-w-[160px]"
              style={{
                fontSize: 'clamp(14px, 2vw, 20px)',
                letterSpacing: '0.02em',
              }}
            >
              {awayName}
            </p>
          </div>
        </div>

        {/* Mensagem central — transição emocional */}
        <AnimatePresence mode="wait">
          {phase === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.35 }}
              className="text-center"
            >
              <p
                className="font-impact uppercase text-black leading-[1.1]"
                style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}
              >
                Pronto?
              </p>
            </motion.div>
          )}

          {isCountdown && countdownNumber && (
            <motion.div
              key={`countdown-${countdownNumber}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-center"
            >
              <span
                className="ole-num text-black leading-none"
                style={{ fontSize: 'clamp(6rem, 18vw, 12rem)' }}
              >
                {countdownNumber}
              </span>
            </motion.div>
          )}

          {phase === 'kickoff' && (
            <motion.div
              key="kickoff"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45 }}
              className="text-center"
            >
              <p
                className="uppercase text-black leading-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(2rem, 6vw, 4rem)',
                  letterSpacing: '0.02em',
                }}
              >
                Bola rolando!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
