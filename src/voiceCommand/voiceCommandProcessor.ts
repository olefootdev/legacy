/**
 * Sistema completo de processamento de comandos de voz.
 *
 * Fluxo:
 * 1. Transcrição (Web Speech API)
 * 2. Matching com biblioteca de frases (Supabase)
 * 3. Parse determinístico (intentMatcher)
 * 4. Validação (commandValidation)
 * 5. Resolução de alvos (jogadores)
 * 6. Execução (dispatch para reducer)
 * 7. Feedback visual (balões + progresso)
 */

import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { VoiceIntent, ParsedCommand as VoiceParsedCommand } from '@/voiceCommand/types';
import { parseVoiceCommand, type MatchRosterContext } from '@/voiceCommand/intentMatcher';
import { matchPhrase, incrementPhraseUsage } from '@/voiceCommand/phraseLibrary';
import { validateCommand, type ValidationContext } from '@/voiceCommand/commandValidation';
import { findClosestPlayerName } from '@/voiceCommand/intelligentParser';

export interface VoiceCommandResult {
  success: boolean;
  message: string;
  /** Comandos parseados (pode ser múltiplos se comando composto). */
  commands?: VoiceParsedCommand[];
  /** Jogadores afetados. */
  targetPlayers?: string[];
  /** Intent detectado. */
  intent?: VoiceIntent;
  /** Confiança do matching (0-100). */
  confidence?: number;
}

export interface ProcessVoiceCommandOptions {
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
}

/**
 * Processa comando de voz completo: transcrição → parse → validação → execução.
 */
export async function processVoiceCommand(
  options: ProcessVoiceCommandOptions
): Promise<VoiceCommandResult> {
  const { transcript, players, playersById, ballCarrierId, side, minute } = options;

  // 1. Normaliza transcrição
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) {
    return {
      success: false,
      message: 'Comando vazio',
    };
  }

  // 2. Tenta matching com biblioteca de frases do Supabase
  let parsedCommands: VoiceParsedCommand[] = [];
  let confidence = 0;
  let usedLibrary = false;

  try {
    const phraseMatch = await matchPhrase(normalizedTranscript, 0.7);

    if (phraseMatch) {
      // Encontrou na biblioteca
      usedLibrary = true;
      confidence = Math.round(phraseMatch.similarity * 100);

      // Incrementa contador de uso
      await incrementPhraseUsage(phraseMatch.phrase.id);

      // Cria comando a partir da frase da biblioteca
      parsedCommands = [{
        intent: phraseMatch.phrase.intent,
        target: { kind: 'ball_carrier' }, // Default: portador da bola
        rawText: normalizedTranscript,
        fragmentIndex: 0,
      }];
    }
  } catch (err) {
    console.warn('[voice] Erro ao buscar na biblioteca:', err);
  }

  // 3. Se não encontrou na biblioteca, usa parser determinístico
  if (parsedCommands.length === 0) {
    const rosterContext: MatchRosterContext = {
      homePlayers: players.map(p => ({
        playerId: p.playerId,
        name: p.name,
        num: p.shirtNumber,
        slotId: p.slotId,
        role: p.role,
      })),
      ballCarrierPlayerId: ballCarrierId,
    };

    parsedCommands = parseVoiceCommand(normalizedTranscript, rosterContext);
    confidence = parsedCommands.length > 0 ? 85 : 0;
  }

  // 4. Se não conseguiu parsear, retorna erro
  if (parsedCommands.length === 0) {
    return {
      success: false,
      message: `❌ Não entendi "${normalizedTranscript}". Tente: "chuta", "passa pro Adriano", "pressiona alto"`,
      confidence: 0,
    };
  }

  // 5. Processa cada comando parseado
  const results: VoiceCommandResult[] = [];

  for (const cmd of parsedCommands) {
    // Resolve alvo do comando
    const targetPlayer = resolveCommandTarget(cmd, players, ballCarrierId);

    if (!targetPlayer && cmd.target.kind !== 'team') {
      results.push({
        success: false,
        message: `❌ Jogador não encontrado: ${JSON.stringify(cmd.target)}`,
      });
      continue;
    }

    // Valida comando
    if (targetPlayer) {
      const validationCtx: ValidationContext = {
        player: {
          playerId: targetPlayer.playerId,
          name: targetPlayer.name,
          x: targetPlayer.x,
          y: targetPlayer.y,
          role: targetPlayer.role,
          slotId: targetPlayer.slotId,
          attributes: playersById[targetPlayer.playerId]?.attributes,
          hasBall: targetPlayer.playerId === ballCarrierId,
        },
        match: {
          side,
          ballCarrierPlayerId: ballCarrierId,
          minute,
        },
      };

      const validation = validateCommand(cmd.intent, validationCtx);

      if (!validation.valid && validation.severity === 'error') {
        results.push({
          success: false,
          message: `❌ ${validation.reason}${validation.suggestion ? ` — ${validation.suggestion}` : ''}`,
        });
        continue;
      }

      // Warning: permite mas avisa
      if (validation.severity === 'warning') {
        results.push({
          success: true,
          message: `⚠️ ${validation.reason}`,
          commands: [cmd],
          targetPlayers: [targetPlayer.playerId],
          intent: cmd.intent,
          confidence,
        });
        continue;
      }
    }

    // Comando válido
    const targetIds = targetPlayer ? [targetPlayer.playerId] : players.map(p => p.playerId);
    const targetNames = targetPlayer ? [targetPlayer.name] : ['todo o time'];

    results.push({
      success: true,
      message: `✅ ${getCommandFeedback(cmd.intent, targetNames)} ${usedLibrary ? '(biblioteca)' : ''}`,
      commands: [cmd],
      targetPlayers: targetIds,
      intent: cmd.intent,
      confidence,
    });
  }

  // 6. Retorna resultado agregado
  if (results.length === 0) {
    return {
      success: false,
      message: '❌ Nenhum comando válido',
    };
  }

  const allSuccess = results.every(r => r.success);
  const allCommands = results.flatMap(r => r.commands || []);
  const allTargets = [...new Set(results.flatMap(r => r.targetPlayers || []))];

  return {
    success: allSuccess,
    message: results.map(r => r.message).join(' • '),
    commands: allCommands,
    targetPlayers: allTargets,
    intent: results[0]?.intent,
    confidence,
  };
}

