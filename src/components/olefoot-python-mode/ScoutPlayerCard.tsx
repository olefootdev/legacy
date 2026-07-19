/**
 * view-player-card Legacy Tech aplicado ao SCOUTS.
 *
 * Anatomia (DESIGN_SYSTEM §8.1):
 *   ┌─────────┬──────────────────────────────────┐
 *   │  OVR    │  EYEBROW · pos                   │
 *   │ (Moret  │  NOME (Agency 800 uppercase)     │
 *   │  italic)│  💰 valor (Moret italic)         │
 *   │  POS    │  ───────────────────────────────│
 *   │  chip   │  STATS inline (PAC SHO PAS …)    │
 *   │ (Agency)│  Bottom: badges de estado        │
 *   └─────────┴──────────────────────────────────┘
 *
 * Border-left 3px da cor do estado (neon-yellow / warning / danger / success
 * / white/15). Hover sobe 0.5px + borda neon. Press scale-[0.98].
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
import { getPlayerLevelInfo } from '@/entities/playerLevel';

interface Props {
  playerId: string;
  squadEntry?: SquadPlayerEntry;
}

type Tone = 'neutral' | 'positive' | 'negative' | 'urgent';

function MiniStat({
  Icon,
  value,
  label,
  tone = 'neutral',
}: {
  Icon: typeof Activity;
  value: string | number;
  label: string;
  tone?: Tone;
}) {
  const toneColor: Record<Tone, string> = {
    neutral: 'text-white/85',
    positive: 'text-[var(--color-success)]',
    negative: 'text-[var(--color-warning)]',
    urgent: 'text-[var(--color-danger)]',
  };
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Icon size={10} className="opacity-55 shrink-0" />
      <span
        className={cn('text-[12px] font-bold tabular-nums leading-none', toneColor[tone])}
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        {value}
      </span>
      <span
        className="text-[9px] uppercase text-white/40 leading-none"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.18em' }}
      >
        {label}
      </span>
    </div>
  );
}

export function ScoutPlayerCard({ playerId, squadEntry }: Props) {
  const navigate = useNavigate();
  const player = useGameStore((s) => s.players?.[playerId]);
  const health = useGameStore((s) => s.playerHealth?.[playerId]);
  const moral = useGameStore(
    (s) => (s as { playerMoral?: Record<string, unknown> }).playerMoral?.[playerId],
  ) as { moral?: number; formStreak?: number } | undefined;
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

  const ovr = useMemo(() => (player ? overallFromAttributes(player.attrs, player.pos) : null), [player]);
  const lvlInfo = useMemo(
    () => (player ? getPlayerLevelInfo(player.evolutionXp) : null),
    [player],
  );

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

  // Rail amarelo de estado (DS §7.2)
  const railColor = isUnavailable
    ? 'border-l-[var(--color-danger)]'
    : alerts > 0
    ? 'border-l-[var(--color-warning)]'
    : celebrations > 0
    ? 'border-l-[var(--color-success)]'
    : ovr !== null && ovr >= 80
    ? 'border-l-neon-yellow'
    : 'border-l-white/15';

  // OVR cor em Moret italic
  const ovrColor =
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
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      onClick={() => navigate(`/manager/scouts/player/${encodeURIComponent(playerId)}`)}
      className={cn(
        'group w-full text-left flex items-stretch gap-4 p-4',
        'border border-l-[3px] border-[var(--color-border)] bg-[var(--color-card)]',
        'hover:border-neon-yellow/40 transition-all',
        railColor,
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* ── Bloco esquerdo: OVR Moret + POS chip Agency ──────── */}
      <div className="shrink-0 w-14 flex flex-col items-center justify-center gap-1.5 self-center">
        <div
          className={cn('leading-none tabular-nums', ovrColor)}
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 'clamp(30px, 5vw, 38px)',
            letterSpacing: '-0.03em',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {ovr ?? '—'}
        </div>
        <div
          className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-white/75"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '9px',
            letterSpacing: '0.22em',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {player.pos}
        </div>
        {lvlInfo && (
          <div
            className="px-1.5 py-0.5 bg-neon-yellow/10 border border-neon-yellow/35 text-neon-yellow"
            title={`Nível ${lvlInfo.level} · ${lvlInfo.xp} XP (próximo: ${lvlInfo.xpForNext})`}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '9px',
              letterSpacing: '0.18em',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            LV {lvlInfo.level}
          </div>
        )}
      </div>

      {/* ── Bloco direito: header + stats ─────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5 self-stretch">
        {/* Top: nome + valor + chevron */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="truncate text-white"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {player.name}
              </span>
              {isUnavailable && (
                <ShieldOff size={11} className="text-[var(--color-danger)] shrink-0" />
              )}
            </div>
            {mvCents > 0 && (
              <div
                className="mt-1 text-neon-yellow/90 tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '15px',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatBroFromCents(mvCents)}
              </div>
            )}
          </div>
          <ChevronRight
            size={16}
            className="text-white/30 group-hover:text-neon-yellow transition shrink-0 mt-0.5"
          />
        </div>

        {/* Divisor sutil */}
        <div className="h-px bg-white/5" />

        {/* Stats row: físico + moral + forma + risco */}
        <div className="flex items-center gap-3 flex-wrap">
          <MiniStat
            Icon={Activity}
            value={`${100 - fatigue}%`}
            label="Físico"
            tone={fatigue > 70 ? 'urgent' : fatigue > 40 ? 'negative' : 'positive'}
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

        {/* Bottom: temporada + badges */}
        {(matches > 0 || alerts > 0 || celebrations > 0) && (
          <div
            className="flex items-center gap-3 text-[10px] tabular-nums leading-none pt-1"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.16em', fontWeight: 700 }}
          >
            {matches > 0 && (
              <span className="text-white/55 uppercase">{matches}P</span>
            )}
            {goals > 0 && (
              <span className="text-[var(--color-success)] uppercase">{goals}G</span>
            )}
            {assists > 0 && (
              <span className="text-blue-300 uppercase">{assists}A</span>
            )}
            {reds > 0 && (
              <span className="text-[var(--color-danger)] uppercase">{reds}V</span>
            )}
            {celebrations > 0 && (
              <span
                className={cn(
                  'ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-[var(--color-success)]/12 text-[var(--color-success)] uppercase',
                )}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '9px',
                  letterSpacing: '0.22em',
                }}
              >
                <Sparkles size={9} /> {celebrations}
              </span>
            )}
            {alerts > 0 && (
              <span
                className={cn(
                  celebrations > 0 ? '' : 'ml-auto',
                  'flex items-center gap-1 px-1.5 py-0.5 bg-[var(--color-warning)]/12 text-[var(--color-warning)] uppercase',
                )}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '9px',
                  letterSpacing: '0.22em',
                }}
              >
                <AlertTriangle size={9} /> {alerts}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}
