import { memo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Zap,
  Shield,
  Target,
  ArrowUpDown,
  Send,
  ChevronRight,
  Footprints,
  Heart,
  Brain,
  Gauge,
  Swords,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  MoveHorizontal,
  Timer,
} from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { playerTokenSrc } from '@/lib/playerPortrait';
import { useGameDispatch, useGameStore, getGameState } from '@/game/store';
import { cn } from '@/lib/utils';

const SLOT_LABEL_PT: Record<string, string> = {
  gol: 'Goleiro',
  zag1: 'Zagueiro E',
  zag2: 'Zagueiro D',
  le: 'Lateral E',
  ld: 'Lateral D',
  vol: 'Volante',
  mc1: 'Meia 1',
  mc2: 'Meia 2',
  pe: 'Ponta E',
  pd: 'Ponta D',
  ata: 'Atacante',
};

const ROLE_LABEL_PT: Record<string, string> = {
  gk: 'Goleiro',
  def: 'Defensor',
  mid: 'Meio-campo',
  attack: 'Atacante',
};

interface TacticalCommand {
  id: string;
  label: string;
  icon: typeof Zap;
  description: string;
  color: string;
}

const TACTICAL_COMMANDS: TacticalCommand[] = [
  { id: 'press_high', label: 'Pressionar', icon: ArrowUp, description: 'Subir e pressionar o adversário', color: 'text-red-400' },
  { id: 'drop_deep', label: 'Recuar', icon: ArrowDown, description: 'Jogar mais recuado e seguro', color: 'text-blue-400' },
  { id: 'go_wide', label: 'Abrir jogo', icon: MoveHorizontal, description: 'Procurar espaço pela lateral', color: 'text-emerald-400' },
  { id: 'shoot_more', label: 'Chutar mais', icon: Target, description: 'Arriscar finalizações', color: 'text-amber-400' },
  { id: 'mark_tight', label: 'Marcar firme', icon: Shield, description: 'Marcação individual agressiva', color: 'text-purple-400' },
  { id: 'creative_freedom', label: 'Liberdade', icon: Brain, description: 'Mais liberdade criativa', color: 'text-cyan-400' },
  { id: 'conserve_energy', label: 'Poupar energia', icon: Timer, description: 'Administrar o desgaste', color: 'text-lime-400' },
  { id: 'attack_runs', label: 'Chegadas', icon: Zap, description: 'Fazer chegadas na área', color: 'text-orange-400' },
];

interface LivePlayerInfoPanelProps {
  player: PitchPlayerState;
  playerEntity: PlayerEntity | undefined;
  onClose: () => void;
  benchPlayers: PlayerEntity[];
  subsLeft: number;
  maxSubs: number;
}

