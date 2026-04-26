/**
 * Sistema de Bônus por Performance Individual
 * Sprint 1: cleanSheet, comeback, hattrick, dominance, efficiency
 */

import type { MatchEventEntry } from '@/engine/types';

export interface PerformanceBonus {
  id: string;
  name: string;
  description: string;
  ole: number;
  exp: number;
  icon: string;
}

export interface PerformanceBonusCheck {
  cleanSheet: boolean;
  hattrick: boolean;
  comeback: boolean;
  dominance: boolean;
  efficiency: boolean;
}

interface MatchStats {
  homeScore: number;
  awayScore: number;
  goalsAgainst: number;
  possession: number;
  shots: number;
  events: MatchEventEntry[];
  wasLosing: boolean;
  won: boolean;
}

function countPlayerGoals(events: MatchEventEntry[], playerId?: string): number {
  return events.filter(
    (e) => e.kind === 'goal_home' && (!playerId || e.playerId === playerId),
  ).length;
}

function findHattrickPlayer(events: MatchEventEntry[]): string | null {
  const goalsByPlayer = new Map<string, number>();
  for (const e of events) {
    if (e.kind === 'goal_home' && e.playerId) {
      goalsByPlayer.set(e.playerId, (goalsByPlayer.get(e.playerId) ?? 0) + 1);
    }
  }
  for (const [pid, count] of goalsByPlayer) {
    if (count >= 3) return pid;
  }
  return null;
}

function wasLosingAtSomePoint(events: MatchEventEntry[]): boolean {
  let homeScore = 0;
  let awayScore = 0;
  for (const e of events) {
    if (e.kind === 'goal_home') homeScore++;
    if (e.kind === 'goal_away') awayScore++;
    if (awayScore > homeScore) return true;
  }
  return false;
}

export function evaluatePerformanceBonuses(stats: MatchStats): PerformanceBonus[] {
  const bonuses: PerformanceBonus[] = [];

  // Clean Sheet
  if (stats.goalsAgainst === 0 && stats.homeScore > 0) {
    bonuses.push({
      id: 'clean_sheet',
      name: 'Defesa Impecável',
      description: 'Não sofreu nenhum golo',
      ole: 50,
      exp: 10,
      icon: '🧤',
    });
  }

  // Hattrick
  const hattrickPlayer = findHattrickPlayer(stats.events);
  if (hattrickPlayer) {
    bonuses.push({
      id: 'hattrick',
      name: 'Hat-trick',
      description: 'Um jogador marcou 3+ golos',
      ole: 100,
      exp: 20,
      icon: '🎩',
    });
  }

  // Comeback
  if (stats.wasLosing && stats.won) {
    bonuses.push({
      id: 'comeback',
      name: 'Virada Épica',
      description: 'Virou o jogo após estar a perder',
      ole: 75,
      exp: 15,
      icon: '🔥',
    });
  }

  // Dominance
  if (stats.possession > 65 && stats.shots > 15 && stats.won) {
    bonuses.push({
      id: 'dominance',
      name: 'Domínio Total',
      description: 'Posse >65% e 15+ finalizações',
      ole: 30,
      exp: 8,
      icon: '👑',
    });
  }

  // Efficiency
  if (stats.homeScore >= 3 && stats.shots <= 8 && stats.won) {
    bonuses.push({
      id: 'efficiency',
      name: 'Eficiência Clínica',
      description: '3+ golos com ≤8 finalizações',
      ole: 40,
      exp: 10,
      icon: '🎯',
    });
  }

  return bonuses;
}

export function calculateTotalBonusRewards(bonuses: PerformanceBonus[]): {
  ole: number;
  exp: number;
} {
  return bonuses.reduce(
    (acc, b) => ({
      ole: acc.ole + b.ole,
      exp: acc.exp + b.exp,
    }),
    { ole: 0, exp: 0 },
  );
}
