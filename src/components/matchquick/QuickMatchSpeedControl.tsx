/**
 * Controle de velocidade da partida Quick Match
 */

import { motion } from 'motion/react';
import { Play, Pause, FastForward, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchSpeed } from '@/hooks/useMatchSimulation';
import type { ReactNode } from 'react';

interface QuickMatchSpeedControlProps {
  speed: MatchSpeed;
  isPaused: boolean;
  onSpeedChange: (speed: MatchSpeed) => void;
  onPauseToggle: () => void;
  disabled?: boolean;
}

const SPEED_OPTIONS: { value: MatchSpeed; label: string; icon: ReactNode; color: string }[] = [
  { value: '1x', label: '1x', icon: <Play className="w-4 h-4" />, color: 'text-green-400' },
  { value: '2x', label: '2x', icon: <FastForward className="w-4 h-4" />, color: 'text-blue-400' },
  { value: '4x', label: '4x', icon: <FastForward className="w-4 h-4" />, color: 'text-purple-400' },
  { value: 'auto', label: 'Auto', icon: <Zap className="w-4 h-4" />, color: 'text-yellow-400' },
];

export function QuickMatchSpeedControl({
  speed,
  isPaused,
  onSpeedChange,
  onPauseToggle,
  disabled = false,
}: QuickMatchSpeedControlProps) {
  return (
    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
      {/* Pause/Play */}
      <button
        onClick={onPauseToggle}
        disabled={disabled}
        className={cn(
          'p-2 rounded-md transition-colors',
          'hover:bg-white/10 active:scale-95',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        title={isPaused ? 'Retomar' : 'Pausar'}
      >
        {isPaused ? (
          <Play className="w-5 h-5 text-green-400" />
        ) : (
          <Pause className="w-5 h-5 text-yellow-400" />
        )}
      </button>

      <div className="w-px h-6 bg-white/20" />

      {/* Speed buttons */}
      <div className="flex items-center gap-1">
        {SPEED_OPTIONS.map((option) => {
          const isActive = speed === option.value;
          return (
            <motion.button
              key={option.value}
              onClick={() => onSpeedChange(option.value)}
              disabled={disabled}
              className={cn(
                'relative px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                'hover:bg-white/10 active:scale-95',
                isActive && 'bg-white/20',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              whileTap={{ scale: 0.95 }}
              title={
                option.value === 'auto'
                  ? 'Pula para próximo evento importante'
                  : `Velocidade ${option.label}`
              }
            >
              <div className="flex items-center gap-1.5">
                <span className={cn(isActive && option.color)}>{option.icon}</span>
                <span className={cn('text-white/80', isActive && 'text-white font-bold')}>
                  {option.label}
                </span>
              </div>

              {isActive && (
                <motion.div
                  layoutId="speed-indicator"
                  className="absolute inset-0 border-2 border-yellow-400/50 rounded-md"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Speed description */}
      <div className="ml-2 text-xs text-white/60">
        {speed === 'auto' ? 'Eventos importantes' : `Velocidade ${speed}`}
      </div>
    </div>
  );
}
