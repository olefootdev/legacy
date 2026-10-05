/**
 * Hook para rastrear progresso de execução de comandos de voz.
 *
 * Monitora estado de comandos ativos por jogador e fornece
 * narrativa de progresso em tempo real.
 */

import { useEffect, useState } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';
import type { PitchPlayerState } from '@/engine/types';
import { L } from '@/i18n/L';

export interface CommandProgress {
  playerId: string;
  intent: VoiceIntent;
  /** Progresso 0-100. */
  progress: number;
  /** Narrativa atual ("Indo pra área...", "Driblando...", etc). */
  narrative: string;
  /** Timestamp de início (ms). */
  startedAt: number;
  /** Duração esperada (ms). */
  expectedDuration: number;
}

interface UseCommandProgressOptions {
  /** Comandos ativos (do reducer). */
  activeCommands: Map<string, { intent: VoiceIntent; issuedAt: number; expiresAt: number }>;
  /** Jogadores no campo. */
  players: PitchPlayerState[];
  /** Tempo de simulação atual (ms). */
  simTimeMs: number;
}

/**
 * Hook que calcula progresso de comandos ativos.
 */
export function useCommandProgress(
  options: UseCommandProgressOptions,
): Map<string, CommandProgress> {
  const { activeCommands, players, simTimeMs } = options;
  const [progressMap, setProgressMap] = useState<Map<string, CommandProgress>>(new Map());

  useEffect(() => {
    const newMap = new Map<string, CommandProgress>();

    for (const [playerId, cmd] of activeCommands.entries()) {
      const elapsed = simTimeMs - cmd.issuedAt;
      const duration = cmd.expiresAt - cmd.issuedAt;
      const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));

      const player = players.find((p) => p.playerId === playerId);
      const narrative = generateNarrative(cmd.intent, progress, player);

      newMap.set(playerId, {
        playerId,
        intent: cmd.intent,
        progress,
        narrative,
        startedAt: cmd.issuedAt,
        expectedDuration: duration,
      });
    }

    setProgressMap(newMap);
  }, [activeCommands, players, simTimeMs]);

  return progressMap;
}

/**
 * Gera narrativa de progresso baseada no intent e progresso atual.
 */
function generateNarrative(
  intent: VoiceIntent,
  progress: number,
  player?: PitchPlayerState,
): string {
  // Fase inicial (0-30%)
  if (progress < 30) {
    return getNarrativeStart(intent);
  }

  // Fase intermediária (30-70%)
  if (progress < 70) {
    return getNarrativeMid(intent);
  }

  // Fase final (70-100%)
  return getNarrativeEnd(intent);
}

function getNarrativeStart(intent: VoiceIntent): string {
  const narratives: Partial<Record<VoiceIntent, string>> = {
    invade_box: L('Avançando...', 'Pushing up...'),
    dribble_attempt: L('Preparando drible...', 'Lining up the dribble...'),
    take_shot: L('Posicionando...', 'Positioning...'),
    cross_ball: L('Buscando espaço...', 'Finding space...'),
    pass_to_player: L('Procurando passe...', 'Looking for a pass...'),
    hold_ball: L('Protegendo bola...', 'Shielding the ball...'),
    quick_pass: L('Tocando...', 'Passing...'),
    switch_play: L('Trocando lado...', 'Switching sides...'),
    mark_player: L('Aproximando...', 'Closing in...'),
    block_advance: L('Posicionando...', 'Positioning...'),
    aggressive_tackle: L('Preparando entrada...', 'Setting up the tackle...'),
    tactical_foul: L('Aproximando...', 'Closing in...'),
    team_press_high: L('Subindo pressão...', 'Raising the press...'),
    team_retreat: L('Recuando...', 'Dropping back...'),
    team_hold_possession: L('Organizando posse...', 'Building possession...'),
    team_high_line: L('Subindo linha...', 'Pushing the line up...'),
    break_line: L('Acelerando...', 'Speeding up...'),
    run_behind: L('Correndo...', 'Running...'),
    pedal_to_metal: L('Aumentando ritmo...', 'Upping the tempo...'),
    free_play: L('Improvisando...', 'Improvising...'),
    wait_support: L('Esperando...', 'Waiting...'),
    stretch_team: L('Abrindo espaços...', 'Opening space...'),
    hold_small_area: L('Invadindo área...', 'Into the box...'),
  };

  return narratives[intent] ?? L('Executando...', 'Executing...');
}

