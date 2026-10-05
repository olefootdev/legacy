/**
 * Hook para detectar e notificar Stat Highlights — Melhoria #8
 * Mostra toasts quando jogador atinge marcos impressionantes.
 */
import { useEffect, useRef } from 'react';
import type { LiveMatchStats } from '@/components/matchday/LiveStatsComparison';
import { L } from '@/i18n/L';

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
    message: L('🔥 Domínio absoluto! 70%+ de posse!', '🔥 Total control! 70%+ possession!'),
    type: 'success',
  },
  {
    id: 'possession-75',
    condition: (s) => s.possession.home >= 75,
    message: L('⚡ POSSE ESMAGADORA! 75%+ de controle!', '⚡ CRUSHING POSSESSION! 75%+ control!'),
    type: 'success',
  },
  {
    id: 'shots-15',
    condition: (s) => s.shots.home >= 15,
    message: L('🎯 15 finalizações! Pressão constante!', '🎯 15 shots! Constant pressure!'),
    type: 'info',
  },
  {
    id: 'shots-20',
    condition: (s) => s.shots.home >= 20,
    message: L('💥 20 FINALIZAÇÕES! Ataque implacável!', '💥 20 SHOTS! Relentless attack!'),
    type: 'success',
  },
  {
    id: 'pass-accuracy-85',
    condition: (s) => s.passAccuracy.home >= 85,
    message: L('✨ 85% de precisão! Passes cirúrgicos!', '✨ 85% accuracy! Surgical passing!'),
    type: 'info',
  },
  {
    id: 'pass-accuracy-90',
    condition: (s) => s.passAccuracy.home >= 90,
    message: L('🎩 90% DE PRECISÃO! Tiki-taka perfeito!', '🎩 90% ACCURACY! Perfect tiki-taka!'),
    type: 'success',
  },
  {
    id: 'shots-on-target-10',
    condition: (s) => s.shotsOnTarget.home >= 10,
    message: L('🎯 10 chutes no alvo! Goleiro trabalha muito!', '🎯 10 shots on target! The keeper is busy!'),
    type: 'info',
  },
  {
    id: 'tackles-15',
    condition: (s) => s.tackles.home >= 15,
    message: L('🛡️ 15 desarmes! Defesa sólida!', '🛡️ 15 tackles! Solid defence!'),
    type: 'info',
  },
  {
    id: 'clean-defense',
    condition: (s) => s.fouls.home <= 3 && s.tackles.home >= 10,
    message: L('👏 Defesa limpa! Pouquíssimas faltas!', '👏 Clean defending! Hardly any fouls!'),
    type: 'success',
  },
  {
    id: 'aggressive-play',
    condition: (s) => s.fouls.home >= 15,
    message: L('⚠️ Jogo físico! 15+ faltas cometidas!', '⚠️ Physical game! 15+ fouls committed!'),
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
