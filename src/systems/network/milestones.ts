/**
 * Rede de indicação — marcos em EXP.
 *
 * Substitui a comissão de 5% sobre o EXP que o indicado ganhava jogando
 * (removida em 2026-07-17: "ganho sobre o ganho do outro" não se explica).
 *
 * ── A REGRA ────────────────────────────────────────────────────────────────
 * • Cada indicado DIRETO abre uma EQUIPE (perna).
 * • A perna vale os DESCENDENTES daquele direto — o direto NÃO conta a si mesmo.
 *   Ex.: a pessoa A tem 10 indicados => perna A = 10.
 * • Só as 2 MAIORES equipes contam.
 *   Ex.: A=10, B=50, C=5 => qualificados = 60 (o C é ignorado).
 * • Só indicado ATIVO conta (já jogou: exp_lifetime_earned > 0). Mesma régua do
 *   sorteio de craque — cadastro sem jogar não vira EXP.
 *
 * ── A EXCEÇÃO DO MARCO 1 ───────────────────────────────────────────────────
 * Como a perna não conta o direto, quem tem 1 indicado direto e nenhuma rede
 * abaixo teria 0 qualificados e nunca receberia o primeiro prêmio. Então o marco
 * 1 — e só ele — olha DIRETOS ATIVOS. Os demais olham a soma das 2 maiores.
 *
 * Espelha `network_milestone_exp()` na migration 20260717120000. O valor pago é
 * decidido no SERVIDOR; o que está aqui é só pra exibir.
 */

export interface NetworkMilestone {
  /** Nº de indicados exigido. */
  target: number;
  /** Prêmio em EXP. */
  exp: number;
}

/**
 * Escada de marcos. Decisão de produto do fundador (2026-07-17), calibrada em
 * 100× a escala inicial. O degrau de 100 rompe o múltiplo de propósito: ×100
 * daria 20M, e ele fixou 25M como bônus de topo.
 *
 * Escala de referência: criar um jogador custa 1.000 EXP.
 */
export const NETWORK_MILESTONES: readonly NetworkMilestone[] = [
  { target: 1, exp: 200_000 },
  { target: 10, exp: 1_000_000 },
  { target: 25, exp: 3_000_000 },
  { target: 50, exp: 8_000_000 },
  { target: 100, exp: 25_000_000 },
] as const;

/** Quantas equipes (pernas) contam pros marcos. */
export const MILESTONE_LEGS_COUNTED = 2;

/**
 * REGRA FUTURA — ainda NÃO aplicada em lugar nenhum.
 *
 * O Plano de Carreira vai exigir indicação até a **equipe D**: 4 pernas diretas
 * (A, B, C, D). Registrado aqui a pedido do fundador (2026-07-17) pra não se
 * perder. Quando for implementar, o `legsTotal` de `getMyNetworkStatus()` já
 * entrega o número de pernas.
 */
export const MIN_LEGS_CAREER_PLAN = 4;

/** Régua de um marco: o 1 olha diretos ativos; o resto, a soma das 2 maiores. */
export function progressForMilestone(
  target: number,
  status: { directsActive: number; qualifyingCount: number },
): number {
  return target === 1 ? status.directsActive : status.qualifyingCount;
}

export function isMilestoneReached(
  target: number,
  status: { directsActive: number; qualifyingCount: number },
): boolean {
  return progressForMilestone(target, status) >= target;
}

/** Próximo marco não atingido, ou null se completou a escada. */
export function nextMilestone(status: {
  directsActive: number;
  qualifyingCount: number;
}): NetworkMilestone | null {
  return NETWORK_MILESTONES.find((m) => !isMilestoneReached(m.target, status)) ?? null;
}
