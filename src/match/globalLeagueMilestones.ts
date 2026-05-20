/**
 * Marcos (milestones) da Liga Global — pagamento em EXP por progresso
 * acumulado ALL-TIME do time do manager.
 *
 * Categorias: matches | goals | points | wins
 * Thresholds: 10 / 50 / 100 / 300 / 1000
 * Total: 4 × 5 = 20 marcos. Cada marco pode ser claimed só 1× por manager.
 */

import type { GlobalTeam } from './globalLeagueMVP';

export type MilestoneCategory = 'matches' | 'goals' | 'points' | 'wins';
export const MILESTONE_THRESHOLDS = [10, 50, 100, 300, 1000] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

/** ID estável do marco — ex.: `gl_matches_10`, `gl_goals_1000`. */
export type GlobalLeagueMilestoneId = `gl_${MilestoneCategory}_${MilestoneThreshold}`;

export const MILESTONE_CATEGORIES: MilestoneCategory[] = ['matches', 'goals', 'points', 'wins'];

const CATEGORY_LABEL: Record<MilestoneCategory, string> = {
  matches: 'Partidas',
  goals: 'Gols',
  points: 'Pontos',
  wins: 'Vitórias',
};

/** EXP entregue por threshold (curva crescente). */
const EXP_REWARDS: Record<MilestoneThreshold, number> = {
  10: 50_000,
  50: 250_000,
  100: 750_000,
  300: 2_500_000,
  1000: 10_000_000,
};

export function milestoneId(category: MilestoneCategory, threshold: MilestoneThreshold): GlobalLeagueMilestoneId {
  return `gl_${category}_${threshold}` as GlobalLeagueMilestoneId;
}

export function milestoneExpReward(threshold: MilestoneThreshold): number {
  return EXP_REWARDS[threshold];
}

export function milestoneLabel(category: MilestoneCategory, threshold: MilestoneThreshold): string {
  return `${threshold.toLocaleString('pt-BR')} ${CATEGORY_LABEL[category]}`;
}

export function milestoneInboxTitle(category: MilestoneCategory, threshold: MilestoneThreshold): string {
  return `🏆 Liga Global — ${threshold.toLocaleString('pt-BR')} ${CATEGORY_LABEL[category]} alcançadas!`;
}

export function milestoneInboxBody(
  category: MilestoneCategory,
  threshold: MilestoneThreshold,
  exp: number,
): string {
  return `Recompensa entregue: +${exp.toLocaleString('pt-BR')} EXP por bater o marco de ${threshold.toLocaleString('pt-BR')} ${CATEGORY_LABEL[category].toLowerCase()} na Liga Global.`;
}

/**
 * Lê os stats all-time do `GlobalTeam` e retorna a lista de marcos que ele
 * JÁ atingiu — desconsidera o que já foi claimed (caller filtra).
 */
export function milestonesReachedByTeam(team: GlobalTeam): GlobalLeagueMilestoneId[] {
  const stats: Record<MilestoneCategory, number> = {
    matches: team.allTimeMatchesPlayed ?? 0,
    goals: team.allTimeGoalsFor ?? 0,
    points: team.allTimePoints ?? 0,
    wins: team.allTimeWins ?? 0,
  };
  const out: GlobalLeagueMilestoneId[] = [];
  for (const cat of MILESTONE_CATEGORIES) {
    for (const th of MILESTONE_THRESHOLDS) {
      if (stats[cat] >= th) out.push(milestoneId(cat, th));
    }
  }
  return out;
}

/** Faz o parse reverso do ID — útil pra inbox/UI/reducer. */
export function parseMilestoneId(
  id: string,
): { category: MilestoneCategory; threshold: MilestoneThreshold } | null {
  const m = /^gl_(matches|goals|points|wins)_(10|50|100|300|1000)$/.exec(id);
  if (!m) return null;
  return {
    category: m[1] as MilestoneCategory,
    threshold: Number(m[2]) as MilestoneThreshold,
  };
}
