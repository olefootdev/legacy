/**
 * Sprint 3: Painel de Desafios Semanais
 * Mostra progresso e recompensas dos desafios de streak
 */

import { motion } from 'motion/react';
import { Trophy, Clock } from 'lucide-react';
import type { StreakChallenge } from '@/match/quickStreakChallenges';
import { getDifficultyColor, getDifficultyIcon } from '@/match/quickStreakChallenges';
import { cn } from '@/lib/utils';

interface Props {
  challenges: StreakChallenge[];
}

export function QuickStreakChallengesPanel({ challenges }: Props) {
  const formatTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Desafios Semanais
          </h3>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/40">
          <Clock className="w-3 h-3 text-white/60" />
          <span className="text-xs text-white/60">
            {formatTimeRemaining(challenges[0]?.expiresAt ?? '')}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {challenges.map((challenge, i) => {
          const progress = (challenge.progress / challenge.target) * 100;
          const isCompleted = challenge.completed;

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'p-3 rounded-lg border-2',
                isCompleted
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-black/40 border-white/20',
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-lg">{getDifficultyIcon(challenge.difficulty)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{challenge.name}</span>
                      {isCompleted && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">
                          ✓ Completo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">{challenge.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-yellow-400">
                    {challenge.reward.ole} OLE
                  </div>
                  <div className="text-xs text-blue-400">{challenge.reward.exp} EXP</div>
                  {challenge.reward.item && (
                    <div className="text-xs text-purple-400 mt-0.5">
                      +{challenge.reward.item}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={getDifficultyColor(challenge.difficulty)}>
                    {challenge.difficulty.toUpperCase()}
                  </span>
                  <span className="text-white/60 tabular-nums">
                    {challenge.progress}/{challenge.target}
                  </span>
                </div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
                    className={cn(
                      'h-full rounded-full',
                      isCompleted
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                        : 'bg-gradient-to-r from-yellow-400 to-orange-500',
                    )}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
