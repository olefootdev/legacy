/**
 * OLEFOOT PYTHON MODE — Painel de transparência do jogador.
 *
 * Rota: /manager/scouts/player/:playerId
 *
 * Mostra:
 *   - Header com player card (foto + nome + OVR + valor de mercado)
 *   - Stats da temporada
 *   - Status físico/moral/forma (dados locais)
 *   - Consequências ativas com explicação humana (local, consequenceViews)
 *   - Timeline cronológica: aplicação das consequências ativas nos últimos 7d
 *     (o store local não guarda as expiradas — não inventamos histórico)
 *   - Evolução de atributos (delta dos últimos 7d via playerEvolutionTimeline)
 *   - Histórico de valor de mercado (snapshots em playerEvolutionTimeline)
 *
 * Regra principal: tudo que mudou tem explicação visível. Se algum dado
 * está em fallback, o painel anuncia isso textualmente em vez de mentir.
 */
import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
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
import { overallFromAttributes } from '@/entities/player';
import { formatBroFromCents } from '@/systems/economy';
import { usePlayerConsequences } from '@/hooks/useConsequences';
import type { PlayerAttributes } from '@/entities/types';
import type { PlayerEvolutionPoint } from '@/team/playerEvolutionTimeline';
import {
  buildPlayerTransparency,
  type ExplainedConsequence,
  type PlayerTimelineEvent,
  type Severity,
} from '@/systems/consequenceViews';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { DEGRAU_CLASSES, SeloRua, type Degrau } from '@/components/ui';
import { rotuloPosicao } from '@/transfer/marketFilters';

// ─── Helpers ───────────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 60_000) return L('agora', 'now');
  const m = Math.floor(diff / 60_000);
  if (m < 60) return L(`há ${m}min`, `${m}min ago`);
  const h = Math.floor(m / 60);
  if (h < 24) return L(`há ${h}h`, `${h}h ago`);
  const d = Math.floor(h / 24);
  return L(`há ${d}d`, `${d}d ago`);
}

