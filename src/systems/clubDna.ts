/**
 * clubDna.ts — DNA Tático do Clube (eixo Romântico ↔ Pragmático).
 *
 * Filosofia Fable ("halo/chifres"): toda escolha tática deixa MARCA visível e
 * permanente na identidade do clube. Não existe lado certo — Romântico cria e
 * sofre mais gols; Pragmático vence feio e a torcida canta menos. Identidade,
 * não score.
 *
 * Alimentado pelo que o motor JÁ registra na Partida Rápida: o log de estilos
 * do dock ao vivo (quickTacticalLive) + a formação usada. Muda DEVAGAR (cap
 * por partida), como a moralidade de Fable — uma partida não te redefine.
 *
 * PURO e determinístico — sem Date/Math.random.
 */

import { FORMATION_OFFENSE } from '@/match/quickTacticalLive';
import type { TacticalIntensityLevel } from '@/match/quickTacticalIntensity';

export interface ClubDnaState {
  /** -100 (Pragmático) … +100 (Romântico). */
  axis: number;
  /** Delta aplicado na última partida — anima a UI do pós-jogo. */
  lastShift: number;
  /** Partidas que já alimentaram o eixo. */
  matchesSampled: number;
}

export function createInitialClubDna(): ClubDnaState {
  return { axis: 0, lastShift: 0, matchesSampled: 0 };
}

/** Peso de cada estilo do dock no eixo (attack=romântico, defend=pragmático). */
const STYLE_DNA: Record<TacticalIntensityLevel, number> = {
  attack: 4, press: 3, possession: 1, counter: -2, defend: -4,
};

/** Cap de mudança por partida — identidade muda devagar (inércia Fable). */
const SHIFT_CAP = 8;

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

/**
 * Aplica UMA Partida Rápida ao DNA: soma os estilos escolhidos ao vivo + o
 * viés da formação final. Sem escolhas (jogo no automático), o eixo regride
 * 1 ponto rumo ao neutro — identidade precisa ser exercida pra durar.
 */
export function applyQuickMatchToDna(
  dna: ClubDnaState | undefined,
  args: { styleLog: TacticalIntensityLevel[]; formation?: string },
): ClubDnaState {
  const cur = dna ?? createInitialClubDna();
  let delta = args.styleLog.reduce((s, c) => s + (STYLE_DNA[c] ?? 0), 0);
  delta += Math.round((FORMATION_OFFENSE[args.formation ?? ''] ?? 0) * 3);
  if (args.styleLog.length === 0 && delta === 0) {
    delta = cur.axis > 0 ? -1 : cur.axis < 0 ? 1 : 0;
  }
  const capped = clamp(-SHIFT_CAP, SHIFT_CAP, delta);
  return {
    axis: clamp(-100, 100, cur.axis + capped),
    lastShift: capped,
    matchesSampled: cur.matchesSampled + 1,
  };
}

/** Rótulo editorial do eixo — aparece junto do escudo/pós-jogo. */
export function dnaLabel(axis: number): string {
  if (axis >= 60) return 'Romântico incorrigível';
  if (axis >= 25) return 'Romântico';
  if (axis >= -24) return 'Equilibrista';
  if (axis >= -59) return 'Pragmático';
  return 'Pragmático de ferro';
}

/** Frase do narrador na entrada em campo, por faixa do eixo. */
export function dnaEntranceLine(axis: number): string | null {
  if (axis >= 60) return 'O time que nunca recua entra no gramado.';
  if (axis >= 25) return 'Time de tocar pra frente — a torcida sabe o que esperar.';
  if (axis <= -60) return 'Frio, fechado, cirúrgico. O adversário que se vire.';
  if (axis <= -25) return 'Time de resultado — feio ou bonito, o que importa é o placar.';
  return null;
}

/**
 * Viés real nos agentes: DNA romântico empurra o risco/finalização pra cima,
 * pragmático pra baixo. Mesma escala do `riskTaking` das lendas (±0.05 no
 * shot bias do pickAction) — soma, não substitui.
 */
export function dnaRiskBias(axis: number): number {
  return (clamp(-100, 100, axis) / 100) * 0.05;
}
