import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export type NearMissType =
  | 'close_shot' // Chute que passou perto
  | 'post_hit' // Bola na trave
  | 'great_save' // Defesa incrível do goleiro
  | 'almost_goal' // Quase gol (linha do gol)
  | 'close_win' // Vitória por 1 gol de diferença
  | 'close_loss'; // Derrota por 1 gol de diferença

interface NearMissEvent {
  type: NearMissType;
  message: string;
  intensity: 'low' | 'medium' | 'high';
}

interface NearMissOverlayProps {
  event: NearMissEvent | null;
  onDismiss: () => void;
}

const NEAR_MISS_CONFIG = {
  close_shot: {
    icon: '😱',
    color: '#F59E0B',
    bgGradient: 'from-amber-500/20 to-orange-600/20',
    borderColor: 'border-amber-500/50',
    shake: true,
  },
  post_hit: {
    icon: '🎯',
    color: '#EF4444',
    bgGradient: 'from-red-500/20 to-red-600/20',
    borderColor: 'border-red-500/50',
    shake: true,
  },
  great_save: {
    icon: '🧤',
    color: '#3B82F6',
    bgGradient: 'from-blue-500/20 to-cyan-600/20',
    borderColor: 'border-blue-500/50',
    shake: false,
  },
  almost_goal: {
    icon: '😤',
    color: '#EF4444',
    bgGradient: 'from-red-500/20 to-pink-600/20',
    borderColor: 'border-red-500/50',
    shake: true,
  },
  close_win: {
    icon: '😅',
    color: '#10B981',
    bgGradient: 'from-green-500/20 to-emerald-600/20',
    borderColor: 'border-green-500/50',
    shake: false,
  },
  close_loss: {
    icon: '💔',
    color: '#EF4444',
    bgGradient: 'from-red-500/20 to-red-700/20',
    borderColor: 'border-red-500/50',
    shake: true,
  },
};

export function NearMissOverlay({ event, onDismiss }: NearMissOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [event, onDismiss]);

  if (!event) return null;

  const config = NEAR_MISS_CONFIG[event.type];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            ...(config.shake && {
              x: [0, -10, 10, -10, 10, 0],
            }),
          }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          transition={{
            duration: 0.4,
            x: { duration: 0.5, delay: 0.2 },
          }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
        >
          <div
            className={`bg-gradient-to-br ${config.bgGradient} backdrop-blur-md border-2 ${config.borderColor} rounded-xl px-6 py-4 shadow-2xl min-w-[280px] max-w-md`}
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  rotate: config.shake ? [0, -15, 15, -15, 15, 0] : 0,
                }}
                transition={{
                  duration: 0.6,
                  repeat: event.intensity === 'high' ? 1 : 0,
                }}
                className="text-4xl"
              >
                {config.icon}
              </motion.div>

              {/* Message */}
              <div className="flex-1">
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white font-bold leading-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    letterSpacing: '0.05em',
                    color: config.color,
                  }}
                >
                  {event.message}
                </motion.p>
              </div>

              {/* Intensity Indicator */}
              {event.intensity === 'high' && (
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <AlertTriangle className="w-5 h-5" style={{ color: config.color }} />
                </motion.div>
              )}
            </div>

            {/* Progress Bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 2.5, ease: 'linear' }}
              className="h-1 bg-white/30 rounded-full mt-3"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Componente para mostrar "quase conseguiu" após derrota apertada
 */
interface NearMissMotivationProps {
  visible: boolean;
  scoreDiff: number;
  onClose: () => void;
}

export function NearMissMotivation({ visible, scoreDiff, onClose }: NearMissMotivationProps) {
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative bg-gradient-to-br from-gray-900 to-black border-2 border-red-500/50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, -5, 5, 0],
            }}
            transition={{ duration: 0.8, repeat: 2 }}
            className="text-center mb-4"
          >
            <span className="text-7xl">😤</span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center text-red-400 uppercase mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.15em',
            }}
          >
            Tão perto!
          </motion.h2>

          {/* Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-6"
          >
            <p
              className="text-white/90 mb-2"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: '18px',
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}
            >
              Perdeste por apenas {scoreDiff} {scoreDiff === 1 ? 'golo' : 'golos'}
            </p>
            <p className="text-white/60 text-sm">
              Estiveste muito perto da vitória. Tenta outra vez!
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-black/40 border border-red-500/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center justify-center gap-2 text-red-400">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
                Estás a melhorar
              </span>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg font-bold uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              letterSpacing: '0.15em',
            }}
          >
            Vou conseguir!
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook para detectar near-miss events durante a partida
 */
export function useNearMissDetection() {
  const [nearMissEvent, setNearMissEvent] = useState<NearMissEvent | null>(null);

  const triggerNearMiss = (type: NearMissType, message: string, intensity: 'low' | 'medium' | 'high' = 'medium') => {
    setNearMissEvent({ type, message, intensity });
  };

  const clearNearMiss = () => {
    setNearMissEvent(null);
  };

  return {
    nearMissEvent,
    triggerNearMiss,
    clearNearMiss,
  };
}

/**
 * Detecta near-miss baseado em probabilidades de chute
 */
export function detectShotNearMiss(shotProbs: { goal: number; save: number; out: number }): NearMissEvent | null {
  const { goal, save, out } = shotProbs;

  // Chute muito perto de ser gol (30-45% de chance)
  if (goal >= 0.30 && goal < 0.45 && save > out) {
    return {
      type: 'great_save',
      message: 'Defesa incrível! Quase foi golo!',
      intensity: 'high',
    };
  }

  // Chute que passou raspando (25-40% de chance de gol)
  if (goal >= 0.25 && goal < 0.40 && out > save) {
    return {
      type: 'close_shot',
      message: 'Por centímetros! Passou muito perto!',
      intensity: 'medium',
    };
  }

  // Chute muito bom mas defendido (40-50% de chance)
  if (goal >= 0.40 && goal < 0.50 && save > 0.3) {
    return {
      type: 'great_save',
      message: 'Que defesa! Era quase golo certo!',
      intensity: 'high',
    };
  }

  return null;
}
