/**
 * OLEFOOT PYTHON MODE — Painel de transparência do jogador.
 *
 * Rota: /manager/scouts/player/:playerId
 *
 * Mostra:
 *   - Header com player card (foto + nome + OVR + valor de mercado)
 *   - Stats da temporada
 *   - Status físico/moral/forma (dados locais)
 *   - Consequências ativas com explicação humana (Python)
 *   - Timeline cronológica de eventos (Python: aplicada/expirada nos últimos 7d)
 *   - Evolução de atributos (delta dos últimos 7d via playerEvolutionTimeline)
 *   - Histórico de valor de mercado (snapshots em playerEvolutionTimeline)
 *
 * Regra principal: tudo que mudou tem explicação visível. Se algum dado
 * está em fallback, o painel anuncia isso textualmente em vez de mentir.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
  Brain,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Heart,
  Clock,
  AlertOctagon,
  Sparkles,
  ShieldOff,
  Calendar,
  Target,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { overallFromAttributes } from '@/entities/player';
import { formatBroFromCents } from '@/systems/economy';
import { useInsightsPlayerTransparency, useInsightsServiceHealth } from '@/hooks/useInsights';
import type { PlayerAttributes } from '@/entities/types';
import type { PlayerEvolutionPoint } from '@/team/playerEvolutionTimeline';
import type { PlayerTimelineEvent, Severity } from '@/insights/client';
import { cn } from '@/lib/utils';

// ─── Helpers ───────────────────────────────────────────────────────

function useAuthUid(): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    sb?.auth.getSession().then(({ data }) => {
      setUid(data?.session?.user?.id ?? null);
    });
  }, []);
  return uid;
}

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 60_000) return 'agora';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function formatTimeLeft(ms: number): string {
  if (ms < 60_000) return '<1m';
  const tm = Math.floor(ms / 60_000);
  if (tm < 60) return `${tm}m`;
  const h = Math.floor(tm / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Severity styling ──────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, { color: string; Icon: typeof Activity }> = {
  alert: { color: 'text-red-400 border-l-red-400', Icon: AlertOctagon },
  celebration: { color: 'text-emerald-400 border-l-emerald-400', Icon: Sparkles },
  neutral: { color: 'text-white/70 border-l-white/30', Icon: Activity },
  info: { color: 'text-blue-300 border-l-blue-300', Icon: Clock },
};

// ─── Sub-components ────────────────────────────────────────────────

function HeroCard({
  name,
  pos,
  ovr,
  marketCents,
  isUnavailable,
  outForMatches,
}: {
  name: string;
  pos: string;
  ovr: number;
  marketCents: number;
  isUnavailable: boolean;
  outForMatches: number;
}) {
  // Hero editorial Legacy Tech: eyebrow Agency + Nome Moret italic + régua + OVR Moret italic.
  return (
    <motion.section
      initial={{ scale: 0.97, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className={cn(
        'relative border border-l-[3px] bg-[var(--color-card)] p-5 sm:p-6 overflow-hidden',
        isUnavailable ? 'border-l-[var(--color-danger)]' : 'border-l-neon-yellow',
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
      }}
    >
      {/* Background watermark — número OVR gigante quase invisível */}
      <div
        aria-hidden
        className="absolute -right-6 top-1/2 -translate-y-1/2 select-none pointer-events-none"
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: '220px',
          letterSpacing: '-0.05em',
          color: isUnavailable ? 'rgba(239,68,68,0.04)' : 'rgba(253,225,0,0.05)',
          lineHeight: 1,
        }}
      >
        {ovr}
      </div>

      {/* Badge "indisponível" no canto */}
      {isUnavailable && (
        <div
          className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/40"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <ShieldOff size={10} />
          Indisponível{outForMatches > 0 ? ` · ${outForMatches}P` : ''}
        </div>
      )}

      <div className="relative flex items-start gap-5">
        {/* OVR Moret italic + POS chip Agency */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div
            className="text-neon-yellow leading-none tabular-nums"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(56px, 9vw, 84px)',
              letterSpacing: '-0.04em',
              textShadow: '0 4px 24px rgba(253,225,0,0.25)',
            }}
          >
            {ovr}
          </div>
          <div
            className="px-2 py-1 bg-deep-black/60 border border-white/15 text-white/80"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '10px',
              letterSpacing: '0.24em',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {pos}
          </div>
        </div>

        {/* Info: eyebrow + Nome Moret + régua + valor */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="block h-px w-6 bg-neon-yellow/55" />
            <span
              className="text-neon-yellow"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              Painel de Transparência
            </span>
          </div>
          <h1
            className="text-white leading-[0.95]"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(32px, 5.5vw, 48px)',
              letterSpacing: '-0.025em',
            }}
          >
            {name}
          </h1>
          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow" />

          {marketCents > 0 && (
            <div className="pt-1.5 flex items-baseline gap-2">
              <DollarSign size={13} className="text-neon-yellow/80 self-center" />
              <span
                className="text-neon-yellow tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(22px, 3.5vw, 28px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatBroFromCents(marketCents)}
              </span>
              <span
                className="text-white/45"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '9px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                }}
              >
                valor atual
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function StatusGrid({
  fatigue,
  moral,
  injuryRisk,
  formStreak,
}: {
  fatigue: number;
  moral: number;
  injuryRisk: number;
  formStreak: number;
}) {
  const cells = [
    {
      label: 'Físico',
      value: `${100 - fatigue}%`,
      hint: fatigue > 70 ? 'Exausto' : fatigue > 40 ? 'Cansado' : 'Pronto',
      Icon: Activity,
      tone: fatigue > 70 ? 'urgent' : fatigue > 40 ? 'negative' : 'positive',
    },
    {
      label: 'Moral',
      value: `${moral}%`,
      hint: moral >= 70 ? 'Confiante' : moral < 40 ? 'Abalado' : 'Estável',
      Icon: Heart,
      tone: moral >= 70 ? 'positive' : moral < 40 ? 'negative' : 'neutral',
    },
    {
      label: 'Forma',
      value: formStreak > 0 ? `+${formStreak}` : `${formStreak}`,
      hint:
        formStreak >= 3
          ? 'Em alta'
          : formStreak <= -3
          ? 'Em baixa'
          : 'Equilibrada',
      Icon: formStreak >= 0 ? TrendingUp : TrendingDown,
      tone: formStreak >= 2 ? 'positive' : formStreak <= -2 ? 'negative' : 'neutral',
    },
    {
      label: 'Risco lesão',
      value: `${injuryRisk}%`,
      hint: injuryRisk >= 70 ? 'Crítico' : injuryRisk >= 40 ? 'Atenção' : 'Baixo',
      Icon: AlertTriangle,
      tone: injuryRisk >= 70 ? 'urgent' : injuryRisk >= 40 ? 'negative' : 'positive',
    },
  ] as const;

  const toneClass: Record<'urgent' | 'negative' | 'neutral' | 'positive', string> = {
    urgent: 'text-[var(--color-danger)] border-[var(--color-danger)]/30 border-l-[var(--color-danger)]',
    negative: 'text-[var(--color-warning)] border-[var(--color-warning)]/30 border-l-[var(--color-warning)]',
    neutral: 'text-white border-white/8 border-l-white/15',
    positive: 'text-[var(--color-success)] border-[var(--color-success)]/30 border-l-[var(--color-success)]',
  };

  return (
    <section
      aria-label="Status atual"
      className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
    >
      {cells.map((c) => (
        <div
          key={c.label}
          className={cn(
            'flex flex-col gap-2 p-4 border border-l-[3px] bg-[var(--color-card)]',
            toneClass[c.tone],
          )}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <div className="flex items-center gap-1.5">
            <c.Icon size={11} className="opacity-65" />
            <span
              className="text-white/55"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
              }}
            >
              {c.label}
            </span>
          </div>
          <div
            className="leading-none tabular-nums"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(24px, 4vw, 30px)',
              letterSpacing: '-0.03em',
            }}
          >
            {c.value}
          </div>
          <div
            className="text-white/45"
            style={{ fontFamily: 'var(--font-ui)', fontSize: '10px' }}
          >
            {c.hint}
          </div>
        </div>
      ))}
    </section>
  );
}

