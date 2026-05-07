/**
 * Resolução de passe — determina se o passe CHEGA ao receptor.
 *
 * Separação conceitual:
 *   decideNextAction() = INTENÇÃO ("passo pro ponta")
 *   resolvePass()      = EXECUÇÃO ("a bola chegou?")
 *
 * Outcomes:
 *   - completed:    bola chega (jogo continua normalmente)
 *   - intercepted:  defensor corta (posse inverte)
 *   - out_of_play:  bola sai do campo (lateral/tiro de meta)
 */

import type { ClassicPlayer, PassSubtype } from './types';
import { PASS_COMPLETION, type PassOutcome } from './calibrationData';
import { ovrModifier } from './ovrModifier';

interface ResolvePassInput {
  passer: ClassicPlayer;
  receiver: ClassicPlayer;
  subtype: PassSubtype;
  distance: number;
  underPressure: boolean;
  minute: number;
}

export interface PassResolution {
  outcome: PassOutcome;
  interceptedBy?: ClassicPlayer;
}

function subtypeToPassType(subtype: PassSubtype): 'short' | 'medium' | 'long' | 'cross' {
  switch (subtype) {
    case 'curto': return 'short';
    case 'rapido': return 'short'; // 1-toque é curto mas sob pressão
    case 'planejado': return 'medium';
    case 'cruzamento': return 'cross';
    default: return 'medium';
  }
}

export function resolvePass(
  input: ResolvePassInput,
  nearbyOpponents: ClassicPlayer[],
): PassResolution {
  const { passer, receiver, subtype, distance, underPressure, minute } = input;

  const passType = subtypeToPassType(subtype);
  const base = PASS_COMPLETION[passType].baseCompletion;

  // Moduladores
  let prob = base;

  // OVR do passador — jogador melhor completa mais
  prob *= ovrModifier(passer.ovr);

  // Distância longa penaliza (suavizado — jogadores de jogo são melhores)
  if (distance > 250) prob *= 0.93;
  if (distance > 350) prob *= 0.88;

  // Pressão no passador (menos punitivo — ação flui melhor)
  if (underPressure) prob *= 0.92;

  // Fadiga (suavizado — jogo não deve punir tanto)
  if (passer.fatigue > 75) prob *= 0.96;
  if (passer.fatigue > 85) prob *= 0.93;

  // Rapido (1-toque) é levemente mais arriscado
  if (subtype === 'rapido') prob *= 0.95;

  // Clamp (floor mais alto — passes não falham demais)
  prob = Math.max(0.25, Math.min(0.98, prob));

  // Roll
  if (Math.random() < prob) {
    return { outcome: 'completed' };
  }

  // Falhou — interceptação (50%) ou out_of_play (50%)
  // Menos interceptações = menos reset de jogo = mais fluidez
  const opponentNearReceiver = nearbyOpponents.find(o =>
    Math.hypot(o.position.x - receiver.position.x, o.position.y - receiver.position.y) < 55
  );

  if (opponentNearReceiver && Math.random() < 0.50) {
    return { outcome: 'intercepted', interceptedBy: opponentNearReceiver };
  }

  return { outcome: 'out_of_play' };
}
