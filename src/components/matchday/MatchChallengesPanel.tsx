/**
 * Painel de Desafios in-match — Fase 3 Polish #10
 * Mostra desafios ativos e notifica quando completados.
 */
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, CheckCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchChallenge } from '@/match/matchChallenges';

interface MatchChallengesPanelProps {
  challenges: MatchChallenge[];
  progress: Map<string, number>;
  completedIds: Set<string>;
  className?: string;
}

export function MatchChallengesPanel({ challenges, progress, completedIds, className }: MatchChallengesPanelProps) {
  const activeChallenges = challenges.filter(c => !completedIds.has(c.id));

  if (activeChallenges.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 px-2">
        <Trophy className="h-4 w-4 text-yellow-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
          Desafios
        </span>
      </div>

      <div className="space-y-1.5">
        {activeChallenges.slice(0, 3).map((challenge) => {
          const challengeProgress = progress.get(challenge.id) ?? 0;
          const isNearComplete = challengeProgress >= 80;

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'relative overflow-hidden rounded-lg border bg-black/40 p-2 backdrop-blur-sm',
                isNearComplete ? 'border-yellow-400/50' : 'border-white/10',
              )}
            >
              {/* Progress bar de fundo */}
              {challengeProgress > 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-transparent" style={{ width: `${challengeProgress}%` }} />
              )}

              <div className="relative flex items-center gap-2">
                {/* Icon */}
                <span className="text-xl">{challenge.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">{challenge.title}</h4>
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                      challenge.difficulty === 'easy' && 'bg-green-500/20 text-green-400',
                      challenge.difficulty === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                      challenge.difficulty === 'hard' && 'bg-red-500/20 text-red-400',
                    )}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">{challenge.description}</p>

                  {/* Reward */}
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className="text-yellow-400">+{challenge.reward.ole} OLE</span>
                    <span className="text-blue-400">+{challenge.reward.exp} EXP</span>
                  </div>
                </div>

                {/* Progress */}
                {challengeProgress > 0 && (
                  <div className="text-right">
                    <div className={cn(
                      'text-xs font-bold tabular-nums',
                      isNearComplete ? 'text-yellow-400' : 'text-gray-400'
                    )}>
                      {Math.round(challengeProgress)}%
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Notificação de desafio completado */
interface ChallengeCompletedNotificationProps {
  challenge: MatchChallenge | null;
  onDismiss: () => void;
}

export function ChallengeCompletedNotification({ challenge, onDismiss }: ChallengeCompletedNotificationProps) {
  if (!challenge) return null;

  // Auto-dismiss após 4 segundos
  setTimeout(() => onDismiss(), 4000);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed left-1/2 top-20 z-[180] -translate-x-1/2"
      >
        <motion.div
          className="relative overflow-hidden rounded-xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-4 shadow-2xl backdrop-blur-md"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          {/* Sparkles */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-yellow-400"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: Math.random() * 0.5,
                  repeat: Infinity,
                }}
              />
            ))}
          </div>

          <div className="relative flex items-center gap-3">
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400">
              <Trophy className="h-6 w-6 text-black" />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-green-400">
                  Desafio Completo!
                </span>
              </div>
              <h3 className="mt-1 text-lg font-black uppercase text-white">
                {challenge.icon} {challenge.title}
              </h3>
              <div className="mt-1 flex items-center gap-3 text-sm font-bold">
                <span className="text-yellow-400">+{challenge.reward.ole} OLE</span>
                <span className="text-blue-400">+{challenge.reward.exp} EXP</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-yellow-400"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 4, ease: 'linear' }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
