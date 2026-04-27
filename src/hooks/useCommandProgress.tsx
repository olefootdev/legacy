/**
 * Hook para rastrear progresso de execução de comandos de voz.
 *
 * Monitora estado de comandos ativos por jogador e fornece
 * narrativa de progresso em tempo real.
 */

import { useEffect, useState } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';
import type { PitchPlayerState } from '@/engine/types';

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
    invade_box: 'Avançando...',
    dribble_attempt: 'Preparando drible...',
    take_shot: 'Posicionando...',
    cross_ball: 'Buscando espaço...',
    pass_to_player: 'Procurando passe...',
    hold_ball: 'Protegendo bola...',
    quick_pass: 'Tocando...',
    switch_play: 'Trocando lado...',
    mark_player: 'Aproximando...',
    block_advance: 'Posicionando...',
    aggressive_tackle: 'Preparando entrada...',
    tactical_foul: 'Aproximando...',
    team_press_high: 'Subindo pressão...',
    team_retreat: 'Recuando...',
    team_hold_possession: 'Organizando posse...',
    team_high_line: 'Subindo linha...',
    break_line: 'Acelerando...',
    run_behind: 'Correndo...',
    pedal_to_metal: 'Aumentando ritmo...',
    free_play: 'Improvisando...',
    wait_support: 'Esperando...',
    stretch_team: 'Abrindo espaços...',
    hold_small_area: 'Invadindo área...',
  };

  return narratives[intent] ?? 'Executando...';
}

function getNarrativeMid(intent: VoiceIntent): string {
  const narratives: Partial<Record<VoiceIntent, string>> = {
    invade_box: 'Indo pra área...',
    dribble_attempt: 'Driblando...',
    take_shot: 'Mirando...',
    cross_ball: 'Cruzando...',
    pass_to_player: 'Passando...',
    hold_ball: 'Segurando bola...',
    quick_pass: 'Tocando rápido...',
    switch_play: 'Trocando jogo...',
    mark_player: 'Marcando...',
    block_advance: 'Bloqueando...',
    aggressive_tackle: 'Entrando...',
    tactical_foul: 'Fazendo falta...',
    team_press_high: 'Pressionando...',
    team_retreat: 'Voltando...',
    team_hold_possession: 'Segurando posse...',
    team_high_line: 'Linha alta...',
    break_line: 'Quebrando linha...',
    run_behind: 'Pelas costas...',
    pedal_to_metal: 'Acelerando...',
    free_play: 'Jogando livre...',
    wait_support: 'Aguardando apoio...',
    stretch_team: 'Esticando time...',
    hold_small_area: 'Na pequena área...',
  };

  return narratives[intent] ?? 'Em execução...';
}

function getNarrativeEnd(intent: VoiceIntent): string {
  const narratives: Partial<Record<VoiceIntent, string>> = {
    invade_box: 'Na área!',
    dribble_attempt: 'Finalizando drible...',
    take_shot: 'Chutando!',
    cross_ball: 'Cruzando!',
    pass_to_player: 'Passando!',
    hold_ball: 'Bola segura',
    quick_pass: 'Tocado!',
    switch_play: 'Trocado!',
    mark_player: 'Marcando firme',
    block_advance: 'Bloqueado',
    aggressive_tackle: 'Entrada!',
    tactical_foul: 'Falta!',
    team_press_high: 'Pressão alta!',
    team_retreat: 'Recuado',
    team_hold_possession: 'Posse segura',
    team_high_line: 'Linha subida',
    break_line: 'Linha quebrada!',
    run_behind: 'Pelas costas!',
    pedal_to_metal: 'Ritmo alto!',
    free_play: 'Improvisando!',
    wait_support: 'Apoio chegando',
    stretch_team: 'Time esticado',
    hold_small_area: 'Na pequena!',
  };

  return narratives[intent] ?? 'Concluído!';
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
        <div className="h-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
          <div
            className="h-full bg-neon-yellow transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Narrativa */}
        <p
          className="mt-0.5 text-center text-[8px] font-bold text-white/90"
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {narrative}
        </p>
      </div>
    </div>
  );
}
