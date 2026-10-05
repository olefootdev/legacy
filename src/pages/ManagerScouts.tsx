/**
 * OLEFOOT PYTHON MODE — Página SCOUTS.
 *
 * Hub central de inteligência do manager. 100% LOCAL: tudo sai do store
 * (`consequenceStore`) via `useClubConsequences` e os builders de
 * `@/systems/consequenceViews`:
 *   - Resumo do clube (ativas, indisponíveis, alertas, celebrações)
 *   - Plantel com efeitos por jogador
 *   - Mapa de consequências por dimensão (físico, psicológico, reputacional, financeiro)
 *
 * O serviço Python /insights que alimentava esta página foi aposentado em
 * 2026-10-05 — ele só relia as mesmas consequências do Supabase.
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
  Brain,
  TrendingUp,
  DollarSign,
  Sparkles,
  AlertTriangle,
  ShieldOff,
  BadgeCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { ScoutsPlantelTab } from '@/components/olefoot-python-mode/ScoutsPlantelTab';
import { useClubConsequences } from '@/hooks/useConsequences';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import {
  buildClubSummary,
  explainConsequence,
  groupByDimension,
  type ConsequencesByDimension,
  type EvaluatedConsequenceView,
} from '@/systems/consequenceViews';

// ─── Stat card ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'urgent';
  Icon: typeof Activity;
}

function StatCard({ label, value, hint, tone = 'neutral', Icon }: StatCardProps) {
  // VOLT2: número chapado, label em caixa alta.
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
          fontFamily: 'var(--font-impact)',
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
    label: L('Físico', 'Physical'),
    Icon: Activity,
    rail: 'border-l-[var(--color-danger)]',
    dot: 'bg-[var(--color-danger)]',
  },
  psychological: {
    label: L('Psicológico', 'Psychological'),
    Icon: Brain,
    rail: 'border-l-neon-yellow',
    dot: 'bg-neon-yellow',
  },
  reputational: {
    label: L('Reputacional', 'Reputation'),
    Icon: TrendingUp,
    rail: 'border-l-[var(--color-success)]',
    dot: 'bg-[var(--color-success)]',
  },
  financial: {
    label: L('Financeiro', 'Financial'),
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

function ConsequenceRow({ entry }: { entry: EvaluatedConsequenceView }) {
  const c = entry.consequence;
  const ex = explainConsequence(c.kind, c.magnitude);
  const isNegative = ex.severity === 'alert';
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
        {ex.title}
      </span>
      <span
        className="text-white/45 tabular-nums shrink-0 leading-none"
        style={{
          fontFamily: 'var(--font-impact)',
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
  entries: EvaluatedConsequenceView[];
}) {
  const meta = DIMENSION_META[dimension];
  return (
    <div
      className={cn(
        'border border-white/8 border-l-[3px] bg-[var(--color-card)] p-4',
        meta.rail,
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
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
        {/* Contador */}
        <span
          className="text-white/65 tabular-nums leading-none"
          style={{
            fontFamily: 'var(--font-impact)',
            fontSize: '18px',
            letterSpacing: '-0.02em',
          }}
        >
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <div
          className="text-white/35 py-2"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '11.5px' }}
        >
          {L('Nada ativo.', 'Nothing active.')}
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
              + {entries.length - 8} {L('mais', 'more')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dados locais (única fonte) ────────────────────────────────────

function useLocalScoutsData() {
  const local = useClubConsequences();
  const stats = useMemo(() => buildClubSummary(local), [local]);
  const byDimension = useMemo(() => groupByDimension(local), [local]);
  return { stats, byDimension };
}

// ─── Main page ─────────────────────────────────────────────────────

type ScoutsTab = 'plantel' | 'impacto';

export function ManagerScouts() {
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const [tab, setTab] = useState<ScoutsTab>('plantel');

  const { stats, byDimension } = useLocalScoutsData();

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
              aria-label={L('Voltar', 'Back')}
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
                  {L('Olefoot · Inteligência', 'Olefoot · Intelligence')}
                </span>
              </div>
              {/* Headline */}
              <h1
                className="font-impact uppercase text-white leading-[1.1] truncate"
                style={{ fontSize: 'clamp(36px, 6vw, 52px)' }}
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
        </motion.header>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <section aria-label={L('Resumo do clube', 'Club summary')} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatCard
            label={L('Ativas', 'Active')}
            value={stats.total_active}
            hint={L('Consequências em jogo', 'Consequences in play')}
            tone="neutral"
            Icon={Activity}
          />
          <StatCard
            label={L('Indisponíveis', 'Unavailable')}
            value={stats.unavailable_players}
            hint={L('Jogadores fora', 'Players out')}
            tone={stats.unavailable_players > 0 ? 'negative' : 'neutral'}
            Icon={ShieldOff}
          />
          <StatCard
            label={L('Alertas', 'Alerts')}
            value={stats.alerts}
            hint={L('Negativos ativos', 'Active negatives')}
            tone={stats.alerts > 3 ? 'urgent' : stats.alerts > 0 ? 'negative' : 'neutral'}
            Icon={AlertTriangle}
          />
          <StatCard
            label={L('Celebrações', 'Celebrations')}
            value={stats.celebrations}
            hint={L('Boas notícias', 'Good news')}
            tone={stats.celebrations > 0 ? 'positive' : 'neutral'}
            Icon={BadgeCheck}
          />
        </section>

        {/* ── Tabs Legacy Tech (DS §7.6) ────────────────────────── */}
        <div
          role="tablist"
          aria-label={L('Modo de visualização', 'View mode')}
          className="flex items-center gap-1 p-1 bg-deep-black/60 border border-white/10 w-fit"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {(['plantel', 'impacto'] as const).map((t) => {
            const active = tab === t;
            const label = t === 'plantel' ? L('Plantel', 'Squad') : L('Mapa de Impacto', 'Impact Map');
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 transition-colors',
                  active
                    ? 'bg-white text-black'
                    : 'text-white/55 hover:text-white',
                )}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Conteúdo da tab ──────────────────────────────────── */}
        {tab === 'plantel' ? (
          <ScoutsPlantelTab />
        ) : (
          <section aria-label={L('Mapa de consequências', 'Consequence map')}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.28em] text-white/55"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  {L('Mapa de Impacto', 'Impact Map')}
                </div>
                <h2
                  className="text-lg font-display font-black text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {L('Consequências ativas', 'Active consequences')}
                </h2>
              </div>
              <div className="text-[11px] text-white/40 tabular-nums">
                {totalDimensionEntries} {L('total', 'total')}
              </div>
            </div>

            {totalDimensionEntries === 0 ? (
              <div className="text-center py-10 px-4 rounded-sm bg-white/3 border border-dashed border-white/10">
                <Sparkles size={24} className="text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/55">{L('Nenhuma consequência ativa no momento.', 'No active consequences right now.')}</p>
                <p className="text-[12px] text-white/35 mt-1">
                  {L('Jogue partidas para gerar impactos que sobrevivem entre sessões.', 'Play matches to create impacts that carry over between sessions.')}
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

      </div>
    </div>
  );
}

export default ManagerScouts;
