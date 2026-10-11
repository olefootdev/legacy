/**
 * placarAoVivo — a ÚNICA porta por onde o aparelho conta gol.
 *
 * UMA VERDADE SÓ (Partida Viva, Fase 0): o aparelho não decide lance nenhum.
 * `golDoLance` (server/src/lib/partida/placar.ts — o MESMO arquivo que a
 * custódia usa) diz se o gol de um lance acontece dada a escolha do manager;
 * `emendarEventos` cola um replan do servidor exatamente no `start_minute`
 * dele, como a custódia costura. Qualquer outra conta de gol no aparelho é
 * bug — scripts/test-uma-verdade.ts varre o código pra garantir.
 */
import type { MatchPlan, MatchPlanEvent } from './quickPlanTypes';
import {
  batedorDoPenalti, contarPartida, escolhaAutomatica, escolhasVazias, golDoLance, lanceDoEvento,
  type Escolhas, type LanceDaVerdade,
} from '../../server/src/lib/partida/placar';

export { batedorDoPenalti, contarPartida, escolhaAutomatica, escolhasVazias, golDoLance, lanceDoEvento };
export type { Escolhas, LanceDaVerdade };

/** O lance da verdade de um evento do plano (null = não conta pro placar). */
export function lanceDe(ev: MatchPlanEvent): LanceDaVerdade | null {
  return lanceDoEvento(ev);
}

/**
 * O estado da partida no começo de `ateMinuto` (exclusivo), lido dos lances
 * do plano na tela com as escolhas feitas até agora — gol ainda não decidido
 * conta pela escolha automática, a mesma regra do servidor. É o que vai no
 * pedido de replan quando não há custódia (com custódia, o servidor deriva o
 * dele da cadeia de planos e ignora este).
 */
export function estadoAte(events: readonly MatchPlanEvent[], escolhas: Escolhas, ateMinuto: number) {
  const lances: LanceDaVerdade[] = [];
  for (const e of events) { const l = lanceDoEvento(e); if (l) lances.push(l); }
  const c = contarPartida(lances, escolhas, ateMinuto);
  return {
    home_score: c.placar[0], away_score: c.placar[1],
    cards_home: c.cartoes.home, cards_away: c.cartoes.away,
    sent_off_home: c.expulsos.home, sent_off_away: c.expulsos.away,
  };
}

/**
 * Cola um replan: o que já foi mostrado fica; do `start_minute` do plano novo
 * em diante vale o plano novo; o que falta até lá continua do plano antigo.
 * É a mesma regra da custódia (`costurar`): o aparelho nunca escolhe onde emendar.
 * Devolve null se o plano novo chegou TARDE (o relógio já passou do início dele):
 * aplicar seria mostrar um passado diferente do que o servidor guardou.
 */
export function emendarEventos(
  atuais: readonly MatchPlanEvent[],
  jaVistos: number,
  minutoAtual: number,
  novo: Pick<MatchPlan, 'events' | 'start_minute'>,
): { events: MatchPlanEvent[]; inicio: number } | null {
  const inicio = Math.max(1, novo.start_minute ?? 0);
  if (minutoAtual >= inicio) return null;
  const vistos = atuais.slice(0, jaVistos);
  if (vistos.some((e) => e.minute >= inicio)) return null;
  const ateInicio = atuais.slice(jaVistos).filter((e) => e.minute < inicio);
  return { events: [...vistos, ...ateInicio, ...novo.events.filter((e) => e.minute >= inicio)], inicio };
}