export const LivePlayerInfoPanel = memo(function LivePlayerInfoPanel({
  player,
  playerEntity,
  onClose,
  benchPlayers,
  subsLeft,
  maxSubs,
}: LivePlayerInfoPanelProps) {
  const dispatch = useGameDispatch();
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [subFeedback, setSubFeedback] = useState<string | null>(null);

  const ovr = playerEntity ? overallFromAttributes(playerEntity.attrs) : 0;
  const portraitUrl = playerEntity ? playerTokenSrc(playerEntity, 120) : undefined;

  const sendCommand = useCallback(
    (cmd: TacticalCommand) => {
      const commandText = `[${player.name}] ${cmd.label}: ${cmd.description}`;
      dispatch({ type: 'COACH_TECHNICAL_COMMAND', text: commandText });
      setCommandFeedback(cmd.label);
      setTimeout(() => setCommandFeedback(null), 2200);
    },
    [dispatch, player.name],
  );

  const doSubstitution = useCallback(
    (inPlayer: PlayerEntity) => {
      if (subsLeft <= 0) {
        setSubFeedback(`Limite de substituições (${maxSubs}).`);
        setTimeout(() => setSubFeedback(null), 2800);
        return;
      }
      if (inPlayer.outForMatches > 0) {
        setSubFeedback('Jogador indisponível (lesão/suspensão).');
        setTimeout(() => setSubFeedback(null), 2800);
        return;
      }
      const lm = getGameState().liveMatch;
      if (!lm || lm.phase !== 'playing') return;
      const before = lm.substitutionsUsed;
      dispatch({
        type: 'MATCH_SUBSTITUTE',
        outPlayerId: player.playerId,
        inPlayerId: inPlayer.id,
      });
      const after = getGameState().liveMatch?.substitutionsUsed ?? before;
      if (after === before) {
        setSubFeedback('Não foi possível substituir.');
        setTimeout(() => setSubFeedback(null), 3000);
        return;
      }
      setSubFeedback(`${player.name} ↔ ${inPlayer.name}`);
      setTimeout(() => {
        setSubFeedback(null);
        onClose();
      }, 2000);
    },
    [dispatch, player.playerId, player.name, subsLeft, maxSubs, onClose],
  );

  const attrs = playerEntity?.attrs;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/15 bg-gradient-to-b from-gray-900/98 to-black/98 shadow-[0_-10px_60px_rgba(0,0,0,0.7)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-neon-yellow/70 bg-black/60 shadow-[0_0_16px_rgba(234,255,0,0.2)]">
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt=""
                  className="h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-sm font-black text-white">{player.num}</span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neon-yellow text-[9px] font-black text-black shadow">
              {player.num}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-black uppercase tracking-wide text-white">
              {player.name}
            </h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold uppercase tracking-wider text-neon-yellow">
                {SLOT_LABEL_PT[player.slotId] ?? player.slotId}
              </span>
              <span className="text-gray-500">·</span>
              <span className="font-bold uppercase tracking-wider text-gray-400">
                {ROLE_LABEL_PT[player.role] ?? player.role}
              </span>
              {ovr > 0 && (
                <>
                  <span className="text-gray-500">·</span>
                  <span className={cn(
                    'font-display font-black tabular-nums',
                    ovr >= 85 ? 'text-neon-yellow' : ovr >= 75 ? 'text-white' : 'text-gray-400',
                  )}>
                    {ovr} OVR
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 p-1.5 text-gray-400 transition-colors hover:border-white/30 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Grid */}
        {attrs && (
          <div className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              Atributos
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              <StatBadge label="VEL" value={attrs.velocidade} icon={Gauge} />
              <StatBadge label="PAS" value={attrs.passe} icon={Footprints} />
              <StatBadge label="FIN" value={attrs.finalizacao} icon={Target} />
              <StatBadge label="DRI" value={attrs.drible} icon={Zap} />
              <StatBadge label="MAR" value={attrs.marcacao} icon={Shield} />
              <StatBadge label="FIS" value={attrs.fisico} icon={Heart} />
              <StatBadge label="TAT" value={attrs.tatico} icon={Brain} />
              <StatBadge label="MEN" value={attrs.mentalidade} icon={Swords} />
              <StatBadge label="CON" value={attrs.confianca} icon={ShieldAlert} />
              <StatBadge label="FPL" value={attrs.fairPlay} icon={Shield} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-bold text-gray-500">
                  Fadiga: {Math.round(player.fatigue)}%
                </span>
              </div>
              {playerEntity?.strongFoot && (
                <span className="text-[9px] font-bold text-gray-500">
                  Pé: {playerEntity.strongFoot === 'right' ? 'Direito' : playerEntity.strongFoot === 'left' ? 'Esquerdo' : 'Ambos'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tactical Commands */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
              Enviar comando
            </p>
            {commandFeedback && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] font-bold text-neon-yellow"
              >
                {commandFeedback} enviado
              </motion.span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TACTICAL_COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => sendCommand(cmd)}
                className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/[0.06] active:scale-[0.97]"
              >
                <cmd.icon className={cn('h-3.5 w-3.5 shrink-0 transition-colors', cmd.color, 'group-hover:text-neon-yellow')} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-white group-hover:text-neon-yellow">
                    {cmd.label}
                  </span>
                  <span className="block truncate text-[8px] text-gray-500">{cmd.description}</span>
                </div>
                <Send className="h-3 w-3 shrink-0 text-gray-600 transition-colors group-hover:text-neon-yellow/60" />
              </button>
            ))}
          </div>
        </div>

        {/* Substitution */}
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-neon-yellow" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                Substituir
              </p>
            </div>
            <span className="text-[9px] font-mono font-bold tabular-nums text-gray-500">
              {subsLeft}/{maxSubs}
            </span>
          </div>

          {subFeedback && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-1.5 text-center text-[10px] text-cyan-100"
            >
              {subFeedback}
            </motion.p>
          )}

          {subsLeft <= 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-[10px] text-gray-500">
              Todas as substituições utilizadas.
            </p>
          ) : !showSubPanel ? (
            <button
              type="button"
              onClick={() => setShowSubPanel(true)}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-left transition-colors hover:border-neon-yellow/40 hover:bg-neon-yellow/[0.06]"
            >
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="block text-xs font-bold text-white">
                    Substituir {player.name}
                  </span>
                  <span className="block text-[9px] text-gray-500">
                    {benchPlayers.length} jogadores no banco
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400">
                  Escolha quem entra por <span className="text-neon-yellow">{player.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setShowSubPanel(false)}
                  className="text-[9px] font-bold uppercase text-gray-500 hover:text-white"
                >
                  Voltar
                </button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-1.5 [scrollbar-width:thin]">
                {benchPlayers.length === 0 ? (
                  <p className="py-3 text-center text-[10px] text-gray-500">Nenhum jogador no banco.</p>
                ) : (
                  benchPlayers.map((bp) => {
                    const bpOvr = overallFromAttributes(bp.attrs);
                    const bpPortrait = playerTokenSrc(bp, 48);
                    return (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={() => doSubstitution(bp)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-all hover:border-neon-yellow/30 hover:bg-neon-yellow/[0.06] active:scale-[0.98]"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/60">
                          {bpPortrait ? (
                            <img
                              src={bpPortrait}
                              alt=""
                              className="h-full w-full object-cover object-top"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-[8px] font-black text-white">{bp.num}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold text-white">
                            {bp.num} · {bp.name}
                          </span>
                          <span className="block text-[9px] text-gray-500">
                            {bp.pos} · {bpOvr} OVR
                          </span>
                        </div>
                        <div className="shrink-0 rounded bg-neon-yellow/15 px-1.5 py-0.5 text-[9px] font-bold text-neon-yellow">
                          Entrar
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

function StatBadge({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Zap;
}) {
  const color =
    value >= 85
      ? 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/[0.06]'
      : value >= 70
        ? 'text-white border-white/20 bg-white/[0.04]'
        : value >= 55
          ? 'text-gray-300 border-white/12 bg-white/[0.03]'
          : 'text-gray-500 border-white/8 bg-white/[0.02]';
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 tabular-nums',
        color,
      )}
    >
      <Icon className="h-3 w-3 opacity-60" />
      <span className="text-[11px] font-black">{value}</span>
      <span className="text-[7px] font-bold uppercase tracking-wider opacity-60">{label}</span>
    </div>
  );
}
