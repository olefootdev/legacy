/**
 * Celebração de gol para Partida Rápida
 * Fundo preto + fontes amarela/branca + foto do jogador + CTA
 * Auto-dismiss em 5s ou ao clicar no CTA
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface QuickGoalCelebrationProps {
  /** Chave única do gol para triggerar remount */
  triggerKey: string | null;
  /** Nome do jogador que marcou */
  scorerName: string;
  /** URL da foto do jogador */
  scorerPortrait?: string | null;
  /** Texto da narrativa do gol */
  narrative?: string;
  /** Callback quando dismissar */
  onDismiss: () => void;
  /** Desabilitar animação */
  disabled?: boolean;
}

export function QuickGoalCelebration({
  triggerKey,
  scorerName,
  scorerPortrait,
  narrative,
  onDismiss,
  disabled = false,
}: QuickGoalCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    if (disabled || triggerKey == null) return;

    setVisible(true);
    setShowCTA(false);

    // Mostrar CTA após 2s
    const ctaTimer = window.setTimeout(() => setShowCTA(true), 2000);

    // Auto-dismiss após 5s
    const dismissTimer = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 5000);

    return () => {
      clearTimeout(ctaTimer);
      clearTimeout(dismissTimer);
    };
  }, [triggerKey, disabled, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="goal-celebration"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-deep-black"
      >
        <motion.div
          initial={{ scale: 0.8, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center gap-6 px-4"
        >
          {/* GOL em Moret italic amarelo */}
          <h1
            className="text-neon-yellow leading-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(4rem, 18vw, 10rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              textShadow: '0 0 40px rgba(253,225,0,0.4)',
            }}
          >
            Gol
          </h1>

          {/* Foto do jogador */}
          {scorerPortrait ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-neon-yellow shadow-[0_0_30px_rgba(253,225,0,0.3)]">
                <img
                  src={scorerPortrait}
                  alt={scorerName}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Nome do jogador */}
              <p
                className="mt-3 text-center text-white uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                  letterSpacing: '0.02em',
                }}
              >
                {scorerName}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-neon-yellow shadow-[0_0_30px_rgba(253,225,0,0.3)] bg-neon-yellow/10 flex items-center justify-center">
                <span
                  className="text-neon-yellow leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontSize: '4rem',
                    fontWeight: 700,
                  }}
                >
                  G
                </span>
              </div>
              {/* Nome do jogador */}
              <p
                className="mt-3 text-center text-white uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                  letterSpacing: '0.02em',
                }}
              >
                {scorerName}
              </p>
            </motion.div>
          )}

          {/* Narrativa da jogada */}
          {narrative && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="max-w-md text-center text-white/80 leading-relaxed"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                fontWeight: 500,
              }}
            >
              {narrative}
            </motion.p>
          )}
        </motion.div>

        {/* CTA: Voltar para a partida */}
        <AnimatePresence>
          {showCTA && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={handleDismiss}
              className="mt-8 inline-flex items-center gap-3 border-2 border-neon-yellow bg-neon-yellow px-8 py-4 text-black uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(253,225,0,0.4)] active:scale-95"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                fontWeight: 700,
                letterSpacing: '0.2em',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Voltar para a partida
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
