import { motion } from 'framer-motion';
import type { QuickMatchStreak } from '@/game/quickMatchStreak';

import { L } from '@/i18n/L';
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
      <div className="-rotate-1 bg-concreto border-[3px] border-rua px-5 py-3">
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
                initial={{ scale: 1.5, color: '#F2E61E' }}
                animate={{ scale: 1, color: '#EEE9DF' }}
                className="font-spray text-[40px] font-black leading-none tabular-nums"
              >
                {current}
              </motion.span>
              <span className="font-voz text-[20px] leading-none text-suave">
                {L('vitórias seguidas', 'wins in a row')}
              </span>
            </div>

            {/* Multiplier Badge */}
            {multiplier > 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-1 self-start bg-rua px-2 py-0.5 font-prova text-[11px] font-bold text-asfalto-27"
              >
                {multiplier}x {L('RECOMPENSAS', 'REWARDS')}
              </motion.div>
            )}
          </div>

          {/* Best Streak */}
          {streak.best > current && (
            <div className="ml-4 border-l border-linha pl-4 font-prova text-[11px] text-mudo">
              <div>{L('Recorde', 'Best')}</div>
              <div className="font-impact text-[20px] leading-none text-ouro-27">{streak.best}</div>
            </div>
          )}
        </div>

        {/* Progress to Next Tier */}
        {current < 10 && (
          <div className="mt-2 border-t border-linha pt-2">
            <div className="mb-1 flex justify-between font-prova text-[11px] text-mudo">
              <span>{L('Próximo nível', 'Next tier')}</span>
              <span>
                {current >= 7 ? '10' : current >= 5 ? '7' : current >= 3 ? '5' : '3'} {L('vitórias', 'wins')}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden bg-linha">
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
                className="h-full bg-rua"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
