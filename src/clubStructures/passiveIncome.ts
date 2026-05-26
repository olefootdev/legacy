/**
 * Renda passiva de estruturas — EXP gerado continuamente por estádio e megaloja
 * mesmo fora de partidas. Resgate manual via action `CLAIM_PASSIVE_STRUCTURE_INCOME`.
 *
 * Cap offline de 8h pra forçar engagement (manager precisa logar várias vezes
 * ao dia pra colher tudo). Sem cap, AFK 24h daria muito EXP gratuito.
 *
 * Estádio e megaloja rendem porque são fontes de receita naturais (bilheteria
 * + vendas). Training/academy/medical são multipliers (treino, recuperação,
 * juventude) — não fazem sentido gerar EXP passivamente.
 */

import type { ClubStructuresState } from './types';

/** EXP por hora gerado por cada estrutura, por nível (índice 0 = L1). */
const STADIUM_RATE_BY_LEVEL = [30, 80, 180, 350, 700] as const;
const MEGASTORE_RATE_BY_LEVEL = [20, 50, 120, 250, 500] as const;

/** Máximo de horas acumuladas offline. Além disso, accrual fica capado. */
export const PASSIVE_INCOME_MAX_OFFLINE_HOURS = 8;

const MS_PER_HOUR = 3_600_000;

function clampLevel(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Taxa total em EXP/hora dadas as estruturas atuais. */
export function passiveIncomeRatePerHour(structures: ClubStructuresState): number {
  const stadium = STADIUM_RATE_BY_LEVEL[clampLevel(structures.stadium) - 1]!;
  const megastore = MEGASTORE_RATE_BY_LEVEL[clampLevel(structures.megastore) - 1]!;
  return stadium + megastore;
}

/** Breakdown por estrutura — útil pra UI mostrar de onde vem a renda. */
export function passiveIncomeBreakdown(structures: ClubStructuresState): {
  stadium: number;
  megastore: number;
} {
  return {
    stadium: STADIUM_RATE_BY_LEVEL[clampLevel(structures.stadium) - 1]!,
    megastore: MEGASTORE_RATE_BY_LEVEL[clampLevel(structures.megastore) - 1]!,
  };
}

/**
 * Calcula EXP acumulado desde lastClaimAt, respeitando o cap offline.
 * Retorna 0 se lastClaimAt for null/inválido (primeiro claim sempre 0;
 * accrual começa após o primeiro Coletar).
 */
export function calculatePassiveAccrual(
  structures: ClubStructuresState,
  lastClaimAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!lastClaimAt) return 0;
  const lastMs = new Date(lastClaimAt).getTime();
  if (!Number.isFinite(lastMs) || lastMs >= nowMs) return 0;

  const elapsedHours = (nowMs - lastMs) / MS_PER_HOUR;
  const cappedHours = Math.min(elapsedHours, PASSIVE_INCOME_MAX_OFFLINE_HOURS);
  const rate = passiveIncomeRatePerHour(structures);
  return Math.floor(cappedHours * rate);
}

/** Quanto tempo até atingir o cap (UI: "Cheio em Xh"). */
export function msUntilCap(lastClaimAt: string | null | undefined, nowMs: number = Date.now()): number {
  if (!lastClaimAt) return 0;
  const lastMs = new Date(lastClaimAt).getTime();
  if (!Number.isFinite(lastMs)) return 0;
  const capMs = lastMs + PASSIVE_INCOME_MAX_OFFLINE_HOURS * MS_PER_HOUR;
  return Math.max(0, capMs - nowMs);
}
