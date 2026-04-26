/**
 * Sprint 2: Controles de Intensidade Tática
 * 3 botões: Conservar | Equilibrado | Sobrecarregar
 */

import { motion } from 'motion/react';
import type { TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
import { TACTICAL_INTENSITY_PRESETS } from '@/match/quickTacticalIntensity';
import { cn } from '@/lib/utils';

interface Props {
  current: TacticalIntensityLevel;
  onChange: (level: TacticalIntensityLevel) => void;
  disabled?: boolean;
}

export function QuickTacticalIntensityControls({ current, onChange, disabled }: Props) {
  const levels: TacticalIntensityLevel[] = ['conserve', 'balanced', 'overload'];

  return (
    <div className="flex items-center gap-2">
      {levels.map((level) => {
        const preset = TACTICAL_INTENSITY_PRESETS[level];
        const isActive = current === level;

        return (
          <motion.button
            key={level}
            onClick={() => onChange(level)}
            disabled={disabled || isActive}
            whileHover={!disabled && !isActive ? { scale: 1.05 } : {}}
            whileTap={!disabled && !isActive ? { scale: 0.95 } : {}}
            className={cn(
              'flex-1 p-2 rounded-lg border-2 transition-all',
              'flex flex-col items-center gap-1',
              isActive
                ? 'bg-yellow-500/20 border-yellow-400 shadow-lg shadow-yellow-500/20'
                : 'bg-black/40 border-white/20 hover:border-white/40',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className="text-xl">{preset.icon}</span>
            <span className="text-xs font-bold text-white">{preset.label}</span>
            {isActive && (
              <motion.div
                layoutId="intensity-indicator"
                className="w-full h-0.5 bg-yellow-400 rounded-full"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export function QuickTacticalIntensityInfo({ level }: { level: TacticalIntensityLevel }) {
  const preset = TACTICAL_INTENSITY_PRESETS[level];

  return (
    <motion.div
      key={level}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-2 rounded-lg bg-black/30 border border-white/10"
    >
      <p className="text-xs text-white/70 text-center">{preset.description}</p>
    </motion.div>
  );
}
