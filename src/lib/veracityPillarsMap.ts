/**
 * Olefoot — três pilares de veracidade (atributos activos, impacto no XI/partida, evolução).
 *
 * Este módulo não calcula nada: serve como mapa único para equipa e UI saberem onde
 * cada pilar é resolvido no código. Ao alterar a simulação ou a progressão, actualiza
 * estes caminhos para manter a rastreabilidade.
 */

export type VeracityPillarId = 'active_attrs' | 'team_match_impact' | 'evolution';

export type VeracityCodeRef = {
  /** Caminho do ficheiro (relativo à raiz do repo / import alias `@/`). */
  module: string;
  /** Símbolo principal (função, tipo ou secção). */
  symbol: string;
  /** Uma linha sobre o papel deste ponto na cadeia. */
  note: string;
};

export interface VeracityPillarDef {
  id: VeracityPillarId;
  /** Rótulo curto na UI (sem aumentar tipografia). */
  label: string;
  /** Texto do tooltip / leitores de ecrã. */
  description: string;
  codeRefs: VeracityCodeRef[];
}

/** Definição estável dos três pilares + onde são calculados / aplicados. */
export const VERACITY_PILLARS: readonly VeracityPillarDef[] = [
  {
    id: 'active_attrs',
    label: 'Atributos → campo',
    description:
      'Os atributos da entidade (`PlayerEntity.attrs`) são convertidos em atributos de partida e injectados no estado do relvado; o movimento e decisões em tempo real leem esses valores.',
    codeRefs: [
      {
        module: '@/match/playerInMatch.ts',
        symbol: 'matchAttributesFromPlayerEntity',
        note: 'Deriva `MatchPlayerAttributes` a partir de `attrs` (passe, remate, etc.).',
      },
      {
        module: '@/engine/pitchFromLineup.ts',
        symbol: 'matchAttributesFromPlayerEntity',
        note: 'Preenche `PitchPlayerState.attributes` ao montar o XI.',
      },
      {
        module: '@/engine/ultralive2d/applyAttrsToMovement.ts',
        symbol: 'attrsOf / teamMovementKnobsFromHomePitch',
        note: 'Lê `PitchPlayerState.attributes` para modular movimento ultralive2d.',
      },
    ],
  },
  {
    id: 'team_match_impact',
    label: 'Impacto (XI + jogo)',
    description:
      'Força do plantel no ecrã de equipa usa o mesmo overall dos atributos activos. Em jogo, estatísticas e ledger de impacto alimentam rating e factores de evento.',
    codeRefs: [
      {
        module: '@/entities/player.ts',
        symbol: 'overallFromAttributes',
        note: 'Overall agregado a partir dos mesmos `attrs` do cartão / entidade.',
      },
      {
        module: '@/pages/Team.tsx',
        symbol: 'startersStrength',
        note: 'Soma e média do OVR dos titulares no mini-campo.',
      },
      {
        module: '@/match/impactLedger.ts',
        symbol: 'appendEntry / ledger de impacto',
        note: 'Registo de factores por jogador e minuto (casa).',
      },
      {
        module: '@/match/impactLedger.ts',
        symbol: 'homeImpactBase',
        note: 'Base de impacto a partir de passes, desarmes, km e rating da linha de stats.',
      },
    ],
  },
  {
    id: 'evolution',
    label: 'Evolução (treino + jogo)',
    description:
      'Planos de treino alteram `attrs` e XP; jogos aplicam swing de performance; a linha do tempo grava snapshots para auditoria na ficha.',
    codeRefs: [
      {
        module: '@/systems/trainingPlans.ts',
        symbol: 'applyTrainingToPlayer',
        note: 'Incrementos de atributos por tipo de plano de treino.',
      },
      {
        module: '@/game/reducer.ts',
        symbol: "case 'COMPLETE_DUE_TRAININGS'",
        note: 'Aplica treinos concluídos, booster do CT e timeline.',
      },
      {
        module: '@/entities/playerEvolution.ts',
        symbol: 'applyMatchPerformanceEvolution',
        note: 'Swing de atributos / XP após partida com base em stats e resultado.',
      },
      {
        module: '@/team/playerEvolutionTimeline.ts',
        symbol: 'appendEvolutionTimelinePoints',
        note: 'Pontos de evolução (match, training_plan, training_light).',
      },
      {
        module: '@/systems/training.ts',
        symbol: 'applySquadTraining',
        note: 'Treino leve de plantel (fadiga + XP, custo OLE).',
      },
    ],
  },
] as const;

export function veracityPillarTooltip(def: VeracityPillarDef): string {
  const refs = def.codeRefs.map((r) => `${r.module} → ${r.symbol}`).join('\n');
  return `${def.description}\n\nCódigo:\n${refs}`;
}
