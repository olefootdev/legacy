/**
 * Disciplina no jogo contínuo (`TacticalSimLoop`): faltas/cartões com RNG seedado
 * (`simulationSeed` + chave por jogada). Não duplica `rollMatchDiscipline` do minuto-a-minuto.
 */

/** Base: desarme limpo vs falta (defensor). MVP: mais contacto → faltas visíveis. */
export const TACKLE_FOUL_PROB_BASE = 0.11;
/** Baixo fairPlay aumenta probabilidade de falta no desarme. */
export const TACKLE_FOUL_FAIRPLAY_WEIGHT = 0.3;
export const TACKLE_FOUL_PROB_CAP = 0.44;

/** Dado falta no desarme: amarelo (cumulativo com vermelho abaixo). */
export const FOUL_AFTER_TACKLE_YELLOW_PROB = 0.4;
export const FOUL_AFTER_TACKLE_RED_PROB = 0.034;

/** `draw_foul` (atacante): sucesso se defensor muito perto. */
export const DRAW_FOUL_SUCCESS_BASE = 0.3;
export const DRAW_FOUL_MENTAL_BONUS = 0.14; // (mentalidade+confianca)/200 * bonus
export const DRAW_FOUL_MAX_DIST = 2.95;
