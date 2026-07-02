/**
 * rivalDerby.ts — Nêmesis/rivalidade acende o DERBY (ponte Fable #1).
 *
 * O maquinário de clássico SEMPRE existiu (`derbyIntensity 1.15×` em
 * contextFactors) mas nenhum caller passava `isDerby`. Esta ponte liga as
 * duas fontes de rivalidade que o jogo JÁ rastreia:
 *
 *   • `ligaOleNemesis` — o algoz da última Liga Ole (revanche pendente).
 *   • `rivalryEncounters` — head-to-head da Liga Global MVP (≥3 = clássico).
 *
 * PURO — recebe fatias do estado, devolve boolean.
 */

export const RIVALRY_DERBY_THRESHOLD = 3;

export interface RivalDerbyInput {
  /** Id do adversário do confronto. */
  opponentId: string | undefined;
  /** Nêmesis pendente da Liga Ole (revanche = clássico). */
  ligaOleNemesisId?: string;
  /** Head-to-head do MEU time na Liga Global MVP (teamId → nº de confrontos). */
  rivalryEncounters?: Record<string, number>;
}

/** O confronto é um clássico? (nêmesis OU 3+ encontros na rivalidade) */
export function nemesisIsDerby(input: RivalDerbyInput): boolean {
  if (!input.opponentId) return false;
  if (input.ligaOleNemesisId && input.ligaOleNemesisId === input.opponentId) return true;
  const count = input.rivalryEncounters?.[input.opponentId] ?? 0;
  return count >= RIVALRY_DERBY_THRESHOLD;
}

/** Fatia mínima do estado que a ponte precisa (evita acoplar o tipo inteiro). */
export function derbyInputFromState(state: {
  ligaOleNemesis?: { id: string };
  globalLeagueMVP?: { teams: { id: string; managerId?: string; rivalryEncounters?: Record<string, number> }[] };
}, opponentId: string | undefined, myManagerId?: string): RivalDerbyInput {
  const myTeam = myManagerId
    ? state.globalLeagueMVP?.teams.find((t) => t.managerId === myManagerId)
    : undefined;
  return {
    opponentId,
    ligaOleNemesisId: state.ligaOleNemesis?.id,
    rivalryEncounters: myTeam?.rivalryEncounters,
  };
}
