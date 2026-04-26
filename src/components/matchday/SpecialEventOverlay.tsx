/**
 * Overlay de Evento Especial — Fase 2 Core Gameplay #3
 * Mostra animação dramática quando evento raro acontece.
 */
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Heart, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpecialEvent } from '@/match/specialEvents';

interface SpecialEventOverlayProps {
  event: SpecialEvent | null;
  onDismiss: () => void;
}

const EVENT_CONFIGS = {
  bicycle_kick: {
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500',
    textColor: 'text-purple-400',
    title: 'BICICLETA!',
    emoji: '🚴',
  },
  thunderstrike: {
    icon: Zap,
    color: 'from-yellow-500 to-orange-500',
    textColor: 'text-yellow-400',
    title: 'BOMBAÇO!',
    emoji: '⚡',
  },
  goalkeeper_assist: {
    icon: TrendingUp,
    color: 'from-cyan-500 to-blue-500',
    textColor: 'text-cyan-400',
    title: 'LANÇAMENTO PERFEITO!',
    emoji: '🎯',
  },
  injury_scare: {
    icon: Heart,
    color: 'from-red-500 to-orange-500',
    textColor: 'text-red-400',
    title: 'PANCADA FORTE!',
    emoji: '💥',
  },
  crowd_roar_boost: {
    icon: Users,
    color: 'from-green-500 to-emerald-500',
    textColor: 'text-green-400',
    title: 'TORCIDA EM ÊXTASE!',
    emoji: '🔥',
  },
};

export function SpecialEventOverlay({ event, onDismiss }: SpecialEventOverlayProps) {
  if (!event) return null;

  const config = EVENT_CONFIGS[event.type];
  const Icon = config.icon;

  // Auto-dismiss após 3 segundos
  setTimeout(() => onDismiss(), 3000);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0.5, rotate: 10 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative text-center"
        >
          {/* Emoji gigante */}
          <motion.div
            className="mb-4 text-8xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: 2,
            }}
          >
            {config.emoji}
          </motion.div>

          {/* Título */}
          <motion.h1
            className={cn(
              'mb-3 font-display text-6xl font-black uppercase tracking-tight sm:text-7xl',
              config.textColor
            )}
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 0.8,
              repeat: 2,
            }}
          >
            {config.title}
          </motion.h1>

          {/* Narrativa */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mx-auto max-w-2xl px-4 text-xl font-bold text-white sm:text-2xl"
          >
            {event.narrative.split('—')[1]?.trim() || event.narrative}
          </motion.p>

          {/* Efeito */}
          {event.effect && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 flex items-center justify-center gap-2"
            >
              {event.effect.xGBonus && (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-400">
                  +{Math.round((event.effect.xGBonus - 1) * 100)}% chance de gol
                </span>
              )}
              {event.effect.accuracyBoost && (
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-bold text-blue-400">
                  +{Math.round(event.effect.accuracyBoost * 100)}% precisão por {event.effect.durationMinutes} min
                </span>
              )}
              {event.effect.fatigueIncrease && (
                <span className="rounded-full bg-red-500/20 px-3 py-1 text-sm font-bold text-red-400">
                  Sentindo a pancada por {event.effect.durationMinutes} min
                </span>
              )}
            </motion.div>
          )}

          {/* Partículas de fundo */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'absolute h-2 w-2 rounded-full',
                  `bg-gradient-to-br ${config.color}`
                )}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  delay: Math.random() * 0.5,
                  repeat: Infinity,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <motion.div
            className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div
              className={cn('h-full', `bg-gradient-to-r ${config.color}`)}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 3, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
