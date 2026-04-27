import type { CoachAgent, TeamContext } from './types';
import type { IndividualTrainingType, CollectiveTrainingType, TrainingGroup, StaffRoleId } from '@/game/types';

export type CoachActionType =
  | 'start_training'
  | 'upgrade_staff'
  | 'assign_staff'
  | 'start_treatment';

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
  | StartTreatmentActionData;

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
    title: `Iniciar treino ${suggestion.mode === 'individual' ? 'individual' : 'coletivo'}: ${suggestion.trainingType}`,
    description: suggestion.mode === 'individual'
      ? `Treino ${suggestion.trainingType} para ${playerIds.length} jogador(es) por ${suggestion.durationHours}h`
      : `Treino ${suggestion.trainingType} coletivo (${suggestion.group}) por ${suggestion.durationHours}h`,
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
    title: `Upgrade ${suggestion.role} para nível ${currentLevel + 1}`,
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
    title: `Atribuir staff a ${playerName}`,
    description: `Atribuir ${roleIds.join(', ')} a ${playerName}`,
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
    title: `Iniciar tratamento médico: ${playerName}`,
    description: `Colocar ${playerName} em tratamento no departamento médico`,
    reasoning,
    urgency: 'high',
    status: 'pending',
    createdAt: Date.now(),
    data: {
      playerId,
    },
  };
}
