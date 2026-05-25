/**
 * OLEFOOT PYTHON MODE — Calibração temporal canônica.
 *
 * Toda constante de tempo do novo loop de impacto + ritmo + engajamento
 * deriva daqui. Outros módulos NUNCA devem hardcodar "5 minutos" ou "2 horas".
 *
 * Fuso horário fixo: Brasília (UTC-3).
 */

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_MINUTE = 60 * 1000;

/** Brasília = UTC-3 (sem horário de verão). */
export const BRT_OFFSET_MS = -3 * MS_PER_HOUR;

/** Duração de uma partida em minutos reais. CORAÇÃO do ritmo. */
export const MATCH_DURATION_MIN = 5;
export const MATCHES_PER_HOUR = 60 / MATCH_DURATION_MIN; // 12

/** Início do dia ativo (BRT): 05:30 — público acordando. */
export const DAY_START_HOUR_BRT = 5.5;
/** Início da noite regenerativa (BRT): 23:00. */
export const NIGHT_START_HOUR_BRT = 23;

/** Final de semana = sábado e domingo (Date.getUTCDay: 0=dom, 6=sáb). */
export const WEEKEND_DAYS = [0, 6] as const;

// ─── Login bonus cycle ─────────────────────────────────────────────
/** Intervalo entre claims de bonus de login durante semana (horas). */
export const LOGIN_BONUS_INTERVAL_WEEKDAY_HOURS = 3;
/** Intervalo entre claims de bonus de login no final de semana (horas). */
export const LOGIN_BONUS_INTERVAL_WEEKEND_HOURS = 1;

// ─── Absence penalty thresholds (horas sem login) ───────────────────
export const ABSENCE_TIER_HOURS = {
  warning: 12,
  mild: 24,
  moderate: 36,
  heavy: 48,
  crisis: 72,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Hora local BRT decimal (ex.: 9.5 = 9:30). */
export function brtHourDecimal(ms: number): number {
  const d = new Date(ms + BRT_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** YYYY-MM-DD em BRT. */
export function brtDateString(ms: number): string {
  return new Date(ms + BRT_OFFSET_MS).toISOString().split('T')[0]!;
}

/** dom=0..sáb=6 em BRT. */
export function brtDayOfWeek(ms: number): number {
  return new Date(ms + BRT_OFFSET_MS).getUTCDay();
}

export function isWeekendBrt(ms: number): boolean {
  return (WEEKEND_DAYS as readonly number[]).includes(brtDayOfWeek(ms));
}

/** Está dentro da janela de noite regenerativa (23:00 → 05:30)? */
export function isNightRegenWindow(ms: number): boolean {
  const h = brtHourDecimal(ms);
  return h >= NIGHT_START_HOUR_BRT || h < DAY_START_HOUR_BRT;
}

/** Quantas partidas teriam rodado num intervalo (cota teórica máxima). */
export function matchesInInterval(fromMs: number, toMs: number): number {
  return Math.max(0, Math.floor((toMs - fromMs) / (MATCH_DURATION_MIN * MS_PER_MINUTE)));
}

/** Próximo limiar BRT atingível (5:30 ou 23:00) a partir de `ms`. */
export function nextDayBoundaryMs(ms: number): number {
  const d = new Date(ms + BRT_OFFSET_MS);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const next = new Date(d);
  next.setUTCMinutes(0, 0, 0);
  if (hour < DAY_START_HOUR_BRT) {
    next.setUTCHours(5, 30, 0, 0);
  } else if (hour < NIGHT_START_HOUR_BRT) {
    next.setUTCHours(23, 0, 0, 0);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(5, 30, 0, 0);
  }
  return next.getTime() - BRT_OFFSET_MS;
}
