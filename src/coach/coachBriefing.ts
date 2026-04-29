import type { OlefootGameState } from '@/game/types';
import type { ConversationMessage } from './types';

/**
 * Gera 1 frase de briefing pré-jogo (1min antes da partida LEGACY).
 * Formato: "Time pronto, fadiga X%, Y lesionados, sugestão FORMAÇÃO[ contra OPONENTE]."
 *
 * Saída pluga em `state.manager.coach.conversationContext` via COACH_ADD_MESSAGE.
 */
export function buildPreMatchBriefing(state: OlefootGameState, opponent?: string): ConversationMessage | null {
  const players = Object.values(state.players);
  if (players.length === 0) return null;
  const coach = state.manager.coach;
  if (!coach) return null;

  const health = state.playerHealth ?? {};
  let totalFatigue = 0;
  let injured = 0;
  let suspended = 0;
  for (const p of players) {
    const h = health[p.id];
    totalFatigue += h?.fatigue ?? p.fatigue ?? 0;
    if ((h?.outForMatches ?? p.outForMatches ?? 0) > 0) injured++;
    if ((h?.suspendedMatches ?? 0) > 0) suspended++;
  }
  const avgFatigue = totalFatigue / players.length;
  const formation = state.manager.formationScheme;

  const parts: string[] = ['Time pronto', `fadiga ${avgFatigue.toFixed(0)}%`];
  if (injured > 0) parts.push(`${injured} lesionado${injured > 1 ? 's' : ''}`);
  if (suspended > 0) parts.push(`${suspended} suspenso${suspended > 1 ? 's' : ''}`);
  parts.push(opponent ? `sugestão ${formation} contra ${opponent}` : `formação ${formation}`);

  const content = parts.join(', ') + '.';

  return {
    role: 'assistant',
    content,
    timestamp: Date.now(),
  };
}
