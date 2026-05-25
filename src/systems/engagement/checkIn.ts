/**
 * OLEFOOT PYTHON MODE — Check-in do manager.
 *
 * Toda abertura de app dispara `recordCheckIn`. Atualiza presença,
 * sinaliza sessões e expõe queries pra UI ("já fiz check-in hoje?").
 */
import { brtDateString } from '@/systems/timeCalibration';
import type { ManagerPresence } from './types';
import { EMPTY_PRESENCE } from './types';

/** Registra abertura/foco do app. Imutável. */
export function recordCheckIn(
  prev: ManagerPresence | undefined,
  managerId: string,
  nowMs: number = Date.now(),
): ManagerPresence {
  const base = prev ?? EMPTY_PRESENCE(managerId);
  // Considera nova sessão se passou >5min do último login
  const FIVE_MIN = 5 * 60 * 1000;
  const isNewSession = !base.lastLoginAt || nowMs - base.lastLoginAt > FIVE_MIN;
  return {
    ...base,
    managerId,
    lastLoginAt: nowMs,
    totalSessions: base.totalSessions + (isNewSession ? 1 : 0),
  };
}

/** Marca fim de sessão (idle/close). */
export function recordSessionEnd(
  prev: ManagerPresence,
  nowMs: number = Date.now(),
): ManagerPresence {
  return { ...prev, lastSessionEndAt: nowMs };
}

// ─── Queries ────────────────────────────────────────────────────────

/** Quantas horas reais desde o último login. */
export function hoursSinceLastLogin(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): number {
  if (!presence?.lastLoginAt) return 0;
  return Math.max(0, (nowMs - presence.lastLoginAt) / (60 * 60 * 1000));
}

/** Manager já fez check-in HOJE (BRT)? */
export function hasCheckedInToday(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!presence?.lastLoginAt) return false;
  return brtDateString(presence.lastLoginAt) === brtDateString(nowMs);
}

/** Logins nos últimos N dias BRT. Estima visitas/dia, lê última 14 dias. */
export interface CheckInStreak {
  /** Dias BRT consecutivos com pelo menos 1 login. */
  streakDays: number;
}

export function computeCheckInStreak(
  presence: ManagerPresence | undefined,
  nowMs: number = Date.now(),
): CheckInStreak {
  if (!presence?.lastLoginAt) return { streakDays: 0 };
  const today = brtDateString(nowMs);
  const last = brtDateString(presence.lastLoginAt);
  // Sem histórico granular ainda — versão simples:
  // - se logou hoje, streak ≥ 1
  // - se logou ontem mas não hoje, streak ainda 1 até hoje terminar
  // (Próxima sessão: persistir array de últimos N dias).
  if (today === last) return { streakDays: 1 };
  return { streakDays: 0 };
}
