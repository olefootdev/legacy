/**
 * Integração de Learning pós-jogo no reducer
 *
 * Aplica eventos de aprendizado capturados durante a partida
 * ao AgentProfile de cada jogador.
 */

import type { OlefootGameState } from '@/game/types';
import type { LiveMatchSnapshot } from '@/engine/types';
import { MatchLearningCapture, updateAgentProfileWithLearning } from './MatchLearningEngine';

/**
 * Captura eventos de aprendizado do snapshot da partida
 */
export function captureMatchLearningEvents(
  snapshot: LiveMatchSnapshot,
  homeRoster: string[],
): MatchLearningCapture {
  const capture = new MatchLearningCapture();

  // Percorre eventos da partida
  for (const event of snapshot.events) {
    if (!event.playerId) continue;

    // Só processa eventos de jogadores da casa
    if (!homeRoster.includes(event.playerId)) continue;

    const minute = event.minute;

    // Gols
    if (event.kind === 'goal_home') {
      capture.recordShotOk(event.playerId, minute, true);
      capture.recordCriticalSuccess(event.playerId, minute, 'Gol marcado');
    }

    // Chutes
    if (event.kind === 'shot_home') {
      // Verifica se foi no alvo ou fora pelo texto
      const wasWide = event.text.toLowerCase().includes('fora') || event.text.toLowerCase().includes('por cima');
      if (wasWide) {
        capture.recordShotFail(event.playerId, minute, true);
      } else {
        capture.recordShotOk(event.playerId, minute, false);
      }
    }

    // Cartões (erros críticos)
    if (event.kind === 'red_home') {
      capture.recordCriticalError(event.playerId, minute, 'Cartão vermelho');
    }
    if (event.kind === 'yellow_home') {
      // Amarelo é erro menor
      capture.recordDuelLost(event.playerId, minute);
    }

    // Lesões (não é erro do jogador, mas afeta confiança)
    if (event.kind === 'injury_home') {
      capture.recordDuelLost(event.playerId, minute);
    }
  }

  // Processa estatísticas individuais
  for (const [playerId, stats] of Object.entries(snapshot.homeStats)) {
    if (!homeRoster.includes(playerId)) continue;

    // Passes
    const passOk = stats.passesOk ?? 0;
    const passAttempt = stats.passesAttempt ?? 0;
    const passFail = passAttempt - passOk;

    // Registra alguns passes (não todos para não sobrecarregar)
    const passesToRecord = Math.min(5, passOk);
    for (let i = 0; i < passesToRecord; i++) {
      const minute = Math.floor(Math.random() * 90);
      const underPressure = Math.random() > 0.7;
      capture.recordPassOk(playerId, minute, underPressure);
    }

    const passFailToRecord = Math.min(3, passFail);
    for (let i = 0; i < passFailToRecord; i++) {
      const minute = Math.floor(Math.random() * 90);
      const underPressure = Math.random() > 0.5;
      capture.recordPassFail(playerId, minute, underPressure);
    }

    // Duelos (tackles)
    const tackles = stats.tackles ?? 0;
    if (tackles > 0) {
      const duelsWon = Math.floor(tackles * 0.6); // Assume 60% de sucesso
      for (let i = 0; i < Math.min(3, duelsWon); i++) {
        const minute = Math.floor(Math.random() * 90);
        capture.recordDuelWon(playerId, minute);
      }
    }
  }

  return capture;
}

/**
 * Aplica learning aos jogadores após a partida
 */
export function applyMatchLearningToPlayers(
  state: OlefootGameState,
  snapshot: LiveMatchSnapshot,
): OlefootGameState {
  const homeRoster = Object.values(snapshot.matchLineupBySlot);
  const capture = captureMatchLearningEvents(snapshot, homeRoster);

  const updatedPlayers = { ...state.players };

  for (const playerId of homeRoster) {
    const player = updatedPlayers[playerId];
    if (!player || !player.agentProfile) continue;

    const playerEvents = capture.getPlayerEvents(playerId);
    if (playerEvents.length === 0) continue;

    // Atualiza profile com learning
    const updatedProfile = updateAgentProfileWithLearning(
      player.agentProfile,
      playerEvents,
    );

    updatedPlayers[playerId] = {
      ...player,
      agentProfile: updatedProfile,
    };
  }

  return {
    ...state,
    players: updatedPlayers,
  };
}
