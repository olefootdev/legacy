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
} from '@/hooks/useInsights';
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
  const tones = {
    neutral: 'text-white border-white/8',
    positive: 'text-emerald-400 border-emerald-500/30',
    negative: 'text-orange-400 border-orange-500/30',
    urgent: 'text-red-400 border-red-500/30',
  };
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 p-4 rounded-sm border bg-[var(--color-card)]',
        tones[tone],
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="opacity-60" />
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-white/55"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-3xl font-display font-black leading-none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-white/40">{hint}</div>}
    </div>
  );
}

// ─── Dimension section ─────────────────────────────────────────────

const DIMENSION_META = {
  physical: { label: 'Físico', Icon: Activity, accent: 'border-l-red-400' },
  psychological: { label: 'Psicológico', Icon: Brain, accent: 'border-l-blue-400' },
  reputational: { label: 'Reputacional', Icon: TrendingUp, accent: 'border-l-emerald-400' },
  financial: { label: 'Financeiro', Icon: DollarSign, accent: 'border-l-amber-400' },
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
  const isNegative = entry.current_value < 0 || c.kind.includes('drop') || c.kind.includes('out') || c.kind.includes('suspension');
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isNegative ? 'bg-red-400' : 'bg-emerald-400',
        )}
      />
      <span className="flex-1 text-[12px] text-white/85 truncate">
        {formatKindLabel(c.kind)}
      </span>
      <span className="text-[10px] text-white/40 font-mono shrink-0">
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
        'rounded-sm border border-white/8 border-l-4 bg-[var(--color-card)] p-4',
        meta.accent,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <meta.Icon size={14} className="text-white/60" />
          <span
            className="text-[10px] uppercase tracking-[0.22em] text-white/55"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {meta.label}
          </span>
        </div>
        <span className="text-[11px] text-white/40 tabular-nums">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="text-[11px] text-white/30 italic py-2">Nada ativo.</div>
      ) : (
        <div className="space-y-0.5">
          {entries.slice(0, 8).map((e) => (
            <ConsequenceRow key={e.consequence.id} entry={e} />
          ))}
          {entries.length > 8 && (
            <div className="text-[10px] text-white/40 pt-1">+ {entries.length - 8} mais…</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Night report ──────────────────────────────────────────────────

function NightReportSection({ report }: { report: NightReport }) {
  return (
    <section
      aria-label="Relatório da noite"
      className="rounded-sm border border-white/8 border-l-4 border-l-neon-yellow bg-[var(--color-card)] p-5"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-neon-yellow/80"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            Relatório da Noite
          </div>
          <h3
            className="text-xl font-display font-black text-white mt-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {report.one_line_summary}
          </h3>
        </div>
        <div className="text-[10px] text-white/40 shrink-0 ml-3">
          <Clock size={11} className="inline mr-1" />
          {new Date(report.generated_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-sm bg-white/5">
          <div className="text-2xl font-black font-display text-emerald-400 leading-none">
            {report.resolved_overnight}
          </div>
          <div className="text-[10px] text-white/50 mt-1 uppercase tracking-wider">Resolvidas</div>
        </div>
        <div className="text-center p-2 rounded-sm bg-white/5">
          <div className="text-2xl font-black font-display text-white leading-none">
            {report.still_active}
          </div>
          <div className="text-[10px] text-white/50 mt-1 uppercase tracking-wider">Ativas</div>
        </div>
        <div className="text-center p-2 rounded-sm bg-white/5">
          <div className="text-2xl font-black font-display text-orange-400 leading-none">
            {report.new_alerts}
          </div>
          <div className="text-[10px] text-white/50 mt-1 uppercase tracking-wider">Novos</div>
        </div>
      </div>

      {report.cards.length > 0 ? (
        <div className="space-y-1.5">
          {report.cards.map((card) => {
            const Icon =
              card.kind === 'alert' || card.tone === 'urgent'
                ? AlertOctagon
                : card.kind === 'celebration'
                ? Trophy
                : Sparkles;
            const toneClass = {
              positive: 'text-emerald-400',
              negative: 'text-orange-400',
              urgent: 'text-red-400 font-bold',
              neutral: 'text-white/70',
            }[card.tone];
            return (
              <div
                key={card.id}
                className="flex items-center gap-2.5 py-2 border-t border-white/5 first:border-t-0"
              >
                <Icon size={14} className={toneClass} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium truncate', toneClass)}>{card.title}</div>
                  <div className="text-[11px] text-white/45 truncate">{card.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-[12px] text-white/40 py-3 italic">
          Sem destaques no momento.
        </div>
      )}
    </section>
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

export function ManagerScouts() {
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const authUid = useAuthUid();

  // Python endpoints (passa null se sem auth — hook não dispara fetch)
  const { data: summary, error: summaryError } = useInsightsClubSummary(authUid);
  const { data: consequences } = useInsightsConsequences(authUid);
  const { data: nightReport } = useInsightsNightReport(authUid);

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
        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/manager')}
              className="shrink-0 w-9 h-9 rounded-sm bg-white/5 hover:bg-white/10 grid place-items-center text-white/70 transition"
              aria-label="Voltar"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.28em] text-neon-yellow/80"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                Inteligência
              </div>
              <h1
                className="text-2xl sm:text-3xl font-display font-black text-white truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                SCOUTS
              </h1>
              <div className="text-[11px] text-white/45 mt-0.5 truncate">{club.name}</div>
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

        {/* ── Mapa de consequências por dimensão ─────────────────── */}
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
