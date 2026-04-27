/**
 * Overlay de Momentum Shift Dramático — Melhoria #7
 * Mostra fullscreen quando momentum vira drasticamente (40+ pontos em 2 min).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MomentumState } from '@/components/matchday/MomentumVisualBar';

interface MomentumShiftDetectorProps {
  momentum: MomentumState | undefined;
  homeShort: string;
  awayShort: string;
}

interface ShiftEvent {
  newLeader: string;
  oldLeader: string;
  delta: number;
  timestamp: number;
}

const SHIFT_THRESHOLD = 40; // mudança de 40+ pontos
const TIME_WINDOW_MS = 120_000; // em 2 minutos

export function MomentumShiftOverlay({ momentum, homeShort, awayShort }: MomentumShiftDetectorProps) {
  const [shiftEvent, setShiftEvent] = useState<ShiftEvent | null>(null);
  const [prevMomentum, setPrevMomentum] = useState<MomentumState | null>(null);
  const [lastShiftTime, setLastShiftTime] = useState<number>(0);

  useEffect(() => {
    if (!momentum || !prevMomentum) {
      setPrevMomentum(momentum ?? null);
      return;
    }

    const now = Date.now();
    const timeSinceLastShift = now - lastShiftTime;

    // Só detecta shift se passou tempo suficiente desde o último
    if (timeSinceLastShift < TIME_WINDOW_MS) {
      setPrevMomentum(momentum);
      return;
    }

    const homeDelta = momentum.home - prevMomentum.home;
    const awayDelta = momentum.away - prevMomentum.away;

    // Detecta virada dramática
    let shift: ShiftEvent | null = null;

    // Casa virou o jogo
    if (homeDelta >= SHIFT_THRESHOLD && prevMomentum.home < prevMomentum.away && momentum.home > momentum.away) {
      shift = {
        newLeader: homeShort,
        oldLeader: awayShort,
        delta: homeDelta,
        timestamp: now,
      };
    }
    // Visitante virou o jogo
    else if (awayDelta >= SHIFT_THRESHOLD && prevMomentum.away < prevMomentum.home && momentum.away > momentum.home) {
      shift = {
        newLeader: awayShort,
        oldLeader: homeShort,
        delta: awayDelta,
        timestamp: now,
      };
    }

    if (shift) {
      setShiftEvent(shift);
      setLastShiftTime(now);
      // Auto-dismiss após 3 segundos
      setTimeout(() => setShiftEvent(null), 3000);
    }

    setPrevMomentum(momentum);
  }, [momentum, prevMomentum, homeShort, awayShort, lastShiftTime]);

  return (
    <AnimatePresence>
      {shiftEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={() => setShiftEvent(null)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative text-center"
          >
            {/* Ícone animado */}
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Zap className="h-10 w-10 text-white" strokeWidth={3} />
            </motion.div>

            {/* Título principal */}
            <motion.h1
              className="mb-4 font-display text-6xl font-black uppercase tracking-tight text-yellow-400 sm:text-7xl"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 1,
                repeat: 2,
                ease: 'easeInOut',
              }}
            >
              VIRADA DE JOGO!
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-2 text-2xl font-bold text-white sm:text-3xl"
            >
              {shiftEvent.newLeader} assumiu o controle!
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-gray-400"
            >
              +{shiftEvent.delta} momentum em 2 minutos
            </motion.p>

            {/* Indicador de auto-dismiss */}
            <motion.div
              className="mx-auto mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <motion.div
                className="h-full bg-yellow-400"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