function SeasonStats({
  matches,
  goals,
  assists,
  yellows,
  reds,
}: {
  matches: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
}) {
  if (matches === 0) {
    return (
      <div
        className="text-white/45 italic p-4 bg-[var(--color-card)] border border-dashed border-white/12 text-center"
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '12px',
          borderRadius: 'var(--radius-md)',
        }}
      >
        Sem partidas oficiais ainda nesta temporada.
      </div>
    );
  }
  const items = [
    { label: 'Partidas', value: matches, Icon: Calendar, color: 'text-white' },
    { label: 'Gols', value: goals, Icon: Target, color: 'text-[var(--color-success)]' },
    { label: 'Assists', value: assists, Icon: Award, color: 'text-blue-300' },
    { label: 'Amarelos', value: yellows, Icon: AlertTriangle, color: 'text-[var(--color-warning)]' },
    { label: 'Vermelhos', value: reds, Icon: AlertOctagon, color: 'text-[var(--color-danger)]' },
  ];
  return (
    <section className="grid grid-cols-5 gap-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex flex-col items-center gap-1.5 p-3 bg-[var(--color-card)] border border-white/8"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <i.Icon size={12} className={cn('opacity-70', i.color)} />
          <div
            className={cn('leading-none tabular-nums', i.color)}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(18px, 3vw, 22px)',
              letterSpacing: '-0.02em',
            }}
          >
            {i.value}
          </div>
          <div
            className="text-white/40 text-center"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            {i.label}
          </div>
        </div>
      ))}
    </section>
  );
}

