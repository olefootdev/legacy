/**
 * Dados de calibração do motor CLASSIC — "Arcade Realism".
 *
 * Base: dados reais (StatsBomb / FBref / Understat)
 * Ajuste: tuned para diversão — mais chutes, mais gols, mais drama.
 *
 * Filosofia: FIFA no Professional, não simulador BBC.
 * ~3.5–4.5 gols/partida, ~30 chutes, mais traves e defesas.
 */

// ─── Shot Zone Classification ────────────────────────────────────────────────

export type ShotZone = 'box' | 'edge' | 'outside';

export type ShotOutcomeCalibrated =
  | 'goal' | 'save' | 'blocked' | 'wide' | 'post' | 'rebound' | 'corner_def';

export interface ShotZoneDistribution {
  goalRate: number;
  saveRate: number;
  blockedRate: number;
  wideRate: number;
  postRate: number;
  reboundRate: number;
  cornerRate: number;
}

/**
 * Distribuição de outcomes de chute por zona.
 * Baseado em dados reais — cada zona tem conversão e outcomes diferentes.
 *
 * box = dentro da grande área (xRel >= 0.85)
 * edge = borda da área (xRel >= 0.72)
 * outside = fora da área (xRel < 0.72)
 */
export const SHOT_ZONE_DISTRIBUTIONS: Record<ShotZone, ShotZoneDistribution> = {
  box: {
    goalRate:    0.280,   // conversão alta dentro da área — é jogo, não BBC
    saveRate:    0.195,   // defesas dramáticas
    blockedRate: 0.160,   // menos bloqueio (tedioso)
    wideRate:    0.210,   // menos "pra fora"
    postRate:    0.065,   // TRAVE = adrenalina pura
    reboundRate: 0.055,   // segundas chances
    cornerRate:  0.035,   // set pieces
  },
  edge: {
    goalRate:    0.145,   // golaço de meia distância — satisfatório
    saveRate:    0.200,   // defesa espetacular
    blockedRate: 0.220,   // bloqueio moderado
    wideRate:    0.260,   // menos "pra fora"
    postRate:    0.070,   // trave de fora = icônico
    reboundRate: 0.060,   // sobras perigosas
    cornerRate:  0.045,   // escanteios
  },
  outside: {
    goalRate:    0.050,   // golaço de fora — raro mas possível
    saveRate:    0.165,   // defesaça
    blockedRate: 0.260,   // bloqueio de longe
    wideRate:    0.280,   // chute alto
    postRate:    0.065,   // trave de longe = épico
    reboundRate: 0.070,   // sobras
    cornerRate:  0.045,   // escanteios
  },
};

// ─── Pass Completion ─────────────────────────────────────────────────────────

export type PassType = 'short' | 'medium' | 'long' | 'cross';

export type PassOutcome = 'completed' | 'intercepted' | 'out_of_play';

export interface PassCompletionProfile {
  baseCompletion: number;
}

export const PASS_COMPLETION: Record<PassType, PassCompletionProfile> = {
  short:  { baseCompletion: 0.945 },  // menos interceptações chatas em passes curtos
  medium: { baseCompletion: 0.895 },  // chega mais rápido no terço final
  long:   { baseCompletion: 0.685 },  // bola longa funciona mais = mais transições
  cross:  { baseCompletion: 0.365 },  // cruzamento completa mais = mais chutes de área
};

// ─── Match Frequency Targets ─────────────────────────────────────────────────

export interface MatchFrequencyTargets {
  goalsPerMatch: number;
  shotsPerMatch: number;
  passesPerMatch: number;
  foulsPerMatch: number;
  cornersPerMatch: number;
  tacklesPerMatch: number;
  interceptionsPerMatch: number;
}

export const MATCH_FREQUENCY_TARGETS: MatchFrequencyTargets = {
  goalsPerMatch: 3.8,     // FIFA-like — mais celebrações
  shotsPerMatch: 32,      // mais momentos de perigo
  passesPerMatch: 720,    // menos dead time, mais ação
  foulsPerMatch: 16,      // menos paradas chatas
  cornersPerMatch: 12,    // mais set pieces
  tacklesPerMatch: 28,    // disputas emocionantes
  interceptionsPerMatch: 14,  // menos cortes (que resetam o jogo)
};
