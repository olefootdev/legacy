/**
 * Sistema de Arcos Narrativos
 * Sprint 2: detectar e ajustar feed dinamicamente
 */

import type { MatchEventEntry } from '@/engine/types';

export type NarrativeArc =
  | 'underdog_fight'
  | 'dominant_control'
  | 'late_drama'
  | 'collapse'
  | 'balanced';

export interface NarrativeArcState {
  arc: NarrativeArc;
  intensity: number;
  detectedAtMinute: number;
}

interface ArcDetectionContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEventEntry[];
  possession: number;
  shots: number;
  shotsAgainst: number;
}

function countRecentShots(events: MatchEventEntry[], sinceMinute: number): number {
  return events.filter(
    (e) =>
      (e.kind === 'narrative' && e.text.toLowerCase().includes('chut')) ||
      e.kind === 'goal_home',
  ).length;
}

function countGoalsInPeriod(
  events: MatchEventEntry[],
  fromMinute: number,
  toMinute: number,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.minute >= fromMinute && e.minute <= toMinute) {
      if (e.kind === 'goal_home') home++;
      if (e.kind === 'goal_away') away++;
    }
  }
  return { home, away };
}

export function detectNarrativeArc(ctx: ArcDetectionContext): NarrativeArcState {
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  const recentShots = countRecentShots(ctx.events, ctx.minute - 10);
  const last15Goals = countGoalsInPeriod(ctx.events, ctx.minute - 15, ctx.minute);

  // Late Drama: empate ou diferença de 1 após min 75
  if (ctx.minute >= 75 && Math.abs(scoreDiff) <= 1) {
    return {
      arc: 'late_drama',
      intensity: 0.9,
      detectedAtMinute: ctx.minute,
    };
  }

  // Collapse: estava ganhando por 2+, agora perdendo ou empatado
  if (scoreDiff <= 0 && last15Goals.away >= 2) {
    return {
      arc: 'collapse',
      intensity: 0.85,
      detectedAtMinute: ctx.minute,
    };
  }

  // Underdog Fight: perdendo mas criando muitas chances
  if (scoreDiff < 0 && recentShots >= 3 && ctx.possession >= 45) {
    return {
      arc: 'underdog_fight',
      intensity: 0.75,
      detectedAtMinute: ctx.minute,
    };
  }

  // Dominant Control: ganhando por 2+ e adversário sem chutes
  if (scoreDiff >= 2 && ctx.shotsAgainst <= 2 && ctx.possession >= 60) {
    return {
      arc: 'dominant_control',
      intensity: 0.6,
      detectedAtMinute: ctx.minute,
    };
  }

  return {
    arc: 'balanced',
    intensity: 0.5,
    detectedAtMinute: ctx.minute,
  };
}

export function getArcFeedSpeed(arc: NarrativeArc): number {
  switch (arc) {
    case 'late_drama':
      return 3000;
    case 'collapse':
      return 3200;
    case 'underdog_fight':
      return 3500;
    case 'dominant_control':
      return 5000;
    case 'balanced':
      return 4200;
  }
}

export function getArcMusicIntensity(arc: NarrativeArc): number {
  switch (arc) {
    case 'late_drama':
      return 1.0;
    case 'collapse':
      return 0.9;
    case 'underdog_fight':
      return 0.8;
    case 'dominant_control':
      return 0.4;
    case 'balanced':
      return 0.6;
  }
}

export function getArcDescription(arc: NarrativeArc): string {
  switch (arc) {
    case 'late_drama':
      return 'Drama nos minutos finais!';
    case 'collapse':
      return 'A vantagem está a escapar...';
    case 'underdog_fight':
      return 'Luta contra as probabilidades!';
    case 'dominant_control':
      return 'Domínio absoluto!';
    case 'balanced':
      return 'Jogo equilibrado';
  }
}
