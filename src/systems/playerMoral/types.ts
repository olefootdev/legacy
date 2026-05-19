/**
 * Single Source of Truth para moral/momentum de um jogador.
 * Espelho do `playerHealth`: alimentado por resultados de partidas em todas as ligas
 * (LEGACY, OLEFOOT, amistoso). Lido pelo coach e por sistemas de gameplay.
 */
export interface PlayerMoral {
  playerId: string;
  /** 0–100. Default 50. >=70 = empolgado, <=30 = abatido. */
  moral: number;
  /** -10..+10. Forma recente; decay natural a cada ciclo. */
  momentum: number;
  /** Sequência atual: positiva = vitórias seguidas, negativa = derrotas. */
  streak: number;
  /** Timestamp do último resultado que afetou esta moral. */
  lastResultAt: number;
  /** Boa/má fase: positivo = boas atuações seguidas, negativo = ruins. Buff/debuff a partir de |3|. */
  formStreak: number;
}

export type MatchResult = 'win' | 'draw' | 'loss';

/** Cria estado inicial neutro de moral. */
export function createDefaultMoral(playerId: string, now: number = Date.now()): PlayerMoral {
  return {
    playerId,
    moral: 50,
    momentum: 0,
    streak: 0,
    formStreak: 0,
    lastResultAt: now,
  };
}

/**
 * Aplica resultado de partida na moral de um jogador.
 * Heurística:
 * - win:  moral +6, momentum +2, streak += 1 (ou reset pra +1 se vinha negativa)
 * - draw: moral +1, momentum -0.5, streak → 0
 * - loss: moral -5, momentum -2, streak -= 1 (ou reset pra -1 se vinha positiva)
 * Sequência amplifica: streak >=3 dá bônus +2; streak <=-3 dá penalidade -2.
 */
export function applyMatchResultToMoral(prev: PlayerMoral, result: MatchResult, now: number = Date.now()): PlayerMoral {
  let { moral, momentum, streak } = prev;
  switch (result) {
    case 'win':
      moral += 6;
      momentum += 2;
      streak = streak < 0 ? 1 : streak + 1;
      if (streak >= 3) moral += 2;
      break;
    case 'draw':
      moral += 1;
      momentum -= 0.5;
      streak = 0;
      break;
    case 'loss':
      moral -= 5;
      momentum -= 2;
      streak = streak > 0 ? -1 : streak - 1;
      if (streak <= -3) moral -= 2;
      break;
  }
  return {
    ...prev,
    moral: clamp(moral, 0, 100),
    momentum: clamp(momentum, -10, 10),
    streak: clamp(streak, -10, 10),
    lastResultAt: now,
  };
}

/** Decay leve do momentum a cada ciclo (chamar no FINALIZE_MATCH ou periodicamente). */
export function decayMomentum(p: PlayerMoral): PlayerMoral {
  const m = p.momentum;
  if (m === 0) return p;
  const next = m > 0 ? Math.max(0, m - 0.5) : Math.min(0, m + 0.5);
  return { ...p, momentum: next };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Atualiza form streak de um jogador.
 * good=true (vitória sem cartão/lesão): incrementa. good=false: decrementa.
 * Capped em [-5, +5].
 */
export function updateFormStreak(prev: PlayerMoral, good: boolean): PlayerMoral {
  const fs = prev.formStreak ?? 0;
  const raw = good
    ? (fs < 0 ? 1 : fs + 1)
    : (fs > 0 ? -1 : fs - 1);
  const next = Math.max(-5, Math.min(5, raw));
  return { ...prev, formStreak: next };
}

/**
 * Multiplicador de atributos baseado na form streak.
 * |formStreak| >= 3 → ±5% por nível acima de 2.
 * Ex: formStreak=3 → 1.05, formStreak=5 → 1.15, formStreak=-3 → 0.95
 */
export function formStreakMultiplier(formStreak: number): number {
  const fs = formStreak ?? 0;
  const abs = Math.abs(fs);
  if (abs < 3) return 1;
  const levels = abs - 2;
  const delta = levels * 0.05;
  return fs > 0 ? 1 + delta : 1 - delta;
}