/**
 * Resolve alvo do comando para um jogador específico.
 */
function resolveCommandTarget(
  cmd: VoiceParsedCommand,
  players: PitchPlayerState[],
  ballCarrierId?: string,
): PitchPlayerState | null {
  const target = cmd.target;

  switch (target.kind) {
    case 'player_id':
      return players.find(p => p.playerId === target.playerId) || null;

    case 'player_name':
      return findClosestPlayerName(target.nameToken, players);

    case 'shirt_number':
      return players.find(p => p.shirtNumber === target.number) || null;

    case 'ball_carrier':
      return ballCarrierId ? players.find(p => p.playerId === ballCarrierId) || null : null;

    case 'role':
      // Retorna primeiro jogador da role (comandos coletivos)
      return players.find(p => p.role === target.role) || null;

    case 'team':
      // Comandos de time não têm alvo específico
      return null;

    default:
      return null;
  }
}

/**
 * Gera feedback legível por intent.
 */
function getCommandFeedback(intent: VoiceIntent, targetNames: string[]): string {
  const target = targetNames.join(', ');

  const feedbacks: Partial<Record<VoiceIntent, string>> = {
    take_shot: `${target} vai chutar`,
    dribble_attempt: `${target} vai driblar`,
    cross_ball: `${target} vai cruzar`,
    pass_to_player: `${target} vai passar`,
    hold_ball: `${target} vai segurar a bola`,
    quick_pass: `${target} vai tocar rápido`,
    invade_box: `${target} vai invadir a área`,
    mark_player: `${target} vai marcar`,
    team_press_high: 'Time vai pressionar alto',
    team_retreat: 'Time vai recuar',
    team_hold_possession: 'Time vai segurar a posse',
    break_line: `${target} vai quebrar a linha`,
    run_behind: `${target} vai correr pelas costas`,
    pedal_to_metal: 'Time vai acelerar',
  };

  return feedbacks[intent] || `Comando: ${intent}`;
}
