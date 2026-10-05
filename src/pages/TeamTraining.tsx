import { useEffect, useMemo, useState } from 'react';
import { RailStat } from '@/components/ui/RailStat';
import { motion } from 'motion/react';
import { BatteryCharging, Brain, Check, Clock, Crosshair, Dumbbell, Footprints, LayoutGrid, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EditorialHero } from '@/components/EditorialHero';
import { useGameDispatch, useGameStore } from '@/game/store';
import { durationGainMultiplier, maxSlotsByTrainingCenter, resolveGroupPlayerIds } from '@/systems/trainingPlans';
import { overallFromAttributes } from '@/entities/player';
import {
  medicalDeptTreatmentSlots,
  trainingCenterAttributeGainMultiplier,
  trainingCenterMaxConcurrentCollectivePlans,
} from '@/clubStructures/benefits';
import { TREATMENT_PLAN_DURATION_H } from '@/systems/medicalTreatment';
import type { PlayerEntity } from '@/entities/types';
import type { TrainingPlan } from '@/game/types';
import { trackMissionEvent } from '@/progression/trackEvent';
import { BackButton } from '@/components/BackButton';
import { L, LOCALE, emIngles } from '@/i18n/L';
import { posLabel as rotuloPosicao } from '@/i18n/posicao';

/**
 * Fallback ESTÁVEL: `?? []` dentro de um seletor do `useGameStore`
 * (useSyncExternalStore) cria um array novo a cada leitura e joga o React num
 * laço infinito de re-render. A constante garante a mesma referência.
 */
const LISTA_VAZIA: never[] = [];


/** Os 6 cards de treino. Chaves = trainingType do reducer (válidas p/ individual e coletivo). */
type TrainingCardId = 'fisico' | 'mental' | 'tatico' | 'atributos' | 'especial' | 'descanso';
/** Quem treina: o elenco todo, um setor, ou uma seleção manual. */
type WhoMode = 'elenco' | 'setor' | 'individual';
type SectorId = 'defensivo' | 'criativo' | 'ataque';

const CARD_ORDER: TrainingCardId[] = ['fisico', 'mental', 'tatico', 'atributos', 'especial', 'descanso'];

type Gain = { t: string; down?: boolean; muted?: boolean };
type CardMeta = { label: string; grade: string; desc: string; icon: LucideIcon; gains: Gain[] };

/** Ganhos/custos batem 1:1 com applyTrainingToPlayer() em systems/trainingPlans.ts. */
const CARD_META: Record<TrainingCardId, CardMeta> = {
  fisico: {
    label: L('Físico', 'Physical'), grade: 'A', icon: Zap,
    desc: L('Resistência e velocidade', 'Stamina and pace'),
    gains: [{ t: L('+2 Físico', '+2 Physical') }, { t: L('+1 Velocidade', '+1 Pace') }, { t: L('−4 Fadiga', '−4 Fatigue') }],
  },
  mental: {
    label: 'Mental', grade: 'A', icon: Brain,
    desc: L('Confiança sob pressão', 'Confidence under pressure'),
    gains: [{ t: L('+2 Mental', '+2 Mental') }, { t: L('+2 Confiança', '+2 Confidence') }, { t: L('+6 Fadiga', '+6 Fatigue'), down: true }],
  },
  tatico: {
    label: L('Tático', 'Tactical'), grade: 'B', icon: LayoutGrid,
    desc: L('Posicionamento e marcação', 'Positioning and marking'),
    gains: [{ t: L('+2 Tático', '+2 Tactical') }, { t: L('+1 Marcação', '+1 Marking') }, { t: L('+7 Fadiga', '+7 Fatigue'), down: true }],
  },
  atributos: {
    label: L('Técnico', 'Technical'), grade: 'B', icon: Footprints,
    desc: L('Passe, drible, finalização', 'Passing, dribbling, finishing'),
    gains: [{ t: L('+1 Passe', '+1 Passing') }, { t: L('+1 Drible', '+1 Dribbling') }, { t: L('+1 Finalização', '+1 Finishing') }, { t: L('+8 Fadiga', '+8 Fatigue'), down: true }],
  },
  especial: {
    label: L('Espec. ofensiva', 'Attacking spec.'), grade: 'A', icon: Crosshair,
    desc: L('Faro de gol', 'Goal instinct'),
    gains: [{ t: L('+2 Finalização', '+2 Finishing') }, { t: L('+1 Passe', '+1 Passing') }, { t: L('+1 Drible', '+1 Dribbling') }, { t: L('+8 Fadiga', '+8 Fatigue'), down: true }],
  },
  descanso: {
    label: L('Descanso', 'Rest'), grade: 'REC', icon: BatteryCharging,
    desc: L('Recuperação', 'Recovery'),
    gains: [{ t: L('−25 Fadiga', '−25 Fatigue') }, { t: L('−8 Risco', '−8 Risk') }, { t: L('Sem XP', 'No XP'), muted: true }],
  },
};

