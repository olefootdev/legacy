/**
 * Controles de Intensidade Tática
 * 5 opções: Defender | Posse | Contra-Ataque | Pressionar | Ataque Total
 */

import { motion } from 'motion/react';
import { Shield, CircleDot, Zap, Flame, Swords, type LucideIcon } from 'lucide-react';
import type { TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
import { TACTICAL_INTENSITY_PRESETS } from '@/match/quickTacticalIntensity';
import { cn } from '@/lib/utils';

interface Props {
  current: TacticalIntensityLevel;
  onChange: (level: TacticalIntensityLevel) => void;
  disabled?: boolean;
}

const INTENSITY_ICONS: Record<TacticalIntensityLevel, LucideIcon> = {
  defend: Shield,
  possession: CircleDot,
  counter: Zap,
  press: Flame,
  attack: Swords,
};

export function QuickTacticalIntensityControls({ current, onChange, disabled }: Props) {
  const levels: TacticalIntensityLevel[] = ['defend', 'possession', 'counter', 'press', 'attack'];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {levels.map((level) => {
        const preset = TACTICAL_INTENSITY_PRESETS[level];
        const isActive = current === level;
        const Icon = INTENSITY_ICONS[level];

        return (
          <motion.button
            key={level}
            onClick={() => onChange(level)}
            disabled={disabled || isActive}
            whileHover={!disabled && !isActive ? { scale: 1.05 } : {}}
            whileTap={!disabled && !isActive ? { scale: 0.95 } : {}}
            className={cn(
              'flex-1 min-w-[70px] p-2.5 rounded-lg border-2 transition-all',
              'flex flex-col items-center gap-1.5',
              isActive
                ? 'bg-neon-yellow border-neon-yellow shadow-[0_0_16px_rgba(253,224,71,0.4)]'
                : 'bg-black/60 border-white/20 hover:border-neon-yellow/40 hover:bg-black/80',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Icon className={cn('h-5 w-5', isActive ? 'text-black' : 'text-white')} />
            <span
              className={cn(
                'text-[10px] font-bold leading-tight text-center uppercase tracking-wider',
                isActive ? 'text-black' : 'text-white',
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {preset.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="intensity-indicator"
                className="w-full h-0.5 bg-black rounded-full"
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
