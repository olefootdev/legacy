/**
 * Efeito Visual no Campo quando Momentum Extremo — Melhoria #9
 * Overlay sutil + partículas quando um time domina completamente.
 */
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { MomentumState } from '@/components/matchday/MomentumVisualBar';

interface MomentumFieldEffectProps {
  momentum: MomentumState | undefined;
  className?: string;
}

export function MomentumFieldEffect({ momentum, className }: MomentumFieldEffectProps) {
  if (!momentum) return null;

  const homeDominant = momentum.home >= 80;
  const awayDominant = momentum.away >= 80;

  if (!homeDominant && !awayDominant) return null;

  const isHome = homeDominant;
  const intensity = isHome ? momentum.home : momentum.away;
  const opacity = Math.min(0.25, (intensity - 80) / 100); // 0.05 a 0.25

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Gradient overlay */}
      <motion.div
        className={cn(
          'absolute inset-0',
          isHome
            ? 'bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent'
            : 'bg-gradient-to-l from-blue-500/10 via-transparent to-transparent',
        )}
        animate={{ opacity: [opacity * 0.5, opacity, opacity * 0.5] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      />

      {/* Partículas flutuantes */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            'absolute h-2 w-2 rounded-full',
            isHome ? 'bg-yellow-400/30' : 'bg-blue-400/30',
          )}
          style={{
            top: `${20 + i * 15}%`,
            [isHome ? 'left' : 'right']: '-10px',
          }}
          animate={{
            [isHome ? 'x' : 'x']: isHome ? [0, 400, 0] : [0, -400, 0],
            y: [-20, 20, -20],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 4 + i * 0.5,
            ease: 'linear',
            delay: i * 0.3,
          }}
        />
      ))}

      {/* Pulso de energia nas laterais */}
      <motion.div
        className={cn(
          'absolute top-0 h-full w-1',
          isHome ? 'left-0 bg-yellow-400/40' : 'right-0 bg-blue-400/40',
        )}
        animate={{
          scaleY: [1, 1.5, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
