import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MomentumBarProps {
  /** Momentum value 0-1, where 0.5 is neutral, 0 is full away, 1 is full home */
  momentum: number;
  homeShort: string;
  awayShort: string;
  homeColor?: string;
  awayColor?: string;
}

export function MomentumBar({
  momentum,
  homeShort,
  awayShort,
  homeColor = '#FDE047',
  awayColor = '#FFFFFF',
}: MomentumBarProps) {
  // Convert 0-1 momentum to percentage for home team (0.5 = 50%)
  const homePercent = Math.round(momentum * 100);
  const awayPercent = 100 - homePercent;

  // Determine dominance level
  const homeDominant = homePercent >= 65;
  const awayDominant = awayPercent >= 65;
  const balanced = !homeDominant && !awayDominant;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Labels */}
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              scale: homeDominant ? [1, 1.15, 1] : 1,
              opacity: homeDominant ? 1 : 0.7,
            }}
            transition={{ duration: 0.6, repeat: homeDominant ? Infinity : 0 }}
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: homeColor }}
          >
            {homeShort}
          </motion.div>
          {homeDominant && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-[10px]"
            >
              🔥
            </motion.span>
          )}
        </div>

        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
          Domínio
        </div>

        <div className="flex items-center gap-2">
          {awayDominant && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-[10px]"
            >
              🔥
            </motion.span>
          )}
          <motion.div
            animate={{
              scale: awayDominant ? [1, 1.15, 1] : 1,
              opacity: awayDominant ? 1 : 0.7,
            }}
            transition={{ duration: 0.6, repeat: awayDominant ? Infinity : 0 }}
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: awayColor }}
          >
            {awayShort}
          </motion.div>
        </div>
      </div>

      {/* Bar Container */}
      <div className="relative h-8 bg-black/60 rounded-lg overflow-hidden border border-white/10 shadow-lg">
        {/* Center Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/20 z-10" />

        {/* Home Side Fill */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 transition-colors duration-300"
          style={{
            background: `linear-gradient(to right, ${homeColor}00, ${homeColor})`,
          }}
          animate={{
            width: `${homePercent}%`,
            opacity: homePercent > 50 ? 0.3 + (homePercent - 50) / 100 : 0.1,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {/* Away Side Fill */}
        <motion.div
          className="absolute right-0 top-0 bottom-0 transition-colors duration-300"
          style={{
            background: `linear-gradient(to left, ${awayColor}00, ${awayColor})`,
          }}
          animate={{
            width: `${awayPercent}%`,
            opacity: awayPercent > 50 ? 0.3 + (awayPercent - 50) / 100 : 0.1,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {/* Percentage Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-3 z-20">
          <motion.span
            animate={{
              opacity: homePercent > 15 ? 1 : 0,
              scale: homeDominant ? 1.1 : 1,
            }}
            className="text-xs font-black tabular-nums"
            style={{ color: homeColor }}
          >
            {homePercent}%
          </motion.span>

          {balanced && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-[10px] text-white/60 font-bold uppercase tracking-wider"
            >
              Equilibrado
            </motion.span>
          )}

          <motion.span
            animate={{
              opacity: awayPercent > 15 ? 1 : 0,
              scale: awayDominant ? 1.1 : 1,
            }}
            className="text-xs font-black tabular-nums"
            style={{ color: awayColor }}
          >
            {awayPercent}%
          </motion.span>
        </div>

        {/* Pulse Effect on Dominance */}
        {(homeDominant || awayDominant) && (
          <motion.div
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              homeDominant ? 'left-0' : 'right-0',
            )}
            style={{
              width: `${homeDominant ? homePercent : awayPercent}%`,
              background: homeDominant
                ? `linear-gradient(to right, ${homeColor}00, ${homeColor}40)`
                : `linear-gradient(to left, ${awayColor}00, ${awayColor}40)`,
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Momentum Indicator Arrow */}
      <div className="relative h-3 mt-1">
        <motion.div
          className="absolute top-0 flex items-center justify-center"
          animate={{
            left: `calc(${homePercent}% - 8px)`,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div
            className="w-4 h-4 rotate-45 border-2 shadow-lg"
            style={{
              borderColor: homePercent > 50 ? homeColor : awayColor,
              backgroundColor: homePercent > 50 ? homeColor : awayColor,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
