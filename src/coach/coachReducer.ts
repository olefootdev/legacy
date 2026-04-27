import type { OlefootGameState, GameAction } from '@/game/types';
import type { CoachAction } from '@/coach/types';

/**
 * Actions do reducer para Coach Agent
 */

export type CoachGameAction =
  | { type: 'COACH_ADD_PENDING_ACTION'; action: CoachAction }
  | { type: 'COACH_APPROVE_ACTION'; actionId: string }
  | { type: 'COACH_REJECT_ACTION'; actionId: string }
  | { type: 'COACH_EXECUTE_ACTION'; actionId: string }
  | { type: 'COACH_CLEAR_EXECUTED_ACTIONS' };

/**
 * Adiciona uma ação pendente do coach
 */
export function addCoachPendingAction(
  state: OlefootGameState,
  action: CoachAction
): OlefootGameState {
  if (!state.manager.coach) return state;

  return {
    ...state,
    manager: {
      ...state.manager,
      coach: {
        ...state.manager.coach,
        pendingActions: [...state.manager.coach.pendingActions, action],
      },
    },
  };
}

/**
 * Aprova uma ação do coach (muda status para approved)
 */
export function approveCoachAction(
  state: OlefootGameState,
  actionId: string
): OlefootGameState {
  if (!state.manager.coach) return state;

  return {
    ...state,
    manager: {
      ...state.manager,
      coach: {
        ...state.manager.coach,
        pendingActions: state.manager.coach.pendingActions.map((a) =>
          a.id === actionId ? { ...a, status: 'approved' as const } : a
        ),
      },
    },
  };
}

/**
 * Rejeita uma ação do coach (muda status para rejected)
 */
export function rejectCoachAction(
  state: OlefootGameState,
  actionId: string
): OlefootGameState {
  if (!state.manager.coach) return state;

  return {
    ...state,
    manager: {
      ...state.manager,
      coach: {
        ...state.manager.coach,
        pendingActions: state.manager.coach.pendingActions.map((a) =>
          a.id === actionId ? { ...a, status: 'rejected' as const } : a
        ),
      },
    },
  };
}

/**
 * Executa uma ação aprovada do coach
 */
export function executeCoachAction(
  state: OlefootGameState,
  actionId: string
): OlefootGameState {
  if (!state.manager.coach) return state;

  const action = state.manager.coach.pendingActions.find((a) => a.id === actionId);
  if (!action || action.status !== 'approved') return state;

  // Executa a ação baseado no tipo
  let newState = state;

  switch (action.type) {
    case 'start_training':
      newState = executeStartTraining(state, action);
      break;
    case 'upgrade_staff':
      newState = executeUpgradeStaff(state, action);
      break;
    case 'assign_staff':
      newState = executeAssignStaff(state, action);
      break;
    case 'start_treatment':
      newState = executeStartTreatment(state, action);
      break;
  }

  // Marca ação como executada
  return {
    ...newState,
    manager: {
      ...newState.manager,
      coach: {
        ...newState.manager.coach!,
        pendingActions: newState.manager.coach!.pendingActions.map((a) =>
          a.id === actionId ? { ...a, status: 'executed' as const } : a
        ),
      },
    },
  };
}

/**
 * Remove ações executadas ou rejeitadas antigas (limpeza)
 */
export function clearExecutedCoachActions(
  state: OlefootGameState
): OlefootGameState {
  if (!state.manager.coach) return state;

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  return {
    ...state,
    manager: {
      ...state.manager,
      coach: {
        ...state.manager.coach,
        pendingActions: state.manager.coach.pendingActions.filter(
          (a) =>
            a.status === 'pending' ||
            a.status === 'approved' ||
            a.createdAt > oneHourAgo
        ),
      },
    },
  };
}

// ============================================================================
// Executores de ações específicas
// ============================================================================

function executeStartTraining(
  state: OlefootGameState,
  action: CoachAction
): OlefootGameState {
  const data = action.data as any;

  // Usa o reducer existente START_TEAM_TRAINING_PLAN
  // (precisa ser importado do reducer principal)
  const nanoid = () => `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const plan = {
    id: nanoid(),
    mode: data.mode,
    trainingType: data.trainingType,
    playerIds: data.playerIds,
    group: data.group,
    startedAt: new Date().toISOString(),
    endAt: new Date(Date.now() + data.durationHours * 60 * 60 * 1000).toISOString(),
    status: 'running' as const,
  };

  return {
    ...state,
    manager: {
      ...state.manager,
      trainingPlans: [...state.manager.trainingPlans, plan],
    },
  };
}

function executeUpgradeStaff(
  state: OlefootGameState,
  action: CoachAction
): OlefootGameState {
  const data = action.data as any;

  // Verifica se tem recursos
  const cost = data.cost;
  if (cost.currency === 'exp' && state.finance.ole < cost.amount) {
    return state; // não tem EXP suficiente
  }
  if (cost.currency === 'bro' && state.finance.broCents < cost.amount) {
    return state; // não tem BRO suficiente
  }

  // Deduz custo
  let newFinance = state.finance;
  if (cost.currency === 'exp') {
    newFinance = { ...newFinance, ole: newFinance.ole - cost.amount };
  } else {
    newFinance = { ...newFinance, broCents: newFinance.broCents - cost.amount };
  }

  // Faz upgrade
  const newStaff = {
    ...state.manager.staff,
    roles: {
      ...state.manager.staff.roles,
      [data.roleId]: data.targetLevel,
    },
  };

  return {
    ...state,
    finance: newFinance,
    manager: {
      ...state.manager,
      staff: newStaff,
    },
  };
}

function executeAssignStaff(
  state: OlefootGameState,
  action: CoachAction
): OlefootGameState {
  const data = action.data as any;

  return {
    ...state,
    manager: {
      ...state.manager,
      staff: {
        ...state.manager.staff,
        assignedByPlayer: {
          ...state.manager.staff.assignedByPlayer,
          [data.playerId]: data.roleIds,
        },
      },
    },
  };
}

function executeStartTreatment(
  state: OlefootGameState,
  action: CoachAction
): OlefootGameState {
  const data = action.data as any;
  const nanoid = () => `treat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const TREATMENT_DURATION_H = 24; // pode importar de systems/medicalTreatment

  const plan = {
    id: nanoid(),
    playerId: data.playerId,
    startedAt: new Date().toISOString(),
    endAt: new Date(Date.now() + TREATMENT_DURATION_H * 60 * 60 * 1000).toISOString(),
    status: 'running' as const,
  };

  return {
    ...state,
    manager: {
      ...state.manager,
      treatmentPlans: [...(state.manager.treatmentPlans || []), plan],
    },
  };
}
