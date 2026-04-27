/**
 * Hook para dispatch de comandos de voz no reducer.
 *
 * Integra o processamento completo de comandos de voz com o reducer do jogo,
 * calculando obediência e aplicando comandos no match engine.
 */

import { useCallback } from 'react';
import { useGameDispatch } from '@/game/store';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { VoiceIntent } from '@/voiceCommand/types';
import { processVoiceCommand, type VoiceCommandResult } from '@/voiceCommand/voiceCommandProcessor';
import { rollObedience } from '@/voiceCommand/obedienceRoll';

export interface DispatchVoiceCommandOptions {
  /** Transcrição do áudio. */
  transcript: string;
  /** Jogadores no campo. */
  players: PitchPlayerState[];
  /** Entidades de jogadores (com atributos). */
  playersById: Record<string, PlayerEntity>;
  /** ID do portador da bola. */
  ballCarrierId?: string;
  /** Side do time (home/away). */
  side: 'home' | 'away';
  /** Minuto da partida. */
  minute: number;
  /** Obediência do time (0-100). */
  teamObedience: number;
  /** Relação manager-jogador por ID. */
  managerRelationByPlayer?: Record<string, number>;
}

/**
 * Hook para dispatch de comandos de voz.
 */
export function useVoiceCommandDispatch() {
  const dispatch = useGameDispatch();

  const dispatchVoiceCommand = useCallback(
    async (options: DispatchVoiceCommandOptions): Promise<VoiceCommandResult> => {
      const {
        transcript,
        players,
        playersById,
        ballCarrierId,
        side,
        minute,
        teamObedience,
        managerRelationByPlayer = {},
      } = options;

      // 1. Processa comando (transcrição → parse → validação)
      const result = await processVoiceCommand({
        transcript,
        players,
        playersById,
        ballCarrierId,
        side,
        minute,
      });

      if (!result.success || !result.commands || result.commands.length === 0) {
        return result;
      }

      // 2. Para cada comando parseado, calcula obediência e dispatch
      for (const cmd of result.commands) {
        const targetPlayerIds = result.targetPlayers || [];

        // Se comando é coletivo (team), aplica a todos os jogadores
        const playerIds = targetPlayerIds.length > 0
          ? targetPlayerIds
          : cmd.target.kind === 'team'
          ? players.map(p => p.playerId)
          : [];

        // Dispatch para cada jogador afetado
        for (const playerId of playerIds) {
          const player = players.find(p => p.playerId === playerId);
          if (!player) continue;

          const playerEntity = playersById[playerId];
          if (!playerEntity) continue;

          // Calcula obediência do jogador
          const obedienceResult = rollObedience({
            intent: cmd.intent,
            teamObedience,
            player: {
              attributes: playerEntity.attributes,
              role: player.role,
              slotId: player.slotId,
              confianca: 70, // TODO: pegar do estado do jogador
              fatigue: player.fatigue || 0,
              tatico: playerEntity.attributes?.tatico || 50,
              relacaoManager: managerRelationByPlayer[playerId],
            },
            assistantEffectiveness: result.confidence || 75,
          });

          // Dispatch VOICE_COMMAND_ISSUED para o reducer
          dispatch({
            type: 'VOICE_COMMAND_ISSUED',
            playerId,
            intent: cmd.intent,
            effectiveObedience: obedienceResult.effectiveScore,
            tier: obedienceResult.tier,
            rawText: transcript,
            assistantEffectiveness: result.confidence || 75,
            payload: {},
          });
        }
      }

      return result;
    },
    [dispatch]
  );

  return { dispatchVoiceCommand };
}
