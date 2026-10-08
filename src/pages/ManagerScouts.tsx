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
import { SecaoRua } from '@/components/ui';
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

/**
 * DS 2027: concreto, número em spray, rótulo em mono. Verde/vermelho só no
 * número (delta de jogo), nunca como cor de bloco; o fio à esquerda marca o
 * que pede olho (rua).
 */
function StatCard({ label, value, hint, tone = 'neutral', Icon }: StatCardProps) {
  const num = {
    neutral: 'text-papel',
    positive: 'text-alta',
    negative: 'text-rua',
    urgent: 'text-baixa',
  };
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 bg-concreto p-3.5',
        tone === 'neutral' ? 'border-l-[5px] border-linha' : 'border-l-[5px] border-rua',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon size={13} className="shrink-0 text-mudo" aria-hidden />
        <span className="truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{label}</span>
      </div>
      <div className={cn('font-spray font-black leading-none tabular-nums', num[tone])} style={{ fontSize: 'clamp(30px, 8vw, 40px)' }}>
        {value}
      </div>
      {hint && <div className="text-[11.5px] leading-snug text-mudo">{hint}</div>}
    </div>
  );
}

// ─── Dimension section ─────────────────────────────────────────────
//
// DS 2027: sem cor por dimensão (nada de vermelho/verde/âmbar como bloco).
// A dimensão se lê pelo ícone + rótulo; o sinal (bom/ruim) vai no ponto.

const DIMENSION_META = {
  physical: { label: L('Físico', 'Physical'), Icon: Activity },
  psychological: { label: L('Psicológico', 'Psychological'), Icon: Brain },
  reputational: { label: L('Reputacional', 'Reputation'), Icon: TrendingUp },
  financial: { label: L('Financeiro', 'Financial'), Icon: DollarSign },
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
    <div className="flex min-w-0 items-center gap-2.5 py-2">
      <span aria-hidden className={cn('font-impact text-[14px] leading-none', isNegative ? 'text-baixa' : 'text-alta')}>
        {isNegative ? '−' : '+'}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-papel">{ex.title}</span>
      <span className="shrink-0 font-prova text-[11px] font-bold tabular-nums text-mudo">
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
    <div className="min-w-0 bg-concreto p-4">
      <div className="mb-2 flex items-center justify-between border-b-2 border-linha pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <meta.Icon size={14} className="shrink-0 text-mudo" aria-hidden />
          <span className="truncate font-impact text-[19px] uppercase leading-none text-papel">{meta.label}</span>
        </div>
        <span className="font-spray text-[22px] font-black leading-none tabular-nums text-papel">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="py-2 font-prova text-[11.5px] text-mudo">{L('Nada ativo.', 'Nothing active.')}</div>
      ) : (
        <div className="divide-y divide-linha">
          {entries.slice(0, 8).map((e) => (
            <ConsequenceRow key={e.consequence.id} entry={e} />
          ))}
          {entries.length > 8 && (
            <div className="pt-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">
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
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-3 py-4 sm:px-4">
        {/* ── Hero — o grito em Anton, o clube na voz ───────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex min-w-0 items-end gap-3 border-b-2 border-papel pb-3"
        >
          <button
            type="button"
            onClick={() => navigate('/manager')}
            className="mb-1 grid h-11 w-11 shrink-0 place-items-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
            aria-label={L('Voltar', 'Back')}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">
              — {L('Olefoot · Inteligência', 'Olefoot · Intelligence')}
            </span>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <h1 className="font-impact uppercase leading-[0.9] text-papel" style={{ fontSize: 'clamp(48px, 14vw, 72px)' }}>
                Scouts
              </h1>
              <span className="min-w-0 truncate font-voz text-[clamp(20px,6vw,28px)] leading-none text-suave">{club.name}</span>
            </div>
          </div>
        </motion.header>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <section aria-label={L('Resumo do clube', 'Club summary')} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

        {/* ── Abas ─────────────────────────────────────────────── */}
        <div role="tablist" aria-label={L('Modo de visualização', 'View mode')} className="flex flex-wrap items-center gap-2">
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
                  'min-h-[42px] border-2 px-4 font-prova text-[12px] font-bold uppercase tracking-[0.14em] transition-colors',
                  active ? 'border-rua bg-rua text-asfalto-27' : 'border-linha text-mudo hover:border-fio hover:text-papel',
                )}
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
          <section aria-label={L('Mapa de consequências', 'Consequence map')} className="flex flex-col gap-3">
            <SecaoRua label={L('Consequências ativas', 'Active consequences')} aside={totalDimensionEntries} />

            {totalDimensionEntries === 0 ? (
              <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-5">
                <Sparkles size={22} className="text-fio" aria-hidden />
                <p className="font-voz text-[23px] leading-[1.05] text-papel">{L('Nenhuma consequência ativa no momento.', 'No active consequences right now.')}</p>
                <p className="text-[12.5px] leading-snug text-suave">
                  {L('Jogue partidas para gerar impactos que sobrevivem entre sessões.', 'Play matches to create impacts that carry over between sessions.')}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                >
                  {L('Jogar', 'Play')} <span aria-hidden>→</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
