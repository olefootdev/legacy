import type { StaffRoleId, IndividualTrainingType, CollectiveTrainingType, TrainingGroup } from '@/game/types';
import type { FormationSchemeId } from '@/match-engine/types';

export type CoachPersonality =
  | 'Pragmatic'      // Mourinho-style: defesa sólida, resultado
  | 'Visionary'      // Guardiola-style: posse, padrões
  | 'Motivator'      // Klopp-style: intensidade, pressing
  | 'Tactician'      // Ancelotti-style: adaptação, equilíbrio
  | 'Developer';     // youth focus, long-term building

export type CoachSpecialty =
  | 'defense' | 'attack' | 'midfield' | 'setpieces'
  | 'youth' | 'fitness' | 'mentality';

export interface CoachAgent {
  id: string;
  name: string;
  personality: CoachPersonality;
  specialties: CoachSpecialty[];

  // Atributos (0-20, estilo FM)
  tactical: number;        // lê o jogo, ajusta formação
  motivation: number;      // impacta moral/fatigue recovery
  discipline: number;      // reduz cartões, melhora defensive shape
  attacking: number;       // coaching de finalizações/criação
  defending: number;       // coaching de marcação/posicionamento

  // Autonomia (0-100)
  autonomyLevel: number;   // quanto o coach age sem pedir permissão

  // Estado
  reputation: number;      // 0-100

  // Memória de longo prazo
  memory: CoachMemory;

  // Contexto da conversa atual (limpa após cada sessão)
  conversationContext: ConversationMessage[];

  // Ações pendentes de aprovação do manager
  pendingActions: CoachAction[];
}

export interface CoachMemory {
  // Instruções do manager (aprendizado)
  managerInstructions: ManagerInstruction[];

  // Conhecimento sobre o sistema de treinos
  trainingKnowledge: {
    preferredIndividualTypes: IndividualTrainingType[];
    preferredCollectiveTypes: CollectiveTrainingType[];
    preferredGroups: TrainingGroup[];
    typicalDurationHours: number;
  };

  // Conhecimento sobre staff
  staffKnowledge: {
    priorityRoles: StaffRoleId[];  // quais roles priorizar upgrade
    playerAssignmentStrategy: string;  // como distribuir staff por jogadores
  };

  // Histórico de decisões
  decisionHistory: CoachDecision[];

  // Progresso do onboarding guiado (undefined = não iniciado, 0-2 = em progresso, 3+ = completo)
  onboardingStep?: number;
}

export interface ManagerInstruction {
  timestamp: number;
  instruction: string;        // texto livre do manager
  context: string;            // "Conversa sobre treinos", "Antes do jogo contra X"
  priority: 'high' | 'medium' | 'low';
  active: boolean;            // manager pode desativar depois
  category: 'training' | 'staff' | 'lineup' | 'tactics' | 'general';
}

export interface CoachDecision {
  timestamp: number;
  type: 'training_plan' | 'staff_assignment' | 'staff_upgrade' | 'lineup' | 'substitution' | 'tactical_tweak';
  context: string;         // "Plantel cansado após 3 jogos"
  action: string;          // "Iniciei treino físico coletivo de 24h"
  reasoning: string;       // "Fadiga média do plantel está em 65%"
  managerApproved: boolean;
  outcome?: string;        // "Fadiga reduziu para 45% após treino"
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

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
  data: any; // tipo específico definido em coachActions.ts
}

export interface CoachSuggestion {
  type: 'training' | 'staff' | 'lineup' | 'tactics';
  title: string;
  description: string;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high';
  action?: () => void;  // ação executável se manager aprovar
}

// Contexto completo do time para o coach
export interface TeamContext {
  // Jogadores
  totalPlayers: number;
  injuredPlayers: number;
  suspendedPlayers: number;
  averageFatigue: number;
  averageInjuryRisk: number;
  averageOverall: number;

  // Staff
  staffLevels: Record<StaffRoleId, number>;
  staffSlotsAvailable: number;
  staffAssignedCount: number;

  // Treinos
  runningTrainingPlans: number;
  completedTrainingPlans: number;
  trainingCenterLevel: number;

  // Finanças
  availableExp: number;
  availableBro: number;

  // Próximo jogo
  nextMatch?: {
    opponent: string;
    isHome: boolean;
    daysUntil: number;
  };

  // Time do coração do manager (do cadastro)
  favoriteTeam?: string;
}
