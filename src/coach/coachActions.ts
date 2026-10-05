import type { CoachAgent, TeamContext } from './types';
import type { IndividualTrainingType, CollectiveTrainingType, TrainingGroup, StaffRoleId } from '@/game/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { L } from '@/i18n/L';

export type CoachActionType =
  | 'start_training'
  | 'upgrade_staff'
  | 'assign_staff'
  | 'start_treatment'
  | 'buy_health_booster'
  | 'set_lineup_formation';

export interface CoachAction {
  id: string;
  type: CoachActionType;
  title: string;
  description: string;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: number;

  // Dados específicos da ação
  data: CoachActionData;
}

export type CoachActionData =
  | StartTrainingActionData
  | UpgradeStaffActionData
  | AssignStaffActionData
  | StartTreatmentActionData
  | BuyHealthBoosterActionData
  | SetLineupFormationActionData;

export interface SetLineupFormationActionData {
  formationScheme: FormationSchemeId;
  /** Opcional: lineup proposto (slotId → playerId). Se omitido, mantém lineup atual e só troca formação. */
  lineup?: Record<string, string>;
  /** Adversário/contexto que motivou a sugestão. */
  opponentContext?: string;
}

export interface BuyHealthBoosterActionData {
  shopItemId: string;
  /** Alvo do booster: 'squad' ou playerId específico. */
  targetPlayerId?: string;
  costExp?: number;
  costBroCents?: number;
}

export interface StartTrainingActionData {
  mode: 'individual' | 'coletivo';
  trainingType: IndividualTrainingType | CollectiveTrainingType;
  playerIds: string[];
  group: TrainingGroup;
  durationHours: number;
}

export interface UpgradeStaffActionData {
  roleId: StaffRoleId;
  currentLevel: number;
  targetLevel: number;
  cost: {
    currency: 'exp' | 'bro';
    amount: number;
  };
}

export interface AssignStaffActionData {
  playerId: string;
  roleIds: StaffRoleId[];
}

export interface StartTreatmentActionData {
  playerId: string;
}

/**
 * Cria uma ação de treino para aprovação do manager
 */
export function createTrainingAction(
  coach: CoachAgent,
  teamContext: TeamContext,
  suggestion: {
    mode: 'individual' | 'coletivo';
    trainingType: string;
    group: TrainingGroup;
    durationHours: number;
    reasoning: string;
    priority: 'low' | 'medium' | 'high';
  },
  playerIds: string[] = []
): CoachAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'start_training',
    title: suggestion.mode === 'individual'
      ? L(`Iniciar treino individual: ${suggestion.trainingType}`, `Start individual training: ${suggestion.trainingType}`)
      : L(`Iniciar treino coletivo: ${suggestion.trainingType}`, `Start team training: ${suggestion.trainingType}`),
    description: suggestion.mode === 'individual'
      ? L(`Treino ${suggestion.trainingType} para ${playerIds.length} jogador(es) por ${suggestion.durationHours}h`, `${suggestion.trainingType} training for ${playerIds.length} player(s) for ${suggestion.durationHours}h`)
      : L(`Treino ${suggestion.trainingType} coletivo (${suggestion.group}) por ${suggestion.durationHours}h`, `${suggestion.trainingType} team training (${suggestion.group}) for ${suggestion.durationHours}h`),
    reasoning: suggestion.reasoning,
    urgency: suggestion.priority,
    status: 'pending',
    createdAt: Date.now(),
    data: {
      mode: suggestion.mode,
      trainingType: suggestion.trainingType as any,
      playerIds,
      group: suggestion.group,
      durationHours: suggestion.durationHours,
    },
  };
}

/**
 * Cria uma ação de upgrade de staff para aprovação do manager
 */
export function createUpgradeStaffAction(
  coach: CoachAgent,
  teamContext: TeamContext,
  suggestion: {
    role: StaffRoleId;
    action: string;
    reasoning: string;
    priority: 'low' | 'medium' | 'high';
    cost: { currency: 'exp' | 'bro'; amount: number };
  }
): CoachAction {
  const currentLevel = teamContext.staffLevels[suggestion.role] ?? 1;

  return {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'upgrade_staff',
    title: L(`Upgrade ${suggestion.role} para nível ${currentLevel + 1}`, `Upgrade ${suggestion.role} to level ${currentLevel + 1}`),
    description: suggestion.action,
    reasoning: suggestion.reasoning,
    urgency: suggestion.priority,
    status: 'pending',
    createdAt: Date.now(),
    data: {
      roleId: suggestion.role,
      currentLevel,
      targetLevel: currentLevel + 1,
      cost: suggestion.cost,
    },
  };
}

/**
 * Cria uma ação de atribuição de staff para aprovação do manager
 */
export function createAssignStaffAction(
  coach: CoachAgent,
  playerId: string,
  playerName: string,
  roleIds: StaffRoleId[],
  reasoning: string
): CoachAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'assign_staff',
    title: L(`Atribuir staff a ${playerName}`, `Assign staff to ${playerName}`),
    description: L(`Atribuir ${roleIds.join(', ')} a ${playerName}`, `Assign ${roleIds.join(', ')} to ${playerName}`),
    reasoning,
    urgency: 'medium',
    status: 'pending',
    createdAt: Date.now(),
    data: {
      playerId,
      roleIds,
    },
  };
}

/**
 * Cria uma ação de tratamento médico para aprovação do manager
 */
export function createTreatmentAction(
  coach: CoachAgent,
  playerId: string,
  playerName: string,
  reasoning: string
): CoachAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'start_treatment',
    title: L(`Iniciar tratamento médico: ${playerName}`, `Start medical treatment: ${playerName}`),
    description: L(`Colocar ${playerName} em tratamento no departamento médico`, `Send ${playerName} to the medical department for treatment`),
    reasoning,
    urgency: 'high',
    status: 'pending',
    createdAt: Date.now(),
    data: {
      playerId,
    },
  };
}
