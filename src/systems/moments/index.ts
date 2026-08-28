/**
 * moments — ponto de entrada do detector de momento.
 *
 * Reexporta `detectMoment` e traz o tradutor de nome de fase → `MomentStage`,
 * que é o que permite Liga Ole e Legends Cup (cada uma com seus próprios
 * rótulos em pt-BR) alimentarem o mesmo detector.
 */

export * from './detectMoment';

import type { MomentStage } from './detectMoment';

/**
 * Traduz o rótulo de fase de qualquer competição pro estágio canônico.
 *
 * Cobre os catálogos vivos:
 *   Liga Ole      — 'Fase de 32' · 'Oitavas' · 'Quartas' · 'Semifinal' · 'Final'
 *   Legends Cup   — 'Fase de Grupos' · 'Playoff' · 'Oitavas' · … · 'Final'
 *
 * Rótulo desconhecido devolve `undefined` — o detector então simplesmente não
 * aplica peso de fase, em vez de inventar uma que não existe.
 */
export function stageFromRoundName(round: string | undefined | null): MomentStage | undefined {
  if (!round) return undefined;
  const r = round.trim().toLowerCase();
  if (r.includes('final')) return r.includes('semi') ? 'semi' : 'final';
  if (r.includes('quarta')) return 'quarter';
  if (r.includes('oitava')) return 'round16';
  if (r.includes('grupo') || r.includes('fase de 32') || r.includes('playoff')) return 'group';
  return undefined;
}
