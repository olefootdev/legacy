import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Brain,
  Check,
  Clock,
  Crosshair,
  Dumbbell,
  Footprints,
  Flame,
  Heart,
  Layers,
  LayoutGrid,
  Lightbulb,
  Shield,
  User,
  Users,
  UsersRound,
} from 'lucide-react';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useGameDispatch, useGameStore } from '@/game/store';
import { maxSlotsByTrainingCenter, resolveGroupPlayerIds } from '@/systems/trainingPlans';
import { overallFromAttributes } from '@/entities/player';
import {
  medicalDeptTreatmentSlots,
  trainingCenterAttributeGainMultiplier,
  trainingCenterHasAiLabs,
  trainingCenterMaxConcurrentCollectivePlans,
} from '@/clubStructures/benefits';
import { TREATMENT_PLAN_DURATION_H } from '@/systems/medicalTreatment';
import type { PlayerEntity } from '@/entities/types';
import type { TrainingPlan } from '@/game/types';
import { trackMissionEvent } from '@/progression/trackEvent';

type IndividualType = 'fisico' | 'mental' | 'tatico' | 'atributos' | 'especial';
type CollectiveType = 'formacao' | 'empatia' | 'fisico';
type GroupType = 'defensivo' | 'criativo' | 'ataque' | 'all';

const INDIVIDUAL: IndividualType[] = ['fisico', 'mental', 'tatico', 'atributos', 'especial'];
const COLLECTIVE: CollectiveType[] = ['formacao', 'empatia', 'fisico'];
const GROUPS: GroupType[] = ['defensivo', 'criativo', 'ataque', 'all'];

const INDIVIDUAL_LABEL: Record<IndividualType, string> = {
  fisico: 'Físico',
  mental: 'Mental',
  tatico: 'Tático',
  atributos: 'Técnico (passe/drible/remate)',
  especial: 'Especialização ofensiva',
};
const COLLECTIVE_LABEL: Record<CollectiveType, string> = {
  formacao: 'Formação / posicionamento',
  empatia: 'Empatia / fair play',
  fisico: 'Físico colectivo',
};
const GROUP_LABEL: Record<GroupType, string> = {
  defensivo: 'Bloco defensivo',
  criativo: 'Meio / criação',
  ataque: 'Ataque',
  all: 'Plantel completo',
};

const INDIVIDUAL_ICONS: Record<IndividualType, LucideIcon> = {
  fisico: Activity,
  mental: Brain,
  tatico: LayoutGrid,
  atributos: Footprints,
  especial: Flame,
};

const COLLECTIVE_ICONS: Record<CollectiveType, LucideIcon> = {
  formacao: Layers,
  empatia: Heart,
  fisico: Dumbbell,
};

const GROUP_ICONS: Record<GroupType, LucideIcon> = {
  defensivo: Shield,
  criativo: Lightbulb,
  ataque: Crosshair,
  all: Users,
};

function trainingTypeLabel(p: TrainingPlan): string {
  return p.mode === 'individual'
    ? INDIVIDUAL_LABEL[p.trainingType as IndividualType] ?? p.trainingType
    : COLLECTIVE_LABEL[p.trainingType as CollectiveType] ?? p.trainingType;
}

