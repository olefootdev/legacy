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
    label: 'Físico', grade: 'A', icon: Zap,
    desc: 'Resistência e velocidade. Alivia a fadiga.',
    gains: [{ t: '+2 Físico' }, { t: '+1 Velocidade' }, { t: '−4 Fadiga' }],
  },
  mental: {
    label: 'Mental', grade: 'A', icon: Brain,
    desc: 'Mentalidade e confiança sob pressão.',
    gains: [{ t: '+2 Mental' }, { t: '+2 Confiança' }, { t: '+6 Fadiga', down: true }],
  },
  tatico: {
    label: 'Tático', grade: 'B', icon: LayoutGrid,
    desc: 'Posicionamento e marcação por função.',
    gains: [{ t: '+2 Tático' }, { t: '+1 Marcação' }, { t: '+7 Fadiga', down: true }],
  },
  atributos: {
    label: 'Técnico', grade: 'B', icon: Footprints,
    desc: 'Passe, drible e finalização — a base.',
    gains: [{ t: '+1 Passe' }, { t: '+1 Drible' }, { t: '+1 Finalização' }, { t: '+8 Fadiga', down: true }],
  },
  especial: {
    label: 'Espec. ofensiva', grade: 'A', icon: Crosshair,
    desc: 'Faro de gol: finalização acima de tudo.',
    gains: [{ t: '+2 Finalização' }, { t: '+1 Passe' }, { t: '+1 Drible' }, { t: '+8 Fadiga', down: true }],
  },
  descanso: {
    label: 'Descanso', grade: 'REC', icon: BatteryCharging,
    desc: 'Recupera fadiga e reduz risco de lesão. Sem evolução.',
    gains: [{ t: '−25 Fadiga' }, { t: '−8 Risco' }, { t: 'Sem XP', muted: true }],
  },
};

const SECTOR_ORDER: SectorId[] = ['defensivo', 'criativo', 'ataque'];
const SECTOR_META: Record<SectorId, { title: string; sub: string }> = {
  defensivo: { title: 'Defensivo', sub: 'Goleiro + defesa' },
  criativo: { title: 'Criativo', sub: 'Meio / criação' },
  ataque: { title: 'Ataque', sub: 'Setor ofensivo' },
};

// --- Labels usados apenas p/ renderizar planos já em curso (inclui tipos antigos) ---
const RUNNING_TYPE_LABEL: Record<string, string> = {
  fisico: 'Físico', mental: 'Mental', tatico: 'Tático',
  atributos: 'Técnico', especial: 'Espec. ofensiva',
  formacao: 'Formação', empatia: 'Empatia', descanso: 'Descanso',
};
const GROUP_LABEL: Record<string, string> = {
  defensivo: 'Bloco defensivo', criativo: 'Meio / criação', ataque: 'Ataque', all: 'Plantel completo',
};

const SERIF = 'var(--font-serif-hero)';

function trainingTypeLabel(p: TrainingPlan): string {
  return RUNNING_TYPE_LABEL[p.trainingType] ?? p.trainingType;
}

