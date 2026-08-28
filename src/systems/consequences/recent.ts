/**
 * recent.ts — quais consequências vieram da partida que acabou.
 *
 * Módulo PURO, separado da UI de propósito: o pós-jogo precisa dele, e os
 * self-tests também — e um self-test não consegue importar componente React
 * (a cadeia puxa o store, que depende de `import.meta.env`).
 */

import type { PersistentConsequence } from './types';

/**
 * Janela para considerar uma consequência "desta partida".
 *
 * O `PersistentConsequence` guarda `sourceEventId` prefixado pelo matchId, mas
 * a tela de pós-jogo não conhece esse id (o fixture já rodou). Recência é o
 * critério honesto: o reducer grava as consequências no mesmo tick em que
 * finaliza a partida, então tudo que nasceu nos últimos minutos veio daqui.
 */
export const RECENT_WINDOW_MS = 3 * 60 * 1000;

/**
 * Tolerância do agrupamento. `eventsFromMatchSummary` carimba TODOS os eventos
 * de uma partida com o mesmo `at`, então as consequências de um jogo nascem
 * praticamente no mesmo milissegundo. Alguns segundos de folga cobrem o custo
 * de materializar o lote.
 */
const CLUSTER_TOLERANCE_MS = 5_000;

/**
 * Consequências do clube nascidas da ÚLTIMA partida.
 *
 * Duas travas, e as duas importam:
 *
 *  1. RECÊNCIA — nada mais velho que a janela entra. Protege contra mostrar o
 *     passado como se fosse desta partida.
 *  2. AGRUPAMENTO — dentro da janela, só o lote MAIS NOVO. Sem isso, abrir a
 *     Partida Rápida logo depois de uma rodada da Liga Global misturaria as
 *     duas, e o título "o que este jogo causou" viraria mentira.
 *
 * Ordena penalidade antes de bônus: o manager precisa ver o que dói antes do
 * que afaga. Consequência de outro clube nunca entra, e nascida no futuro
 * (relógio torto, save de outra máquina) também não.
 */
export function selectRecentConsequences(
  active: Record<string, PersistentConsequence>,
  clubId: string,
  nowMs: number,
): PersistentConsequence[] {
  const candidates = Object.values(active)
    .filter((c) => c.clubId === clubId)
    .filter((c) => c.startsAt <= nowMs && nowMs - c.startsAt <= RECENT_WINDOW_MS);

  if (candidates.length === 0) return [];

  const newest = Math.max(...candidates.map((c) => c.startsAt));

  return candidates
    .filter((c) => newest - c.startsAt <= CLUSTER_TOLERANCE_MS)
    .sort((a, b) => {
      const sa = Math.sign(a.magnitude);
      const sb = Math.sign(b.magnitude);
      if (sa !== sb) return sa - sb;
      return b.startsAt - a.startsAt;
    });
}
