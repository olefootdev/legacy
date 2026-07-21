/**
 * Sistema de Desafios in-match — Fase 3 Polish #10
 * Desafios opcionais que dão recompensas (OLE + EXP).
 */

import type { LiveMatchSnapshot } from '@/engine/types';

/**
 * Fonte de verdade dos gols: o log append-only `snap.events`.
 * `goal_home` traz `minute` sempre e `playerId` quando o motor sabe o autor —
 * é o que permite Hat-Trick / Virada / Início Fulminante sem tocar no reducer.
 */

/** Maior nº de gols de um MESMO jogador da casa (0 se o autor não é rastreado). */
function maxHomeGoalsBySinglePlayer(snap: LiveMatchSnapshot): number {
  const byPlayer = new Map<string, number>();
  let max = 0;
  for (const e of snap.events ?? []) {
    if (e.kind !== 'goal_home' || !e.playerId) continue;
    const n = (byPlayer.get(e.playerId) ?? 0) + 1;
    byPlayer.set(e.playerId, n);
    if (n > max) max = n;
  }
  return max;
}

/** Reproduz o placar evento a evento: houve momento perdendo por 2+? */
function wasLosingByTwo(snap: LiveMatchSnapshot): boolean {
  let home = 0;
  let away = 0;
  for (const e of snap.events ?? []) {
    if (e.kind === 'goal_home') home += 1;
    else if (e.kind === 'goal_away') away += 1;
    if (away - home >= 2) return true;
  }
  return false;
}

/** Gols da casa até o minuto dado (inclusive). */
function homeGoalsUpToMinute(snap: LiveMatchSnapshot, minute: number): number {
  let n = 0;
  for (const e of snap.events ?? []) {
    if (e.kind === 'goal_home' && e.minute <= minute) n += 1;
  }
  return n;
}

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
      // Replay do log de gols: precisa ter ESTADO perdendo por 2+ em algum
      // momento e AGORA estar vencendo.
      return snap.homeScore > snap.awayScore && wasLosingByTwo(snap);
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
      // Só completa quando o motor rastreia o autor (goal_home com playerId).
      // Sem autor no evento, nunca dispara — honesto, sem falso positivo.
      return maxHomeGoalsBySinglePlayer(snap) >= 3;
    },
    progress: (snap) => Math.min(100, (maxHomeGoalsBySinglePlayer(snap) / 3) * 100),
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
      // Conta pelos MINUTOS dos eventos de gol — completa mesmo se avaliado
      // depois do minuto 15 (antes exigia snap.minute<=15, quase nunca batia).
      return homeGoalsUpToMinute(snap, 15) >= 2;
    },
    progress: (snap) => Math.min(100, (homeGoalsUpToMinute(snap, 15) / 2) * 100),
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
