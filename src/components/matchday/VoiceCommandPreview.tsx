/**
 * Componente de preview visual de comandos de voz no campo.
 *
 * Mostra durante a transcrição (interim):
 * - Seta apontando pro alvo
 * - Círculo no destino posicional
 * - Área de efeito para comandos coletivos
 */

import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Circle, Users } from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import type { ParsedCommand } from '@/voiceCommand/types';
import { commandPositionOverride } from '@/voiceCommand/commandQueue';
import { L } from '@/i18n/L';

interface VoiceCommandPreviewProps {
  /** Comando parseado (pode ser null se ainda não reconhecido). */
  command: ParsedCommand | null;
  /** Jogadores no campo (pra resolver alvos). */
  players: PitchPlayerState[];
  /** Side do time (home/away). */
  side: 'home' | 'away';
  /** Dimensões do campo em px (pra converter coords). */
  fieldWidth: number;
  fieldHeight: number;
}

export function VoiceCommandPreview({
  command,
  players,
  side,
  fieldWidth,
  fieldHeight,
}: VoiceCommandPreviewProps) {
  if (!command) return null;

  // Resolve alvo do comando
  const targetPlayer = resolveTarget(command, players);
  if (!targetPlayer) return null;

  // Calcula override posicional (se houver)
  const override = commandPositionOverride(command.intent, side, {
    x: targetPlayer.x,
    y: targetPlayer.y,
    role: targetPlayer.role,
    slotId: targetPlayer.slotId,
  });

  // Converte coords engine (0-100) pra px
  const playerPx = {
    x: (targetPlayer.x / 100) * fieldWidth,
    y: (targetPlayer.y / 100) * fieldHeight,
  };

  const targetPx = override
    ? {
        x: (override.tx / 100) * fieldWidth,
        y: (override.ty / 100) * fieldHeight,
      }
    : null;

  // Determina tipo de preview
  const isCollective = command.intent.startsWith('team_') ||
                       command.intent.includes('_compact') ||
                       command.intent.includes('_press');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 z-50"
      >
        {/* Seta do jogador pro destino */}
        {targetPx && (
          <svg
            className="absolute inset-0 h-full w-full"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <marker
                id="arrowhead-preview"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill="rgba(250, 204, 21, 0.8)"
                />
              </marker>
            </defs>
            <motion.line
              x1={playerPx.x}
              y1={playerPx.y}
              x2={targetPx.x}
              y2={targetPx.y}
              stroke="rgba(250, 204, 21, 0.8)"
              strokeWidth="3"
              strokeDasharray="8 4"
              markerEnd="url(#arrowhead-preview)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </svg>
        )}

        {/* Círculo no destino */}
        {targetPx && (
          <motion.div
            className="absolute rounded-full border-4 border-neon-yellow/60 bg-neon-yellow/10"
            style={{
              left: targetPx.x - 20,
              top: targetPx.y - 20,
              width: 40,
              height: 40,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <Circle className="absolute inset-0 m-auto h-6 w-6 text-neon-yellow" />
          </motion.div>
        )}

        {/* Área de efeito (comandos coletivos) */}
        {isCollective && (
          <motion.div
            className="absolute rounded-full border-4 border-cyan-400/40 bg-cyan-500/10"
            style={{
              left: playerPx.x - 60,
              top: playerPx.y - 60,
              width: 120,
              height: 120,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Users className="absolute inset-0 m-auto h-8 w-8 text-cyan-300" />
          </motion.div>
        )}

        {/* Label do comando */}
        <motion.div
          className="absolute rounded-lg border border-neon-yellow/60 bg-nav px-3 py-1.5 text-xs font-bold text-neon-yellow"
          style={{
            left: playerPx.x + 30,
            top: playerPx.y - 10,
          }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {getIntentLabel(command.intent)}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Resolve alvo do comando (jogador específico ou portador da bola).
 */
function resolveTarget(
  command: ParsedCommand,
  players: PitchPlayerState[],
): PitchPlayerState | null {
  // Se comando tem alvo explícito, resolve
  if (command.target) {
    const target = command.target;
    if (target.kind === 'player_name') {
      const lower = target.nameToken.toLowerCase();
      const match = players.find((p) => p.name.toLowerCase().includes(lower));
      if (match) return match;
    }
    if (target.kind === 'player_id') {
      const match = players.find((p) => p.playerId === target.playerId);
      if (match) return match;
    }
    if (target.kind === 'shirt_number') {
      const match = players.find((p) => p.num === target.number);
      if (match) return match;
    }
  }

  // Fallback: portador da bola (se comando individual)
  if (!command.intent.startsWith('team_')) {
    // TODO: pegar ballCarrier do contexto
    // Por ora, retorna primeiro jogador
    return players[0] ?? null;
  }

  // Comandos coletivos: retorna centroide do time
  if (players.length === 0) return null;
  const avgX = players.reduce((sum, p) => sum + p.x, 0) / players.length;
  const avgY = players.reduce((sum, p) => sum + p.y, 0) / players.length;
  return {
    ...players[0]!,
    x: avgX,
    y: avgY,
  };
}

/**
 * Label legível por intent.
 */
function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    invade_box: L('Invade a área', 'Into the box'),
    dribble_attempt: L('Tenta drible', 'Takes on'),
    take_shot: L('Chuta', 'Shoots'),
    cross_ball: L('Cruza', 'Crosses'),
    pass_to_player: L('Passa', 'Passes'),
    hold_ball: L('Segura bola', 'Holds ball'),
    quick_pass: L('Toca rápido', 'Quick pass'),
    switch_play: L('Troca de lado', 'Switches play'),
    mark_player: L('Marca', 'Marks'),
    block_advance: L('Bloqueia', 'Blocks'),
    aggressive_tackle: L('Entra duro', 'Goes in hard'),
    tactical_foul: L('Falta tática', 'Tactical foul'),
    team_press_high: L('Pressão alta', 'High press'),
    team_retreat: L('Recua', 'Drop back'),
    team_hold_possession: L('Segura posse', 'Keep possession'),
    team_high_line: L('Sobe linha', 'High line'),
    forwards_press_defenders: L('Atacantes pressionam', 'Forwards press'),
    midfielders_compact: L('Meias compactam', 'Midfield compact'),
    laterals_cross: L('Laterais cruzam', 'Full-backs cross'),
    left_back_overlap: L('Lateral sobe', 'Full-back overlaps'),
    break_line: L('Quebra linha', 'Break the line'),
    break_zone: L('Quebra zona', 'Break the zone'),
    run_behind: L('Corre pelas costas', 'Run in behind'),
    pedal_to_metal: L('Acelera', 'Speed up'),
    free_play: L('Joga livre', 'Free play'),
    wait_support: L('Espera apoio', 'Wait for support'),
    stretch_team: L('Estica time', 'Stretch team'),
    hold_small_area: L('Vai pra pequena', 'Attack the six-yard box'),
    spare_player: L('Poupa jogador', 'Rest player'),
    calm_team: L('Acalma time', 'Calm the team'),
  };

  return labels[intent] ?? intent;
}
