import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { SecaoRua } from '@/components/ui/Rua';
import { OvrSelo, PlacarRua, VazioRua } from '@/components/clube/escada';
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

/** Cor da barra de cansaço: baixa (alto), aviso (médio), papel (descansado). */
function fatigueRail(fatigue: number): string {
  if (fatigue >= 35) return 'var(--color-baixa)';
  if (fatigue >= 20) return 'var(--color-warning)';
  return 'var(--color-papel)';
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
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-8">
        <BackButton to="/clube" label={L('Clube', 'Club')} />

        <EditorialHero
          eyebrow={L('Gestão do clube · Desenvolvimento', 'Club management · Development')}
          title={L('Treino', 'Training')}
          subtitle={L('Suor hoje, OVR amanhã.', 'Sweat today, OVR tomorrow.')}
          stats={L(`${running.length} planos ativos · ${completedPlans.length} concluídos · ${slots} slots disponíveis`, `${running.length} active plans · ${completedPlans.length} completed · ${slots} slots available`)}
          icon={<Dumbbell aria-hidden />}
          lambe={{ rotulo: 'AI Labs', valor: `+${boosterPct}%` }}
        />

        {/* ---- Placar ---- */}
        <PlacarRua
          itens={[
            { label: L('Slots por sessão', 'Slots per session'), value: slots },
            { label: L('Coletivos simult.', 'Team sessions'), value: <>{runningCollective}<small className="text-[0.5em] text-mudo"> /{maxColl}</small></> },
            { label: L('Em execução', 'Running'), value: running.length },
            { label: 'Booster AI Labs', value: <>+{boosterPct}<small className="text-[0.5em] text-mudo">%</small></> },
          ]}
        />

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
                className={cn(
                  'group relative flex min-w-0 flex-col p-4 text-left transition-colors',
                  sel ? 'bg-rua text-asfalto-27' : 'bg-concreto text-papel hover:bg-linha',
                )}
              >
                <div className="flex items-start justify-between">
                  <Icon className={cn('h-6 w-6', sel ? 'text-asfalto-27' : 'text-rua')} aria-hidden />
                  <span
                    className={cn(
                      'font-impact leading-none',
                      meta.grade.length > 1 ? 'text-[14px]' : 'text-[30px]',
                      sel ? 'text-asfalto-27' : 'text-papel',
                    )}
                  >
                    {meta.grade}
                  </span>
                </div>
                <h3 className="mt-3 font-impact text-[22px] uppercase leading-[0.95]">{meta.label}</h3>
                <p className={cn('mt-1 truncate text-[12px] leading-snug', sel ? 'text-asfalto-27/75' : 'text-suave')}>{meta.desc}</p>
                <div className="mt-3 flex flex-col gap-0.5">
                  {meta.gains.map((g) => (
                    <span
                      key={g.t}
                      className={cn(
                        'font-prova text-[11px] font-bold uppercase tracking-[0.04em]',
                        sel
                          ? g.muted ? 'text-asfalto-27/50' : 'text-asfalto-27'
                          : g.muted ? 'text-mudo' : g.down ? 'text-baixa' : 'text-alta',
                      )}
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

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-concreto p-4 sm:p-5">
          {who === 'elenco' && (
            <div className="flex items-center gap-5">
              <div className="font-spray text-[56px] font-black leading-none text-papel tabular-nums">
                {elencoCount}
              </div>
              <p className="text-[13px] leading-relaxed text-suave">
                {emIngles() ? <><span className="text-papel">Full squad</span> · smaller gain per player · 1 team slot (max {maxColl})</> : <><span className="text-papel">Plantel completo</span> · ganho menor por jogador · 1 slot coletivo (máx. {maxColl})</>}
              </p>
            </div>
          )}

          {who === 'setor' && (
            <div className="space-y-3">
              <p className="text-[13px] text-suave">{L('Escolha o bloco que treina em conjunto.', 'Choose the unit that trains together.')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SECTOR_ORDER.map((id) => {
                  const meta = SECTOR_META[id];
                  const sel = sector === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSector(id)}
                      aria-pressed={sel}
                      className={cn(
                        'flex min-w-0 items-center justify-between gap-3 p-3.5 text-left transition-colors',
                        sel ? 'border-2 border-rua bg-asfalto-27' : 'border-2 border-linha bg-asfalto-27 hover:border-fio',
                      )}
                    >
                      <div className="min-w-0">
                        <div className={cn('font-impact text-[20px] uppercase leading-none', sel ? 'text-rua' : 'text-papel')}>{meta.title}</div>
                        <div className="mt-1 text-[12px] text-suave">{meta.sub}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-impact text-[28px] leading-none text-papel tabular-nums">{sectorCounts[id]}</div>
                        <div className="font-prova text-[10px] uppercase text-mudo">{L('jogadores', 'players')}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {who === 'individual' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-suave">{L(`Selecione até ${slots} — a barra é o cansaço.`, `Select up to ${slots} — the bar shows fatigue.`)}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-impact text-[18px] text-papel tabular-nums">{selectedPlayers.length}/{slots}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayers([])}
                    disabled={selectedPlayers.length === 0}
                    className="inline-flex min-h-[36px] items-center border-2 border-linha px-2.5 font-prova text-[11px] font-bold uppercase text-suave hover:border-papel hover:text-papel disabled:opacity-30"
                  >
                    {L('Limpar', 'Clear')}
                  </button>
                </div>
              </div>
              {roster.length === 0 ? (
                <VazioRua
                  frase={L('Nenhum jogador no elenco ainda.', 'No players in the squad yet.')}
                  acao={{ label: L('Ir pro mercado', 'Go to the market'), to: '/mercado/transfer' }}
                />
              ) : (
              <div className="flex max-h-[min(22rem,46dvh)] flex-col gap-px overflow-y-auto overscroll-y-contain bg-linha [scrollbar-gutter:stable]">
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
                      className={cn(
                        'group relative flex min-h-[68px] shrink-0 items-center gap-3 px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        active ? 'bg-asfalto-27 outline outline-2 -outline-offset-2 outline-rua' : 'bg-asfalto-27 hover:bg-concreto',
                      )}
                    >
                      <OvrSelo ovr={ovr} className="h-11 w-11 text-[22px]" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 font-prova text-[11px] text-mudo">{p.num}</span>
                          <span className="block min-w-0 truncate font-voz text-[21px] leading-none text-papel">{p.name}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.08em] text-mudo">{rotuloPosicao(p.pos)}</span>
                          <div className="flex min-w-0 max-w-[110px] flex-1 items-center gap-1.5" title={L(`${Math.round(fatigue)}% cansaço`, `${Math.round(fatigue)}% fatigue`)}>
                            <span aria-hidden className="grid h-1.5 min-w-0 flex-1 grid-cols-10 gap-[2px]">
                              {Array.from({ length: 10 }, (_, i) => (
                                <span key={i} style={{ background: i < Math.round(Math.min(100, Math.max(0, fatigue)) / 10) ? rail : 'var(--color-linha)' }} />
                              ))}
                            </span>
                            <span className="shrink-0 font-prova text-[10px] text-mudo tabular-nums">{Math.round(fatigue)}%</span>
                          </div>
                          {tag && <span className="shrink-0 border border-baixa px-1 font-prova text-[9px] font-bold uppercase text-baixa">{tag}</span>}
                        </div>
                      </div>
                      <span className={cn('grid h-6 w-6 shrink-0 place-items-center', active ? 'bg-rua' : 'border-2 border-dashed border-fio')}>
                        {active && <Check className="h-3.5 w-3.5 text-asfalto-27" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ================= AÇÃO ================= */}
        <div className="flex flex-col gap-5 border-t-2 border-linha pt-5 sm:flex-row sm:items-end sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SecaoRua label={L('Resumo', 'Summary')} />
            <p className="font-voz text-[24px] leading-tight text-papel">
              {CARD_META[trainingType].label}
              {' · '}
              <span className={who === 'individual' && selectedPlayers.length === 0 ? 'text-[color:var(--color-warning)]' : ''}>{whoSummary}</span>
              {' · '}{durationHours}h
            </p>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-[210px]">
            <label htmlFor="dur" className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Duração de execução', 'Duration')}</label>
            <input id="dur" type="range" min={6} max={72} step={6} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full accent-rua" />
            <div className="font-prova text-[11px] font-bold uppercase tracking-[0.04em] text-papel tabular-nums">
              {durationHours}h · {trainingType === 'descanso' ? L('recuperação', 'recovery') : L(`ganho ×${durMult.toFixed(2)}`, `gain ×${durMult.toFixed(2)}`)} · {L('booster CT', 'TC booster')} +{boosterPct}%
            </div>
          </div>
          <div className="flex gap-3 pb-1 pr-1">
            <button
              type="button"
              onClick={startTraining}
              disabled={!canStartTraining}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 bg-rua px-6 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] disabled:cursor-not-allowed disabled:bg-linha disabled:text-mudo disabled:shadow-none sm:flex-none"
            >
              {L('Iniciar treino', 'Start training')} <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              onClick={completeDueNow}
              className="inline-flex min-h-[52px] items-center justify-center border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
            >
              {L('Concluir', 'Complete')}
            </button>
          </div>
        </div>

        {/* ================= EM ANDAMENTO ================= */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <SecaoRua
            label={L('Em andamento', 'In progress')}
            aside={completedPlans.length > 0 ? L(`${completedPlans.length} no histórico`, `${completedPlans.length} in history`) : undefined}
          />
          {running.length === 0 ? (
            <p className="border-2 border-dashed border-fio p-4 font-voz text-[21px] leading-tight text-suave">{L('Nenhum treino em curso. O campo tá vazio.', 'No training in progress. The pitch is empty.')}</p>
          ) : (
            <div className="flex flex-col gap-px bg-linha">
              {running.map((p) => {
                const dh = planDurationHours(p);
                const remainingMs = new Date(p.endAt).getTime() - countdownNowMs;
                const endShort = new Date(p.endAt).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const done = remainingMs <= 0;
                return (
                  <div key={p.id} className="flex min-w-0 items-center gap-3 bg-asfalto-27 px-3 py-3">
                    <span className={cn('shrink-0 px-2 py-1 font-prova text-[10px] font-bold uppercase tracking-[0.06em]', done ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-suave')}>
                      {trainingTypeLabel(p)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-papel">{planDisplayName(p, players)}</div>
                      <div className="font-prova text-[10px] text-mudo">{dh}h · {L('até', 'until')} {endShort}</div>
                    </div>
                    <span
                      className={cn('inline-flex shrink-0 items-center gap-1.5 font-spray text-[20px] font-black leading-none tabular-nums', done ? 'text-rua' : 'text-papel')}
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
        </motion.section>

        {/* ================= DEPARTAMENTO MÉDICO ================= */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <SecaoRua label={L('Departamento médico', 'Medical department')} aside={`${runningTreat.length}/${treatSlots} · ~${TREATMENT_PLAN_DURATION_H}h`} />
          <p className="text-[12px] text-suave">{L(`Clica num jogador disponível para ocupar um slot médico (nível ${medLevel}).`, `Tap an available player to fill a medical slot (level ${medLevel}).`)}</p>
          <div className="max-h-[min(14rem,34svh)] overflow-y-auto overscroll-y-contain bg-concreto [scrollbar-gutter:stable]">
            <ul className="divide-y divide-linha">
              {roster.map((p) => {
                const busy = runningTreat.some((t) => t.playerId === p.id);
                const full = runningTreat.length >= treatSlots;
                return (
                  <li key={`treat-${p.id}`}>
                    <button
                      type="button"
                      onClick={() => !busy && !full && startTreatment(p.id)}
                      disabled={busy || full}
                      className={cn(
                        'flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed',
                        busy ? 'bg-asfalto-27' : full ? 'opacity-40' : 'hover:bg-linha',
                      )}
                    >
                      <span className="min-w-0 truncate text-[13px] text-papel"><span className="font-prova text-[11px] text-mudo">{p.num}</span> · {p.name}</span>
                      <span className={cn('shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.08em]', busy ? 'text-rua' : full ? 'text-mudo' : 'text-suave')}>
                        {busy ? L('Em tratamento', 'In treatment') : full ? L('Slots cheios', 'Slots full') : <>{L('Iniciar', 'Start')} →</>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {treatmentPlans.length > 0 && (
            <div className="space-y-1 border-t-2 border-linha pt-2">
              {treatmentPlans.map((t) => (
                <div key={t.id} className="flex justify-between gap-2 font-prova text-[10px] text-mudo">
                  <span className="min-w-0 truncate text-papel">{players[t.playerId]?.name ?? t.playerId}</span>
                  <span className="shrink-0 tabular-nums">{t.status} · {L('fim', 'ends')} {new Date(t.endAt).toLocaleString(LOCALE)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <div className="h-[max(1.5rem,3dvh)] shrink-0 sm:h-8 md:h-10" aria-hidden />
      </div>
    </div>
  );
}

/* ---------------- Subcomponentes locais ---------------- */


function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-end gap-3 pt-2">
      {/* Número vazado (degrau CHÃO): o passo ainda vai acontecer. */}
      <div className="font-spray text-[52px] font-black leading-[0.8] text-transparent [-webkit-text-stroke:1.5px_var(--color-rua)] tabular-nums">
        {String(n).padStart(2, '0')}
      </div>
      <h2 className="font-impact text-[28px] uppercase leading-none text-papel">{title}</h2>
    </div>
  );
}

function WhoButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-w-0 flex-col gap-1 p-4 text-left transition-colors',
        active ? 'bg-rua text-asfalto-27' : 'bg-concreto text-papel hover:bg-linha',
      )}
    >
      <div className="font-impact text-[22px] uppercase leading-none">{title}</div>
      <div className={cn('text-[12px]', active ? 'text-asfalto-27/75' : 'text-suave')}>{desc}</div>
    </button>
  );
}
