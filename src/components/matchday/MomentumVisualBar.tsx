/**
 * Barra de Momentum Visual — Fase 1 Quick Win #2 + Melhoria #2 (Histórico e Tendências)
 * Mostra domínio/pressão em tempo real com feedback visual forte + tendências.
 */
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMomentumHistory, type MomentumWithTrend } from '@/hooks/useMomentumHistory';

export interface MomentumState {
  home: number; // 0-100
  away: number; // 0-100
}

type MomentumStreak = 'cold' | 'neutral' | 'hot' | 'fire';

interface MomentumVisualBarProps {
  momentum: MomentumState;
  homeShort: string;
  awayShort: string;
  className?: string;
}

function getMomentumStreak(value: number): MomentumStreak {
  if (value >= 80) return 'fire';
  if (value >= 65) return 'hot';
  if (value <= 35) return 'cold';
  return 'neutral';
}

function getStreakColor(streak: MomentumStreak): string {
  switch (streak) {
    case 'fire':
      return 'bg-red-500';
    case 'hot':
      return 'bg-orange-500';
    case 'cold':
      return 'bg-blue-400';
    default:
      return 'bg-yellow-500';
  }
}

function getStreakGlow(streak: MomentumStreak): string {
  switch (streak) {
    case 'fire':
      return 'shadow-[0_0_30px_rgba(239,68,68,0.6)]';
    case 'hot':
      return 'shadow-[0_0_20px_rgba(251,146,60,0.4)]';
    case 'cold':
      return 'shadow-[0_0_15px_rgba(96,165,250,0.3)]';
    default:
      return '';
  }
}

function getStreakIcon(streak: MomentumStreak) {
  switch (streak) {
    case 'fire':
      return <Flame className="h-3 w-3 animate-pulse" />;
    case 'hot':
      return <TrendingUp className="h-3 w-3" />;
    case 'cold':
      return <Zap className="h-3 w-3 rotate-180" />;
    default:
      return null;
  }
}

function getStreakLabel(streak: MomentumStreak): string {
  switch (streak) {
    case 'fire':
      return 'DOMINANDO!';
    case 'hot':
      return 'Pressão';
    case 'cold':
      return 'Sufocado';
    default:
      return '';
  }
}

function TrendIndicator({ trend, gain }: { trend: MomentumWithTrend['homeTrend']; gain: number }) {
  if (trend === 'stable') return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-0.5"
    >
      {trend === 'rising' ? (
        <TrendingUp className="h-3 w-3 text-green-400" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-400" />
      )}
      <span className={cn(
        'text-[9px] font-bold',
        trend === 'rising' ? 'text-green-400' : 'text-red-400'
      )}>
        {gain > 0 ? '+' : ''}{gain}
      </span>
    </motion.div>
  );
}

export function MomentumVisualBar({ momentum, homeShort, awayShort, className }: MomentumVisualBarProps) {
  const momentumWithTrend = useMomentumHistory(momentum);

  const homeStreak = getMomentumStreak(momentumWithTrend.home);
  const awayStreak = getMomentumStreak(momentumWithTrend.away);

  const homePercent = Math.max(5, Math.min(95, momentumWithTrend.home));
  const awayPercent = Math.max(5, Math.min(95, momentumWithTrend.away));

  const homeDominant = momentumWithTrend.home > momentumWithTrend.away + 20;
  const awayDominant = momentumWithTrend.away > momentumWithTrend.home + 20;

  return (
    <div className={cn('relative w-full', className)}>
      {/* Labels */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-white/90">
            {homeShort}
          </span>
          <TrendIndicator trend={momentumWithTrend.homeTrend} gain={momentumWithTrend.homeGain} />
          <AnimatePresence mode="wait">
            {homeStreak !== 'neutral' && (
              <motion.div
                key={homeStreak}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
                  homeStreak === 'fire' && 'bg-red-500/90',
                  homeStreak === 'hot' && 'bg-orange-500/90',
                  homeStreak === 'cold' && 'bg-blue-400/90',
                )}
              >
                {getStreakIcon(homeStreak)}
                <span>{getStreakLabel(homeStreak)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5">
          <AnimatePresence mode="wait">
            {awayStreak !== 'neutral' && (
              <motion.div
                key={awayStreak}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
                  awayStreak === 'fire' && 'bg-red-500/90',
                  awayStreak === 'hot' && 'bg-orange-500/90',
                  awayStreak === 'cold' && 'bg-blue-400/90',
                )}
              >
                <span>{getStreakLabel(awayStreak)}</span>
                {getStreakIcon(awayStreak)}
              </motion.div>
            )}
          </AnimatePresence>
          <TrendIndicator trend={momentumWithTrend.awayTrend} gain={momentumWithTrend.awayGain} />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-white/90">
            {awayShort}
          </span>
        </div>
      </div>

      {/* Barra de momentum */}
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        {/* Barra casa (esquerda) */}
        <motion.div
          className={cn(
            'absolute left-0 top-0 h-full origin-left',
            getStreakColor(homeStreak),
            getStreakGlow(homeStreak),
            homeStreak === 'fire' && 'animate-pulse',
          )}
          initial={{ width: '50%' }}
          animate={{ width: `${homePercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Barra visitante (direita) */}
        <motion.div
          className={cn(
            'absolute right-0 top-0 h-full origin-right',
            getStreakColor(awayStreak),
            getStreakGlow(awayStreak),
            awayStreak === 'fire' && 'animate-pulse',
          )}
          initial={{ width: '50%' }}
          animate={{ width: `${awayPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Linha central */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
      </div>

      {/* Mensagem de domínio total */}
      <AnimatePresence>
        {homeDominant && homeStreak === 'fire' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-red-400"
          >
            {homeShort} DOMINA COMPLETAMENTE!
          </motion.div>
        )}
        {awayDominant && awayStreak === 'fire' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-red-400"
          >
            {awayShort} SUFOCA {homeShort}!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
