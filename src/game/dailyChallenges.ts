import { L } from '@/i18n/L';
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
  lastResetDate: string;
  streak: number;
}

const CHALLENGE_TEMPLATES: Record<ChallengeType, { title: string; description: string; targetRange: [number, number]; rewardBase: number }> = {
  win_matches: {
    title: L('Vencedor', 'Winner'),
    description: L('Vence {target} partidas na Liga Global', 'Win {target} Global League matches'),
    targetRange: [3, 8],
    rewardBase: 1500,
  },
  score_goals: {
    title: L('Artilheiro', 'Top scorer'),
    description: L('Marca {target} gols na Liga Global', 'Score {target} goals in the Global League'),
    targetRange: [4, 12],
    rewardBase: 1000,
  },
  win_streak: {
    title: L('Imparável', 'Unstoppable'),
    description: L('Conquista {target} vitórias consecutivas na Liga Global', 'Win {target} Global League matches in a row'),
    targetRange: [3, 5],
    rewardBase: 2500,
  },
  clean_sheet: {
    title: L('Muralha', 'The Wall'),
    description: L('Vence {target} partidas sem sofrer gols na Liga Global', 'Win {target} Global League matches without conceding'),
    targetRange: [1, 3],
    rewardBase: 2000,
  },
  comeback: {
    title: L('Virada Épica', 'Epic Comeback'),
    description: L('Vira {target} partidas na Liga Global (perdendo e depois vencendo)', 'Turn around {target} Global League matches (losing, then winning)'),
    targetRange: [1, 2],
    rewardBase: 3000,
  },
  dominant_win: {
    title: L('Dominação', 'Domination'),
    description: L('Vence por {target}+ gols de diferença na Liga Global', 'Win by {target}+ goals in the Global League'),
    targetRange: [3, 5],
    rewardBase: 2000,
  },
  quick_goals: {
    title: L('Goleador do Dia', 'Scorer of the Day'),
    description: L('Marca em {target} partidas diferentes na Liga Global hoje', 'Score in {target} different Global League matches today'),
    targetRange: [3, 6],
    rewardBase: 1500,
  },
};

export function generateDailyChallenges(seed: string): DailyChallenge[] {
  let s = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const types = Object.keys(CHALLENGE_TEMPLATES) as ChallengeType[];
  const selectedTypes: ChallengeType[] = [];

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
    const reward = template.rewardBase + Math.floor(rng() * 500);

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
      if (matchData.homeScore > 0) {
        updated = updateChallengeProgress(updated, 'quick_goals');
      }
      break;
  }

  return updated;
}
