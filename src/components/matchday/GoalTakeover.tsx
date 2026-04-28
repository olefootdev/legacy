/**
 * GOAL TAKEOVER (F3 — Olefoot Broadcast)
 *
 * Sequência cinemática 5s:
 * 0-300ms     → fundo amarelo entra
 * 300-900ms   → "GOL" em Moret italic gigante (ole-goal-hero-text)
 * 900-1800ms  → portrait + lower-third com nome do jogador
 * 1800-3500ms → narrativa + pontos
 * 3500-5000ms → CTA permanece, fade-out gradual
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '@/game/store';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { ArrowRight } from 'lucide-react';

interface GoalTakeoverProps {
  triggerKey: string | null;
  disabled?: boolean;
  onDismiss?: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function GoalTakeover({
  triggerKey,
  disabled = false,
  onDismiss,
}: GoalTakeoverProps) {
  const [visible, setVisible] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const playersById = useGameStore((s) => s.players);
  const live = useGameStore((s) => s.liveMatch);

  const lastGoal = live?.events?.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
  const scorer = lastGoal?.playerId ? playersById[lastGoal.playerId] : null;
  const scorerPortrait = scorer ? playerPortraitSrc(scorer, 256, 256) : null;
  const minute = lastGoal?.minute ?? live?.minute ?? 0;
  const narrative = lastGoal?.text || 'Estufou as redes!';
  const points =
    lastGoal?.playerId && live?.homeStats?.[lastGoal.playerId]?.rating
      ? `+${Math.round(live.homeStats[lastGoal.playerId].rating * 10)} pts`
      : '';

  useEffect(() => {
    if (disabled || triggerKey == null) return;
    setVisible(true);
    setShowCTA(false);
    const ctaTimer = window.setTimeout(() => setShowCTA(true), 2000);
    const dismissTimer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 5000);
    return () => {
      clearTimeout(ctaTimer);
      clearTimeout(dismissTimer);
    };
  }, [triggerKey, disabled, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="goal-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: EASE }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
          style={{
            backgroundColor: 'var(--color-event-goal)',
          }}
        >
          {/* Vinheta decorativa — barras pretas diagonais sutis */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'repeating-linear-gradient(135deg, transparent 0, transparent 80px, rgba(0,0,0,0.04) 80px, rgba(0,0,0,0.04) 82px)',
              opacity: 0.6,
            }}
            aria-hidden
          />

          {/* Eyebrow: minuto + LANCE */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.42, ease: EASE }}
            className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-3"
          >
            <span
              className="font-ui font-bold tabular-nums"
              style={{
                fontSize: '12px',
                color: '#000',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              {minute}'
            </span>
            <span style={{ width: '36px', height: '2px', background: '#000' }} />
            <span
              className="font-ui font-bold"
              style={{
                fontSize: '12px',
                color: '#000',
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
              }}
            >
              Lance decisivo
            </span>
          </motion.div>

          {/* Stack central */}
          <div className="relative flex flex-col items-center gap-8 px-6 pointer-events-none">
            {/* GOL — Moret italic monumental */}
            <motion.h1
              initial={{ opacity: 0, y: 60, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.30, duration: 0.7, ease: EASE }}
              className="leading-none text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 'clamp(5rem, 20vw, 11rem)',
                letterSpacing: '-0.04em',
                textShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            >
              Gol
            </motion.h1>

            {/* Portrait + lower-third nome */}
            {scorer ? (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5, ease: EASE }}
                className="flex flex-col items-center gap-4"
              >
                <div
                  className="relative rounded-full overflow-hidden border-4 border-black"
                  style={{
                    width: 'clamp(110px, 18vw, 150px)',
                    height: 'clamp(110px, 18vw, 150px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.32)',
                  }}
                >
                  {scorerPortrait ? (
                    <img
                      src={scorerPortrait}
                      alt=""
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black/10 text-6xl">
                      ⚽
                    </div>
                  )}
                </div>

                {/* Lower-third inline com nome */}
                <div
                  className="flex items-center gap-3 px-4 py-2"
                  style={{
                    background: '#000',
                    transform: 'skewX(-6deg)',
                  }}
                >
                  <div style={{ transform: 'skewX(6deg)' }} className="flex items-center gap-3">
                    {scorer.num != null && (
                      <span
                        className="font-display font-black tabular-nums leading-none"
                        style={{
                          color: 'var(--color-event-goal)',
                          fontSize: 'clamp(20px, 3vw, 26px)',
                        }}
                      >
                        #{scorer.num}
                      </span>
                    )}
                    <span
                      className="font-display font-black uppercase text-white"
                      style={{
                        fontSize: 'clamp(16px, 2.6vw, 22px)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {scorer.name}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* Narrativa */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.42, ease: EASE }}
              className="max-w-md text-center text-black/85 leading-relaxed font-medium"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'clamp(0.95rem, 2.4vw, 1.15rem)',
              }}
            >
              {narrative}
            </motion.p>

            {/* Pontos */}
            {points ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, duration: 0.42, ease: EASE }}
                className="px-5 py-1.5 border-2 border-black"
              >
                <span
                  className="font-display font-black text-black uppercase tracking-[0.18em]"
                  style={{ fontSize: 'clamp(0.95rem, 2.4vw, 1.15rem)' }}
                >
                  {points}
                </span>
              </motion.div>
            ) : null}
          </div>

          {/* CTA */}
          <AnimatePresence>
            {showCTA && (
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: EASE }}
                onClick={handleDismiss}
                className="absolute bottom-12 inline-flex items-center gap-3 px-7 py-3 font-display font-black uppercase tracking-[0.18em] pointer-events-auto"
                style={{
                  background: '#000',
                  color: 'var(--color-event-goal)',
                  transform: 'skewX(-6deg)',
                  fontSize: 'clamp(0.9rem, 2.4vw, 1.1rem)',
                  boxShadow: '6px 6px 0px rgba(0,0,0,0.25)',
                }}
              >
                <span style={{ transform: 'skewX(6deg)' }} className="inline-flex items-center gap-3">
                  Voltar à partida
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
