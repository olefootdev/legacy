/**
 * Disciplina no jogo contínuo (`TacticalSimLoop`): faltas/cartões com RNG seedado
 * (`simulationSeed` + chave por jogada). Não duplica `rollMatchDiscipline` do minuto-a-minuto.
 */

/** Base: desarme limpo vs falta (defensor). MVP: mais contacto → faltas visíveis. */
export const TACKLE_FOUL_PROB_BASE = 0.18;  // Aumentado de 0.12 para 0.18 (+50%)
/** Baixo fairPlay aumenta probabilidade de falta no desarme. */
export const TACKLE_FOUL_FAIRPLAY_WEIGHT = 0.4;  // Aumentado de 0.3 para 0.4
export const TACKLE_FOUL_PROB_CAP = 0.52;  // Aumentado de 0.44 para 0.52

/**
 * Cartões após falta: um `u ~ U(0,1)` cumulativo — [0,red) vermelho, [red,red+yellow) amarelo.
 * Severidade (leve / firme / feia) vem do contacto.
 * Aumentado para tornar partida mais tensa e realista.
 */
export const FOUL_CARD_RED_P_LIGHT = 0.012;  // Aumentado de 0.008 para 0.012
export const FOUL_CARD_RED_P_FIRM = 0.032;   // Aumentado de 0.024 para 0.032
export const FOUL_CARD_RED_P_UGLY = 0.065;   // Aumentado de 0.05 para 0.065

export const FOUL_CARD_YELLOW_P_LIGHT = 0.58;  // Aumentado de 0.52 para 0.58
export const FOUL_CARD_YELLOW_P_FIRM = 0.56;   // Aumentado de 0.5 para 0.56
export const FOUL_CARD_YELLOW_P_UGLY = 0.64;   // Aumentado de 0.58 para 0.64

/** @deprecated Probabilidades cumulativas antigas — mantidas só para referência em testes legados. */
export const FOUL_AFTER_TACKLE_YELLOW_PROB = 0.4;
export const FOUL_AFTER_TACKLE_RED_PROB = 0.034;

/** `draw_foul` (atacante): sucesso se defensor muito perto. */
export const DRAW_FOUL_SUCCESS_BASE = 0.3;
export const DRAW_FOUL_MENTAL_BONUS = 0.14; // (mentalidade+confianca)/200 * bonus
export const DRAW_FOUL_MAX_DIST = 2.95;