function formatTimeLeft(ms: number): string {
  if (ms < 60_000) return '<1m';
  const tm = Math.floor(ms / 60_000);
  if (tm < 60) return `${tm}m`;
  const h = Math.floor(tm / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Rótulos de tela — as chaves continuam as do schema. */
const ROTULO_ATRIBUTO: Record<keyof PlayerAttributes, string> = {
  passe: L('passe', 'passing'),
  marcacao: L('marcacao', 'marking'),
  velocidade: L('velocidade', 'pace'),
  drible: L('drible', 'dribbling'),
  finalizacao: L('finalizacao', 'finishing'),
  fisico: L('fisico', 'physical'),
  tatico: L('tatico', 'tactical'),
  mentalidade: L('mentalidade', 'mentality'),
  confianca: L('confianca', 'confidence'),
  fairPlay: L('fairPlay', 'fair play'),
  cabeceio: L('cabeceio', 'heading'),
  bolaParada: L('bolaParada', 'set pieces'),
  penalti: L('penalti', 'penalties'),
};

const ROTULO_DIMENSAO: Record<string, string> = {
  physical: L('physical', 'physical'),
  psychological: L('psychological', 'psychological'),
  reputational: L('reputational', 'reputational'),
  financial: L('financial', 'financial'),
};

// ─── Severity styling ──────────────────────────────────────────────
// DS 2027: verde/vermelho só como sinal de jogo (ícone/delta), nunca bloco.

const SEVERITY_STYLE: Record<Severity, { color: string; rail: string; Icon: typeof Activity }> = {
  alert: { color: 'text-baixa', rail: 'border-l-baixa', Icon: AlertOctagon },
  celebration: { color: 'text-alta', rail: 'border-l-alta', Icon: Sparkles },
  neutral: { color: 'text-suave', rail: 'border-l-linha', Icon: Activity },
  info: { color: 'text-rua', rail: 'border-l-rua', Icon: Clock },
};

const ROTULO_CLS = 'font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo';

function degrauDoOvr(ovr: number): Degrau {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 80) return 'respeito';
  if (ovr >= 70) return 'corre';
  return 'chao';
}

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
  // DS 2027: a carta na escada (OVR decide o degrau) + nome na voz.
  return (
    <motion.section
      initial={{ scale: 0.97, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="rua-grao relative flex min-w-0 items-stretch gap-4 bg-concreto p-4 sm:gap-5 sm:p-6"
    >
      {/* OVR + POS — a carta no degrau dela */}
      <div
        className={cn(
          'flex w-[88px] shrink-0 -rotate-2 flex-col items-center justify-center gap-1 py-3 shadow-[4px_4px_0_var(--color-papel)] sm:w-[104px]',
          DEGRAU_CLASSES[degrauDoOvr(ovr)],
        )}
      >
        <div className="font-impact leading-none tabular-nums" style={{ fontSize: 'clamp(44px, 12vw, 64px)' }}>
          {ovr}
        </div>
        <div className="font-prova text-[11px] font-bold uppercase tracking-[0.18em]">{rotuloPosicao(pos)}</div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
          — {L('Painel de Transparência', 'Transparency Panel')}
        </span>
        <h1 className="min-w-0 break-words font-voz leading-[0.95] text-papel" style={{ fontSize: 'clamp(32px, 9vw, 52px)' }}>
          {name}
        </h1>

        {isUnavailable && (
          <SeloRua tom="cal" className="self-start">
            <ShieldOff size={12} aria-hidden />
            {L('Indisponível', 'Unavailable')}{outForMatches > 0 ? ` · ${outForMatches}${L('P', 'M')}` : ''}
          </SeloRua>
        )}

        {marketCents > 0 && (
          <div className="flex min-w-0 items-baseline gap-2 pt-1">
            <span className="min-w-0 truncate font-spray font-black leading-none tabular-nums text-ouro-27" style={{ fontSize: 'clamp(24px, 7vw, 32px)' }}>
              {formatBroFromCents(marketCents)}
            </span>
            <span className={ROTULO_CLS}>{L('valor atual', 'current value')}</span>
          </div>
        )}
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
      key: 'physical',
      label: L('Físico', 'Physical'),
      value: `${100 - fatigue}%`,
      hint: fatigue > 70 ? L('Exausto', 'Exhausted') : fatigue > 40 ? L('Cansado', 'Tired') : L('Pronto', 'Ready'),
      Icon: Activity,
      tone: fatigue > 70 ? 'urgent' : fatigue > 40 ? 'negative' : 'positive',
    },
    {
      key: 'morale',
      label: L('Moral', 'Morale'),
      value: `${moral}%`,
      hint: moral >= 70 ? L('Confiante', 'Confident') : moral < 40 ? L('Abalado', 'Shaken') : L('Estável', 'Stable'),
      Icon: Heart,
      tone: moral >= 70 ? 'positive' : moral < 40 ? 'negative' : 'neutral',
    },
    {
      key: 'form',
      label: L('Forma', 'Form'),
      value: formStreak > 0 ? `+${formStreak}` : `${formStreak}`,
      hint:
        formStreak >= 3
          ? L('Em alta', 'On the rise')
          : formStreak <= -3
          ? L('Em baixa', 'Slumping')
          : L('Equilibrada', 'Steady'),
      Icon: formStreak >= 0 ? TrendingUp : TrendingDown,
      tone: formStreak >= 2 ? 'positive' : formStreak <= -2 ? 'negative' : 'neutral',
    },
    {
      key: 'injury',
      label: L('Risco lesão', 'Injury risk'),
      value: `${injuryRisk}%`,
      hint: injuryRisk >= 70 ? L('Crítico', 'Critical') : injuryRisk >= 40 ? L('Atenção', 'Caution') : L('Baixo', 'Low'),
      Icon: AlertTriangle,
      tone: injuryRisk >= 70 ? 'urgent' : injuryRisk >= 40 ? 'negative' : 'positive',
    },
  ] as const;

  const num: Record<'urgent' | 'negative' | 'neutral' | 'positive', string> = {
    urgent: 'text-baixa',
    negative: 'text-rua',
    neutral: 'text-papel',
    positive: 'text-alta',
  };

  return (
    <section aria-label={L('Status atual', 'Current status')} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cells.map((c) => (
        <div
          key={c.key}
          className={cn(
            'flex min-w-0 flex-col gap-2 border-l-[5px] bg-concreto p-3.5',
            c.tone === 'urgent' || c.tone === 'negative' ? 'border-rua' : 'border-linha',
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <c.Icon size={12} className="shrink-0 text-mudo" aria-hidden />
            <span className={cn(ROTULO_CLS, 'truncate')}>{c.label}</span>
          </div>
          <div className={cn('font-spray font-black leading-none tabular-nums', num[c.tone])} style={{ fontSize: 'clamp(28px, 8vw, 36px)' }}>
            {c.value}
          </div>
          <div className="text-[11.5px] text-mudo">{c.hint}</div>
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
      <div className="border-2 border-dashed border-fio px-4 py-4 font-voz text-[21px] leading-[1.1] text-papel">
        {L('Sem partidas oficiais ainda nesta temporada.', 'No official matches yet this season.')}
      </div>
    );
  }
  const items = [
    { key: 'matches', label: L('Partidas', 'Matches'), value: matches, Icon: Calendar },
    { key: 'goals', label: L('Gols', 'Goals'), value: goals, Icon: Target },
    { key: 'assists', label: L('Assists', 'Assists'), value: assists, Icon: Award },
    { key: 'yellows', label: L('Amarelos', 'Yellows'), value: yellows, Icon: AlertTriangle },
    { key: 'reds', label: L('Vermelhos', 'Reds'), value: reds, Icon: AlertOctagon },
  ];
  return (
    <section className="grid grid-cols-5 divide-x-2 divide-linha border-y-2 border-linha">
      {items.map((i) => (
        <div key={i.key} className="flex min-w-0 flex-col items-center gap-1.5 px-1 py-3">
          <i.Icon size={12} className="text-mudo" aria-hidden />
          <div className="font-spray text-[clamp(22px,6vw,28px)] font-black leading-none tabular-nums text-papel">{i.value}</div>
          <div className="w-full truncate text-center font-prova text-[9.5px] font-bold uppercase tracking-[0.1em] text-mudo">{i.label}</div>
        </div>
      ))}
    </section>
  );
}

function ActiveConsequences({
  list,
}: {
  list: ExplainedConsequence[];
}) {
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1.5 border-2 border-dashed border-fio px-4 py-4">
        <p className="font-voz text-[21px] leading-[1.1] text-papel">{L('Nenhuma consequência ativa.', 'No active consequences.')}</p>
        <p className="font-prova text-[11px] text-mudo">
          {L('Jogador estável — sem efeitos pendentes.', 'Player stable — no pending effects.')}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map((e) => {
        const sty = SEVERITY_STYLE[e.severity];
        return (
          <div key={e.consequence.id} className={cn('flex min-w-0 items-start gap-3 border-l-[5px] bg-concreto p-3.5', sty.rail)}>
            <sty.Icon size={15} className={cn('mt-0.5 shrink-0', sty.color)} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 truncate font-impact text-[17px] uppercase leading-[1.1] text-papel">{e.title}</div>
                <div className="shrink-0 font-prova text-[11px] font-bold tabular-nums text-mudo">
                  {formatTimeLeft(e.ms_until_expiry)}
                </div>
              </div>
              <div className="mt-0.5 text-[12.5px] text-suave">{e.subtitle}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-prova text-[10.5px] uppercase tracking-[0.08em] text-mudo">
                <span>{ROTULO_DIMENSAO[e.consequence.dimension] ?? e.consequence.dimension}</span>
                <span className="tabular-nums">
                  {L('intensidade', 'intensity')} {Math.round(Math.abs(e.current_value * 100))}%
                </span>
                <span aria-hidden>·</span>
                <span>{Math.round(e.life_remaining * 100)}% {L('restante', 'remaining')}</span>
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
      <div className="py-2 font-voz text-[20px] leading-[1.1] text-suave">
        {L('Sem eventos recentes nos últimos 7 dias.', 'No events in the last 7 days.')}
      </div>
    );
  }
  return (
    <ol className="relative pl-4">
      <div className="absolute bottom-0 left-1 top-0 w-0.5 bg-linha" />
      {events.map((e, i) => {
        const sty = SEVERITY_STYLE[e.severity];
        return (
          <li key={`${e.consequence_id}-${e.kind}-${i}`} className="relative pb-3.5 pl-3 last:pb-0">
            <div
              className={cn(
                'absolute -left-[6px] top-1.5 h-2.5 w-2.5',
                e.severity === 'alert'
                  ? 'bg-baixa'
                  : e.severity === 'celebration'
                  ? 'bg-alta'
                  : e.severity === 'info'
                  ? 'bg-rua'
                  : 'bg-fio',
              )}
            />
            <div className="flex items-baseline justify-between gap-2">
              <div className={cn('min-w-0 text-[13px] font-bold', sty.color === 'text-suave' ? 'text-papel' : sty.color)}>
                {e.title}
              </div>
              <div className="shrink-0 font-prova text-[10.5px] tabular-nums text-mudo">
                {formatTimeAgo(e.at)}
              </div>
            </div>
            <div className="mt-0.5 text-[12px] text-suave">{e.subtitle}</div>
            {e.source_event_id && (
              <div className="mt-0.5 truncate font-prova text-[10px] text-fio">
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {keys.map((k) => {
        const now = currentAttrs[k] ?? 0;
        const prev = weekAgoAttrs?.[k] ?? null;
        const delta = prev !== null ? now - prev : null;
        const deltaSign = delta === null ? null : delta > 0 ? '+' : '';
        const hasDelta = delta !== null && delta !== 0;
        return (
          <div key={k} className="flex min-w-0 flex-col gap-1 bg-concreto p-3">
            <div className={cn(ROTULO_CLS, 'truncate')}>{ROTULO_ATRIBUTO[k] ?? k}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-impact text-[24px] leading-none tabular-nums text-papel">{now}</span>
              {hasDelta && (
                <span className={cn('font-prova text-[11px] font-bold tabular-nums', delta > 0 ? 'text-alta' : 'text-baixa')}>
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
      <div className="font-prova text-[11.5px] leading-relaxed text-mudo">
        {L(
          'Histórico de mercado ainda construindo — precisa de mais snapshots após partidas pra exibir tendência.',
          'Market history still building — needs more post-match snapshots to show a trend.',
        )}
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
      <div className="flex items-baseline justify-between gap-2">
        <div className={ROTULO_CLS}>{points.length} snapshots</div>
        <div className={cn('font-prova text-[12px] font-bold tabular-nums', positive ? 'text-alta' : 'text-baixa')}>
          {positive ? '+' : ''}
          {formatBroFromCents(change)} ({changePct >= 0 ? '+' : ''}
          {changePct.toFixed(1)}%)
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" aria-hidden>
        <path d={path} fill="none" stroke="var(--color-rua)" strokeWidth={2.5} />
      </svg>
      <div className="flex items-baseline justify-between font-prova text-[10.5px] tabular-nums text-mudo">
        <span>{formatBroFromCents(first)}</span>
        <span>{formatBroFromCents(last)}</span>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  // DS 2027: rótulo "— " em mono + título em Anton.
  return (
    <div className="flex min-w-0 flex-col gap-1 pt-2">
      <span className={ROTULO_CLS}>— {kicker}</span>
      <h2 className="min-w-0 font-impact text-[clamp(22px,6.4vw,28px)] uppercase leading-[1.05] text-papel">{title}</h2>
    </div>
  );
}

export function ManagerScoutsPlayer() {
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId: string }>();

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

  // Transparência 100% local: consequências ativas do jogador + explicação.
  const playerConsequences = usePlayerConsequences(playerId);
  const transparency = useMemo(
    () => buildPlayerTransparency(playerId ?? '', playerConsequences),
    [playerId, playerConsequences],
  );

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
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <button
          type="button"
          onClick={() => navigate('/manager/scouts')}
          className="inline-flex min-h-[40px] items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo transition-colors hover:text-rua"
        >
          <ChevronLeft size={14} /> {L('Voltar pro plantel', 'Back to squad')}
        </button>
        <div className="mt-6 flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-6">
          <ShieldOff size={26} className="text-fio" aria-hidden />
          <p className="font-voz text-[24px] leading-[1.05] text-papel">{L('Jogador não encontrado no plantel.', 'Player not found in the squad.')}</p>
          <p className="text-[12.5px] text-suave">
            {L('Pode ter sido vendido ou liberado.', 'They may have been sold or released.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/manager/scouts')}
            className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
          >
            {L('Ver o plantel', 'See the squad')} <span aria-hidden>→</span>
          </button>
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

  const isUnavailable = transparency.is_unavailable || outForMatches > 0;

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-3 py-4 sm:px-4">
        {/* ── Voltar (DS §7.1 ghost link) ────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate('/manager/scouts')}
          className="inline-flex min-h-[40px] items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo transition-colors hover:text-rua"
        >
          <ChevronLeft size={13} /> {L('Plantel', 'Squad')}
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
          <SectionHeader kicker={L('Estado de prontidão', 'Readiness')} title={L('Status atual', 'Current status')} />
          <StatusGrid
            fatigue={fatigue}
            moral={moralValue}
            injuryRisk={injuryRisk}
            formStreak={formStreak}
          />
        </section>

        {/* ── Temporada ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker={L('Histórico oficial', 'Official record')} title={L('Temporada', 'Season')} />
          <SeasonStats
            matches={matches}
            goals={goals}
            assists={assists}
            yellows={yellows}
            reds={reds}
          />
        </section>

        {/* ── Consequências ativas (local, com explicação) ──────── */}
        <section className="space-y-2">
          <SectionHeader
            kicker={L('Efeitos pendentes', 'Pending effects')}
            title={`${L('Consequências ativas', 'Active consequences')} · ${transparency.total_active}`}
          />
          <ActiveConsequences list={transparency.active} />
        </section>

        {/* ── Timeline (aplicações das consequências ativas) ────── */}
        <section className="space-y-2">
          <SectionHeader kicker={L('Trace cronológico', 'Chronological trace')} title={L('Linha do tempo · 7 dias', 'Timeline · 7 days')} />
          <div className="bg-concreto p-4">
            <Timeline events={transparency.timeline} />
          </div>
        </section>

        {/* ── Atributos: atual + delta vs 7d atrás ──────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker={L('Evolução técnica', 'Technical progress')} title={L('Atributos · delta 7 dias', 'Attributes · 7-day delta')} />
          <AttrDeltaList currentAttrs={player.attrs} weekAgoAttrs={weekAgoAttrs} />
          {!weekAgoAttrs && (
            <div className="font-prova text-[11px] text-mudo">
              {L('Sem snapshot anterior a 7 dias — o delta aparecerá após a próxima partida.', 'No snapshot older than 7 days — the delta will show after the next match.')}
            </div>
          )}
        </section>

        {/* ── Mercado ───────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionHeader kicker={L('Avaliação', 'Valuation')} title={L('Histórico de valor de mercado', 'Market value history')} />
          <div className="bg-concreto p-4">
            <MarketChart points={marketHistory} />
          </div>
        </section>

      </div>
    </div>
  );
}

export default ManagerScoutsPlayer;