const SECTOR_ORDER: SectorId[] = ['defensivo', 'criativo', 'ataque'];
const SECTOR_META: Record<SectorId, { title: string; sub: string }> = {
  defensivo: { title: L('Defensivo', 'Defensive'), sub: L('Goleiro + defesa', 'Goalkeeper + defence') },
  criativo: { title: L('Criativo', 'Creative'), sub: L('Meio / criação', 'Midfield / creation') },
  ataque: { title: L('Ataque', 'Attack'), sub: L('Setor ofensivo', 'Attacking unit') },
};

// --- Labels usados apenas p/ renderizar planos já em curso (inclui tipos antigos) ---
const RUNNING_TYPE_LABEL: Record<string, string> = {
  fisico: L('Físico', 'Physical'), mental: 'Mental', tatico: L('Tático', 'Tactical'),
  atributos: L('Técnico', 'Technical'), especial: L('Espec. ofensiva', 'Attacking spec.'),
  formacao: L('Formação', 'Shape'), empatia: L('Empatia', 'Empathy'), descanso: L('Descanso', 'Rest'),
};
const GROUP_LABEL: Record<string, string> = {
  defensivo: L('Bloco defensivo', 'Defensive block'), criativo: L('Meio / criação', 'Midfield / creation'), ataque: L('Ataque', 'Attack'), all: L('Plantel completo', 'Full squad'),
};

/** Fonte de número do layer final: Anton. (Era serifa itálica.) */
const NUM = 'var(--font-impact)';

function trainingTypeLabel(p: TrainingPlan): string {
  return RUNNING_TYPE_LABEL[p.trainingType] ?? p.trainingType;
}

