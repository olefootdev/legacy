/**
 * Handlers de eventos posicionais (falta, escanteio, lateral).
 *
 * Cada um delega ao `getBestAction` mas força a `DecisionContext` adequada e,
 * quando o cenário é específico (escanteio sempre busca alvo na grande área),
 * sobrescreve o resultado pra alinhar com a regra do futebol.
 */

import { isBox } from '@/match/spatialZones';
import { getBestAction, type Decision } from '@/smartfield/decision';
import { getAwarenessContext, type AwarePlayer } from '@/smartfield/awareness';

export function resolveFreeKick(
  taker: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
): Decision {
  return getBestAction(taker, allPlayers, side, { hasBall: true, isFreeKick: true });
}

export function resolveCorner(
  taker: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
): Decision {
  // Em escanteio, força busca de alvo na grande área.
  const aw = getAwarenessContext(taker, allPlayers, side);
  const targetInBox = aw.availableTeammates.find((t) => isBox(t.zone));
  if (targetInBox) {
    return {
      action: 'CROSS',
      target: targetInBox,
      confidence: 0.85,
      reason: 'corner → cruzamento na área',
    };
  }
  return { action: 'CROSS', confidence: 0.55, reason: 'corner — sem alvo, área lotada' };
}

export function resolveThrowIn(
  taker: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
): Decision {
  const aw = getAwarenessContext(taker, allPlayers, side);
  if (aw.bestPassOption) {
    return {
      action: 'PASS',
      target: aw.bestPassOption,
      confidence: 0.75,
      reason: 'throw-in → manter posse',
    };
  }
  return { action: 'CLEAR', confidence: 0.5, reason: 'throw-in — sem opção segura' };
}
