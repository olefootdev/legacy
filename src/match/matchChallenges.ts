/**
 * Sistema de Desafios in-match — Fase 3 Polish #10
 * Desafios opcionais que dão recompensas (OLE + EXP).
 */

import type { LiveMatchSnapshot } from '@/engine/types';

export type ChallengeId =
  | 'clean_sheet'
  | 'comeback_king'
  | 'possession_master'
  | 'hat_trick'
  | 'no_fouls'
  | 'shot_accuracy'
  | 'defensive_wall'
  | 'quick_goals';

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface MatchChallenge {
  id: ChallengeId;
  title: string;
  description: string;
  condition: (snap: LiveMatchSnapshot, stats: any) => boolean;
  progress?: (snap: LiveMatchSnapshot, stats: any) => number; // 0-100
  reward: { ole: number; exp: number };
  difficulty: ChallengeDifficulty;
  icon: string;
}

export const MATCH_CHALLENGES: MatchChallenge[] = [
  {
    id: 'clean_sheet',
    title: 'Muralha',
    description: 'Vença sem sofrer gols',
    condition: (snap, stats) => {
      return snap.awayScore === 0 && snap.homeScore > snap.awayScore;
    },
    progress: (snap) => {
      // Progresso baseado no minuto sem sofrer gol
      if (snap.awayScore > 0) return 0;
      return Math.min(100, (snap.minute / 90) * 100);
    },
    reward: { ole: 500, exp: 100 },
    difficulty: 'medium',
    icon: '🛡️',
  },
  {
    id: 'comeback_king',
    title: 'Virada Épica',
    description: 'Vire o jogo após estar perdendo por 2+',
    condition: (snap) => {
      // Precisa ter estado perdendo por 2+ e agora estar vencendo
      // TODO: rastrear histórico de placar
      return snap.homeScore > snap.awayScore && snap.awayScore >= 2;
    },
    reward: { ole: 1000, exp: 200 },
    difficulty: 'hard',
    icon: '🔥',
  },
  {
    id: 'possession_master',
    title: 'Tiki-Taka',
    description: 'Mantenha 70%+ de posse por 20 min',
    condition: (snap, stats) => {
      return stats.possession.home >= 70 && snap.minute >= 20;
    },
    progress: (snap, stats) => {
      if (stats.possession.home < 70) return 0;
      return Math.min(100, (snap.minute / 20) * 100);
    },
    reward: { ole: 300, exp: 50 },
    difficulty: 'easy',
    icon: '⚽',
  },
  {
    id: 'hat_trick',
    title: 'Hat-Trick',
    description: 'Um jogador marque 3 gols',
    condition: (snap) => {
      // TODO: rastrear gols por jogador
      return false; // implementar quando tiver tracking de gols
    },
    reward: { ole: 800, exp: 150 },
    difficulty: 'hard',
    icon: '🎩',
  },
  {
    id: 'no_fouls',
    title: 'Jogo Limpo',
    description: 'Vença cometendo menos de 5 faltas',
    condition: (snap, stats) => {
      return snap.homeScore > snap.awayScore && stats.fouls.home < 5;
    },
    progress: (snap, stats) => {
      const foulsLeft = Math.max(0, 5 - stats.fouls.home);
      return (foulsLeft / 5) * 100;
    },
    reward: { ole: 400, exp: 80 },
    difficulty: 'medium',
    icon: '👏',
  },
  {
    id: 'shot_accuracy',
    title: 'Precisão Cirúrgica',
    description: '80%+ dos chutes no alvo',
    condition: (snap, stats) => {
      if (stats.shots.home === 0) return false;
      const accuracy = (stats.shotsOnTarget.home / stats.shots.home) * 100;
      return accuracy >= 80 && stats.shots.home >= 10;
    },
    progress: (snap, stats) => {
      if (stats.shots.home === 0) return 0;
      return (stats.shotsOnTarget.home / stats.shots.home) * 100;
    },
    reward: { ole: 600, exp: 120 },
    difficulty: 'hard',
    icon: '🎯',
  },
  {
    id: 'defensive_wall',
    title: 'Muralha Defensiva',
    description: 'Sofra menos de 5 finalizações',
    condition: (snap, stats) => {
      return snap.homeScore > snap.awayScore && stats.shots.away < 5;
    },
    progress: (snap, stats) => {
      const shotsLeft = Math.max(0, 5 - stats.shots.away);
      return (shotsLeft / 5) * 100;
    },
    reward: { ole: 500, exp: 100 },
    difficulty: 'medium',
    icon: '🧱',
  },
  {
    id: 'quick_goals',
    title: 'Início Fulminante',
    description: 'Marque 2 gols nos primeiros 15 minutos',
    condition: (snap) => {
      // TODO: rastrear minuto dos gols
      return snap.homeScore >= 2 && snap.minute <= 15;
    },
    reward: { ole: 700, exp: 140 },
    difficulty: 'hard',
    icon: '⚡',
  },
];

/** Verifica quais desafios foram completados */
export function checkCompletedChallenges(
  snap: LiveMatchSnapshot,
  stats: any,
  previouslyCompleted: Set<ChallengeId>,
): MatchChallenge[] {
  const newlyCompleted: MatchChallenge[] = [];

  for (const challenge of MATCH_CHALLENGES) {
    if (previouslyCompleted.has(challenge.id)) continue;

    if (challenge.condition(snap, stats)) {
      newlyCompleted.push(challenge);
    }
  }

  return newlyCompleted;
}

/** Calcula progresso de todos os desafios ativos */
export function calculateChallengeProgress(
  snap: LiveMatchSnapshot,
  stats: any,
): Map<ChallengeId, number> {
  const progress = new Map<ChallengeId, number>();

  for (const challenge of MATCH_CHALLENGES) {
    if (challenge.progress) {
      progress.set(challenge.id, challenge.progress(snap, stats));
    }
  }

  return progress;
}
