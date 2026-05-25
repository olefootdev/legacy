/**
 * OLEFOOT PYTHON MODE — Página SCOUTS.
 *
 * Hub central de inteligência do manager. Consome o serviço Python
 * (/api/insights/*) pra mostrar:
 *   - Relatório da Noite (o que aconteceu enquanto eu dormi)
 *   - Resumo do clube (counts + jogador mais impactado)
 *   - Mapa de consequências por dimensão (físico, psicológico, reputacional, financeiro)
 *
 * Estratégia de fallback: se o Python estiver offline, lê do store local
 * via hooks `useConsequenceCounts` / `useClubConsequences` — a página NUNCA
 * fica em branco. Badge no header indica fonte dos dados.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
  Brain,
  TrendingUp,
  DollarSign,
  Sparkles,
  AlertOctagon,
  AlertTriangle,
  Trophy,
  Clock,
  ShieldOff,
  BadgeCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import {
  useInsightsClubSummary,
  useInsightsConsequences,
  useInsightsNightReport,
  useInsightsServiceHealth,
  useInsightsSquadOverview,
} from '@/hooks/useInsights';
import { ScoutsPlantelTab } from '@/components/olefoot-python-mode/ScoutsPlantelTab';
import {
  useClubConsequences,
  useConsequenceCounts,
} from '@/hooks/useConsequences';
import { cn } from '@/lib/utils';
import type {
  ClubSummary,
  ConsequencesByDimension,
  InsightsEvaluatedConsequence,
  NightReport,
} from '@/insights/client';

// ─── Auth uid hook (necessário pra paths do Python) ────────────────

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

// ─── Status badge ──────────────────────────────────────────────────
//
// Distingue 4 estados verdadeiros — em vez de um booleano que mistura
// "serviço up?" com "consegui buscar meus dados?":
//
//   service-up  → Python health 200, summary chegou. Tudo OK.
//   no-auth     → Python health 200, MAS sem JWT do Supabase. Não é offline,
//                 é o user que não está logado. Badge cinza, tooltip explícito.
//   data-error  → Python health 200, com JWT, mas summary deu erro
//                 (RLS, 5xx, timeout). Sinaliza problema de DADOS, não do serviço.
//   service-down → Python health falhou ou Hono não conseguiu falar com Python.
//                 Este é o "offline" genuíno.

type BadgeState = 'service-up' | 'no-auth' | 'data-error' | 'service-down';

const BADGE_META: Record<BadgeState, { label: string; tooltip: string; cls: string; Icon: typeof Wifi }> = {
  'service-up': {
    label: 'Python · online',
    tooltip: 'Serviço /insights respondendo e dados do clube carregados.',
    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Icon: Wifi,
  },
  'no-auth': {
    label: 'Sem login Supabase',
    tooltip: 'O serviço /insights está online, mas você precisa estar autenticado no Supabase para ver seus dados.',
    cls: 'bg-white/5 text-white/50 border-white/15',
    Icon: WifiOff,
  },
  'data-error': {
    label: 'Sem dados',
    tooltip: 'Serviço /insights respondeu, mas o resumo do clube falhou (RLS, 5xx ou timeout). Mostrando fallback local.',
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    Icon: AlertTriangle,
  },
  'service-down': {
    label: 'Serviço offline',
    tooltip: 'O serviço /insights (Python) não respondeu ao health-check. Mostrando dados locais.',
    cls: 'bg-red-500/10 text-red-300 border-red-500/30',
    Icon: WifiOff,
  },
};

function PythonStatusBadge({ state, detail }: { state: BadgeState; detail?: string | null }) {
  const meta = BADGE_META[state];
  const title = detail ? `${meta.tooltip}\n\n${detail}` : meta.tooltip;
  return (
    <div
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-[10px] font-display font-bold uppercase tracking-[0.18em] border cursor-help',
        meta.cls,
      )}
    >
      <meta.Icon size={11} />
      <span>{meta.label}</span>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'urgent';
  Icon: typeof Activity;
}

function StatCard({ label, value, hint, tone = 'neutral', Icon }: StatCardProps) {
  // Legacy Tech: número em Moret italic, label em Agency uppercase tracking-wide.
  const tones = {
    neutral: 'text-white border-white/8 border-l-white/15',
    positive: 'text-[var(--color-success)] border-[var(--color-success)]/30 border-l-[var(--color-success)]',
    negative: 'text-[var(--color-warning)] border-[var(--color-warning)]/30 border-l-[var(--color-warning)]',
    urgent: 'text-[var(--color-danger)] border-[var(--color-danger)]/30 border-l-[var(--color-danger)]',
  };
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4 border border-l-[3px] bg-[var(--color-card)]',
        tones[tone],
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center gap-2">
        <Icon size={12} className="opacity-65" />
        <span
          className="text-white/55"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontWeight: 800,
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4.5vw, 36px)',
          letterSpacing: '-0.03em',
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="text-white/40"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Dimension section ─────────────────────────────────────────────
//
// Tokens em vez de cores hardcoded (DS §3): físico em danger (lesões),
// psicológico em neon-yellow (acento principal), reputacional em
// success (mercado em alta), financeiro em warning (atenção monetária).

const DIMENSION_META = {
  physical: {
    label: 'Físico',
    Icon: Activity,
    rail: 'border-l-[var(--color-danger)]',
    dot: 'bg-[var(--color-danger)]',
  },
  psychological: {
    label: 'Psicológico',
    Icon: Brain,
    rail: 'border-l-neon-yellow',
    dot: 'bg-neon-yellow',
  },
  reputational: {
    label: 'Reputacional',
    Icon: TrendingUp,
    rail: 'border-l-[var(--color-success)]',
    dot: 'bg-[var(--color-success)]',
  },
  financial: {
    label: 'Financeiro',
    Icon: DollarSign,
    rail: 'border-l-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
} as const;

function formatTimeLeft(ms: number): string {
  if (ms < 60_000) return '<1m';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  if (h < 24) return `${h}h${totalMin % 60 ? ` ${totalMin % 60}m` : ''}`;
  return `${Math.floor(h / 24)}d`;
}

function formatKindLabel(kind: string): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ConsequenceRow({ entry }: { entry: InsightsEvaluatedConsequence }) {
  const c = entry.consequence;
  const isNegative =
    entry.current_value < 0 ||
    c.kind.includes('drop') ||
    c.kind.includes('out') ||
    c.kind.includes('suspension');
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isNegative ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]',
        )}
      />
      <span
        className="flex-1 text-white/85 truncate"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '12.5px' }}
      >
        {formatKindLabel(c.kind)}
      </span>
      <span
        className="text-white/45 tabular-nums shrink-0 leading-none"
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '-0.02em',
        }}
      >
        {formatTimeLeft(entry.ms_until_expiry)}
      </span>
    </div>
  );
}

function DimensionCard({
  dimension,
  entries,
}: {
  dimension: keyof ConsequencesByDimension;
  entries: InsightsEvaluatedConsequence[];
}) {
  const meta = DIMENSION_META[dimension];
  return (
    <div
      className={cn(
        'border border-white/8 border-l-[3px] bg-[var(--color-card)] p-4',
        meta.rail,
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* Header com eyebrow Agency tracking-wide */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <meta.Icon size={12} className="text-white/65" />
          <span
            className="text-white/70"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '10px',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
            }}
          >
            {meta.label}
          </span>
        </div>
        {/* Contador Moret italic */}
        <span
          className="text-white/65 tabular-nums leading-none"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '18px',
            letterSpacing: '-0.02em',
          }}
        >
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <div
          className="text-white/35 italic py-2"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '11.5px' }}
        >
          Nada ativo.
        </div>
      ) : (
        <div className="space-y-0">
          {entries.slice(0, 8).map((e) => (
            <ConsequenceRow key={e.consequence.id} entry={e} />
          ))}
          {entries.length > 8 && (
            <div
              className="text-white/40 pt-2 mt-1 border-t border-white/5"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              + {entries.length - 8} mais
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Night report ──────────────────────────────────────────────────

function NightReportSection({ report }: { report: NightReport }) {
  // Hero card editorial Legacy Tech: eyebrow Agency + headline Moret italic.
  // Counters em Moret italic. Cards de destaque com rail tonal + Agency uppercase.
  const time = new Date(report.generated_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.section
      aria-label="Relatório da noite"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative border border-white/8 border-l-[3px] border-l-neon-yellow bg-[var(--color-card)] p-5 sm:p-6 overflow-hidden"
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 0 18px rgba(253,225,0,0.06)',
      }}
    >
      {/* Header editorial */}
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Eyebrow */}
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
              Relatório da Noite
            </span>
          </div>
          {/* Headline Moret italic editorial */}
          <h3
            className="text-white leading-snug"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(20px, 3.2vw, 26px)',
              letterSpacing: '-0.02em',
            }}
          >
            {report.one_line_summary}
          </h3>
        </div>
        {/* Timestamp em Agency */}
        <div
          className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 bg-deep-black/40 border border-white/10 text-white/55"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <Clock size={10} />
          {time}
        </div>
      </header>

      {/* 3 Counters: Resolvidas / Ativas / Novos */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Resolvidas', value: report.resolved_overnight, color: 'text-[var(--color-success)]' },
          { label: 'Ativas', value: report.still_active, color: 'text-white' },
          { label: 'Novos', value: report.new_alerts, color: 'text-[var(--color-warning)]' },
        ].map((c) => (
          <div
            key={c.label}
            className="text-center p-3 bg-deep-black/40 border border-white/8"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <div
              className={cn('leading-none tabular-nums', c.color)}
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: 'clamp(22px, 3.5vw, 28px)',
                letterSpacing: '-0.03em',
              }}
            >
              {c.value}
            </div>
            <div
              className="text-white/50 mt-1.5"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '9px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
              }}
            >
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Lista de destaques */}
      {report.cards.length > 0 ? (
        <div className="space-y-1.5">
          {report.cards.map((card) => {
            const Icon =
              card.kind === 'alert' || card.tone === 'urgent'
                ? AlertOctagon
                : card.kind === 'celebration'
                ? Trophy
                : Sparkles;
            const toneColor = {
              positive: 'text-[var(--color-success)]',
              negative: 'text-[var(--color-warning)]',
              urgent: 'text-[var(--color-danger)]',
              neutral: 'text-white/70',
            }[card.tone];
            const toneRail = {
              positive: 'border-l-[var(--color-success)]',
              negative: 'border-l-[var(--color-warning)]',
              urgent: 'border-l-[var(--color-danger)]',
              neutral: 'border-l-white/20',
            }[card.tone];
            return (
              <div
                key={card.id}
                className={cn(
                  'flex items-start gap-3 py-2.5 px-3 border border-white/6 border-l-[3px] bg-deep-black/30',
                  toneRail,
                )}
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <Icon size={13} className={cn('shrink-0 mt-0.5', toneColor)} />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn('truncate leading-tight', toneColor)}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: card.tone === 'urgent' ? 900 : 800,
                      fontSize: '12px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    className="text-white/50 truncate mt-0.5"
                    style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}
                  >
                    {card.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="text-center text-white/40 italic py-3"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}
        >
          Sem destaques no momento.
        </div>
      )}
    </motion.section>
  );
}

