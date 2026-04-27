/**
 * Sistema de Desafios Semanais de Streak
 * Sprint 3: progressão com metas e recompensas
 */

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
      name: 'Primeiros Passos',
      description: 'Vença 3 partidas rápidas',
      difficulty: 'easy',
      target: 3,
      progress: 0,
      reward: { ole: 150, exp: 30 },
      expiresAt,
      completed: false,
    },
    {
      id: `medium_${Date.now()}`,
      name: 'Sequência Imparável',
      description: 'Vença 5 partidas rápidas seguidas',
      difficulty: 'medium',
      target: 5,
      progress: 0,
      reward: { ole: 500, exp: 100, item: 'rare_contract' },
      expiresAt,
      completed: false,
    },
    {
      id: `hard_${Date.now()}`,
      name: 'Lenda do Olefoot',
      description: 'Vença 10 partidas rápidas seguidas',
      difficulty: 'hard',
      target: 10,
      progress: 0,
      reward: { ole: 1500, exp: 300, item: 'epic_pack' },
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

export function getCompletedChallengeRewards(challenges: StreakChallenge[]): {
  ole: number;
  exp: number;
  items: string[];
} {
  const completed = challenges.filter((c) => c.completed);
  return completed.reduce(
    (acc, c) => ({
      ole: acc.ole + c.reward.ole,
      exp: acc.exp + c.reward.exp,
      items: c.reward.item ? [...acc.items, c.reward.item] : acc.items,
    }),
    { ole: 0, exp: 0, items: [] as string[] },
  );
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
