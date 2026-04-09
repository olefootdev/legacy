/**
 * Elegibilidade e peso de finalização — evita remates “mortos” por score sempre inferior ao passe.
 */

/** Terço ofensivo ou distância ao gol (m) para candidatura mínima a remate */
export const SHOOT_MIN_ZONE_TAGS = ['attacking_third', 'opp_box'] as const;
/** Raio máximo ao gol (m) para candidatura mesmo fora do tag exato */
export const SHOOT_MAX_DIST_TO_GOAL_M = 30;

/** Piso: score(shoot) >= score(pass_safe) * F + epsilon (quando elegível) */
export const SHOOT_SCORE_VS_PASS_SAFE_FACTOR = 0.48;
export const SHOOT_SCORE_FLOOR_EPSILON = 0.06;

/** Pressão: penalidade mínima residual (não anular shoot por pressure) */
export const SHOOT_PRESSURE_PENALTY_CAP = 0.72;

/** Sem tentativa de remate neste intervalo (s de simTime) → forçar elegibilidade agressiva */
export const SHOT_BUDGET_NO_ATTEMPT_SEC = 55;
/** Após forçar, consumir o orçamento (evitar spam) */
export const SHOT_BUDGET_COOLDOWN_AFTER_FORCE_SEC = 12;

/** Bola no terço ofensivo com posse contínua > T → boost de remate */
export const SHOOT_OFFENSIVE_STALL_SEC = 22;

/** Teste de regressão: minutos sim × taxa ≈ mínimo de tentativas esperadas */
export const SHOT_ATTEMPTS_MIN_PER_90MIN_SIM = 8;