function ActiveConsequences({
  list,
}: {
  list: import('@/insights/client').ExplainedConsequence[];
}) {
  if (list.length === 0) {
    return (
      <div className="text-center py-6 px-4 rounded-sm bg-white/3 border border-dashed border-white/10">
        <Sparkles size={20} className="text-white/30 mx-auto mb-2" />
        <p className="text-[12px] text-white/55">Nenhuma consequência ativa.</p>
        <p className="text-[10px] text-white/35 mt-0.5">
          Jogador estável — sem efeitos pendentes.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((e) => {
        const sty = SEVERITY_STYLE[e.severity];
        return (
          <div
            key={e.consequence.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-sm border border-white/8 border-l-4 bg-[var(--color-card)]',
              sty.color.split(' ').filter((c) => c.startsWith('border-l-')).join(' '),
            )}
          >
            <sty.Icon size={14} className={cn('shrink-0 mt-0.5', sty.color.split(' ')[0])} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className={cn('text-sm font-display font-bold truncate', sty.color.split(' ')[0])}>
                  {e.title}
                </div>
                <div className="text-[10px] text-white/40 shrink-0 tabular-nums">
                  {formatTimeLeft(e.ms_until_expiry)}
                </div>
              </div>
              <div className="text-[11px] text-white/55 mt-0.5">{e.subtitle}</div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
                <span className="uppercase tracking-wider">{e.consequence.dimension}</span>
                <span className="tabular-nums">
                  intensidade {Math.round(Math.abs(e.current_value * 100))}%
                </span>
                <span>·</span>
                <span>{Math.round(e.life_remaining * 100)}% restante</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ events }: { events: PlayerTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-[11px] text-white/40 italic">
        Sem eventos recentes nos últimos 7 dias.
      </div>
    );
  }
  return (
    <ol className="relative pl-4">
      <div className="absolute left-1 top-0 bottom-0 w-px bg-white/10" />
      {events.map((e, i) => {
        const sty = SEVERITY_STYLE[e.severity];
        return (
          <li key={`${e.consequence_id}-${e.kind}-${i}`} className="relative pl-3 pb-3 last:pb-0">
            <div
              className={cn(
                'absolute -left-[5px] top-1.5 w-2 h-2 rounded-full',
                e.severity === 'alert'
                  ? 'bg-red-400'
                  : e.severity === 'celebration'
                  ? 'bg-emerald-400'
                  : e.severity === 'info'
                  ? 'bg-blue-300'
                  : 'bg-white/40',
              )}
            />
            <div className="flex items-baseline justify-between gap-2">
              <div className={cn('text-[12px] font-bold', sty.color.split(' ')[0])}>
                {e.title}
              </div>
              <div className="text-[10px] text-white/40 shrink-0 tabular-nums">
                {formatTimeAgo(e.at)}
              </div>
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">{e.subtitle}</div>
            {e.source_event_id && (
              <div className="text-[9px] text-white/30 font-mono mt-0.5 truncate">
                trace: {e.source_event_id}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function AttrDeltaList({
  currentAttrs,
  weekAgoAttrs,
}: {
  currentAttrs: PlayerAttributes;
  weekAgoAttrs: PlayerAttributes | null;
}) {
  const keys: (keyof PlayerAttributes)[] = [
    'passe',
    'marcacao',
    'velocidade',
    'drible',
    'finalizacao',
    'fisico',
    'tatico',
    'mentalidade',
    'confianca',
    'fairPlay',
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {keys.map((k) => {
        const now = currentAttrs[k] ?? 0;
        const prev = weekAgoAttrs?.[k] ?? null;
        const delta = prev !== null ? now - prev : null;
        const deltaSign = delta === null ? null : delta > 0 ? '+' : '';
        const hasDelta = delta !== null && delta !== 0;
        return (
          <div
            key={k}
            className={cn(
              'flex flex-col gap-1 p-3 bg-[var(--color-card)] border border-l-[3px]',
              hasDelta && delta > 0
                ? 'border-l-[var(--color-success)] border-white/8'
                : hasDelta && delta < 0
                ? 'border-l-[var(--color-danger)] border-white/8'
                : 'border-l-white/12 border-white/8',
            )}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div
              className="text-white/45"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '9px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
              }}
            >
              {k}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-white leading-none tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '22px',
                  letterSpacing: '-0.02em',
                }}
              >
                {now}
              </span>
              {hasDelta && (
                <span
                  className={cn(
                    'tabular-nums',
                    delta > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                  )}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                  }}
                >
                  {deltaSign}
                  {delta}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketChart({
  points,
}: {
  points: { atIso: string; value: number }[];
}) {
  if (points.length < 2) {
    return (
      <div className="text-[11px] text-white/40 italic text-center py-4">
        Histórico de mercado ainda construindo — precisa de mais snapshots
        após partidas pra exibir tendência.
      </div>
    );
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 320;
  const h = 60;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const positive = change >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] text-white/45 uppercase tracking-wider">
          {points.length} snapshots
        </div>
        <div
          className={cn(
            'text-[11px] font-display font-bold tabular-nums',
            positive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {positive ? '+' : ''}
          {formatBroFromCents(change)} ({changePct >= 0 ? '+' : ''}
          {changePct.toFixed(1)}%)
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <path
          d={path}
          fill="none"
          stroke={positive ? 'rgb(52 211 153)' : 'rgb(248 113 113)'}
          strokeWidth={2}
        />
      </svg>
      <div className="flex items-baseline justify-between text-[10px] text-white/40 font-mono tabular-nums">
        <span>{formatBroFromCents(first)}</span>
        <span>{formatBroFromCents(last)}</span>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  // DS §7.5: rail amarelo 3px à esquerda + headline Moret italic.
  return (
    <div className="flex items-stretch gap-3 py-1">
      <span aria-hidden className="w-[3px] bg-neon-yellow self-stretch min-h-[36px]" />
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className="text-neon-yellow leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '10px',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </span>
        <h2
          className="text-white leading-[0.95] mt-1"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 'clamp(20px, 3vw, 26px)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}

export function ManagerScoutsPlayer() {
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId: string }>();
  const authUid = useAuthUid();

  const player = useGameStore((s) => (playerId ? s.players?.[playerId] : undefined));
  const health = useGameStore((s) => (playerId ? s.playerHealth?.[playerId] : undefined));
  const moral = useGameStore((s) =>
    playerId
      ? ((s as { playerMoral?: Record<string, unknown> }).playerMoral?.[playerId] as
          | { moral?: number; formStreak?: number }
          | undefined)
      : undefined,
  );
  const ledger = useGameStore((s) =>
    playerId
      ? ((s as { playerSeasonLedger?: Record<string, unknown> }).playerSeasonLedger?.[playerId] as
          | {
              matchesPlayed?: number;
              goals?: number;
              assists?: number;
              yellowCards?: number;
              redCards?: number;
            }
          | undefined)
      : undefined,
  );
  const timeline = useGameStore((s) =>
    playerId
      ? ((s as { playerEvolutionTimeline?: Record<string, PlayerEvolutionPoint[]> }).playerEvolutionTimeline?.[
          playerId
        ] as PlayerEvolutionPoint[] | undefined)
      : undefined,
  );

  const { data: transparency } = useInsightsPlayerTransparency(authUid ? playerId ?? null : null);
  const { status: serviceStatus } = useInsightsServiceHealth();

  const weekAgoAttrs = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60_000;
    const pt = [...timeline]
      .reverse()
      .find((p) => new Date(p.atIso).getTime() <= weekAgoMs);
    return pt?.attrs ?? null;
  }, [timeline]);

  const marketHistory = useMemo(() => {
    if (!timeline) return [];
    return timeline
      .filter((p) => typeof p.marketValueBroCents === 'number')
      .map((p) => ({ atIso: p.atIso, value: p.marketValueBroCents as number }));
  }, [timeline]);

  if (!playerId) {
    return null;
  }

  if (!player) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => navigate('/manager/scouts')}
          className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white transition"
        >
          <ChevronLeft size={14} /> Voltar pro plantel
        </button>
        <div className="mt-8 text-center py-12 px-4 rounded-sm bg-white/3 border border-dashed border-white/10">
          <ShieldOff size={28} className="text-white/30 mx-auto mb-3" />
          <p className="text-sm text-white/70">Jogador não encontrado no plantel.</p>
          <p className="text-[12px] text-white/40 mt-1">
            Pode ter sido vendido ou liberado.
          </p>
        </div>
      </div>
    );
  }

  const ovr = overallFromAttributes(player.attrs, player.pos);
  const fatigue = Math.round(health?.fatigue ?? 0);
  const injuryRisk = Math.round(health?.injuryRisk ?? 0);
  const outForMatches = Math.round(health?.outForMatches ?? 0);
  const moralValue = Math.round(moral?.moral ?? 50);
  const formStreak = moral?.formStreak ?? 0;
  const matches = ledger?.matchesPlayed ?? 0;
  const goals = ledger?.goals ?? 0;
  const assists = ledger?.assists ?? 0;
  const yellows = ledger?.yellowCards ?? 0;
  const reds = ledger?.redCards ?? 0;
  const marketCents =
    (player as { marketValueBroCents?: number }).marketValueBroCents ?? 0;

  const isUnavailable = transparency?.is_unavailable || outForMatches > 0;

  // Fonte de transparência: prefere Python, fallback claro pro usuário
  const showFallbackNotice = !transparency && (serviceStatus === 'down' || !authUid);

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="w-full min-w-0 mx-auto space-y-4 max-w-5xl px-3 sm:px-4 py-4">
        {/* ── Voltar (DS §7.1 ghost link) ────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate('/manager/scouts')}
          className="inline-flex items-center gap-2 text-white/55 hover:text-neon-yellow transition-colors"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          <ChevronLeft size={13} /> Plantel
        </button>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <HeroCard
          name={player.name}
          pos={player.pos}
          ovr={ovr}
          marketCents={marketCents}
          isUnavailable={isUnavailable}
          outForMatches={outForMatches}
        />

        {/* ── Status atual (sempre local, dado SSOT) ────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker="Estado de prontidão" title="Status atual" />
          <StatusGrid
            fatigue={fatigue}
            moral={moralValue}
            injuryRisk={injuryRisk}
            formStreak={formStreak}
          />
        </section>

        {/* ── Temporada ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker="Histórico oficial" title="Temporada" />
          <SeasonStats
            matches={matches}
            goals={goals}
            assists={assists}
            yellows={yellows}
            reds={reds}
          />
        </section>

        {/* ── Consequências ativas (do Python, com explicação) ──── */}
        <section className="space-y-2">
          <SectionHeader
            kicker="Efeitos pendentes"
            title={`Consequências ativas${
              transparency ? ` · ${transparency.total_active}` : ''
            }`}
          />
          {transparency ? (
            <ActiveConsequences list={transparency.active} />
          ) : showFallbackNotice ? (
            <div className="text-[11px] text-white/40 italic text-center py-4">
              Serviço /insights indisponível — não foi possível listar consequências
              com explicação humana. Tente entrar na conta ou aguarde reconexão.
            </div>
          ) : (
            <div className="text-[11px] text-white/40 italic text-center py-4">
              Carregando consequências...
            </div>
          )}
        </section>

        {/* ── Timeline (do Python) ──────────────────────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker="Trace cronológico" title="Linha do tempo · 7 dias" />
          <div className="rounded-sm border border-white/8 bg-[var(--color-card)] p-4">
            {transparency ? (
              <Timeline events={transparency.timeline} />
            ) : (
              <div className="text-[11px] text-white/40 italic text-center py-3">
                Timeline disponível só com /insights online.
              </div>
            )}
          </div>
        </section>

        {/* ── Atributos: atual + delta vs 7d atrás ──────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker="Evolução técnica" title="Atributos · delta 7 dias" />
          <AttrDeltaList currentAttrs={player.attrs} weekAgoAttrs={weekAgoAttrs} />
          {!weekAgoAttrs && (
            <div className="text-[10px] text-white/35 italic">
              Sem snapshot anterior a 7 dias — o delta aparecerá após a próxima partida.
            </div>
          )}
        </section>

        {/* ── Mercado ───────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker="Avaliação" title="Histórico de valor de mercado" />
          <div className="rounded-sm border border-white/8 bg-[var(--color-card)] p-4">
            <MarketChart points={marketHistory} />
          </div>
        </section>

        {/* ── Nota de honestidade (epígrafe Moret italic) ────────── */}
        <div className="flex flex-col items-center gap-1.5 py-4">
          <span aria-hidden className="block w-8 h-px bg-neon-yellow/40" />
          <div
            className="text-white/55 text-center max-w-md leading-snug px-4"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '13px',
              letterSpacing: '-0.01em',
            }}
          >
            <Brain size={11} className="inline mr-1.5 -mt-0.5 opacity-50" />
            Todos os números vêm de eventos reais — partidas, treinos, decisões.
            Quando um valor mudar, você verá o motivo aqui.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagerScoutsPlayer;
