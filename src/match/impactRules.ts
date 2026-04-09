/**
 * Olefoot — regras de impacto ao vivo (partida rápida / extensível).
 *
 * **Modelo:** impacto final = clamp( impacto_base × Π fatores , floor )
 * onde `impacto_base` vem das stats do minuto (rating + derivados) e cada fator
 * reflete um evento (equipa ou individual). Composição via produto = exp(Σ ln(fator)).
 *
 * **Capitão (só eventos individuais):** f_eff = 1 + (f_raw − 1) × 1,5
 * — amplifica o desvio em relação a 1 (ganhos e penalizações individuais).
 * Não se aplica a fatores de equipa inteira (+10% golo, −10% sofrido, etc.).
 *
 * **Golo sofrido — política B (defeito):** linha + meio + ataque −10% (×0,90);
 * guarda-redes recebe **apenas** ×0,85 (−15%) neste evento, **sem** acumular o −10% global
 * (substitui o fator de equipa para o GR naquele golo).
 *
 * **Floor:** o produto composto não pode reduzir o jogador abaixo de 5% do impacto base
 * (mínimo absoluto = base × 0,05).
 *
 * **Banco:** só jogadores em campo no momento do evento recebem linhas de ledger de equipa;
 * reservas não acumulam até entrarem (novo titular só após minuto de entrada).
 */

/** Amplificação do desvio individual para o capitão (1,5× o “excesso” sobre 1). */
export const CAPTAIN_INDIVIDUAL_GAIN = 1.5;

/** Máx. contagens do mesmo tipo de anti-spam por minuto e por jogador (ex.: desarmes). */
export const ANTI_SPAM_MAX_PER_MINUTE = 3;

/** Golo a favor da equipa: todos em campo +10%. */
export const TEAM_GOAL_SCORED = 1.1;

/** Golo sofrido: campo (não-GR) −10%. */
export const TEAM_GOAL_CONCEDED_FIELD = 0.9;

/**
 * Golo sofrido: GR — política B — −15% (×0,85), **em substituição** do −10% de equipa
 * para esse evento (não multiplicar 0,9×0,85).
 */
export const TEAM_GOAL_CONCEDED_GK_POLICY_B = 0.85;

/** Eventos individuais — linha (multiplicador bruto antes do capitão). */
export const INDIV = {
  goalAuthor: 1.14,
  assist: 1.08,
  preAssist: 1.03,
  shotOnTarget: 1.02,
  shotOff: 1.005,
  tackleRecovery: 1.015,
  interception: 1.015,
  defensiveCut: 1.02,
  keyPass: 1.03,
  dribbleSuccess: 1.01,
  foulWon: 1.01,
  foulCommitted: 0.98,
  dangerousTurnover: 0.97,
  ownGoal: 0.8,
  errorLeadingToGoal: 0.85,
  yellow: 0.75,
  red: 0.5,
} as const;

/** Goleiro — individuais. */
export const INDIV_GK = {
  save: 1.015,
  saveHard: 1.06,
  penaltySave: 1.15,
  successfulRush: 1.03,
  distributionAttack: 1.02,
  distributionDangerOwn: 0.95,
} as const;

/** Clean sheet (final): GK + defesas + volantes “defensivos” (pos VOL ou role def em meio). */
export const CLEAN_SHEET_MULT = 1.06;

/** Posições que contam para clean sheet além de GK e def. */
export const CLEAN_SHEET_EXTRA_POS = new Set(['VOL', 'MC', 'VOL']);

/** Floor mínimo do produto de fatores (5% do base). */
export const IMPACT_FACTOR_FLOOR = 0.05;

/**
 * Aplica regra do capitão a um multiplicador **individual** bruto.
 * f_eff = 1 + (f_raw − 1) × 1,5
 */
export function captainAmplifyIndividualFactor(rawFactor: number): number {
  if (rawFactor <= 0) return rawFactor;
  return 1 + (rawFactor - 1) * CAPTAIN_INDIVIDUAL_GAIN;
}

export function isGkPitch(p: { role: string; pos: string }): boolean {
  return p.role === 'gk' || p.pos === 'GOL';
}

/** Critério clean sheet: GR, linha defensiva, e volantes listados. */
export function qualifiesCleanSheetPlayer(p: { role: string; pos: string }): boolean {
  if (p.role === 'gk' || p.pos === 'GOL') return true;
  if (p.role === 'def' || ['ZAG', 'LE', 'LD'].includes(p.pos)) return true;
  if (p.pos === 'VOL') return true;
  return false;
}

/** Capitão ao arranque: 1.º MC (pos ou slot), senão VOL, senão primeiro titular. */
export function pickHomeCaptainPlayerId(
  homePlayers: { playerId: string; pos: string; slotId: string }[],
): string | undefined {
  if (homePlayers.length === 0) return undefined;
  const mc = homePlayers.find((p) => p.pos === 'MC' || /mc/i.test(p.slotId));
  if (mc) return mc.playerId;
  const vol = homePlayers.find((p) => p.pos === 'VOL');
  if (vol) return vol.playerId;
  return homePlayers[0]!.playerId;
}
