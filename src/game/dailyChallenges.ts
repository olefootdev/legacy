export type ChallengeType =
  | 'win_matches'
  | 'score_goals'
  | 'win_streak'
  | 'clean_sheet'
  | 'comeback'
  | 'dominant_win'
  | 'quick_goals';

export interface DailyChallenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyChallengesState {
  challenges: DailyChallenge[];
  lastResetDate: string; // ISO date string
  streak: number; // consecutive days completing all challenges
}

const CHALLENGE_TEMPLATES: Record<ChallengeType, { title: string; description: string; targetRange: [number, number]; rewardBase: number }> = {
  win_matches: {
    title: 'Vencedor',
    description: 'Vence {target} partidas rápidas',
    targetRange: [2, 5],
    rewardBase: 150,
  },
  score_goals: {
    title: 'Artilheiro',
    description: 'Marca {target} golos em partidas rápidas',
    targetRange: [3, 8],
    rewardBase: 100,
  },
  win_streak: {
    title: 'Imparável',
    description: 'Conquista uma sequência de {target} vitórias',
    targetRange: [3, 5],
    rewardBase: 250,
  },
  clean_sheet: {
    title: 'Muralha',
    description: 'Vence {target} partidas sem sofrer golos',
    targetRange: [1, 3],
    rewardBase: 200,
  },
  comeback: {
    title: 'Virada Épica',
    description: 'Vira {target} partidas estando a perder',
    targetRange: [1, 2],
    rewardBase: 300,
  },
  dominant_win: {
    title: 'Dominação',
    description: 'Vence por {target}+ golos de diferença',
    targetRange: [3, 5],
    rewardBase: 200,
  },
  quick_goals: {
    title: 'Início Fulminante',
    description: 'Marca nos primeiros 15 minutos em {target} partidas',
    targetRange: [2, 4],
    rewardBase: 150,
  },
};

export function generateDailyChallenges(seed: string): DailyChallenge[] {
  // Use date as seed for consistent daily challenges
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = () => {
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
  };

  const types = Object.keys(CHALLENGE_TEMPLATES) as ChallengeType[];
  const selectedTypes: ChallengeType[] = [];

  // Select 3 unique challenge types
  while (selectedTypes.length < 3) {
    const idx = Math.floor(rng() * types.length);
    const type = types[idx];
    if (!selectedTypes.includes(type)) {
      selectedTypes.push(type);
    }
  }

  return selectedTypes.map((type, index) => {
    const template = CHALLENGE_TEMPLATES[type];
    const [min, max] = template.targetRange;
    const target = Math.floor(min + rng() * (max - min + 1));
    const reward = template.rewardBase + Math.floor(rng() * 50);

    return {
      id: `daily_${seed}_${index}`,
      type,
      title: template.title,
      description: template.description.replace('{target}', target.toString()),
      target,
      progress: 0,
      reward,
      completed: false,
      claimed: false,
    };
  });
}

export function shouldResetDailyChallenges(lastResetDate: string): boolean {
  const last = new Date(lastResetDate);
  const now = new Date();

  // Reset if different day (UTC)
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

export function getTodaySeed(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export function updateChallengeProgress(
  challenges: DailyChallenge[],
  type: ChallengeType,
  increment: number = 1,
): DailyChallenge[] {
  return challenges.map((challenge) => {
    if (challenge.type === type && !challenge.completed) {
      const newProgress = Math.min(challenge.progress + increment, challenge.target);
      return {
        ...challenge,
        progress: newProgress,
        completed: newProgress >= challenge.target,
      };
    }
    return challenge;
  });
}

export function checkChallengeCompletion(
  challenges: DailyChallenge[],
  type: ChallengeType,
  matchData: {
    won: boolean;
    homeScore: number;
    awayScore: number;
    firstGoalMinute?: number;
    wasLosingAtHalftime?: boolean;
  },
): DailyChallenge[] {
  let updated = [...challenges];

  switch (type) {
    case 'win_matches':
      if (matchData.won) {
        updated = updateChallengeProgress(updated, 'win_matches');
      }
      break;

    case 'score_goals':
      updated = updateChallengeProgress(updated, 'score_goals', matchData.homeScore);
      break;

    case 'win_streak':
      // This is handled by the streak system externally
      break;

    case 'clean_sheet':
      if (matchData.won && matchData.awayScore === 0) {
        updated = updateChallengeProgress(updated, 'clean_sheet');
      }
      break;

    case 'comeback':
      if (matchData.won && matchData.wasLosingAtHalftime) {
        updated = updateChallengeProgress(updated, 'comeback');
      }
      break;

    case 'dominant_win':
      if (matchData.won) {
        const diff = matchData.homeScore - matchData.awayScore;
        const challenge = updated.find((c) => c.type === 'dominant_win' && !c.completed);
        if (challenge && diff >= challenge.target) {
          updated = updateChallengeProgress(updated, 'dominant_win');
        }
      }
      break;

    case 'quick_goals':
      if (matchData.firstGoalMinute !== undefined && matchData.firstGoalMinute <= 15) {
        updated = updateChallengeProgress(updated, 'quick_goals');
      }
      break;
  }

  return updated;
}