function planDisplayName(p: TrainingPlan, rosterById: Record<string, PlayerEntity | undefined>): string {
  if (p.mode === 'coletivo') {
    return `${GROUP_LABEL[p.group] ?? p.group} · ${p.playerIds.length} jog.`;
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
  const treatmentPlans = useGameStore((s) => s.manager.treatmentPlans ?? []);

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
    if (susp > 0) return 'Suspenso';
    if (out > 0) return 'Lesionado';
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
      ? `Elenco completo (${elencoCount})`
      : who === 'setor'
        ? `Setor ${SECTOR_META[sector].title} (${sectorCounts[sector]})`
        : selectedPlayers.length > 0
          ? `${selectedPlayers.length} jogador(es)`
          : 'nenhum jogador ainda';

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-14">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-6">
        <BackButton to="/clube" label="Clube" />

        <EditorialHero
          watermark="TREINO"
          eyebrow="Gestão do clube · Desenvolvimento"
          title="Treino"
          subtitle="Evolua seu time"
          stats={`${running.length} planos ativos · ${completedPlans.length} concluídos · ${slots} slots disponíveis`}
          icon={
            <div className="group/icon relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28 transition-all hover:border-black/80 hover:shadow-[0_0_24px_rgba(0,0,0,0.4)]"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <div className="flex h-full w-full items-center justify-center">
                <Dumbbell className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" aria-hidden />
              </div>
            </div>
          }
        />

        {/* ---- STAT CARDS (rail 3px + número serifa) ---- */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <RailStat label="Slots por sessão" value={<>{slots}</>} />
          <RailStat label="Coletivos simult." value={<>{runningCollective}<small className="text-white/45"> /{maxColl}</small></>} />
          <RailStat label="Em execução" value={<>{running.length}</>} />
          <RailStat label="Booster AI Labs" value={<>+{boosterPct}<small className="text-white/45">%</small></>} />
        </div>

        {/* ================= STEP 1 · O QUE TREINAR ================= */}
        <StepHeader n={1} title="O que treinar" />
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
                className={`group relative overflow-hidden rounded-[var(--radius-md)] border bg-[#1c1c1c] p-4 pl-[18px] text-left transition-all ${
                  sel
                    ? '-translate-y-0.5 border-neon-yellow shadow-[0_12px_34px_-18px_rgba(253,225,0,0.6)]'
                    : 'border-white/10 hover:-translate-y-0.5 hover:border-white/20'
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] transition-colors ${
                    sel ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'
                  }`}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-neon-yellow/10">
                    <Icon className="h-5 w-5 text-neon-yellow" aria-hidden />
                  </span>
                  <span
                    className="italic leading-none text-neon-yellow"
                    style={{ fontFamily: SERIF, fontWeight: 700, fontSize: meta.grade.length > 1 ? '13px' : '26px' }}
                  >
                    {meta.grade}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-[16px] font-semibold uppercase tracking-[0.03em] leading-tight">{meta.label}</h3>
                <p className="mt-1 min-h-[34px] text-[11.5px] leading-snug text-white/55">{meta.desc}</p>
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
        <StepHeader n={2} title="Quem treina" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <WhoButton active={who === 'elenco'} onClick={() => setWho('elenco')} title="Elenco" desc="Todo o plantel disponível." />
          <WhoButton active={who === 'setor'} onClick={() => setWho('setor')} title="Setor" desc="Defensivo, criativo ou ataque." />
          <WhoButton active={who === 'individual'} onClick={() => setWho('individual')} title="Individual" desc={`Até ${slots} jogadores na lista.`} />
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-4 sm:p-5">
          {who === 'elenco' && (
            <div className="flex items-center gap-5">
              <div className="italic leading-none text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '44px' }}>
                {elencoCount}
              </div>
              <p className="text-[12.5px] leading-relaxed text-white/60">
                <span className="text-white">Plantel completo</span> na sessão coletiva. Ganho menor por jogador, mas todos evoluem juntos — conta como 1 slot coletivo (máx. {maxColl} em simultâneo).
              </p>
            </div>
          )}

          {who === 'setor' && (
            <div className="space-y-3">
              <p className="text-[12px] text-white/55">Escolha o bloco que treina em conjunto.</p>
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
                      className={`group relative overflow-hidden rounded-[var(--radius-md)] border bg-[#1c1c1c] p-3.5 pl-[18px] text-left transition-all ${
                        sel ? '-translate-y-0.5 border-neon-yellow' : 'border-white/10 hover:-translate-y-0.5 hover:border-white/20'
                      }`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-[3px] ${sel ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'}`} aria-hidden />
                      <div className="font-display text-[14px] font-semibold uppercase tracking-[0.04em]">{meta.title}</div>
                      <div className="mt-0.5 text-[11px] text-white/50">{meta.sub}</div>
                      <div className="mt-2 italic leading-none text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '24px' }}>
                        {sectorCounts[id]}
                        <span className="ml-1 align-baseline text-[11px] not-italic text-white/50" style={{ fontFamily: 'var(--font-sans)' }}>jogadores</span>
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
                <p className="text-[12px] text-white/55">Selecione até {slots} — a cor do rail é a fadiga.</p>
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <span className="font-semibold tabular-nums text-white">{selectedPlayers.length}/{slots}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayers([])}
                    disabled={selectedPlayers.length === 0}
                    className="rounded border border-white/15 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              {roster.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[13px] text-white/60">
                  Nenhum jogador no elenco ainda.
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
                      className={`group relative flex min-h-[64px] shrink-0 items-stretch overflow-hidden rounded-[var(--radius-md)] border bg-[#1c1c1c] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active ? 'border-neon-yellow' : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <span className="absolute inset-y-0 left-0 z-10 w-[3px]" style={{ background: active ? 'var(--color-neon-yellow)' : rail }} aria-hidden />
                      <div className="relative flex w-[86px] shrink-0 flex-col justify-center overflow-hidden bg-black/60 py-3 pl-4">
                        <span className="pointer-events-none absolute -bottom-3 -right-1 italic leading-none text-white/[0.05]" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '72px' }} aria-hidden>
                          {p.name.charAt(0)}
                        </span>
                        <span className="italic leading-none" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '32px', color: rail }}>{ovr}</span>
                        <span className="mt-1 font-display text-[10px] uppercase tracking-[0.1em] text-white/45">{p.pos}</span>
                      </div>
                      <div className="flex flex-1 items-center px-4">
                        <div className="min-w-0">
                          <div className="truncate font-display text-[15px] font-bold uppercase tracking-[0.02em]">
                            <span className="text-white/45">{p.num}</span> {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="font-display text-[10.5px] uppercase tracking-[0.1em] text-white/45">{Math.round(fatigue)}% cansaço</span>
                            {tag && <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wide text-red-300">{tag}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center pr-4">
                        <span className={`grid h-[22px] w-[22px] place-items-center rounded-[7px] border ${active ? 'border-neon-yellow bg-neon-yellow' : 'border-white/20'}`}>
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
            Treino <span className="text-white">{CARD_META[trainingType].label}</span>
            {' · '}em{' '}
            <span className={who === 'individual' && selectedPlayers.length === 0 ? 'text-[color:var(--color-warning)]' : 'text-white'}>{whoSummary}</span>
            {' · '}por <span className="text-white">{durationHours}h</span>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-[190px]">
            <label htmlFor="dur" className="font-display text-[10px] uppercase tracking-[0.16em] text-white/50">Duração de execução</label>
            <input id="dur" type="range" min={6} max={72} step={6} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full accent-neon-yellow" />
            <div className="font-display text-[11px] uppercase tracking-wide text-neon-yellow tabular-nums">
              {durationHours}h · {trainingType === 'descanso' ? 'recuperação' : `ganho ×${durMult.toFixed(2)}`} · booster CT +{boosterPct}%
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startTraining}
              disabled={!canStartTraining}
              className="rounded-[var(--radius-md)] bg-neon-yellow px-6 py-3.5 font-display text-[14px] font-bold uppercase tracking-[0.08em] text-black shadow-[0_0_24px_-6px_rgba(253,225,0,0.6)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
            >
              Iniciar treino
            </button>
            <button
              type="button"
              onClick={completeDueNow}
              className="rounded-[var(--radius-md)] border border-white/20 bg-white/[0.06] px-4 py-3.5 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-white/80 transition-colors hover:bg-white/10"
            >
              Concluir
            </button>
          </div>
        </div>

        {/* ================= EM ANDAMENTO ================= */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel overflow-visible p-3 pb-4 sm:p-4 sm:pb-5">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
            <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.05em] text-white/90">Em andamento</h3>
            {completedPlans.length > 0 && (
              <span className="text-[10px] text-gray-500">{completedPlans.length} no histórico recente</span>
            )}
          </div>
          {running.length === 0 ? (
            <p className="text-[11px] text-gray-500">Nenhum treino em curso.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {running.map((p) => {
                const dh = planDurationHours(p);
                const remainingMs = new Date(p.endAt).getTime() - countdownNowMs;
                const endShort = new Date(p.endAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const done = remainingMs <= 0;
                return (
                  <div key={p.id} className="relative flex items-center gap-3 overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#1c1c1c] py-3 pl-[18px] pr-3">
                    <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: done ? 'var(--color-neon-green)' : 'var(--color-neon-yellow)' }} aria-hidden />
                    <span className="shrink-0 rounded-md bg-neon-yellow/12 px-2 py-1 font-display text-[10.5px] uppercase tracking-[0.04em] text-neon-yellow">
                      {trainingTypeLabel(p)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-white">{planDisplayName(p, players)}</div>
                      <div className="text-[10.5px] text-white/45">{dh}h · até {endShort}</div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 italic ${done ? 'text-neon-green' : 'text-white'}`}
                      style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '17px' }}
                      title={done ? 'Prazo atingido — usa «Concluir» para aplicar' : `Termina a ${endShort}`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-80 not-italic" aria-hidden />
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
            <h3 className="font-display text-[15px] font-bold uppercase tracking-[0.05em] text-white/90">Departamento médico</h3>
            <span className="text-[10px] text-gray-500 tabular-nums">{runningTreat.length}/{treatSlots} slots · ~{TREATMENT_PLAN_DURATION_H}h</span>
          </div>
          <p className="text-[10px] text-gray-500">Clica num jogador disponível para ocupar um slot médico (nível {medLevel}).</p>
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
                        {busy ? 'Em tratamento' : full ? 'Slots cheios' : 'Iniciar'}
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
                  <span className="shrink-0 tabular-nums">{t.status} · fim {new Date(t.endAt).toLocaleString('pt-BR')}</span>
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
      <div className="italic leading-none text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '34px' }}>{n}</div>
      <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.05em] leading-none">{title}</h2>
    </div>
  );
}

function WhoButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-[var(--radius-md)] border bg-[#1c1c1c] p-4 pl-[18px] text-left transition-colors ${
        active ? 'border-neon-yellow' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${active ? 'bg-neon-yellow' : 'bg-white/15 group-hover:bg-neon-yellow/60'}`} aria-hidden />
      <div className={`font-display text-[15px] font-semibold uppercase tracking-[0.05em] ${active ? 'text-neon-yellow' : 'text-white'}`}>{title}</div>
      <div className="mt-1 text-[11.5px] text-white/50">{desc}</div>
    </button>
  );
}