// ─── Fallback (Python offline) ─────────────────────────────────────

function LocalFallbackSummary() {
  const counts = useConsequenceCounts();
  const local = useClubConsequences();

  const byDim = useMemo(() => {
    const out: ConsequencesByDimension = {
      physical: [],
      psychological: [],
      reputational: [],
      financial: [],
    };
    for (const e of local) {
      out[e.consequence.dimension].push({
        consequence: {
          id: e.consequence.id,
          manager_id: e.consequence.managerId,
          club_id: e.consequence.clubId,
          player_id: e.consequence.playerId ?? null,
          kind: e.consequence.kind,
          dimension: e.consequence.dimension,
          scope: e.consequence.scope,
          magnitude: e.consequence.magnitude,
          decay_curve: e.consequence.decayCurve,
          starts_at: new Date(e.consequence.startsAt).toISOString(),
          expires_at: new Date(e.consequence.expiresAt).toISOString(),
          source_event_id: e.consequence.sourceEventId ?? null,
          metadata: e.consequence.metadata ?? null,
        },
        current_value: e.currentValue,
        life_remaining: e.lifeRemaining,
        ms_until_expiry: e.msUntilExpiry,
      });
    }
    return out;
  }, [local]);

  return { counts, byDim };
}

// ─── Main page ─────────────────────────────────────────────────────

