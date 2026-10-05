import type { OlefootGameState } from '@/game/types';
import type { ConversationMessage } from './types';
import { L } from '@/i18n/L';

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

  const parts: string[] = [L('Time pronto', 'Team ready'), L(`fadiga ${avgFatigue.toFixed(0)}%`, `fatigue ${avgFatigue.toFixed(0)}%`)];
  if (injured > 0) parts.push(L(`${injured} lesionado${injured > 1 ? 's' : ''}`, `${injured} injured`));
  if (suspended > 0) parts.push(L(`${suspended} suspenso${suspended > 1 ? 's' : ''}`, `${suspended} suspended`));
  parts.push(opponent ? L(`sugestão ${formation} contra ${opponent}`, `suggested ${formation} vs ${opponent}`) : L(`formação ${formation}`, `formation ${formation}`));

  const content = parts.join(', ') + '.';

  return {
    role: 'assistant',
    content,
    timestamp: Date.now(),
  };
}
