import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Zap, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Reward {
  type: 'exp' | 'streak' | 'bonus' | 'achievement';
  label: string;
  value: number | string;
  icon: 'trophy' | 'trending' | 'zap' | 'star';
  color: string;
}

interface InstantRewardsProps {
  visible: boolean;
  result: 'win' | 'draw' | 'loss';
  baseExp: number;
  streakMultiplier?: number;
  streakCount?: number;
  bonuses?: Array<{ label: string; value: number }>;
  onClose: () => void;
}

const ICON_MAP = {
  trophy: Trophy,
  trending: TrendingUp,
  zap: Zap,
  star: Star,
};

export function InstantRewards({
  visible,
  result,
  baseExp,
  streakMultiplier = 1,
  streakCount = 0,
  bonuses = [],
  onClose,
}: InstantRewardsProps) {
  const [showRewards, setShowRewards] = useState(false);
  const [currentRewardIndex, setCurrentRewardIndex] = useState(-1);

  const totalExp = Math.round(baseExp * streakMultiplier + bonuses.reduce((sum, b) => sum + b.value, 0));

  const rewards: Reward[] = [
    {
      type: 'exp',
      label: result === 'win' ? 'Vitória' : result === 'draw' ? 'Empate' : 'Participação',
      value: baseExp,
      icon: 'trophy',
      color: result === 'win' ? '#FDE047' : result === 'draw' ? '#60A5FA' : '#9CA3AF',
    },
  ];

  if (streakMultiplier > 1 && streakCount > 0) {
    rewards.push({
      type: 'streak',
      label: `Streak ${streakCount}x`,
      value: `${streakMultiplier}x`,
      icon: 'zap',
      color: '#F59E0B',
    });
  }

  bonuses.forEach((bonus) => {
    rewards.push({
      type: 'bonus',
      label: bonus.label,
      value: bonus.value,
      icon: 'star',
      color: '#A78BFA',
    });
  });

  useEffect(() => {
    if (visible) {
      setShowRewards(false);
      setCurrentRewardIndex(-1);
      const timer = setTimeout(() => {
        setShowRewards(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  useEffect(() => {
    if (showRewards && currentRewardIndex < rewards.length - 1) {
      const timer = setTimeout(() => {
        setCurrentRewardIndex((i) => i + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [showRewards, currentRewardIndex, rewards.length]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 bg-gradient-to-b from-gray-900 to-black border-2 border-neon-yellow/30 rounded-2xl p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-6"
          >
            <h2
              className="text-neon-yellow uppercase mb-2"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.2em',
              }}
            >
              Recompensas
            </h2>
            <div className="h-1 w-16 bg-neon-yellow mx-auto" />
          </motion.div>

          {/* Rewards List */}
          <div className="space-y-3 mb-6">
            {rewards.map((reward, index) => {
              const Icon = ICON_MAP[reward.icon];
              const isVisible = currentRewardIndex >= index;

              return (
                <AnimatePresence key={index}>
                  {isVisible && (
                    <motion.div
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 50, opacity: 0 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-4 relative overflow-hidden"
                    >
                      {/* Background Glow */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.3, 0] }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at center, ${reward.color}40, transparent)`,
                        }}
                      />

                      {/* Icon */}
                      <div className="flex items-center gap-3 relative z-10">
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${reward.color}20`, border: `2px solid ${reward.color}` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: reward.color }} />
                        </motion.div>

                        <div>
                          <p
                            className="text-white/90 font-bold"
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '14px',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {reward.label}
                          </p>
                          {reward.type === 'streak' && (
                            <p className="text-xs text-white/50">Multiplicador ativo</p>
                          )}
                        </div>
                      </div>

                      {/* Value */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative z-10"
                      >
                        <span
                          className="font-black tabular-nums"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '20px',
                            color: reward.color,
                          }}
                        >
                          {typeof reward.value === 'number' ? `+${reward.value}` : reward.value}
                        </span>
                        {typeof reward.value === 'number' && (
                          <span className="text-xs text-white/50 ml-1">EXP</span>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })}
          </div>

          {/* Total */}
          {currentRewardIndex >= rewards.length - 1 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-gradient-to-r from-neon-yellow/20 to-yellow-600/20 border-2 border-neon-yellow rounded-lg p-4 mb-4"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-white uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                  }}
                >
                  Total
                </span>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-neon-yellow font-black tabular-nums"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '32px',
                  }}
                >
                  +{totalExp}
                  <span className="text-sm ml-2">EXP</span>
                </motion.span>
              </div>
            </motion.div>
          )}

          {/* Continue Button */}
          {currentRewardIndex >= rewards.length - 1 && (
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-neon-yellow text-black hover:bg-white transition-colors rounded-lg"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Continuar
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