function getNarrativeMid(intent: VoiceIntent): string {
  const narratives: Partial<Record<VoiceIntent, string>> = {
    invade_box: L('Indo pra área...', 'Heading into the box...'),
    dribble_attempt: L('Driblando...', 'Dribbling...'),
    take_shot: L('Mirando...', 'Taking aim...'),
    cross_ball: L('Cruzando...', 'Crossing...'),
    pass_to_player: L('Passando...', 'Passing...'),
    hold_ball: L('Segurando bola...', 'Holding the ball...'),
    quick_pass: L('Tocando rápido...', 'Quick passing...'),
    switch_play: L('Trocando jogo...', 'Switching play...'),
    mark_player: L('Marcando...', 'Marking...'),
    block_advance: L('Bloqueando...', 'Blocking...'),
    aggressive_tackle: L('Entrando...', 'Going in...'),
    tactical_foul: L('Fazendo falta...', 'Making the foul...'),
    team_press_high: L('Pressionando...', 'Pressing...'),
    team_retreat: L('Voltando...', 'Tracking back...'),
    team_hold_possession: L('Segurando posse...', 'Keeping possession...'),
    team_high_line: L('Linha alta...', 'High line...'),
    break_line: L('Quebrando linha...', 'Breaking the line...'),
    run_behind: L('Pelas costas...', 'In behind...'),
    pedal_to_metal: L('Acelerando...', 'Speeding up...'),
    free_play: L('Jogando livre...', 'Playing free...'),
    wait_support: L('Aguardando apoio...', 'Waiting for support...'),
    stretch_team: L('Esticando time...', 'Stretching the team...'),
    hold_small_area: L('Na pequena área...', 'In the six-yard box...'),
  };

  return narratives[intent] ?? L('Em execução...', 'In progress...');
}

function getNarrativeEnd(intent: VoiceIntent): string {
  const narratives: Partial<Record<VoiceIntent, string>> = {
    invade_box: L('Na área!', 'In the box!'),
    dribble_attempt: L('Finalizando drible...', 'Finishing the dribble...'),
    take_shot: L('Chutando!', 'Shooting!'),
    cross_ball: L('Cruzando!', 'Crossing!'),
    pass_to_player: L('Passando!', 'Passing!'),
    hold_ball: L('Bola segura', 'Ball secured'),
    quick_pass: L('Tocado!', 'Passed!'),
    switch_play: L('Trocado!', 'Switched!'),
    mark_player: L('Marcando firme', 'Marking tight'),
    block_advance: L('Bloqueado', 'Blocked'),
    aggressive_tackle: L('Entrada!', 'Tackle!'),
    tactical_foul: L('Falta!', 'Foul!'),
    team_press_high: L('Pressão alta!', 'High press!'),
    team_retreat: L('Recuado', 'Dropped back'),
    team_hold_possession: L('Posse segura', 'Possession secured'),
    team_high_line: L('Linha subida', 'Line up'),
    break_line: L('Linha quebrada!', 'Line broken!'),
    run_behind: L('Pelas costas!', 'In behind!'),
    pedal_to_metal: L('Ritmo alto!', 'High tempo!'),
    free_play: L('Improvisando!', 'Improvising!'),
    wait_support: L('Apoio chegando', 'Support arriving'),
    stretch_team: L('Time esticado', 'Team stretched'),
    hold_small_area: L('Na pequena!', 'In the six-yard box!'),
  };

  return narratives[intent] ?? L('Concluído!', 'Done!');
}

/**
 * Componente de barra de progresso para token do jogador.
 */
export function CommandProgressBar({
  progress,
  narrative,
}: {
  progress: number;
  narrative: string;
}) {
  return (
    <div className="absolute -top-8 left-0 right-0 z-10">
      <div className="mx-auto w-full max-w-[80px]">
        {/* Barra de progresso */}
        <div className="h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-neon-yellow transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Narrativa */}
        <p
          className="mt-0.5 text-center text-[8px] font-bold text-white/90"
        >
          {narrative}
        </p>
      </div>
    </div>
  );
}
