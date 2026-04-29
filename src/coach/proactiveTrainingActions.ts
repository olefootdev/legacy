import type { OlefootGameState } from '@/game/types';
import type { CoachAction } from './coachActions';
import type { CoachPersonality } from './types';
import type { CollectiveTrainingType, IndividualTrainingType, TrainingGroup } from '@/game/types';

/**
 * Gera ações de TREINO/EVOLUÇÃO para a janela 2 do ciclo (5min "preparação e evolução").
 *
 * Heurísticas conservadoras:
 * - Se fadiga média < 60% E injury risk médio < 50% → safe para treinar (não conflitar com health).
 * - Personalidade do coach define ênfase do treino coletivo.
 * - Identifica até 2 jogadores com atributo destaque-fraco para treino individual focado.
 *
 * NOTE: Este gerador foca em EVOLUÇÃO. Recuperação/descanso fica em proactiveHealthActions.
 */
export function generateProactiveTrainingActions(state: OlefootGameState): CoachAction[] {
  const out: CoachAction[] = [];
  const players = Object.values(state.players);
  if (players.length === 0) return out;
  const coach = state.manager.coach;
  if (!coach) return out;

  const health = state.playerHealth ?? {};
  const now = Date.now();

  let totalFatigue = 0;
  let totalInjuryRisk = 0;
  for (const p of players) {
    const h = health[p.id];
    totalFatigue += h?.fatigue ?? p.fatigue ?? 0;
    totalInjuryRisk += h?.injuryRisk ?? p.injuryRisk ?? 0;
  }
  const avgFatigue = totalFatigue / players.length;
  const avgInjuryRisk = totalInjuryRisk / players.length;

  // Guarda: se plantel cansado, deixa health agir e não propõe treino que cansa mais.
  if (avgFatigue >= 60 || avgInjuryRisk >= 50) return out;

  const runningPlans = state.manager.trainingPlans.filter((p) => p.status === 'running').length;
  // Não empilhar se já há treinos rodando.
  if (runningPlans >= 2) return out;

  // 1) Treino coletivo baseado em personalidade do coach
  const collective = pickCollectiveByPersonality(coach.personality);
  out.push({
    id: `coach-train-coletivo-${now}`,
    type: 'start_training',
    title: `Treino coletivo: ${collective.label}`,
    description: `Sessão coletiva (${collective.group}, 12h) focada em ${collective.label.toLowerCase()}.`,
    reasoning: `Plantel descansado (fadiga ${avgFatigue.toFixed(0)}%) — janela boa para evoluir. Estilo do coach: ${coach.personality}.`,
    urgency: 'medium',
    status: 'pending',
    createdAt: now,
    data: {
      mode: 'coletivo',
      trainingType: collective.type as CollectiveTrainingType,
      playerIds: [],
      group: collective.group,
      durationHours: 12,
    },
  });

  // 2) Treino individual focado: até 2 jogadores com OVR mais baixo.
  const meanOvr = (p: typeof players[number]) => {
    const a = p.attrs as unknown as Record<string, number>;
    const vals = Object.values(a).filter((v) => typeof v === 'number');
    return vals.length === 0 ? 50 : vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const sorted = [...players].sort((a, b) => meanOvr(a) - meanOvr(b)).slice(0, 2);
  for (const p of sorted) {
    const weak = pickWeakAttr(p.attrs as unknown as Record<string, number>);
    if (!weak) continue;
    const indiv = mapAttrToIndividualType(weak);
    out.push({
      id: `coach-train-indiv-${p.id}-${now}`,
      type: 'start_training',
      title: `Treino individual: ${p.name}`,
      description: `Treino ${indiv} para ${p.name} (8h) — atributo fraco: ${weak}.`,
      reasoning: `${p.name} (OVR ${meanOvr(p).toFixed(0)}) ganha mais com treino focado em ${weak}.`,
      urgency: 'low',
      status: 'pending',
      createdAt: now,
      data: {
        mode: 'individual',
        trainingType: indiv as IndividualTrainingType,
        playerIds: [p.id],
        group: 'all' as TrainingGroup,
        durationHours: 8,
      },
    });
  }

  return out;
}

function pickCollectiveByPersonality(personality: CoachPersonality): {
  type: CollectiveTrainingType;
  label: string;
  group: TrainingGroup;
} {
  switch (personality) {
    case 'Pragmatic':
      return { type: 'fisico', label: 'Físico (resistência defensiva)', group: 'defensivo' };
    case 'Visionary':
      return { type: 'formacao', label: 'Formação (padrões de jogo)', group: 'all' };
    case 'Motivator':
      return { type: 'empatia', label: 'Empatia (coesão de grupo)', group: 'all' };
    case 'Tactician':
      return { type: 'formacao', label: 'Formação (leitura tática)', group: 'all' };
    case 'Developer':
      return { type: 'formacao', label: 'Formação (base do plantel)', group: 'all' };
  }
}

type AttrKey = 'finalizacao' | 'passe' | 'drible' | 'marcacao' | 'fisico' | 'velocidade' | 'tatico' | 'mentalidade';

function pickWeakAttr(attrs: Record<string, number>): AttrKey | null {
  const keys: AttrKey[] = ['finalizacao', 'passe', 'drible', 'marcacao', 'fisico', 'velocidade', 'tatico', 'mentalidade'];
  let weakest: AttrKey | null = null;
  let weakVal = 999;
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === 'number' && v < weakVal) {
      weakVal = v;
      weakest = k;
    }
  }
  return weakest;
}

function mapAttrToIndividualType(attr: AttrKey): IndividualTrainingType {
  switch (attr) {
    case 'fisico':
    case 'velocidade':
      return 'fisico';
    case 'mentalidade':
      return 'mental';
    case 'tatico':
    case 'marcacao':
      return 'tatico';
    case 'finalizacao':
      return 'especial';
    case 'passe':
    case 'drible':
      return 'atributos';
  }
}
