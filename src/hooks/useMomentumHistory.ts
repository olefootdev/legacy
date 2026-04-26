/**
 * Hook para rastrear histórico de momentum e detectar tendências — Melhoria #2
 */
import { useEffect, useRef, useState } from 'react';
import type { MomentumState } from '@/components/matchday/MomentumVisualBar';

export type MomentumTrend = 'rising' | 'falling' | 'stable';

export interface MomentumWithTrend extends MomentumState {
  homeTrend: MomentumTrend;
  awayTrend: MomentumTrend;
  homeGain: number; // ganho/perda nos últimos 5 min
  awayGain: number;
}

const HISTORY_SIZE = 5; // últimos 5 snapshots

export function useMomentumHistory(momentum: MomentumState | undefined): MomentumWithTrend {
  const [history, setHistory] = useState<MomentumState[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!momentum) return;

    const now = Date.now();
    // Atualiza histórico a cada 1 segundo (evita poluir com updates de 24fps)
    if (now - lastUpdateRef.current < 1000) return;
    lastUpdateRef.current = now;

    setHistory(prev => {
      const next = [...prev, momentum].slice(-HISTORY_SIZE);
      return next;
    });
  }, [momentum]);

  if (!momentum || history.length < 2) {
    return {
      home: momentum?.home ?? 50,
      away: momentum?.away ?? 50,
      homeTrend: 'stable',
      awayTrend: 'stable',
      homeGain: 0,
      awayGain: 0,
    };
  }

  // Calcula tendência (compara primeiro vs último do histórico)
  const first = history[0]!;
  const last = history[history.length - 1]!;
  const homeGain = last.home - first.home;
  const awayGain = last.away - first.away;

  const homeTrend: MomentumTrend =
    homeGain > 10 ? 'rising' :
    homeGain < -10 ? 'falling' : 'stable';

  const awayTrend: MomentumTrend =
    awayGain > 10 ? 'rising' :
    awayGain < -10 ? 'falling' : 'stable';

  return {
    home: momentum.home,
    away: momentum.away,
    homeTrend,
    awayTrend,
    homeGain: Math.round(homeGain),
    awayGain: Math.round(awayGain),
  };
}
