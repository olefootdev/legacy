/**
 * OLEFOOT AGENTS — Tipos base para agentes offline
 *
 * Arquitetura:
 * - AgentProfile: perfil completo do jogador (espacial, coletivo, individual, risco, crítico)
 * - SkillDefinition: skills equipáveis com when/score/apply
 * - LearningState: evolução baseada em eventos de partida
 */

import type { PlayerEntity } from '@/entities/types';
import type { DecisionContext } from '@/playerDecision/types';

/** Conhecimento espacial por posição */
export interface SpatialProfile {
  /** Zonas preferidas (ex: ['att_third', 'opp_box']) */
  preferredZones: string[];
  /** Consciência de espaço 0-100 */
  spatialAwareness: number;
  /** Scan antes de receber 0-100 */
  scanBeforeReceive: number;
  /** Conhecimento de timing de corrida 0-100 */
  runTiming: number;
  /** Posicionamento defensivo 0-100 */
  defensivePositioning: number;
}

/** Comportamento coletivo */
export interface TeamProfile {
  /** Suporte ao portador 0-100 */
  supportCarrier: number;
  /** Disciplina tática 0-100 */
  tacticalDiscipline: number;
  /** Comunicação com time 0-100 */
  teamCommunication: number;
  /** Cobertura defensiva 0-100 */
  defensiveCover: number;
  /** Movimento coletivo 0-100 */
  collectiveMovement: number;
}

/** Comportamento individual */
export interface IndividualProfile {
  /** Criatividade 0-100 */
  creativity: number;
  /** Decisão sob pressão 0-100 */
  decisionUnderPressure: number;
  /** Confiança com bola 0-100 */
  ballConfidence: number;
  /** Visão de jogo 0-100 */
  vision: number;
  /** Execução técnica 0-100 */
  technicalExecution: number;
}

/** Perfil de risco */
export interface RiskProfile {
  /** Nível base de risco 0-100 */
  baseRisk: number;
  /** Risco sob pressão (delta) -50 a +50 */
  riskUnderPressure: number;
  /** Risco quando perdendo (delta) -50 a +50 */
  riskWhenLosing: number;
  /** Risco quando ganhando (delta) -50 a +50 */
  riskWhenWinning: number;
  /** Preferência por drible vs passe 0-100 (0=sempre passa, 100=sempre dribla) */
  dribbleVsPass: number;
}

/** Perfil crítico (momentos decisivos) */
export interface CriticalProfile {
  /** Compostura em momentos críticos 0-100 */
  criticalComposure: number;
  /** Ego/desejo individual 0-100 */
  ego: number;
  /** Reação a pressão da torcida 0-100 */
  crowdPressureReaction: number;
  /** Decisão egoísta vs coletiva 0-100 (0=sempre coletivo, 100=sempre egoísta) */
  selfishVsTeam: number;
  /** Confiança em finalizações 0-100 */
  finishingConfidence: number;
}

/** Estado de aprendizado (evolui com partidas) */
export interface LearningState {
  /** Confiança atual 0-100 */
  confidence: number;
  /** Tendência de risco atual 0-100 */
  riskTendency: number;
  /** Preferência de passe vs chute 0-100 */
  passVsShootPreference: number;
  /** Compostura crítica atual 0-100 */
  criticalComposure: number;
  /** Disciplina tática atual 0-100 */
  tacticalDiscipline: number;
  /** Ego controlado 0-100 */
  egoControl: number;
  /** Memória de eventos recentes */
  recentEvents: LearningEvent[];
}

/** Evento de aprendizado */
export interface LearningEvent {
  type: 'pass_ok' | 'pass_fail' | 'shot_ok' | 'shot_fail' | 'duel_won' | 'duel_lost' | 'critical_error' | 'critical_success' | 'selfish_ok' | 'selfish_fail';
  minute: number;
  context: string;
  impact: number; // -10 a +10
}

/** Perfil completo do agente */
export interface AgentProfile {
  playerId: string;
  position: string;
  role: string;
  archetype: string;
  spatialProfile: SpatialProfile;
  teamProfile: TeamProfile;
  individualProfile: IndividualProfile;
  riskProfile: RiskProfile;
  criticalProfile: CriticalProfile;
  equippedSkills: string[];
  learningState: LearningState;
  /** Timestamp de criação */
  createdAt: string;
  /** Timestamp de última atualização */
  updatedAt: string;
  /** Versão do profile (para migração futura) */
  version: number;
}

/** Definição de skill offline */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'spatial' | 'team' | 'individual' | 'risk' | 'critical';
  /** Posições elegíveis (ex: ['ATA', 'PE', 'PD']) */
  positions: string[];
  /** Quando a skill deve ser considerada */
  when: (ctx: DecisionContext) => boolean;
  /** Score adicional para decisão (0-1) */
  score: (ctx: DecisionContext) => number;
  /** Bias de ações (ex: { pass_progressive: +0.15 }) */
  bias: Record<string, number>;
  /** Cooldown em segundos (0 = sempre ativa) */
  cooldown: number;
}

/** Contexto de decisão do agente (estende DecisionContext) */
export interface AgentDecisionContext extends DecisionContext {
  agentProfile?: AgentProfile;
  teamIntent?: TeamIntent;
  matchState?: MatchState;
}

/** Intenção coletiva do time */
export type TeamIntent =
  | 'control_game'
  | 'press_high'
  | 'protect_result'
  | 'seek_draw'
  | 'accelerate_attack'
  | 'reorganize';

/** Estado da partida para decisão */
export interface MatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  momentum: number; // -1 a +1
  fatigue: number; // 0-100
}

/** Template de profile por posição */
export interface ProfileTemplate {
  position: string;
  role: string;
  spatialProfile: Partial<SpatialProfile>;
  teamProfile: Partial<TeamProfile>;
  individualProfile: Partial<IndividualProfile>;
  riskProfile: Partial<RiskProfile>;
  criticalProfile: Partial<CriticalProfile>;
  defaultSkills: string[];
}
