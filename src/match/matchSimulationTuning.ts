/**
 * Constantes centralizadas do simulador de partida (timing, fadiga, fair play, decisão).
 * Resolução contestada (tetos de passe/chute, QA de posse): ver `actionResolutionTuning.ts`.
 */

/** Cooldown anti devolução ao ex-portador após desarme (ms de tempo de simulação ≈ world.simTime em s — usamos segundos no loop) */
export const POSSESSION_LOCK_SEC = 0.5;

/** Intervalo mínimo entre replanejamentos completos de decisão (≈ 11 Hz) */
export const DECISION_TICK_MS = 80;

/** Peso 0–1: quanto fair play baixo aumenta “agressividade” em disputas (efeito marginal no desarme) */
export const FAIRPLAY_FOUL_BIAS = 0.12;

/** Fadiga base por segundo em intensidade média (0–100 stamina) */
export const FATIGUE_RATE_BASE = 2.8;

/** Recuperação de stamina por segundo quando longe da bola e baixa intensidade */
export const STAMINA_RECOVERY_BASE = 1.1;

/** Multiplicador máximo de execução técnica vindo da confiança em runtime */
export const CONFIDENCE_EXECUTION_CAP = 0.14;

/** Quanto a confiança runtime sobe/desce por evento */
export const CONFIDENCE_DELTA_GOOD = 0.06;
export const CONFIDENCE_DELTA_BAD = 0.08;

/** Histórico curto de ações por jogador */
export const LAST_ACTIONS_MAX = 5;

/** Debug: log de top-3 scores (ativar via globalThis.__OF_DECISION_DEBUG__) */
export const DECISION_DEBUG_TOP_N = 3;

/** Throttle mínimo entre `SIM_SYNC` só por mudança de feed (evita 60 dispatch/s; mantém remates/faltas visíveis). */
export const LIVE_SIM_SYNC_THROTTLE_MS = 72;

// ---------------------------------------------------------------------------
// Deliberation after ball reception
// ---------------------------------------------------------------------------

/** @deprecated Janela antiga em sub-segundo; o motor usa `RECEPTION_THINK_*` + `receptionThinkMode`. Mantido para docs/ferramentas. */
export const DELIBERATION_BASE_SEC = 0.12;
/** @deprecated Ver `RECEPTION_THINK_MIN_SEC`. */
export const DELIBERATION_MIN_SEC = 0.03;
/** @deprecated Ver `RECEPTION_THINK_MAX_SEC`. */
export const DELIBERATION_MAX_SEC = 0.28;
/** Pressure radius (m) for counting nearby opponents during deliberation */
export const DELIBERATION_PRESSURE_RADIUS = 8;

/**
 * Modo cognitivo ao receber a bola (antes de passe/chute/condução):
 * rápido (instinto), moderado (ler o jogo), lento (risco/genialidade).
 */
export const RECEPTION_THINK_FAST_SEC = 1;
export const RECEPTION_THINK_MODERATE_SEC = 2;
export const RECEPTION_THINK_SLOW_SEC = 3;
export const RECEPTION_THINK_MIN_SEC = 0.35;
export const RECEPTION_THINK_MAX_SEC = 3.5;
