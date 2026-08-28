/**
 * OLEFOOT PYTHON MODE — Penalidade por ausência.
 *
 * RECALIBRADO EM 2026-08-26 — lesão CERTA virou RISCO elevado.
 *
 * A tabela antiga forçava 1–3 lesões automáticas por ausência: quem voltava
 * depois de dois dias encontrava o plantel quebrado e desistia de novo. Um
 * jogo que pune o retorno não retém ninguém. A pressão continua existindo —
 * ela só mudou de lugar: vive agora no `injuryRiskAdditive` (que o motor já
 * lê ao escalar) em vez de estragar o elenco antes do manager tocar em nada.
 *
 * Calibração atual:
 *   0-12h    normal
 *   12-24h   treino -10%, sem evolução de atributos
 *   24-36h   treino para, risco lesão +15
 *   36-48h   risco +22, fadiga não regenera, mercado para
 *   48-72h   risco +30, treino zerado, ofertas desaparecem
 *   72h+     crise: risco +38, torcida esfria (-8), estrelas cogitam sair
 *
 * O que NÃO mudou: treino, evolução de atributos e mercado continuam parando.
 * O clube sente a ausência — ele só não devolve o plantel destruído.
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
    injuryRiskAdditive: 22,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 0,
    crowdSupportDelta: -2,
    starPlayerDepartureRisk: false,
    message: 'Clube à deriva. Sem recuperação física, mercado paralisado.',
  },
  heavy_48h: {
    tier: 'heavy_48h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 30,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 0,
    crowdSupportDelta: -4,
    starPlayerDepartureRisk: false,
    message: 'Elenco no limite. Risco de lesão alto, ofertas desaparecendo.',
  },
  crisis_72h: {
    tier: 'crisis_72h',
    trainingMultiplier: 0,
    attrEvolutionEnabled: false,
    injuryRiskAdditive: 38,
    fatigueRegenEnabled: false,
    marketActivityEnabled: false,
    randomInjuryCount: 0,
    crowdSupportDelta: -8,
    starPlayerDepartureRisk: true,
    message: 'CRISE. Torcida esfriou, jogadores estrela cogitando sair.',
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
