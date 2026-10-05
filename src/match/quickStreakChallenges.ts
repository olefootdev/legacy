/**
 * Sistema de Desafios Semanais de Streak
 * Sprint 3: progressão com metas e recompensas
 */
import { L } from '@/i18n/L';

export type StreakChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface StreakChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: StreakChallengeDifficulty;
  target: number;
  progress: number;
  reward: {
    ole: number;
    exp: number;
    item?: string;
  };
  expiresAt: string;
  completed: boolean;
  claimed?: boolean;
}

export interface StreakChallengesState {
  challenges: StreakChallenge[];
  lastRefreshDate: string;
}

function getNextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  return nextSunday;
}

export function generateWeeklyChallenges(): StreakChallenge[] {
  const expiresAt = getNextSunday().toISOString();

  return [
    {
      id: `easy_${Date.now()}`,
      name: L('Primeiros Passos', 'First Steps'),
      description: L('Vença 3 partidas rápidas', 'Win 3 quick matches'),
      difficulty: 'easy',
      target: 3,
      progress: 0,
      reward: { ole: 2500, exp: 500 },
      expiresAt,
      completed: false,
    },
    {
      id: `medium_${Date.now()}`,
      name: L('Sequência Imparável', 'Unstoppable Streak'),
      description: L('Vença 5 partidas rápidas seguidas', 'Win 5 quick matches in a row'),
      difficulty: 'medium',
      target: 5,
      progress: 0,
      reward: { ole: 8000, exp: 2000, item: 'rare_contract' },
      expiresAt,
      completed: false,
    },
    {
      id: `hard_${Date.now()}`,
      name: L('Lenda do Olefoot', 'Olefoot Legend'),
      description: L('Vença 10 partidas rápidas seguidas', 'Win 10 quick matches in a row'),
      difficulty: 'hard',
      target: 10,
      progress: 0,
      reward: { ole: 25000, exp: 5000, item: 'epic_pack' },
      expiresAt,
      completed: false,
    },
  ];
}

export function shouldRefreshChallenges(state: StreakChallengesState): boolean {
  const lastRefresh = new Date(state.lastRefreshDate);
  const now = new Date();
  return now > new Date(state.challenges[0]?.expiresAt ?? 0) || now.getTime() - lastRefresh.getTime() > 7 * 24 * 60 * 60 * 1000;
}

export function updateChallengeProgress(
  challenges: StreakChallenge[],
  currentStreak: number,
  won: boolean,
): StreakChallenge[] {
  if (!won) return challenges;

  return challenges.map((c) => {
    if (c.completed) return c;

    const newProgress = Math.min(currentStreak, c.target);
    const completed = newProgress >= c.target;

    return {
      ...c,
      progress: newProgress,
      completed,
    };
  });
}

export function getDifficultyColor(difficulty: StreakChallengeDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'hard':
      return 'text-red-400';
  }
}

export function getDifficultyIcon(difficulty: StreakChallengeDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return '⭐';
    case 'medium':
      return '⭐⭐';
    case 'hard':
      return '⭐⭐⭐';
  }
}
