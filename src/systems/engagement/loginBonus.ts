/**
 * OLEFOOT PYTHON MODE — Login bonus 3h (semana) / 1h (fim de semana).
 *
 * Ciclo independente da streak de 7 dias (que já existe em
 * `src/onboarding/dailyBonus.ts`). Esta é a recompensa POR VISITA
 * frequente — incentiva os 3-5 logins/dia desejados.
 *
 * Regras:
 *   - Intervalo mínimo: 3h dias úteis / 1h fim de semana
 *   - Bônus escala com slots reivindicados consecutivamente (até 8/dia)
 *   - 30s de sessão já libera claim (incentiva "abrir rapidinho")
 *   - Streak quebra se passar 24h sem claim
 */
import {
  LOGIN_BONUS_INTERVAL_WEEKDAY_HOURS,
  LOGIN_BONUS_INTERVAL_WEEKEND_HOURS,
  MS_PER_HOUR,
  isWeekendBrt,
} from '@/systems/timeCalibration';
import type {
  LoginBonusClaimResult,
  LoginBonusReward,
  ManagerPresence,
} from './types';

const STREAK_BREAK_HOURS = 24;

/** Quantas horas precisam passar entre claims pra este dia. */
export function getIntervalHours(nowMs: number = Date.now()): number {
  return isWeekendBrt(nowMs)
    ? LOGIN_BONUS_INTERVAL_WEEKEND_HOURS
    : LOGIN_BONUS_INTERVAL_WEEKDAY_HOURS;
}

/** Está dentro da janela em que claim é possível? */
export function canClaimNow(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!presence) return false;
  if (!presence.lastBonusClaimAt) return true;
  const intervalMs = getIntervalHours(nowMs) * MS_PER_HOUR;
  return nowMs - presence.lastBonusClaimAt >= intervalMs;
}

export function msUntilNextClaim(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): number {
  if (!presence?.lastBonusClaimAt) return 0;
  const intervalMs = getIntervalHours(nowMs) * MS_PER_HOUR;
  return Math.max(0, presence.lastBonusClaimAt + intervalMs - nowMs);
}

// ─── Reward computation ────────────────────────────────────────────

const BASE_EXP_SMALL = 25_000;
const BASE_EXP_MEDIUM = 100_000;
const BASE_EXP_LARGE = 400_000;

function computeReward(
  streakSlots: number,
  isWeekend: boolean,
): LoginBonusReward {
  const weekendMult = isWeekend ? 1.5 : 1;
  const escalation = 1 + Math.min(streakSlots, 8) * 0.15;

  // Slots especiais
  if (streakSlots > 0 && streakSlots % 8 === 0) {
    return { kind: 'pack_rare', label: 'Pack Raro (streak épica)' };
  }
  if (streakSlots > 0 && streakSlots % 4 === 0) {
    return { kind: 'pack_basic', label: 'Pack Básico' };
  }
  if (streakSlots >= 6) {
    return {
      kind: 'exp_large',
      expAmount: Math.round(BASE_EXP_LARGE * weekendMult * escalation),
      label: `${Math.round(BASE_EXP_LARGE * weekendMult * escalation / 1000)}K EXP`,
    };
  }
  if (streakSlots >= 3) {
    return {
      kind: 'exp_medium',
      expAmount: Math.round(BASE_EXP_MEDIUM * weekendMult * escalation),
      label: `${Math.round(BASE_EXP_MEDIUM * weekendMult * escalation / 1000)}K EXP`,
    };
  }
  return {
    kind: 'exp_small',
    expAmount: Math.round(BASE_EXP_SMALL * weekendMult * escalation),
    label: `${Math.round(BASE_EXP_SMALL * weekendMult * escalation / 1000)}K EXP`,
  };
}

/** Tenta claim. Retorna resultado + presence atualizada. */
export function attemptClaim(
  presence: ManagerPresence,
  nowMs: number = Date.now(),
): { result: LoginBonusClaimResult; nextPresence: ManagerPresence } {
  const intervalMs = getIntervalHours(nowMs) * MS_PER_HOUR;
  const elapsed = presence.lastBonusClaimAt ? nowMs - presence.lastBonusClaimAt : Infinity;

  if (elapsed < intervalMs) {
    return {
      result: {
        claimed: false,
        blockedReason: 'too_soon',
        nextClaimAt: (presence.lastBonusClaimAt ?? 0) + intervalMs,
      },
      nextPresence: presence,
    };
  }

  // Streak quebra se passou >24h sem claim
  const streakBreak = elapsed > STREAK_BREAK_HOURS * MS_PER_HOUR;
  const nextStreak = streakBreak ? 1 : presence.bonusStreakSlots + 1;
  const isWeekend = isWeekendBrt(nowMs);
  const reward = computeReward(nextStreak, isWeekend);

  return {
    result: {
      claimed: true,
      nextClaimAt: nowMs + intervalMs,
      reward,
      slotIndex: nextStreak,
      isWeekend,
    },
    nextPresence: {
      ...presence,
      lastBonusClaimAt: nowMs,
      bonusStreakSlots: nextStreak,
    },
  };
}

/** Preview do próximo reward sem efetuar claim. */
export function previewNextReward(
  presence: ManagerPresence,
  nowMs: number = Date.now(),
): LoginBonusReward {
  const elapsed = presence.lastBonusClaimAt
    ? nowMs - presence.lastBonusClaimAt
    : Infinity;
  const streakBreak = elapsed > STREAK_BREAK_HOURS * MS_PER_HOUR;
  const nextStreak = streakBreak ? 1 : presence.bonusStreakSlots + 1;
  return computeReward(nextStreak, isWeekendBrt(nowMs));
}
