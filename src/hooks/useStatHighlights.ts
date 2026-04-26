/**
 * Hook para detectar e notificar Stat Highlights — Melhoria #8
 * Mostra toasts quando jogador atinge marcos impressionantes.
 */
import { useEffect, useRef } from 'react';
import type { LiveMatchStats } from '@/components/matchday/LiveStatsComparison';

interface StatMilestone {
  id: string;
  condition: (stats: LiveMatchStats) => boolean;
  message: string;
  type: 'success' | 'info' | 'warning';
}

const MILESTONES: StatMilestone[] = [
  {
    id: 'possession-70',
    condition: (s) => s.possession.home >= 70,
    message: '🔥 Domínio absoluto! 70%+ de posse!',
    type: 'success',
  },
  {
    id: 'possession-75',
    condition: (s) => s.possession.home >= 75,
    message: '⚡ POSSE ESMAGADORA! 75%+ de controle!',
    type: 'success',
  },
  {
    id: 'shots-15',
    condition: (s) => s.shots.home >= 15,
    message: '🎯 15 finalizações! Pressão constante!',
    type: 'info',
  },
  {
    id: 'shots-20',
    condition: (s) => s.shots.home >= 20,
    message: '💥 20 FINALIZAÇÕES! Ataque implacável!',
    type: 'success',
  },
  {
    id: 'pass-accuracy-85',
    condition: (s) => s.passAccuracy.home >= 85,
    message: '✨ 85% de precisão! Passes cirúrgicos!',
    type: 'info',
  },
  {
    id: 'pass-accuracy-90',
    condition: (s) => s.passAccuracy.home >= 90,
    message: '🎩 90% DE PRECISÃO! Tiki-taka perfeito!',
    type: 'success',
  },
  {
    id: 'shots-on-target-10',
    condition: (s) => s.shotsOnTarget.home >= 10,
    message: '🎯 10 chutes no alvo! Goleiro trabalha muito!',
    type: 'info',
  },
  {
    id: 'tackles-15',
    condition: (s) => s.tackles.home >= 15,
    message: '🛡️ 15 desarmes! Defesa sólida!',
    type: 'info',
  },
  {
    id: 'clean-defense',
    condition: (s) => s.fouls.home <= 3 && s.tackles.home >= 10,
    message: '👏 Defesa limpa! Pouquíssimas faltas!',
    type: 'success',
  },
  {
    id: 'aggressive-play',
    condition: (s) => s.fouls.home >= 15,
    message: '⚠️ Jogo físico! 15+ faltas cometidas!',
    type: 'warning',
  },
];

export function useStatHighlights(
  stats: LiveMatchStats,
  onHighlight?: (message: string, type: 'success' | 'info' | 'warning') => void,
) {
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!onHighlight) return;

    for (const milestone of MILESTONES) {
      if (shownRef.current.has(milestone.id)) continue;

      if (milestone.condition(stats)) {
        shownRef.current.add(milestone.id);
        onHighlight(milestone.message, milestone.type);
      }
    }
  }, [stats, onHighlight]);

  return {
    reset: () => shownRef.current.clear(),
  };
}
