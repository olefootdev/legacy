import { motion } from 'framer-motion';
import type { QuickMatchStreak } from '@/game/quickMatchStreak';

interface StreakBarProps {
  streak: QuickMatchStreak | undefined;
}

export function StreakBar({ streak }: StreakBarProps) {
  if (!streak || streak.current === 0) return null;

  const current = streak.current;
  const multiplier = streak.multiplier;
  const isHot = current >= 5;
  const isOnFire = current >= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-black/90 border-2 border-neon-yellow rounded-lg px-6 py-3 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* Fire Icon */}
          <motion.div
            animate={{
              scale: isOnFire ? [1, 1.2, 1] : isHot ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-3xl"
          >
            {isOnFire ? '🔥' : isHot ? '⚡' : '🎯'}
          </motion.div>

          {/* Streak Counter */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <motion.span
                key={current}
                initial={{ scale: 1.5, color: '#FDE047' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="text-3xl font-black"
              >
                {current}
              </motion.span>
              <span className="text-sm text-gray-400 uppercase tracking-wider">
                vitórias seguidas
              </span>
            </div>

            {/* Multiplier Badge */}
            {multiplier > 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-1 bg-neon-yellow text-black px-2 py-0.5 rounded text-xs font-bold"
              >
                {multiplier}x RECOMPENSAS
              </motion.div>
            )}
          </div>

          {/* Best Streak */}
          {streak.best > current && (
            <div className="ml-4 pl-4 border-l border-gray-700 text-xs text-gray-500">
              <div>Recorde</div>
              <div className="font-bold text-gray-400">{streak.best}</div>
            </div>
          )}
        </div>

        {/* Progress to Next Tier */}
        {current < 10 && (
          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Próximo nível</span>
              <span>
                {current >= 7 ? '10' : current >= 5 ? '7' : current >= 3 ? '5' : '3'} vitórias
              </span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    current >= 7
                      ? ((current - 7) / 3) * 100
                      : current >= 5
                        ? ((current - 5) / 2) * 100
                        : current >= 3
                          ? ((current - 3) / 2) * 100
                          : (current / 3) * 100
                  }%`,
                }}
                className="h-full bg-gradient-to-r from-neon-yellow to-yellow-300"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
