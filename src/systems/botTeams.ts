/**
 * Pools de times BOT para matchmaking inicial.
 *
 * Dificuldade é atrelada à pontuação do manager (rating ELO futuro).
 *   - easy   (OVR 55–65): primeiros managers, exp < 50k
 *   - medium (65–75): exp 50k–500k
 *   - hard   (75–85): exp ≥ 500k
 *
 * Cada bot é um `OpponentStub` com um `strength` (OVR médio) que o motor
 * de partida rápida já consome pra calibrar pGoalAway, gkFactor01 etc.
 */

import type { OpponentStub } from '@/entities/types';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

// Pool reduzido pra deploy de testes online: 3 times (um por dificuldade).
// Histórico completo (30 times) no git — reexpandir quando abrir beta público.
const NAMES_EASY: Array<[string, string]> = [
  ['Aurora FC', 'AUR'],
];

const NAMES_MEDIUM: Array<[string, string]> = [
  ['Tupis da Guanabara', 'TGB'],
];

const NAMES_HARD: Array<[string, string]> = [
  ['Olympia Ouro', 'OLP'],
];

function makeBot(
  ix: number,
  name: string,
  short: string,
  strength: number,
  highlightOvr: number,
  highlightName: string,
  difficulty: BotDifficulty,
): OpponentStub {
  return {
    id: `bot-${difficulty}-${ix.toString().padStart(2, '0')}`,
    name,
    shortName: short,
    strength,
    highlightPlayer: { name: highlightName, ovr: highlightOvr },
  };
}

function seedPool(
  names: Array<[string, string]>,
  minStrength: number,
  maxStrength: number,
  difficulty: BotDifficulty,
): OpponentStub[] {
  const star = (i: number) => {
    const first = ['Lucas', 'Diego', 'Murilo', 'Pedro', 'Rafael', 'Hugo', 'Thiago', 'Gabriel', 'Mateus', 'Victor'][i % 10]!;
    const last = ['Costa', 'Silva', 'Rocha', 'Barros', 'Santos', 'Pires', 'Vieira', 'Ferreira', 'Lima', 'Moraes'][i % 10]!;
    return `${first} ${last}`;
  };
  return names.map(([nm, sh], i) => {
    const span = maxStrength - minStrength;
    const strength = Math.round(minStrength + (i / Math.max(1, names.length - 1)) * span);
    return makeBot(i + 1, nm, sh, strength, Math.min(99, strength + 4), star(i), difficulty);
  });
}

export const BOT_POOL: Record<BotDifficulty, OpponentStub[]> = {
  easy: seedPool(NAMES_EASY, 55, 65, 'easy'),
  medium: seedPool(NAMES_MEDIUM, 65, 75, 'medium'),
  hard: seedPool(NAMES_HARD, 75, 85, 'hard'),
};

/** Dificuldade recomendada pelo `expLifetimeEarned` do manager. */
export function botDifficultyForExp(exp: number): BotDifficulty {
  if (exp < 50_000) return 'easy';
  if (exp < 500_000) return 'medium';
  return 'hard';
}

/** Sorteia um oponente BOT da dificuldade apropriada. Nunca retorna o mesmo da última partida (parâmetro opcional). */
export function pickBotOpponent(expLifetimeEarned: number, excludeId?: string): OpponentStub {
  const diff = botDifficultyForExp(expLifetimeEarned);
  const pool = BOT_POOL[diff];
  const candidates = excludeId ? pool.filter((b) => b.id !== excludeId) : pool;
  const arr = candidates.length > 0 ? candidates : pool;
  return arr[Math.floor(Math.random() * arr.length)]!;
}