type ScoutsTab = 'plantel' | 'impacto';

export function ManagerScouts() {
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const authUid = useAuthUid();
  const [tab, setTab] = useState<ScoutsTab>('plantel');

  // Python endpoints (passa null se sem auth — hook não dispara fetch)
  const { data: summary, error: summaryError } = useInsightsClubSummary(authUid);
  const { data: consequences } = useInsightsConsequences(authUid);
  const { data: nightReport } = useInsightsNightReport(authUid);
  const { data: squadOverview } = useInsightsSquadOverview(authUid);

  // Probe de saúde do upstream — sem JWT, mede só o serviço
  const { status: serviceStatus, reason: serviceDownReason, lastCheckedAt } =
    useInsightsServiceHealth();

  // Local fallback (sempre disponível)
  const fallback = LocalFallbackSummary();

  // Estado HONESTO do badge — separa "serviço up" de "consegui buscar meus dados"
  const badgeState: BadgeState =
    serviceStatus === 'down'
      ? 'service-down'
      : !authUid
      ? 'no-auth'
      : summary
      ? 'service-up'
      : serviceStatus === 'unknown'
      ? 'no-auth' // ainda probando — mostra cinza neutro
      : 'data-error';

  const badgeDetail =
    badgeState === 'service-down'
      ? serviceDownReason
      : badgeState === 'data-error'
      ? (summaryError ?? null)
      : lastCheckedAt
      ? `Última verificação: ${new Date(lastCheckedAt).toLocaleTimeString('pt-BR')}`
      : null;

  // Compatibilidade interna — algumas condicionais legadas usam pythonOnline
  const pythonOnline = badgeState === 'service-up';

  // Decide qual fonte usar
  const stats: ClubSummary | null = summary ?? {
    total_active: fallback.counts.total,
    unavailable_players: fallback.counts.unavailablePlayers,
    alerts: fallback.counts.alerts,
    celebrations: 0,
    next_expiry_at: null,
    most_impacted_player_id: null,
  };

  const byDimension: ConsequencesByDimension = consequences ?? fallback.byDim;

  const totalDimensionEntries =
    byDimension.physical.length +
    byDimension.psychological.length +
    byDimension.reputational.length +
    byDimension.financial.length;

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="w-full min-w-0 mx-auto space-y-5 max-w-5xl px-3 sm:px-4 py-4">
        {/* ── Hero editorial Legacy Tech (DS §7.4) ───────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate('/manager')}
              className="shrink-0 w-9 h-9 mt-1 bg-deep-black/60 border border-white/12 hover:border-neon-yellow/40 hover:text-neon-yellow grid place-items-center text-white/70 transition-colors"
              style={{ borderRadius: 'var(--radius-sm)' }}
              aria-label="Voltar"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Eyebrow Agency tracking-wide */}
              <div className="flex items-center gap-2">
                <span aria-hidden className="block h-px w-8 bg-neon-yellow/55" />
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
                  Olefoot · Inteligência
                </span>
              </div>
              {/* Headline Moret italic */}
              <h1
                className="text-neon-yellow leading-[0.95] truncate"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: 'clamp(36px, 6vw, 52px)',
                  letterSpacing: '-0.03em',
                }}
              >
                Scouts
              </h1>
              {/* Régua amarela */}
              <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow" />
              {/* Metadata: nome do clube */}
              <div
                className="text-white/55 truncate pt-1"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                {club.name}
              </div>
            </div>
          </div>
          <PythonStatusBadge state={badgeState} detail={badgeDetail} />
        </motion.header>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <section aria-label="Resumo do clube" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatCard
            label="Ativas"
            value={stats.total_active}
            hint="Consequências em jogo"
            tone="neutral"
            Icon={Activity}
          />
          <StatCard
            label="Indisponíveis"
            value={stats.unavailable_players}
            hint="Jogadores fora"
            tone={stats.unavailable_players > 0 ? 'negative' : 'neutral'}
            Icon={ShieldOff}
          />
          <StatCard
            label="Alertas"
            value={stats.alerts}
            hint="Negativos ativos"
            tone={stats.alerts > 3 ? 'urgent' : stats.alerts > 0 ? 'negative' : 'neutral'}
            Icon={AlertTriangle}
          />
          <StatCard
            label="Celebrações"
            value={stats.celebrations}
            hint="Boas notícias"
            tone={stats.celebrations > 0 ? 'positive' : 'neutral'}
            Icon={BadgeCheck}
          />
        </section>

        {/* ── Night report (só se Python entregou) ───────────────── */}
        {nightReport && <NightReportSection report={nightReport} />}

        {/* ── Tabs Legacy Tech (DS §7.6) ────────────────────────── */}
        <div
          role="tablist"
          aria-label="Modo de visualização"
          className="flex items-center gap-1 p-1 bg-deep-black/60 border border-white/10 w-fit"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {(['plantel', 'impacto'] as const).map((t) => {
            const active = tab === t;
            const label = t === 'plantel' ? 'Plantel' : 'Mapa de Impacto';
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 transition-all',
                  active
                    ? 'bg-neon-yellow/[0.08] text-neon-yellow shadow-[0_0_12px_rgba(253,225,0,0.18)]'
                    : 'text-white/55 hover:text-white',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: active ? '3px solid var(--color-neon-yellow)' : '3px solid transparent',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Conteúdo da tab ──────────────────────────────────── */}
        {tab === 'plantel' ? (
          <ScoutsPlantelTab overview={squadOverview} />
        ) : (
          <section aria-label="Mapa de consequências">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.28em] text-white/55"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Mapa de Impacto
                </div>
                <h2
                  className="text-lg font-display font-black text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Consequências ativas
                </h2>
              </div>
              <div className="text-[11px] text-white/40 tabular-nums">
                {totalDimensionEntries} total
              </div>
            </div>

            {totalDimensionEntries === 0 ? (
              <div className="text-center py-10 px-4 rounded-sm bg-white/3 border border-dashed border-white/10">
                <Sparkles size={24} className="text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/55">Nenhuma consequência ativa no momento.</p>
                <p className="text-[12px] text-white/35 mt-1">
                  Jogue partidas para gerar impactos que sobrevivem entre sessões.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DimensionCard dimension="physical" entries={byDimension.physical} />
                <DimensionCard dimension="psychological" entries={byDimension.psychological} />
                <DimensionCard dimension="reputational" entries={byDimension.reputational} />
                <DimensionCard dimension="financial" entries={byDimension.financial} />
              </div>
            )}
          </section>
        )}

        {/* ── Rodapé de status — explica em texto o que o badge representa ─── */}
        {badgeState !== 'service-up' && (
          <div className="text-[11px] text-white/40 italic text-center py-2">
            {badgeState === 'service-down' && (
              <>Serviço /insights offline — mostrando dados locais.</>
            )}
            {badgeState === 'no-auth' && (
              <>Sem sessão Supabase ativa — entre na sua conta para ver os dados do serviço /insights.</>
            )}
            {badgeState === 'data-error' && (
              <>Não foi possível carregar o resumo do clube — mostrando fallback local.</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerScouts;
