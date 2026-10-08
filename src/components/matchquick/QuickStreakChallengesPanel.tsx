/**
 * Sprint 3: Painel de Desafios Semanais
 * Mostra progresso e recompensas dos desafios de streak
 */

import { motion } from 'motion/react';
import { Trophy, Clock } from 'lucide-react';
import type { StreakChallenge } from '@/match/quickStreakChallenges';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

interface Props {
  challenges: StreakChallenge[];
  onClaimReward?: (challengeId: string) => void;
}

export function QuickStreakChallengesPanel({ challenges, onClaimReward }: Props) {
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
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
          <Trophy className="h-4 w-4 shrink-0 text-rua" aria-hidden />
          <span className="truncate">{L('Desafios semanais', 'Weekly challenges')}</span>
        </h3>
        <span className="flex shrink-0 items-center gap-1 font-prova text-[11px] font-bold text-mudo">
          <Clock className="h-3 w-3" aria-hidden />
          {formatTimeRemaining(challenges[0]?.expiresAt ?? '')}
        </span>
      </div>

      <ul className="flex flex-col">
        {challenges.map((challenge, i) => {
          const progress = Math.max(0, Math.min(100, (challenge.progress / challenge.target) * 100));
          const isCompleted = challenge.completed;

          return (
            <motion.li
              key={challenge.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="border-b border-linha py-3 last:border-b-0"
            >
              <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-voz text-[20px] leading-none text-papel">{challenge.name}</span>
                    {isCompleted && !challenge.claimed && (
                      <span className="bg-rua px-1.5 py-0.5 font-prova text-[10px] font-bold uppercase tracking-[0.08em] text-asfalto-27">
                        {L('✓ Completo', '✓ Complete')}
                      </span>
                    )}
                    {challenge.claimed && (
                      <span className="border-2 border-linha px-1.5 py-0.5 font-prova text-[10px] font-bold uppercase tracking-[0.08em] text-mudo">
                        {L('✓ Resgatado', '✓ Claimed')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-suave">{challenge.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                  <p className="font-impact text-[16px] leading-none tabular-nums text-papel">
                    +{challenge.reward.ole + challenge.reward.exp} EXP
                  </p>
                  {challenge.reward.item && (
                    <p className="font-prova text-[11px] font-bold text-suave">+{challenge.reward.item}</p>
                  )}
                  {isCompleted && !challenge.claimed && onClaimReward && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => onClaimReward(challenge.id)}
                      className="min-h-[36px] whitespace-nowrap bg-rua px-3 font-impact text-[14px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)]"
                    >
                      {L('Resgatar', 'Claim')} →
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Progresso — chapado, sem pílula */}
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">
                  {challenge.difficulty}
                </span>
                <div className="h-2 flex-1 overflow-hidden bg-linha">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, delay: i * 0.08 + 0.15 }}
                    className={cn('h-full', isCompleted ? 'bg-rua' : 'bg-papel')}
                  />
                </div>
                <span className="shrink-0 font-impact text-[14px] leading-none tabular-nums text-papel">
                  {challenge.progress}/{challenge.target}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