function planDisplayName(p: TrainingPlan, rosterById: Record<string, PlayerEntity | undefined>): string {
  if (p.mode === 'coletivo') {
    return `${GROUP_LABEL[p.group] ?? p.group} · ${p.playerIds.length} ${L('jog.', 'pl.')}`;
  }
  const names = p.playerIds.map((id) => rosterById[id]?.name).filter(Boolean) as string[];
  if (names.length === 0) return '—';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]!} + ${names[1]!}`;
  return `${names[0]!}, ${names[1]!} +${names.length - 2}`;
}

function planDurationHours(p: TrainingPlan): number {
  const ms = new Date(p.endAt).getTime() - new Date(p.startedAt).getTime();
  return Math.max(1, Math.round(ms / 3_600_000));
}

/** Relógio regressivo até `endAtIso` (segundos cheios). */
function formatCountdownRemaining(msRemaining: number): string {
  const sec = Math.max(0, Math.floor(msRemaining / 1000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Cor do rail comunica a fadiga do jogador (padrão do DS). */
function fatigueRail(fatigue: number): string {
  if (fatigue >= 35) return 'var(--color-danger)';
  if (fatigue >= 20) return 'var(--color-warning)';
  return 'var(--color-neon-yellow)';
}

export function TeamTraining() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const structures = useGameStore((s) => s.structures);
  const plans = useGameStore((s) => s.manager.trainingPlans);
  const treatmentPlans = useGameStore((s) => s.manager.treatmentPlans ?? LISTA_VAZIA);

  const [trainingType, setTrainingType] = useState<TrainingCardId>('fisico');
  const [who, setWho] = useState<WhoMode>('elenco');
  const [sector, setSector] = useState<SectorId>('defensivo');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [durationHours, setDurationHours] = useState(24);

  const ctLevel = structures.training_center ?? 1;
  const medLevel = structures.medical_dept ?? 1;
  const slots = maxSlotsByTrainingCenter(ctLevel);
  const maxColl = trainingCenterMaxConcurrentCollectivePlans(ctLevel);
  const boosterPct = Math.round((trainingCenterAttributeGainMultiplier(ctLevel) - 1) * 100);
  const durMult = durationGainMultiplier(durationHours);
  const runningCollective = plans.filter((p) => p.status === 'running' && p.mode === 'coletivo').length;
  const treatSlots = medicalDeptTreatmentSlots(medLevel);
  const runningTreat = treatmentPlans.filter((p) => p.status === 'running');

  // Modo/grupo derivados da escolha "quem treina" — mantém o dispatch idêntico ao anterior.
  const mode: 'individual' | 'coletivo' = who === 'individual' ? 'individual' : 'coletivo';
  const group: 'defensivo' | 'criativo' | 'ataque' | 'all' = who === 'elenco' ? 'all' : who === 'setor' ? sector : 'all';

  // Mostra SEMPRE o elenco inteiro (não esconde ninguém). Antes filtrava por
  // outForMatches, que num save com dado de saúde desalinhado esvaziava a lista.
  // Lesão/suspensão vira só um selo informativo — nunca some da lista.
  const roster = useMemo(
    () => Object.values(players).sort((a, b) => a.num - b.num),
    [players],
  );

  /** Selo informativo de indisponibilidade (não bloqueia treino). */
  const availabilityTag = (p: PlayerEntity): string | null => {
    const h = playerHealth?.[p.id];
    const out = h ? h.outForMatches : (p.outForMatches ?? 0);
    const susp = h ? (h.suspendedMatches ?? 0) : 0;
    if (susp > 0) return L('Suspenso', 'Suspended');
    if (out > 0) return L('Lesionado', 'Injured');
    return null;
  };

  const sectorCounts = useMemo(
    () => ({
      defensivo: resolveGroupPlayerIds(players, 'defensivo').length,
      criativo: resolveGroupPlayerIds(players, 'criativo').length,
      ataque: resolveGroupPlayerIds(players, 'ataque').length,
    }),
    [players],
  );
  const elencoCount = useMemo(() => resolveGroupPlayerIds(players, 'all').length, [players]);

  const collectiveTargetIds = useMemo(() => {
    if (mode !== 'coletivo') return [];
    return resolveGroupPlayerIds(players, group);
  }, [mode, players, group]);

  const running = plans.filter((p) => p.status === 'running');
  const completedPlans = plans.filter((p) => p.status === 'completed');

  const runningPlansKey = useMemo(
    () =>
      plans
        .filter((p) => p.status === 'running')
        .map((p) => `${p.id}:${p.endAt}`)
        .sort()
        .join('|'),
    [plans],
  );

  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!runningPlansKey) return;
    setCountdownNowMs(Date.now());
    const id = window.setInterval(() => setCountdownNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runningPlansKey]);

  const canStartTraining = who === 'individual' ? selectedPlayers.length > 0 : collectiveTargetIds.length > 0;

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= slots) return prev;
      return [...prev, id];
    });
  };

  const startTraining = () => {
    if (!canStartTraining) return;
    dispatch({
      type: 'START_TEAM_TRAINING_PLAN',
      mode,
      trainingType,
      playerIds: selectedPlayers,
      group,
      durationHours,
    });
    trackMissionEvent('training_session');
    setSelectedPlayers([]);
  };

  const completeDueNow = () => dispatch({ type: 'COMPLETE_DUE_TRAININGS' });
  const startTreatment = (playerId: string) => dispatch({ type: 'START_TREATMENT_PLAN', playerId });

  const whoSummary =
    who === 'elenco'
      ? L(`Elenco completo (${elencoCount})`, `Full squad (${elencoCount})`)
      : who === 'setor'
        ? L(`Setor ${SECTOR_META[sector].title} (${sectorCounts[sector]})`, `${SECTOR_META[sector].title} unit (${sectorCounts[sector]})`)
        : selectedPlayers.length > 0
          ? L(`${selectedPlayers.length} jogador(es)`, `${selectedPlayers.length} player(s)`)
          : L('nenhum jogador ainda', 'no players yet');

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-14">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-6">
        <BackButton to="/clube" label={L('Clube', 'Club')} />

        <EditorialHero
          watermark="TREINO"
          eyebrow={L('Gestão do clube · Desenvolvimento', 'Club management · Development')}
          title={L('Treino', 'Training')}
          subtitle={L('Evolua seu time', 'Develop your team')}
          stats={L(`${running.length} planos ativos · ${completedPlans.length} concluídos · ${slots} slots disponíveis`, `${running.length} active plans · ${completedPlans.length} completed · ${slots} slots available`)}
          icon={
            <div className="group/icon relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28 transition-colors hover:border-black/80"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <div className="flex h-full w-full items-center justify-center">
                <Dumbbell className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" aria-hidden />
              </div>
            </div>
          }
        />

        {/* ---- STAT CARDS (rail 3px + número) ---- */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <RailStat label={L('Slots por sessão', 'Slots per session')} value={<>{slots}</>} />
          <RailStat label={L('Coletivos simult.', 'Team sessions')} value={<>{runningCollective}<small className="text-white/45"> /{maxColl}</small></>} />
          <RailStat label={L('Em execução', 'Running')} value={<>{running.length}</>} />
          <RailStat label="Booster AI Labs" value={<>+{boosterPct}<small className="text-white/45">%</small></>} />
        </div>

        {/* ================= STEP 1 · O QUE TREINAR ================= */}
        <StepHeader n={1} title={L('O que treinar', 'What to train')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {CARD_ORDER.map((id) => {
            const meta = CARD_META[id];
            const Icon = meta.icon;
            const sel = trainingType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTrainingType(id)}
                aria-pressed={sel}
                className={`group relative overflow-hidden rounded-md border bg-card p-4 pl-[18px] text-left transition-colors ${
                  sel
                    ? 'border-neon-yellow'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] transition-colors ${
                    sel ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'
                  }`}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-sm bg-neon-yellow/10">
                    <Icon className="h-5 w-5 text-neon-yellow" aria-hidden />
                  </span>
                  <span
                    className="leading-none text-neon-yellow"
                    style={{ fontFamily: NUM, fontSize: meta.grade.length > 1 ? '13px' : '26px' }}
                  >
                    {meta.grade}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-[16px] font-semibold uppercase tracking-[0.03em] leading-tight">{meta.label}</h3>
                <p className="mt-1 truncate text-[11.5px] leading-snug text-white/55">{meta.desc}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {meta.gains.map((g) => (
                    <span
                      key={g.t}
                      className={`rounded-md px-1.5 py-0.5 font-display text-[10.5px] uppercase tracking-[0.04em] ${
                        g.muted
                          ? 'bg-white/[0.06] text-white/45'
                          : g.down
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-neon-green/10 text-neon-green'
                      }`}
                    >
                      {g.t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* ================= STEP 2 · QUEM TREINA ================= */}
        <StepHeader n={2} title={L('Quem treina', 'Who trains')} />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <WhoButton active={who === 'elenco'} onClick={() => setWho('elenco')} title={L('Elenco', 'Squad')} desc={L('Todo o plantel disponível.', 'The whole available squad.')} />
          <WhoButton active={who === 'setor'} onClick={() => setWho('setor')} title={L('Setor', 'Unit')} desc={L('Defensivo, criativo ou ataque.', 'Defensive, creative or attack.')} />
          <WhoButton active={who === 'individual'} onClick={() => setWho('individual')} title="Individual" desc={L(`Até ${slots} jogadores na lista.`, `Up to ${slots} players on the list.`)} />
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-4 sm:p-5">
          {who === 'elenco' && (
            <div className="flex items-center gap-5">
              <div className="tabular-nums leading-none text-neon-yellow" style={{ fontFamily: NUM, fontSize: '44px' }}>
                {elencoCount}
              </div>
              <p className="text-[12.5px] leading-relaxed text-white/60">
                {emIngles() ? <><span className="text-white">Full squad</span> · smaller gain per player · 1 team slot (max {maxColl})</> : <><span className="text-white">Plantel completo</span> · ganho menor por jogador · 1 slot coletivo (máx. {maxColl})</>}
              </p>
            </div>
          )}

          {who === 'setor' && (
            <div className="space-y-3">
              <p className="text-[12px] text-white/55">{L('Escolha o bloco que treina em conjunto.', 'Choose the unit that trains together.')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SECTOR_ORDER.map((id) => {
                  const meta = SECTOR_META[id];
                  const sel = sector === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSector(id)}
                      aria-pressed={sel}
                      className={`group relative overflow-hidden rounded-md border bg-card p-3.5 pl-[18px] text-left transition-colors ${
                        sel ? 'border-neon-yellow' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-[3px] ${sel ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'}`} aria-hidden />
                      <div className="font-display text-[14px] font-semibold uppercase tracking-[0.04em]">{meta.title}</div>
                      <div className="mt-0.5 text-[11px] text-white/50">{meta.sub}</div>
                      <div className="tabular-nums mt-2 leading-none text-neon-yellow" style={{ fontFamily: NUM, fontSize: '24px' }}>
                        {sectorCounts[id]}
                        <span className="ml-1 align-baseline text-[11px] text-white/50" style={{ fontFamily: 'var(--font-sans)' }}>{L('jogadores', 'players')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {who === 'individual' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-white/55">{L(`Selecione até ${slots} — a cor do rail é a fadiga.`, `Select up to ${slots} — the rail colour shows fatigue.`)}</p>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <span className="font-semibold tabular-nums text-white">{selectedPlayers.length}/{slots}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayers([])}
                    disabled={selectedPlayers.length === 0}
                    className="rounded border border-white/15 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    {L('Limpar', 'Clear')}
                  </button>
                </div>
              </div>
              {roster.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[13px] text-white/60">
                  {L('Nenhum jogador no elenco ainda.', 'No players in the squad yet.')}
                </div>
              ) : (
              <div className="flex max-h-[min(20rem,42dvh)] flex-col gap-2 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
                {roster.map((p) => {
                  const active = selectedPlayers.includes(p.id);
                  const disabled = !active && selectedPlayers.length >= slots;
                  const ovr = overallFromAttributes(p.attrs, p.pos);
                  const fatigue = playerHealth?.[p.id]?.fatigue ?? p.fatigue;
                  const rail = fatigueRail(fatigue);
                  const tag = availabilityTag(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlayer(p.id)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={`group relative flex min-h-[64px] shrink-0 items-stretch overflow-hidden rounded-md border bg-card text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active ? 'border-neon-yellow' : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <span className="absolute inset-y-0 left-0 z-10 w-[3px]" style={{ background: active ? 'var(--color-neon-yellow)' : rail }} aria-hidden />
                      <div className="relative flex w-[86px] shrink-0 flex-col justify-center overflow-hidden bg-black/60 py-3 pl-4">
                        <span className="tabular-nums leading-none" style={{ fontFamily: NUM, fontSize: '32px', color: rail }}>{ovr}</span>
                        <span className="mt-1 font-display text-[10px] uppercase tracking-[0.1em] text-white/45">{rotuloPosicao(p.pos)}</span>
                      </div>
                      <div className="flex flex-1 items-center px-4">
                        <div className="min-w-0">
                          <div className="truncate font-display text-[15px] font-bold uppercase tracking-[0.02em]">
                            <span className="text-white/45">{p.num}</span> {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="font-display text-[10.5px] uppercase tracking-[0.1em] text-white/45">{Math.round(fatigue)}% {L('cansaço', 'fatigue')}</span>
                            {tag && <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wide text-red-300">{tag}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center pr-4">
                        <span className={`grid h-[22px] w-[22px] place-items-center rounded-sm border ${active ? 'border-neon-yellow bg-neon-yellow' : 'border-white/20'}`}>
                          {active && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ================= AÇÃO ================= */}
        <div className="sports-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <div className="flex-1 text-[13px] leading-relaxed text-white/60">
            {L('Treino', 'Training')} <span className="text-white">{CARD_META[trainingType].label}</span>
            {' · '}{L('em', 'for')}{' '}
            <span className={who === 'individual' && selectedPlayers.length === 0 ? 'text-[color:var(--color-warning)]' : 'text-white'}>{whoSummary}</span>
            {' · '}{L('por', 'over')} <span className="text-white">{durationHours}h</span>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-[190px]">
            <label htmlFor="dur" className="font-display text-[10px] uppercase tracking-[0.16em] text-white/50">{L('Duração de execução', 'Duration')}</label>
            <input id="dur" type="range" min={6} max={72} step={6} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full accent-neon-yellow" />
            <div className="font-display text-[11px] uppercase tracking-wide text-neon-yellow tabular-nums">
              {durationHours}h · {trainingType === 'descanso' ? L('recuperação', 'recovery') : L(`ganho ×${durMult.toFixed(2)}`, `gain ×${durMult.toFixed(2)}`)} · {L('booster CT', 'TC booster')} +{boosterPct}%
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startTraining}
              disabled={!canStartTraining}
              className="rounded-md bg-neon-yellow px-6 py-3.5 font-display text-[14px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              {L('Iniciar treino', 'Start training')}
            </button>
            <button
              type="button"
              onClick={completeDueNow}
              className="rounded-md border border-white/20 bg-white/[0.06] px-4 py-3.5 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 transition-colors hover:bg-white/10"
            >
              {L('Concluir', 'Complete')}
            </button>
          </div>
        </div>

        {/* ================= EM ANDAMENTO ================= */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel overflow-visible p-3 pb-4 sm:p-4 sm:pb-5">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
            <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.05em] text-white/90">{L('Em andamento', 'In progress')}</h3>
            {completedPlans.length > 0 && (
              <span className="text-[10px] text-gray-500">{L(`${completedPlans.length} no histórico recente`, `${completedPlans.length} in recent history`)}</span>
            )}
          </div>
          {running.length === 0 ? (
            <p className="text-[11px] text-gray-500">{L('Nenhum treino em curso.', 'No training in progress.')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {running.map((p) => {
                const dh = planDurationHours(p);
                const remainingMs = new Date(p.endAt).getTime() - countdownNowMs;
                const endShort = new Date(p.endAt).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const done = remainingMs <= 0;
                return (
                  <div key={p.id} className="relative flex items-center gap-3 overflow-hidden ole-poster py-3 pl-[18px] pr-3">
                    <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: done ? 'var(--color-neon-green)' : 'var(--color-neon-yellow)' }} aria-hidden />
                    <span className="shrink-0 rounded-md bg-neon-yellow/12 px-2 py-1 font-display text-[10.5px] uppercase tracking-[0.04em] text-neon-yellow">
                      {trainingTypeLabel(p)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-white">{planDisplayName(p, players)}</div>
                      <div className="text-[10.5px] text-white/45">{dh}h · {L('até', 'until')} {endShort}</div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 ${done ? 'text-neon-green' : 'text-white'}`}
                      style={{ fontFamily: NUM, fontSize: '17px' }}
                      title={done ? L('Prazo atingido — usa «Concluir» para aplicar', 'Time is up — use “Complete” to apply') : L(`Termina a ${endShort}`, `Ends ${endShort}`)}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      {formatCountdownRemaining(done ? 0 : remainingMs)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ================= DEPARTAMENTO MÉDICO ================= */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel space-y-2 p-3 pb-4 sm:p-4 sm:pb-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.05em] text-white/90">{L('Departamento médico', 'Medical department')}</h3>
            <span className="text-[10px] text-gray-500 tabular-nums">{runningTreat.length}/{treatSlots} slots · ~{TREATMENT_PLAN_DURATION_H}h</span>
          </div>
          <p className="text-[10px] text-gray-500">{L(`Clica num jogador disponível para ocupar um slot médico (nível ${medLevel}).`, `Tap an available player to fill a medical slot (level ${medLevel}).`)}</p>
          <div className="max-h-[min(12rem,32svh)] overflow-y-auto overscroll-y-contain rounded border border-white/10 bg-black/25 [scrollbar-gutter:stable]">
            <ul className="divide-y divide-white/10">
              {roster.map((p) => {
                const busy = runningTreat.some((t) => t.playerId === p.id);
                const full = runningTreat.length >= treatSlots;
                return (
                  <li key={`treat-${p.id}`}>
                    <button
                      type="button"
                      onClick={() => !busy && !full && startTreatment(p.id)}
                      disabled={busy || full}
                      className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors disabled:cursor-not-allowed ${
                        busy ? 'bg-neon-green/5' : full ? 'opacity-40' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="font-medium text-white"><span className="font-mono text-gray-400">{p.num}</span> · {p.name}</span>
                      <span className="shrink-0 font-display text-[10px] uppercase tracking-wide text-gray-500">
                        {busy ? L('Em tratamento', 'In treatment') : full ? L('Slots cheios', 'Slots full') : L('Iniciar', 'Start')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {treatmentPlans.length > 0 && (
            <div className="space-y-0.5 border-t border-white/10 pt-2">
              {treatmentPlans.map((t) => (
                <div key={t.id} className="flex justify-between gap-2 text-[10px] text-gray-400">
                  <span className="text-white/90">{players[t.playerId]?.name ?? t.playerId}</span>
                  <span className="shrink-0 tabular-nums">{t.status} · {L('fim', 'ends')} {new Date(t.endAt).toLocaleString(LOCALE)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="h-[max(1.5rem,3dvh)] shrink-0 sm:h-8 md:h-10" aria-hidden />
      </div>
    </div>
  );
}

/* ---------------- Subcomponentes locais ---------------- */


function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3.5 pt-1">
      <div className="tabular-nums leading-none text-neon-yellow" style={{ fontFamily: NUM, fontSize: '34px' }}>{n}</div>
      <h2 className="ole-eyebrow-poster" style={{ fontSize: '15px' }}>{title}</h2>
    </div>
  );
}

function WhoButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-md border bg-card p-4 pl-[18px] text-left transition-colors ${
        active ? 'border-neon-yellow' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${active ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'}`} aria-hidden />
      <div className={`font-display text-[15px] font-semibold uppercase tracking-[0.05em] ${active ? 'text-neon-yellow' : 'text-white'}`}>{title}</div>
      <div className="mt-1 text-[11.5px] text-white/50">{desc}</div>
    </button>
  );
}
