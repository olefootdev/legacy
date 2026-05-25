/**
 * OLEFOOT PYTHON MODE — Penalidade por ausência.
 *
 * Calibração travada na conversa de design:
 *   0-12h    normal
 *   12-24h   treino -10%, sem evolução de atributos
 *   24-36h   treino para, risco lesão +15, 1 jogador desmotivado
 *   36-48h   1 lesão leve aleatória possível, fadiga não regenera, mercado para
 *   48-72h   treino zerado, 2-3 lesões leves automáticas, ofertas desaparecem
 *   72h+     crise: -20% apoio torcida, jogadores estrela considerando saída
 *
 * Toda função é pura. O reducer agenda quando aplicar (não aqui).
 */
import { ABSENCE_TIER_HOURS } from '@/systems/timeCalibration';
import type {
  AbsencePenaltyEffect,
  AbsenceTier,
  ManagerPresence,
} from './types';
import { hoursSinceLastLogin } from './checkIn';

const TIER_TABLE: Record<AbsenceTier, AbsencePenaltyEffect> = {
  normal: {
    tier: 'normal',
    trainingMultiplier: 1,
    attrEvolutionEnabled: true,
    injuryRiskAdditive: 0,
    fatigueRegenEnabled: true,
    marketActivityEnabled: true,
    randomInjuryCount: 0,
    crowdSupportDelta: 0,
    starPlayerDepartureRisk: false,
    message: 'Tudo em ordem no clube.',
  },
  warning_12h: {
    tier: 'warning_12h',
    trainingMultiplier: 0.9,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 0,
    fatigueRegenEnabled: true,
    marketActivityEnabled: true,
    randomInjuryCount: 0,
    crowdSupportDelta: 0,
    starPlayerDepartureRisk: false,
    message: 'Jogadores sentem falta da sua presença. Treino rendendo 10% menos.',
  },
  mild_24h: {
    tier: 'mild_24h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 15,
    fatigueRegenEnabled: true,
    marketActivityEnabled: true,
    randomInjuryCount: 0,
    crowdSupportDelta: 0,
    starPlayerDepartureRisk: false,
    message: 'Sem comando, treinos pararam. Risco de lesão aumentou.',
  },
  moderate_36h: {
    tier: 'moderate_36h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 15,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 1,
    crowdSupportDelta: -5,
    starPlayerDepartureRisk: false,
    message: 'Clube à deriva. Lesões começam a aparecer, mercado paralisado.',
  },
  heavy_48h: {
    tier: 'heavy_48h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 25,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 2,
    crowdSupportDelta: -10,
    starPlayerDepartureRisk: false,
    message: 'Crise no clube. Múltiplas lesões, ofertas desaparecendo.',
  },
  crisis_72h: {
    tier: 'crisis_72h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 35,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 3,
    crowdSupportDelta: -20,
    starPlayerDepartureRisk: true,
    message: 'CRISE. Torcida revoltada, jogadores estrela cogitando sair.',
  },
};

export function getAbsenceTier(hoursAbsent: number): AbsenceTier {
  const h = hoursAbsent;
  if (h >= ABSENCE_TIER_HOURS.crisis) return 'crisis_72h';
  if (h >= ABSENCE_TIER_HOURS.heavy) return 'heavy_48h';
  if (h >= ABSENCE_TIER_HOURS.moderate) return 'moderate_36h';
  if (h >= ABSENCE_TIER_HOURS.mild) return 'mild_24h';
  if (h >= ABSENCE_TIER_HOURS.warning) return 'warning_12h';
  return 'normal';
}

export function getAbsenceEffect(tier: AbsenceTier): AbsencePenaltyEffect {
  return TIER_TABLE[tier];
}

/** Avalia ausência atual e retorna efeito completo. */
export function evaluateAbsence(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): { tier: AbsenceTier; hours: number; effect: AbsencePenaltyEffect } {
  const hours = hoursSinceLastLogin(presence, nowMs);
  const tier = getAbsenceTier(hours);
  return { tier, hours, effect: getAbsenceEffect(tier) };
}

/** Mudou de tier desde a última aplicação? UI usa pra avisar. */
export function tierChangedSinceLastApply(
  presence: ManagerPresence | undefined,
  currentTier: AbsenceTier,
): boolean {
  if (!presence) return false;
  return presence.lastAbsenceTier !== currentTier;
}
