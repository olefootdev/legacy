/**
 * Card horizontal do jogador na aba PLANTEL do SCOUTS.
 *
 * Mostra dados REAIS do plantel local (OVR, posição, market value, físico,
 * moral, forma) + agregação de consequências ativas do Python (alertas,
 * celebrações, indisponibilidade).
 *
 * Usa padrão view-player-card (memory `pattern_view_player_card`): bloco
 * esquerdo com foto+OVR, bloco direito com info+stats+CTA.
 */
import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Heart,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { formatBroFromCents } from '@/systems/economy';
import { cn } from '@/lib/utils';
import type { SquadPlayerEntry } from '@/insights/client';

interface Props {
  playerId: string;
  /** Agregação vinda do Python (opcional — pode estar offline). */
  squadEntry?: SquadPlayerEntry;
}

function MiniStat({
  Icon,
  value,
  label,
  tone = 'neutral',
}: {
  Icon: typeof Activity;
  value: string | number;
  label: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'urgent';
}) {
  const tones = {
    neutral: 'text-white/85',
    positive: 'text-emerald-400',
    negative: 'text-orange-400',
    urgent: 'text-red-400',
  };
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Icon size={11} className="opacity-60 shrink-0" />
      <span className={cn('text-[11px] font-display font-bold tabular-nums', tones[tone])}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-white/40 truncate">{label}</span>
    </div>
  );
}

export function ScoutPlayerCard({ playerId, squadEntry }: Props) {
  const navigate = useNavigate();
  const player = useGameStore((s) => s.players?.[playerId]);
  const health = useGameStore((s) => s.playerHealth?.[playerId]);
  const moral = useGameStore((s) => (s as { playerMoral?: Record<string, unknown> }).playerMoral?.[playerId]) as
    | { moral?: number; formStreak?: number }
    | undefined;
  const ledger = useGameStore(
    (s) =>
      (s as { playerSeasonLedger?: Record<string, unknown> }).playerSeasonLedger?.[playerId],
  ) as
    | {
        matchesPlayed?: number;
        goals?: number;
        assists?: number;
        yellowCards?: number;
        redCards?: number;
      }
    | undefined;

  const ovr = useMemo(() => (player ? overallFromAttributes(player.attrs) : null), [player]);

  if (!player) return null;

  const fatigue = Math.round(health?.fatigue ?? 0);
  const injuryRisk = Math.round(health?.injuryRisk ?? 0);
  const outForMatches = Math.round(health?.outForMatches ?? 0);
  const moralValue = Math.round(moral?.moral ?? 50);
  const formStreak = moral?.formStreak ?? 0;
  const matches = ledger?.matchesPlayed ?? 0;
  const goals = ledger?.goals ?? 0;
  const assists = ledger?.assists ?? 0;
  const reds = ledger?.redCards ?? 0;

  const isUnavailable = squadEntry?.is_unavailable || outForMatches > 0;
  const alerts = squadEntry?.alerts ?? 0;
  const celebrations = squadEntry?.celebrations ?? 0;

  // Bordas + acentos baseados no estado
  const borderAccent = isUnavailable
    ? 'border-l-red-400'
    : alerts > 0
    ? 'border-l-orange-400'
    : celebrations > 0
    ? 'border-l-emerald-400'
    : 'border-l-white/10';

  // Tone do OVR
  const ovrTone =
    ovr === null
      ? 'text-white/40'
      : ovr >= 85
      ? 'text-neon-yellow'
      : ovr >= 75
      ? 'text-white'
      : 'text-white/70';

  const mvCents = (player as { marketValueBroCents?: number }).marketValueBroCents ?? 0;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => navigate(`/manager/scouts/player/${encodeURIComponent(playerId)}`)}
      className={cn(
        'group w-full text-left flex items-stretch gap-3 p-3 rounded-sm border border-l-4',
        'bg-[var(--color-card)] hover:bg-white/[0.04] border-white/8 transition',
        borderAccent,
      )}
    >
      {/* ── Bloco esquerdo: OVR + posição ──────────────────────── */}
      <div className="shrink-0 w-16 flex flex-col items-center justify-center gap-1">
        <div
          className={cn(
            'text-3xl font-display font-black leading-none tabular-nums',
            ovrTone,
          )}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {ovr ?? '—'}
        </div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-white/45 font-bold">
          {player.pos}
        </div>
      </div>

      {/* ── Bloco direito: info + stats ────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
        {/* Linha 1: nome + valor de mercado */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-display font-bold text-white truncate">
                {player.name}
              </span>
              {isUnavailable && (
                <ShieldOff size={11} className="text-red-400 shrink-0" />
              )}
            </div>
            <div className="text-[10px] text-neon-yellow/80 font-mono mt-0.5 tabular-nums">
              {mvCents > 0 ? formatBroFromCents(mvCents) : '—'}
            </div>
          </div>
          <ChevronRight
            size={16}
            className="text-white/30 group-hover:text-white/60 transition shrink-0 mt-1"
          />
        </div>

        {/* Linha 2: status físico + moral + forma */}
        <div className="flex items-center gap-3 flex-wrap">
          <MiniStat
            Icon={Activity}
            value={`${100 - fatigue}%`}
            label="Físico"
            tone={fatigue > 70 ? 'urgent' : fatigue > 40 ? 'negative' : 'neutral'}
          />
          <MiniStat
            Icon={Heart}
            value={`${moralValue}%`}
            label="Moral"
            tone={moralValue >= 70 ? 'positive' : moralValue < 40 ? 'negative' : 'neutral'}
          />
          <MiniStat
            Icon={formStreak >= 0 ? TrendingUp : TrendingDown}
            value={formStreak > 0 ? `+${formStreak}` : `${formStreak}`}
            label="Forma"
            tone={formStreak >= 2 ? 'positive' : formStreak <= -2 ? 'negative' : 'neutral'}
          />
          {injuryRisk >= 60 && (
            <MiniStat
              Icon={AlertTriangle}
              value={`${injuryRisk}%`}
              label="Risco"
              tone="urgent"
            />
          )}
        </div>

        {/* Linha 3: temporada (partidas + gols + assists + cards) */}
        {matches > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-white/55 tabular-nums">
            <span>{matches}P</span>
            {goals > 0 && <span className="text-emerald-400">{goals}G</span>}
            {assists > 0 && <span className="text-blue-300">{assists}A</span>}
            {reds > 0 && <span className="text-red-400">{reds}🟥</span>}
            {celebrations > 0 && (
              <span className="ml-auto flex items-center gap-1 text-emerald-400">
                <Sparkles size={9} />
                {celebrations}
              </span>
            )}
            {alerts > 0 && (
              <span className={cn(celebrations > 0 ? '' : 'ml-auto', 'flex items-center gap-1 text-orange-400')}>
                <AlertTriangle size={9} />
                {alerts}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}
