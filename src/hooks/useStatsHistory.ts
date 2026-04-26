/**
 * Hook para rastrear histórico de stats e gerar gráfico — Melhoria #3
 */
import { useEffect, useState } from 'react';
import type { LiveMatchStats } from '@/components/matchday/LiveStatsComparison';

export interface StatsHistoryPoint {
  minute: number;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
}

const MAX_HISTORY_POINTS = 10; // últimos 10 minutos

export function useStatsHistory(
  stats: LiveMatchStats,
  currentMinute: number | undefined,
): StatsHistoryPoint[] {
  const [history, setHistory] = useState<StatsHistoryPoint[]>([]);
  const [lastMinute, setLastMinute] = useState<number>(-1);

  useEffect(() => {
    if (!currentMinute || currentMinute === lastMinute) return;

    setLastMinute(currentMinute);
    setHistory(prev => {
      const newPoint: StatsHistoryPoint = {
        minute: currentMinute,
        possession: { ...stats.possession },
        shots: { ...stats.shots },
      };
      return [...prev, newPoint].slice(-MAX_HISTORY_POINTS);
    });
  }, [currentMinute, stats, lastMinute]);

  return history;
}