function planDisplayName(p: TrainingPlan, rosterById: Record<string, PlayerEntity | undefined>): string {
  if (p.mode === 'coletivo') {
    return `${GROUP_LABEL[p.group]} · ${p.playerIds.length} jog.`;
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

export function TeamTraining() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const structures = useGameStore((s) => s.structures);
  const plans = useGameStore((s) => s.manager.trainingPlans);
  const treatmentPlans = useGameStore((s) => s.manager.treatmentPlans ?? []);
  const [mode, setMode] = useState<'individual' | 'coletivo'>('individual');
  const [individualType, setIndividualType] = useState<IndividualType>('fisico');
  const [collectiveType, setCollectiveType] = useState<CollectiveType>('formacao');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [group, setGroup] = useState<GroupType>('all');
  const [durationHours, setDurationHours] = useState(24);

  const ctLevel = structures.training_center ?? 1;
  const medLevel = structures.medical_dept ?? 1;
  const slots = maxSlotsByTrainingCenter(ctLevel);
  const maxColl = trainingCenterMaxConcurrentCollectivePlans(ctLevel);
  const runningCollective = plans.filter((p) => p.status === 'running' && p.mode === 'coletivo').length;
  const treatSlots = medicalDeptTreatmentSlots(medLevel);
  const runningTreat = treatmentPlans.filter((p) => p.status === 'running');

  const roster = useMemo(
    () => Object.values(players).filter((p) => p.outForMatches <= 0).sort((a, b) => a.num - b.num),
    [players],
  );

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

  const canStartTraining =
    mode === 'coletivo' ? collectiveTargetIds.length > 0 : selectedPlayers.length > 0;

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= slots) return prev;
      return [...prev, id];
    });
  };

  const startTraining = () => {
    dispatch({
      type: 'START_TEAM_TRAINING_PLAN',
      mode,
      trainingType: mode === 'individual' ? individualType : collectiveType,
      playerIds: selectedPlayers,
      group,
      durationHours,
    });
    trackMissionEvent('training_session');
    setSelectedPlayers([]);
  };

  const completeDueNow = () => {
    dispatch({ type: 'COMPLETE_DUE_TRAININGS' });
  };

  const startTreatment = (playerId: string) => {
    dispatch({ type: 'START_TREATMENT_PLAN', playerId });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-3 pb-14 text-[13px] leading-snug sm:space-y-4 sm:pb-12 md:pb-14">
      <TeamMeuTimeHeader
        title="Treino"
        subtitle="Seleciona o tipo, escolhe jogadores ou grupo e inicia o plano de treino com execução por período."
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel space-y-3 p-3 pb-4 sm:p-4 sm:pb-5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('individual')}
            className={
              mode === 'individual'
                ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-3 py-1.5 text-[11px] font-semibold uppercase text-black'
                : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase text-gray-200'
            }
          >
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Individual
          </button>
          <button
            type="button"
            onClick={() => setMode('coletivo')}
            className={
              mode === 'coletivo'
                ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-3 py-1.5 text-[11px] font-semibold uppercase text-black'
                : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase text-gray-200'
            }
          >
            <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Coletivo
          </button>
        </div>

        {mode === 'individual' ? (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Tipo de treino (Individual)</div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {INDIVIDUAL.map((t) => {
                const Ic = INDIVIDUAL_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIndividualType(t)}
                    className={
                      individualType === t
                        ? 'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded bg-neon-yellow px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-black'
                        : 'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-gray-200'
                    }
                  >
                    <Ic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="leading-tight">{INDIVIDUAL_LABEL[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Tipo de treino (Coletivo)</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {COLLECTIVE.map((t) => {
                const Ic = COLLECTIVE_ICONS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCollectiveType(t)}
                    className={
                      collectiveType === t
                        ? 'inline-flex items-center justify-center gap-1.5 rounded bg-neon-yellow py-1.5 text-[11px] font-semibold uppercase text-black'
                        : 'inline-flex items-center justify-center gap-1.5 rounded border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold uppercase text-gray-200'
                    }
                  >
                    <Ic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {COLLECTIVE_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Grupo</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {GROUPS.map((g) => {
                const Ic = GROUP_ICONS[g];
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    className={
                      group === g
                        ? 'inline-flex items-center justify-center gap-1.5 rounded bg-neon-yellow py-1.5 text-[11px] font-semibold uppercase text-black'
                        : 'inline-flex items-center justify-center gap-1.5 rounded border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold uppercase text-gray-200'
                    }
                  >
                    <Ic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {GROUP_LABEL[g]}
                  </button>
                );
              })}
            </div>
            <p className="pt-0.5 text-[10px] text-gray-500">
              Coletivo aplica a todos do grupo acima (não usa a lista manual). Limite de planos colectivos em simultâneo: {maxColl}.
            </p>
          </div>
        )}

        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Período de execução</div>
          <input type="range" min={6} max={72} step={6} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full accent-neon-yellow" />
          <div className="text-[11px] text-gray-500 tabular-nums">{durationHours}h</div>
        </div>

        <p className="text-[10px] leading-relaxed text-gray-500">
          Booster (CT ≥4):{' '}
          <span className="font-medium text-neon-yellow tabular-nums">
            +{Math.round((trainingCenterAttributeGainMultiplier(ctLevel) - 1) * 100)}%
          </span>
          {' · '}
          AI Labs:{' '}
          <span className="font-medium text-gray-400">
            {trainingCenterHasAiLabs(ctLevel) ? '/team/ailabs' : 'CT nível 2+'}
          </span>
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-3 pb-4 sm:p-4 sm:pb-5">
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">Selecionar jogadores</h3>
            <p className="mt-0.5 text-[10px] text-gray-500">
              {mode === 'individual'
                ? `Lista do plantel disponível — até ${slots} por treino individual (limite por tipo de sessão no CT).`
                : `Alvo do treino coletivo: ${collectiveTargetIds.length} jogador(es) no grupo «${GROUP_LABEL[group]}».`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500">
            {mode === 'individual' && (
              <>
                <span className="font-semibold text-white tabular-nums">{selectedPlayers.length}/{slots}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPlayers([])}
                  disabled={selectedPlayers.length === 0}
                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  Limpar
                </button>
              </>
            )}
          </div>
        </div>
        <div
          className={`max-h-[min(16rem,min(34dvh,38svh))] overflow-y-auto overscroll-y-contain rounded border border-white/10 bg-black/25 [scrollbar-gutter:stable] ${mode === 'coletivo' ? 'opacity-60' : ''}`}
        >
          <ul className="divide-y divide-white/10">
            {roster.map((p) => {
              const active = selectedPlayers.includes(p.id);
              const disabled = !active && selectedPlayers.length >= slots;
              const ovr = overallFromAttributes(p.attrs);
              const inCollective = mode === 'coletivo' && collectiveTargetIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    disabled={disabled || mode === 'coletivo'}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${
                      active ? 'bg-neon-yellow/10' : ''
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-neon-yellow ${
                        mode === 'coletivo'
                          ? inCollective
                            ? 'border-neon-yellow/50 bg-neon-yellow/15'
                            : 'border-white/10 bg-black/40'
                          : active
                            ? 'border-neon-yellow bg-neon-yellow/20'
                            : 'border-white/15 bg-black/40'
                      }`}
                    >
                      {mode === 'coletivo' ? (
                        inCollective ? <Check className="h-3 w-3" strokeWidth={3} /> : null
                      ) : active ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px] font-medium text-gray-400 tabular-nums">{p.num}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">{p.name}</span>
                      <span className="shrink-0 text-[10px] font-medium text-gray-500">{p.pos}</span>
                      <span className="shrink-0 text-[10px] text-gray-500 tabular-nums sm:ml-auto">
                        OVR {ovr} · FAT {Math.round(p.fatigue)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTraining}
          disabled={!canStartTraining}
          className="rounded bg-neon-yellow px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Iniciar treino
        </button>
        <button type="button" onClick={completeDueNow} className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Concluir treinos / tratamentos vencidos
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel space-y-2 p-3 pb-4 sm:p-4 sm:pb-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">Tratamentos médicos</h3>
          <span className="text-[10px] text-gray-500 tabular-nums">{runningTreat.length}/{treatSlots} slots · ~{TREATMENT_PLAN_DURATION_H}h</span>
        </div>
        <p className="text-[10px] text-gray-500">
          Clica num jogador disponível para ocupar um slot do departamento médico (nível {medLevel}).
        </p>
        <div className="max-h-[min(12rem,min(28dvh,32svh))] overflow-y-auto overscroll-y-contain rounded border border-white/10 bg-black/25 [scrollbar-gutter:stable]">
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
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-white/5 disabled:cursor-not-allowed ${
                      busy ? 'bg-neon-green/5' : full ? 'opacity-40' : 'hover:bg-red-500/5'
                    }`}
                  >
                    <span className="font-medium text-white">
                      <span className="font-mono text-gray-400">{p.num}</span> · {p.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase text-gray-500">
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel overflow-visible p-3 pb-4 sm:p-4 sm:pb-5"
      >
        <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">Em treinamento</h3>
          {completedPlans.length > 0 && (
            <span className="text-[10px] text-gray-500">{completedPlans.length} no histórico recente</span>
          )}
        </div>
        {running.length === 0 ? (
          <p className="text-[11px] text-gray-500">Nenhum treino em curso.</p>
        ) : (
          <div
            className={`overflow-x-auto rounded border border-white/10 ${running.length > 4 ? 'max-h-[min(14rem,min(36dvh,42svh))] overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]' : ''}`}
          >
            <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 bg-black/30 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-1.5 font-medium">Nome</th>
                  <th className="px-2 py-1.5 font-medium">Tipo de treino</th>
                  <th className="px-2 py-1.5 font-medium whitespace-nowrap">Tempo de execução</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {running.map((p) => {
                  const dh = planDurationHours(p);
                  const endMs = new Date(p.endAt).getTime();
                  const remainingMs = endMs - countdownNowMs;
                  const endShort = new Date(p.endAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const done = remainingMs <= 0;
                  return (
                    <tr key={p.id} className="bg-black/20 text-gray-200">
                      <td className="max-w-[10rem] truncate px-2 py-1.5 font-medium text-white sm:max-w-none">
                        {planDisplayName(p, players)}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300">{trainingTypeLabel(p)}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                              done ? 'text-neon-green' : 'text-neon-yellow'
                            }`}
                            title={done ? 'Prazo atingido — usa «Concluir treinos…» para aplicar' : `Termina a ${endShort}`}
                          >
                            <Clock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            {formatCountdownRemaining(done ? 0 : remainingMs)}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-gray-500">
                            ({dh}h · até {endShort})
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 border-t border-white/10 pt-3 pb-3 sm:pb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-stretch">
            <div className="flex min-h-0 min-w-0 flex-col rounded border border-white/10 bg-black/40 p-2 text-[10px] leading-tight sm:text-[11px]">
              <div className="break-words font-medium uppercase tracking-wide text-gray-500">Nível centro treino</div>
              <div className="mt-1 text-sm font-semibold text-white tabular-nums sm:text-base">{structures.training_center ?? 1}</div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-col rounded border border-white/10 bg-black/40 p-2 text-[10px] leading-tight sm:text-[11px]">
              <div className="break-words font-medium uppercase tracking-wide text-gray-500">Slots por treino</div>
              <div className="mt-1 text-sm font-semibold text-neon-yellow tabular-nums sm:text-base">{slots}</div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-col rounded border border-white/10 bg-black/40 p-2 text-[10px] leading-tight sm:text-[11px]">
              <div className="break-words font-medium uppercase tracking-wide text-gray-500">Em execução</div>
              <div className="mt-1 text-sm font-semibold text-white tabular-nums sm:text-base">{running.length}</div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-col rounded border border-white/10 bg-black/40 p-2 text-[10px] leading-tight sm:text-[11px]">
              <div className="break-words font-medium uppercase tracking-wide text-gray-500">Colectivos simultâneos</div>
              <div className="mt-1 text-sm font-semibold text-white tabular-nums sm:text-base">
                {runningCollective} / {maxColl}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Respiro extra: um pouco de dvh no telemóvel + mais em ecrãs maiores */}
      <div
        className="h-[max(1.5rem,min(3dvh,2.25rem))] shrink-0 sm:h-8 md:h-10"
        aria-hidden
      />
    </div>
  );
}
