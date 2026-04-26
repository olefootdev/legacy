/**
 * Painel de Estatísticas ao Vivo Comparativas — Fase 1 Quick Win #8
 * Mostra stats em tempo real com animações quando valores mudam significativamente.
 */
import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Target, Activity, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiveMatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  tackles: { home: number; away: number };
  fouls: { home: number; away: number };
}

type StatTrend = 'home_up' | 'away_up' | 'neutral';

interface StatRowProps {
  label: string;
  icon: ReactNode;
  homeValue: number | string;
  awayValue: number | string;
  homePercent?: number;
  awayPercent?: number;
  trend?: StatTrend;
  isPercentage?: boolean;
}

function StatRow({ label, icon, homeValue, awayValue, homePercent, awayPercent, trend, isPercentage }: StatRowProps) {
  const homeDominant = homePercent && awayPercent && homePercent > awayPercent + 15;
  const awayDominant = homePercent && awayPercent && awayPercent > homePercent + 15;

  return (
    <div className="group relative">
      {/* Barra de fundo (quando há percentual) */}
      {homePercent !== undefined && awayPercent !== undefined && (
        <div className="absolute inset-0 flex overflow-hidden rounded-sm">
          <motion.div
            className={cn(
              'h-full origin-left',
              homeDominant ? 'bg-yellow-500/15' : 'bg-white/5',
            )}
            initial={{ width: '50%' }}
            animate={{ width: `${homePercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <motion.div
            className={cn(
              'h-full origin-right',
              awayDominant ? 'bg-blue-500/15' : 'bg-white/5',
            )}
            initial={{ width: '50%' }}
            animate={{ width: `${awayPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Conteúdo */}
      <div className="relative flex items-center justify-between px-3 py-2">
        {/* Valor casa */}
        <motion.div
          key={`home-${homeValue}`}
          initial={{ scale: 1 }}
          animate={{ scale: trend === 'home_up' ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'flex items-center gap-1.5 font-display text-sm font-bold tabular-nums',
            homeDominant ? 'text-yellow-400' : 'text-white/90',
          )}
        >
          <span>{homeValue}{isPercentage ? '%' : ''}</span>
          {trend === 'home_up' && (
            <TrendingUp className="h-3 w-3 text-green-400 animate-in fade-in slide-in-from-bottom-1" />
          )}
        </motion.div>

        {/* Label central com ícone */}
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-white/60">
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{icon}</span>
        </div>

        {/* Valor visitante */}
        <motion.div
          key={`away-${awayValue}`}
          initial={{ scale: 1 }}
          animate={{ scale: trend === 'away_up' ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'flex items-center gap-1.5 font-display text-sm font-bold tabular-nums',
            awayDominant ? 'text-blue-400' : 'text-white/90',
          )}
        >
          {trend === 'away_up' && (
            <TrendingUp className="h-3 w-3 text-green-400 animate-in fade-in slide-in-from-bottom-1" />
          )}
          <span>{awayValue}{isPercentage ? '%' : ''}</span>
        </motion.div>
      </div>
    </div>
  );
}

interface LiveStatsComparisonProps {
  stats: LiveMatchStats;
  homeShort: string;
  awayShort: string;
  className?: string;
}

export function LiveStatsComparison({ stats, homeShort, awayShort, className }: LiveStatsComparisonProps) {
  // Detecta trends (simplificado — em produção, comparar com stats anteriores)
  const possessionTrend: StatTrend =
    stats.possession.home > 60 ? 'home_up' :
    stats.possession.away > 60 ? 'away_up' : 'neutral';

  const shotsTrend: StatTrend =
    stats.shots.home > stats.shots.away + 3 ? 'home_up' :
    stats.shots.away > stats.shots.home + 3 ? 'away_up' : 'neutral';

  return (
    <div className={cn('w-full overflow-hidden rounded-lg bg-black/40 backdrop-blur-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-yellow-400">
          {homeShort}
        </span>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-white/60" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/60">
            Estatísticas
          </span>
        </div>
        <span className="font-display text-xs font-bold uppercase tracking-wider text-blue-400">
          {awayShort}
        </span>
      </div>

      {/* Stats */}
      <div className="divide-y divide-white/5">
        <StatRow
          label="Posse"
          icon={<Activity className="h-3.5 w-3.5" />}
          homeValue={stats.possession.home}
          awayValue={stats.possession.away}
          homePercent={stats.possession.home}
          awayPercent={stats.possession.away}
          trend={possessionTrend}
          isPercentage
        />

        <StatRow
          label="Finalizações"
          icon={<Target className="h-3.5 w-3.5" />}
          homeValue={stats.shots.home}
          awayValue={stats.shots.away}
          homePercent={stats.shots.home > 0 ? (stats.shots.home / (stats.shots.home + stats.shots.away)) * 100 : 50}
          awayPercent={stats.shots.away > 0 ? (stats.shots.away / (stats.shots.home + stats.shots.away)) * 100 : 50}
          trend={shotsTrend}
        />

        <StatRow
          label="No Alvo"
          icon={<Zap className="h-3.5 w-3.5" />}
          homeValue={stats.shotsOnTarget.home}
          awayValue={stats.shotsOnTarget.away}
          homePercent={stats.shotsOnTarget.home > 0 ? (stats.shotsOnTarget.home / (stats.shotsOnTarget.home + stats.shotsOnTarget.away)) * 100 : 50}
          awayPercent={stats.shotsOnTarget.away > 0 ? (stats.shotsOnTarget.away / (stats.shotsOnTarget.home + stats.shotsOnTarget.away)) * 100 : 50}
        />

        <StatRow
          label="Precisão"
          icon={<Target className="h-3.5 w-3.5" />}
          homeValue={stats.passAccuracy.home}
          awayValue={stats.passAccuracy.away}
          homePercent={stats.passAccuracy.home}
          awayPercent={stats.passAccuracy.away}
          isPercentage
        />

        <StatRow
          label="Desarmes"
          icon={<Shield className="h-3.5 w-3.5" />}
          homeValue={stats.tackles.home}
          awayValue={stats.tackles.away}
          homePercent={stats.tackles.home > 0 ? (stats.tackles.home / (stats.tackles.home + stats.tackles.away)) * 100 : 50}
          awayPercent={stats.tackles.away > 0 ? (stats.tackles.away / (stats.tackles.home + stats.tackles.away)) * 100 : 50}
        />

        <StatRow
          label="Faltas"
          icon={<Activity className="h-3.5 w-3.5" />}
          homeValue={stats.fouls.home}
          awayValue={stats.fouls.away}
          homePercent={stats.fouls.home > 0 ? (stats.fouls.home / (stats.fouls.home + stats.fouls.away)) * 100 : 50}
          awayPercent={stats.fouls.away > 0 ? (stats.fouls.away / (stats.fouls.home + stats.fouls.away)) * 100 : 50}
        />
      </div>

      {/* Destaque de domínio */}
      <AnimatePresence>
        {stats.possession.home >= 70 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-center"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
              🔥 {homeShort} domina a posse!
            </p>
          </motion.div>
        )}
        {stats.possession.away >= 70 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-blue-500/20 bg-blue-500/10 px-3 py-2 text-center"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
              🔥 {awayShort} domina a posse!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
