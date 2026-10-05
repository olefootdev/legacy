/**
 * Sistema de Intensidade Tática
 * 5 níveis táticos com efeitos reais no jogo
 */
import { L } from '@/i18n/L';

export type TacticalIntensityLevel = 'defend' | 'possession' | 'counter' | 'press' | 'attack';

export interface TacticalIntensity {
  level: TacticalIntensityLevel;
  fatigueRate: number;        // Multiplicador de fadiga (0.5 = metade, 2.0 = dobro)
  shotChanceBoost: number;    // Modificador de chance de gol (-0.15 a +0.20)
  possessionBoost: number;    // Modificador de posse de bola (-0.10 a +0.15)
  counterChance: number;      // Chance de contra-ataque (0.0 a 0.30)
  pressureIntensity: number;  // Intensidade de pressão (0.3 a 1.5)
  defensiveBonus: number;     // Bônus defensivo (-0.10 a +0.25)
  label: string;
  description: string;
}

export const TACTICAL_INTENSITY_PRESETS: Record<TacticalIntensityLevel, TacticalIntensity> = {
  defend: {
    level: 'defend',
    fatigueRate: 0.6,
    shotChanceBoost: -0.15,
    possessionBoost: -0.10,
    counterChance: 0.15,
    pressureIntensity: 0.3,
    defensiveBonus: 0.25,
    label: L('Defender', 'Defend'),
    description: L('Bloco baixo, +25% defesa, contra-ataques rápidos', 'Low block, +25% defence, fast counters'),
  },
  possession: {
    level: 'possession',
    fatigueRate: 0.8,
    shotChanceBoost: -0.05,
    possessionBoost: 0.15,
    counterChance: 0.05,
    pressureIntensity: 0.6,
    defensiveBonus: 0.10,
    label: L('Posse', 'Possession'),
    description: L('Controla o jogo, +15% posse, desgasta adversário', 'Controls the game, +15% possession, wears the opponent down'),
  },
  counter: {
    level: 'counter',
    fatigueRate: 1.0,
    shotChanceBoost: 0.08,
    possessionBoost: -0.05,
    counterChance: 0.30,
    pressureIntensity: 0.5,
    defensiveBonus: 0.15,
    label: L('Contra-Ataque', 'Counter-Attack'),
    description: L('Aguarda e explora espaços, +30% contra-ataques', 'Waits and exploits space, +30% counters'),
  },
  press: {
    level: 'press',
    fatigueRate: 1.6,
    shotChanceBoost: 0.10,
    possessionBoost: 0.05,
    counterChance: 0.10,
    pressureIntensity: 1.5,
    defensiveBonus: -0.05,
    label: L('Pressionar', 'Press'),
    description: L('Pressão alta, recupera bola rápido, fadiga 1.6x', 'High press, wins the ball back fast, 1.6x fatigue'),
  },
  attack: {
    level: 'attack',
    fatigueRate: 2.0,
    shotChanceBoost: 0.20,
    possessionBoost: 0.10,
    counterChance: 0.05,
    pressureIntensity: 1.2,
    defensiveBonus: -0.10,
    label: L('Ataque Total', 'All-Out Attack'),
    description: L('+20% chances de gol, -10% defesa, fadiga 2x', '+20% goal chances, -10% defence, 2x fatigue'),
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
  return Math.max(0.05, Math.min(0.95, baseChance + preset.shotChanceBoost));
}

export function applyIntensityToPossession(
  basePossession: number,
  intensity: TacticalIntensityLevel,
): number {
  const preset = TACTICAL_INTENSITY_PRESETS[intensity];
  return Math.max(0.2, Math.min(0.8, basePossession + preset.possessionBoost));
}

export function getCounterAttackChance(intensity: TacticalIntensityLevel): number {
  return TACTICAL_INTENSITY_PRESETS[intensity].counterChance;
}

export function getPressureIntensity(intensity: TacticalIntensityLevel): number {
  return TACTICAL_INTENSITY_PRESETS[intensity].pressureIntensity;
}

export function applyIntensityToDefense(
  baseDefense: number,
  intensity: TacticalIntensityLevel,
): number {
  const preset = TACTICAL_INTENSITY_PRESETS[intensity];
  return Math.max(0.1, Math.min(0.95, baseDefense + preset.defensiveBonus));
}

export function shouldAutoSwitchIntensity(
  minute: number,
  homeScore: number,
  awayScore: number,
  currentIntensity: TacticalIntensityLevel,
): TacticalIntensityLevel | null {
  const scoreDiff = homeScore - awayScore;

  // Auto-attack se perdendo após min 75
  if (minute >= 75 && scoreDiff < 0 && currentIntensity !== 'attack') {
    return 'attack';
  }

  // Auto-defend se ganhando por 2+ após min 80
  if (minute >= 80 && scoreDiff >= 2 && currentIntensity !== 'defend') {
    return 'defend';
  }

  // Auto-press se empatado após min 70
  if (minute >= 70 && scoreDiff === 0 && currentIntensity === 'possession') {
    return 'press';
  }

  return null;
}
