/**
 * Celebração de gol para Partida Rápida
 * Fundo preto + fontes amarela/branca + foto do jogador + CTA
 * Auto-dismiss em 5s ou ao clicar no CTA
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { L } from '@/i18n/L';
import { FitaRua } from '@/components/ui/Rua';

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

  // Ref pra estabilizar onDismiss e evitar reset dos timers a cada render do pai.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (disabled || triggerKey == null) return;

    setVisible(true);
    setShowCTA(false);

    // Mostrar CTA após 1.2s (era 2s — antecipado pra dar saída mais rápida)
    const ctaTimer = window.setTimeout(() => setShowCTA(true), 1200);

    // Auto-dismiss após 5s — timer estável (deps só dependem do triggerKey)
    const dismissTimer = window.setTimeout(() => {
      setVisible(false);
      onDismissRef.current();
    }, 5000);

    return () => {
      clearTimeout(ctaTimer);
      clearTimeout(dismissTimer);
    };
  }, [triggerKey, disabled]);

  // ESC fecha
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
        onDismissRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    onDismissRef.current();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="goal-celebration"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={handleDismiss}
        role="button"
        tabIndex={0}
        aria-label={L('Fechar celebração de gol', 'Close goal celebration')}
        className="rua-grao fixed inset-0 z-[9999] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-asfalto-27"
      >
        {/* Hint discreto no topo */}
        <p className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap font-prova text-[11px] font-bold uppercase tracking-[0.24em] text-mudo">
          {L('Toque pra continuar · ESC', 'Tap to continue · ESC')}
        </p>

        <motion.div
          initial={{ scale: 0.86, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-md flex-col items-center gap-5 px-5"
        >
          {/* GOL — spray amarelo gigante, como pichação no muro */}
          <h1
            className="font-spray font-black uppercase leading-[0.8] text-rua"
            style={{ fontSize: 'clamp(7rem, 40vw, 13rem)', letterSpacing: '-0.01em' }}
          >
            {L('Gol', 'Goal')}
          </h1>

          {/* Lambe do artilheiro: foto colada torta + fita adesiva */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, rotate: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: -3 }}
            transition={{ delay: 0.15 }}
            className="relative"
          >
            <span aria-hidden className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rotate-[5deg] bg-papel/70" />
            <div className="h-32 w-32 overflow-hidden border-[5px] border-papel bg-concreto sm:h-40 sm:w-40">
              {scorerPortrait ? (
                <img
                  src={scorerPortrait}
                  alt={scorerName}
                  className="h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-spray font-black text-[4.5rem] leading-none text-rua">
                  G
                </span>
              )}
            </div>
          </motion.div>

          <p
            className="text-center font-voz leading-[0.98] text-papel [overflow-wrap:anywhere]"
            style={{ fontSize: 'clamp(2.1rem, 10vw, 3.2rem)' }}
          >
            {scorerName}
          </p>

          {/* Narrativa da jogada */}
          {narrative && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="max-w-md text-center text-[15px] leading-snug text-suave"
            >
              {narrative}
            </motion.p>
          )}
        </motion.div>

        {/* CTA: Voltar para a partida */}
        <AnimatePresence>
          {showCTA && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleDismiss}
              className="mt-8 inline-flex min-h-[54px] items-center gap-3 bg-rua px-7 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
            >
              {L('Voltar pro jogo', 'Back to the match')}
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>

        <FitaRua tags={['#gol', '#correloko']} inclinacao={-3} className="absolute inset-x-0 bottom-10" />
      </motion.div>
    </AnimatePresence>
  );
}
