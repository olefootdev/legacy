import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Flame, Shield, TrendingUp, Zap, Clock, Gift } from 'lucide-react';
import type { DailyChallenge, ChallengeType } from '@/game/dailyChallenges';
import { cn } from '@/lib/utils';

interface DailyChallengesCardProps {
  challenges: DailyChallenge[];
  onClaimReward: (challengeId: string) => void;
  compact?: boolean;
}

const CHALLENGE_ICONS: Record<ChallengeType, typeof Trophy> = {
  win_matches: Trophy,
  score_goals: Target,
  win_streak: Flame,
  clean_sheet: Shield,
  comeback: TrendingUp,
  dominant_win: Zap,
  quick_goals: Clock,
};

const CHALLENGE_COLORS: Record<ChallengeType, string> = {
  win_matches: '#FDE047',
  score_goals: '#F59E0B',
  win_streak: '#EF4444',
  clean_sheet: '#3B82F6',
  comeback: '#8B5CF6',
  dominant_win: '#10B981',
  quick_goals: '#EC4899',
};

export function DailyChallengesCard({ challenges, onClaimReward, compact = false }: DailyChallengesCardProps) {
  const allCompleted = challenges.every((c) => c.completed);
  const allClaimed = challenges.every((c) => c.claimed);
  const totalRewards = challenges.reduce((sum, c) => sum + c.reward, 0);
  const earnedRewards = challenges.filter((c) => c.completed).reduce((sum, c) => sum + c.reward, 0);

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-black border border-neon-yellow/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-neon-yellow" />
            <h3
              className="text-neon-yellow uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.15em',
              }}
            >
              Desafios Diários
            </h3>
          </div>
          <div className="text-xs text-white/60">
            {challenges.filter((c) => c.completed).length}/{challenges.length}
          </div>
        </div>

        <div className="space-y-2">
          {challenges.map((challenge) => {
            const Icon = CHALLENGE_ICONS[challenge.type];
            const color = CHALLENGE_COLORS[challenge.type];
            const progressPercent = (challenge.progress / challenge.target) * 100;

            return (
              <div
                key={challenge.id}
                className={cn(
                  'bg-black/40 border rounded-lg p-3 transition-all',
                  challenge.completed ? 'border-neon-yellow/50' : 'border-white/10',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p
                        className="text-white/90 text-sm font-bold truncate"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {challenge.title}
                      </p>
                      <span className="text-xs text-neon-yellow font-bold whitespace-nowrap">
                        +{challenge.reward} EXP
                      </span>
                    </div>

                    <p className="text-xs text-white/60 mb-2">{challenge.description}</p>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-black/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: challenge.completed
                            ? `linear-gradient(to right, ${color}, #FDE047)`
                            : `linear-gradient(to right, ${color}80, ${color})`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-white/50 font-bold tabular-nums">
                        {challenge.progress}/{challenge.target}
                      </span>

                      {challenge.completed && !challenge.claimed && (
                        <motion.button
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => onClaimReward(challenge.id)}
                          className="text-[10px] bg-neon-yellow text-black px-2 py-0.5 rounded font-bold uppercase"
                          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
                        >
                          Resgatar
                        </motion.button>
                      )}

                      {challenge.claimed && (
                        <span className="text-[10px] text-green-500 font-bold">✓ Resgatado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Progress */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60 uppercase" style={{ fontFamily: 'var(--font-display)' }}>
              Progresso Total
            </span>
            <span className="text-sm text-neon-yellow font-bold tabular-nums">
              {earnedRewards}/{totalRewards} EXP
            </span>
          </div>
        </div>

        {allCompleted && !allClaimed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-gradient-to-r from-neon-yellow/20 to-yellow-600/20 border border-neon-yellow rounded-lg p-3 text-center"
          >
            <p className="text-xs text-neon-yellow font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
              🎉 Todos os desafios completos!
            </p>
          </motion.div>
        )}
      </div>
    );
  }

  // Full version (not compact)
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-neon-yellow/30 rounded-xl p-6 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gift className="w-6 h-6 text-neon-yellow" />
          <h2
            className="text-neon-yellow uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.2em',
            }}
          >
            Desafios Diários
          </h2>
        </div>
        <div className="h-1 w-20 bg-neon-yellow mx-auto mb-3" />
        <p className="text-sm text-white/60">Completa desafios para ganhar recompensas extras</p>
      </div>

      {/* Challenges */}
      <div className="space-y-4 mb-6">
        {challenges.map((challenge, index) => {
          const Icon = CHALLENGE_ICONS[challenge.type];
          const color = CHALLENGE_COLORS[challenge.type];
          const progressPercent = (challenge.progress / challenge.target) * 100;

          return (
            <motion.div
              key={challenge.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'bg-black/40 border-2 rounded-xl p-4 transition-all',
                challenge.completed ? 'border-neon-yellow/50 shadow-lg shadow-neon-yellow/20' : 'border-white/10',
              )}
            >
              <div className="flex items-start gap-4">
                <motion.div
                  animate={{
                    scale: challenge.completed ? [1, 1.2, 1] : 1,
                    rotate: challenge.completed ? [0, 360] : 0,
                  }}
                  transition={{ duration: 0.6 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </motion.div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3
                        className="text-white font-bold mb-1"
                        style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}
                      >
                        {challenge.title}
                      </h3>
                      <p className="text-sm text-white/70">{challenge.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-neon-yellow font-black text-lg">+{challenge.reward}</span>
                      <span className="text-xs text-white/50 ml-1">EXP</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 bg-black/60 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: challenge.completed
                          ? `linear-gradient(to right, ${color}, #FDE047)`
                          : `linear-gradient(to right, ${color}80, ${color})`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60 font-bold tabular-nums">
                      {challenge.progress}/{challenge.target}
                    </span>

                    {challenge.completed && !challenge.claimed && (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => onClaimReward(challenge.id)}
                        className="bg-neon-yellow text-black px-4 py-1.5 rounded-lg font-bold uppercase text-sm"
                        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
                      >
                        Resgatar
                      </motion.button>
                    )}

                    {challenge.claimed && (
                      <span className="text-sm text-green-500 font-bold">✓ Resgatado</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-neon-yellow/10 to-yellow-600/10 border border-neon-yellow/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-white uppercase font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Total Disponível
          </span>
          <span className="text-neon-yellow font-black text-2xl tabular-nums">
            {earnedRewards}/{totalRewards} EXP
          </span>
        </div>
      </div>

      {allCompleted && !allClaimed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 bg-gradient-to-r from-neon-yellow/20 to-yellow-600/20 border-2 border-neon-yellow rounded-lg p-4 text-center"
        >
          <p className="text-neon-yellow font-bold uppercase" style={{ fontFamily: 'var(--font-display)' }}>
            🎉 Parabéns! Todos os desafios completos!
          </p>
        </motion.div>
      )}
    </div>
  );
}
