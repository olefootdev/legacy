/**
 * Sistema de Intensidade Tática
 * Sprint 2: 3 níveis (conserve, balanced, overload)
 */

export type TacticalIntensityLevel = 'conserve' | 'balanced' | 'overload';

export interface TacticalIntensity {
  level: TacticalIntensityLevel;
  fatigueRate: number;
  chanceBoost: number;
  label: string;
  icon: string;
  description: string;
}

export const TACTICAL_INTENSITY_PRESETS: Record<TacticalIntensityLevel, TacticalIntensity> = {
  conserve: {
    level: 'conserve',
    fatigueRate: 0.5,
    chanceBoost: -0.1,
    label: 'Conservar',
    icon: '⚡',
    description: 'Poupa energia, -10% chances de golo',
  },
  balanced: {
    level: 'balanced',
    fatigueRate: 1.0,
    chanceBoost: 0,
    label: 'Equilibrado',
    icon: '⚖️',
    description: 'Ritmo normal de jogo',
  },
  overload: {
    level: 'overload',
    fatigueRate: 2.0,
    chanceBoost: 0.15,
    label: 'Sobrecarregar',
    icon: '🔥',
    description: '+15% chances, fadiga 2x mais rápida',
  },
};

export interface TacticalIntensityState {
  current: TacticalIntensityLevel;
  changedAtMinute: number;
}

export function applyIntensityToFatigue(
  baseFatigue: number,
  intensity: TacticalIntensityLevel,
): number {
  const preset = TACTICAL_INTENSITY_PRESETS[intensity];
  return baseFatigue * preset.fatigueRate;
}

export function applyIntensityToShotChance(
  baseChance: number,
  intensity: TacticalIntensityLevel,
): number {
  const preset = TACTICAL_INTENSITY_PRESETS[intensity];
  return Math.max(0.05, Math.min(0.95, baseChance + preset.chanceBoost));
}

export function shouldAutoSwitchIntensity(
  minute: number,
  homeScore: number,
  awayScore: number,
  currentIntensity: TacticalIntensityLevel,
): TacticalIntensityLevel | null {
  const scoreDiff = homeScore - awayScore;

  // Auto-overload se perdendo após min 75
  if (minute >= 75 && scoreDiff < 0 && currentIntensity !== 'overload') {
    return 'overload';
  }

  // Auto-conserve se ganhando por 2+ após min 80
  if (minute >= 80 && scoreDiff >= 2 && currentIntensity !== 'conserve') {
    return 'conserve';
  }

  return null;
}
