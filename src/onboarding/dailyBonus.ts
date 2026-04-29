/**
 * Daily bonus — recompensa por acesso diário (loop de 7 dias).
 *
 * Regras:
 *   - Streak avança quando o claim ocorre entre 20h e 48h do anterior.
 *   - Se passou de 48h sem claim, streak quebra e volta para o Dia 1.
 *   - Antes de 20h, claim é bloqueado (msUntilNext indica espera).
 *   - Streak loopa 7→1 — não tem "fim".
 *
 * Tabela do dia 1 ao 7 confirmada em product review.
 */
export type DailyRewardKind = 'exp' | 'pack_basic' | 'pack_premium';

export interface DailyReward {
  readonly day: number;
  readonly kind: DailyRewardKind;
  readonly expAmount?: number;
  readonly label: string;
  readonly tone: 'basic' | 'rare' | 'epic' | 'legendary';
}

export const DAILY_REWARDS_7D: ReadonlyArray<DailyReward> = [
  { day: 1, kind: 'exp', expAmount:    50_000, label: '50K EXP',    tone: 'basic' },
  { day: 2, kind: 'exp', expAmount:   100_000, label: '100K EXP',   tone: 'basic' },
  { day: 3, kind: 'exp', expAmount:   250_000, label: '250K EXP',   tone: 'rare' },
  { day: 4, kind: 'exp', expAmount:   500_000, label: '500K EXP',   tone: 'rare' },
  { day: 5, kind: 'pack_basic',                 label: 'Pack 3 cards basic', tone: 'epic' },
  { day: 6, kind: 'exp', expAmount: 1_000_000, label: '1M EXP',     tone: 'epic' },
  { day: 7, kind: 'pack_premium',               label: 'Pack premium (1 RARE garantido)', tone: 'legendary' },
];

const HOUR_MS = 60 * 60 * 1000;
export const DAILY_BONUS_MIN_INTERVAL_MS = 20 * HOUR_MS;
export const DAILY_BONUS_MAX_INTERVAL_MS = 48 * HOUR_MS;
export const DAILY_BONUS_LOOP_LENGTH = DAILY_REWARDS_7D.length;

export interface DailyClaimState {
  /** Timestamp do último claim bem-sucedido (ms desde epoch). */
  readonly lastClaimMs?: number;
  /** Dia atual da streak (1..7). Indefinido = manager nunca claimou. */
  readonly streakDay?: number;
}

export interface DailyClaimEvaluation {
  /** Pode reivindicar agora. */
  readonly canClaim: boolean;
  /**
   * Dia da recompensa que será concedida se canClaim=true.
   * Loopa 7→1.
   */
  readonly nextStreakDay: number;
  /** Recompensa associada ao próximo dia (preview, mesmo se !canClaim). */
  readonly nextReward: DailyReward;
  /** True se a janela de 48h foi excedida (próximo claim reseta streak). */
  readonly streakBroken: boolean;
  /** Caso !canClaim, milissegundos faltando para liberar. */
  readonly msUntilNext?: number;
  /** Caso !canClaim, motivo amigável. */
  readonly blockReason?: 'too_soon';
}

function rewardForDay(day: number): DailyReward {
  const idx = ((day - 1) % DAILY_BONUS_LOOP_LENGTH + DAILY_BONUS_LOOP_LENGTH) % DAILY_BONUS_LOOP_LENGTH;
  return DAILY_REWARDS_7D[idx]!;
}

export function evaluateDailyClaim(
  state: DailyClaimState,
  nowMs: number,
): DailyClaimEvaluation {
  const lastMs = state.lastClaimMs;
  const prevDay = state.streakDay ?? 0;

  if (lastMs == null || prevDay <= 0) {
    return {
      canClaim: true,
      nextStreakDay: 1,
      nextReward: rewardForDay(1),
      streakBroken: false,
    };
  }

  const elapsed = nowMs - lastMs;

  if (elapsed < DAILY_BONUS_MIN_INTERVAL_MS) {
    const previewNext = (prevDay % DAILY_BONUS_LOOP_LENGTH) + 1;
    return {
      canClaim: false,
      nextStreakDay: previewNext,
      nextReward: rewardForDay(previewNext),
      streakBroken: false,
      msUntilNext: DAILY_BONUS_MIN_INTERVAL_MS - elapsed,
      blockReason: 'too_soon',
    };
  }

  if (elapsed >= DAILY_BONUS_MAX_INTERVAL_MS) {
    return {
      canClaim: true,
      nextStreakDay: 1,
      nextReward: rewardForDay(1),
      streakBroken: true,
    };
  }

  const next = (prevDay % DAILY_BONUS_LOOP_LENGTH) + 1;
  return {
    canClaim: true,
    nextStreakDay: next,
    nextReward: rewardForDay(next),
    streakBroken: false,
  };
}

/**
 * Calcula o estado seguinte ao realizar um claim.
 * Caller é responsável por checar `evaluateDailyClaim().canClaim` antes.
 */
export function applyDailyClaim(
  state: DailyClaimState,
  nowMs: number,
): { next: DailyClaimState; reward: DailyReward } {
  const evalRes = evaluateDailyClaim(state, nowMs);
  const day = evalRes.nextStreakDay;
  return {
    next: { lastClaimMs: nowMs, streakDay: day },
    reward: rewardForDay(day),
  };
}

export function getDailyReward(day: number): DailyReward {
  return rewardForDay(day);
}
