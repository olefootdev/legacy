/**
 * QuickMatchHero — Hero cinematográfico para pré-jogo da Partida Rápida.
 *
 * Countdown 3-2-1 em Moret italic gigante sobre fundo amarelo com split diagonal BVB.
 * Transição emocional: "Pronto?" → 3 → 2 → 1 → "Bola a rolar!"
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
      {/* Linhas verticais sutis (textura de campo) */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <g stroke="#000" strokeWidth="0.15">
          <line x1="20" y1="0" x2="20" y2="100" />
          <line x1="40" y1="0" x2="40" y2="100" />
          <line x1="60" y1="0" x2="60" y2="100" />
          <line x1="80" y1="0" x2="80" y2="100" />
        </g>
      </svg>

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

          {/* Separador × em Moret italic */}
          <span
            className="text-black/85 leading-none select-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(40px, 8vw, 72px)',
              letterSpacing: '-0.04em',
            }}
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
                className="italic text-black leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                  letterSpacing: '-0.02em',
                }}
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
                className="italic text-black leading-none tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(6rem, 18vw, 12rem)',
                  letterSpacing: '-0.04em',
                }}
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
                Bola a rolar!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
