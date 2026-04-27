/**
 * Full-screen goal celebration:
 * Tela amarela com "GOL" em Moret + foto do jogador + nome + CTA "Voltar para a partida"
 * Auto-dismiss após 7s
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '@/game/store';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { ArrowRight } from 'lucide-react';

interface GoalTakeoverProps {
  /** Bumped externally when a new goal happens — drives mount + remount. */
  triggerKey: string | null;
  /** Suppress entirely (e.g. reduce-motion preference). */
  disabled?: boolean;
  /** Callback quando o usuário clica para voltar */
  onDismiss?: () => void;
}

export function GoalTakeover({
  triggerKey,
  disabled = false,
  onDismiss,
}: GoalTakeoverProps) {
  const [visible, setVisible] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const playersById = useGameStore((s) => s.players);
  const live = useGameStore((s) => s.liveMatch);

  // Pega o último gol
  const lastGoal = live?.events?.find((e) => e.kind === 'goal_home' || e.kind === 'goal_away');
  const scorer = lastGoal?.playerId ? playersById[lastGoal.playerId] : null;
  const scorerPortrait = scorer ? playerPortraitSrc(scorer, 256, 256) : null;

  // Fallback para narrativa genérica se não houver texto
  const narrative = lastGoal?.text || 'Estufou as redes!';

  const points = lastGoal?.playerId && live?.homeStats?.[lastGoal.playerId]?.rating
    ? `+${Math.round(live.homeStats[lastGoal.playerId].rating * 10)} pts`
    : '';

  useEffect(() => {
    if (disabled || triggerKey == null) return;

    setVisible(true);
    setShowCTA(false);

    // Mostrar CTA após 2s
    const ctaTimer = window.setTimeout(() => setShowCTA(true), 2000);

    // Auto-dismiss após 5s
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
    // Chamar onDismiss imediatamente para desbloquear o jogo
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
          transition={{ duration: 0.3 }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'var(--yellow)' }}
        >
        <motion.div
          initial={{ scale: 0.8, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center gap-6 px-4 pointer-events-none"
        >
          {/* GOL em Moret italic */}
          <h1
            className="text-black leading-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 'clamp(4rem, 18vw, 10rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              textShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            Gol
          </h1>

          {/* Foto do jogador - sempre mostra algo */}
          {scorerPortrait && scorer ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-black shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                <img
                  src={scorerPortrait}
                  alt={scorer.name}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Nome do jogador */}
              <p
                className="mt-3 text-center text-black uppercase tracking-wider"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                  letterSpacing: '0.02em',
                }}
              >
                {scorer.name}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-black shadow-[0_8px_30px_rgba(0,0,0,0.3)] bg-black/10 flex items-center justify-center">
                <span className="text-6xl">⚽</span>
              </div>
            </motion.div>
          )}

          {/* Narrativa da jogada */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-md text-center text-black/80 leading-relaxed font-medium"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            }}
          >
            {narrative}
          </motion.p>

          {/* Pontos no ranking */}
          {points ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 400 }}
              className="rounded-full border-2 border-black bg-black/10 px-6 py-2"
            >
              <span
                className="font-display font-black text-black uppercase tracking-wider"
                style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)' }}
              >
                {points}
              </span>
            </motion.div>
          ) : null}
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
              className="mt-8 inline-flex items-center gap-3 rounded-xl border-2 border-black bg-black px-8 py-4 font-display font-black uppercase tracking-wider text-white transition-all hover:scale-105 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] active:scale-95 pointer-events-auto"
              style={{ fontSize: 'clamp(1rem, 3vw, 1.3rem)' }}
            >
              Voltar para a partida
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
