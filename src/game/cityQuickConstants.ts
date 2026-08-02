/**
 * Custos e efeitos das ações rápidas na Cidade do Clube (UI / reducer).
 * Valores em EXP (ole) salvo onde indicado; BRO em centavos.
 */

export const CITY_QUICK_MEDICAL_COST_EXP = 490;
/** Redução de fadiga por jogador (0–100). */
export const CITY_QUICK_MEDICAL_FATIGUE_DELTA = 16;
export const CITY_QUICK_MEDICAL_INJURY_RISK_DELTA = 5;

export const CITY_QUICK_STORE_COST_EXP = 540;
// 2026-08-01: a campanha pagava 7.500 centavos (R$ 75) de BRO por 540 EXP, sem
// cooldown nem teto. Era conversão livre de moeda de jogo em dinheiro de valor
// real. O ganho em BRO saiu; sobrou o efeito de torcida, que é o que a
// mecânica sempre quis dizer.
/** Reforço de apoio da torcida (0–100) após campanha na megaloja. */
export const CITY_QUICK_STORE_CROWD_DELTA = 0.55;

export const CITY_QUICK_TRAINING_COST_EXP = 380;
export const CITY_QUICK_TRAINING_DURATION_H = 5;

/** Bónus de apoio ao subir o estádio (sentido GameSpirit / ambiente). */
export const STADIUM_UPGRADE_CROWD_DELTA = 1.05;
