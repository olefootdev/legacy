import { nanoid } from 'nanoid';
import type { CoachAgent, CoachPersonality } from './types';
import { L } from '@/i18n/L';

/**
 * Cria o coach agent default que cada manager recebe.
 * Este coach começa "neutro" e desenvolve personalidade através das conversas com o manager.
 */
export function createDefaultCoachAgent(): CoachAgent {
  return {
    id: nanoid(),
    name: L('Assistente Técnico', 'Assistant Coach'),
    personality: 'Tactician', // começa equilibrado
    specialties: ['youth', 'fitness', 'mentality'], // foco em desenvolvimento

    // Stats iniciais balanceados (nível júnior)
    tactical: 12,
    motivation: 12,
    discipline: 11,
    attacking: 11,
    defending: 11,

    // Autonomia baixa no início (manager precisa aprovar tudo)
    autonomyLevel: 30,

    reputation: 50,

    memory: {
      managerInstructions: [],
      trainingKnowledge: {
        preferredIndividualTypes: [], // aprende com o manager
        preferredCollectiveTypes: [],
        preferredGroups: [],
        typicalDurationHours: 24, // padrão conservador
      },
      staffKnowledge: {
        priorityRoles: [], // aprende quais roles o manager valoriza
        playerAssignmentStrategy: L('Ainda não definida. Aguardando orientação do manager.', 'Not set yet. Waiting for the manager’s guidance.'),
      },
      decisionHistory: [],
    },

    conversationContext: [],
    pendingActions: [],
  };
}

/**
 * Personalidades pré-definidas que o manager pode escolher ou o coach pode evoluir para.
 */
export const COACH_PERSONALITIES: Record<CoachPersonality, {
  description: string;
  statWeights: Record<string, number>;
  specialties: string[];
  trainingPreferences: {
    individualTypes: string[];
    collectiveTypes: string[];
    durationHours: number;
  };
}> = {
  Pragmatic: {
    description: 'Foca em resultados, defesa sólida e disciplina tática. Estilo Mourinho.',
    statWeights: { defending: 1.3, discipline: 1.2, tactical: 1.1 },
    specialties: ['defense', 'mentality', 'setpieces'],
    trainingPreferences: {
      individualTypes: ['tatico', 'mental'],
      collectiveTypes: ['formacao', 'fisico'],
      durationHours: 36, // treinos mais longos
    },
  },
  Visionary: {
    description: 'Jogo de posse, padrões ofensivos e desenvolvimento. Estilo Guardiola.',
    statWeights: { tactical: 1.4, attacking: 1.2, motivation: 1.1 },
    specialties: ['attack', 'midfield', 'youth'],
    trainingPreferences: {
      individualTypes: ['tatico', 'atributos'],
      collectiveTypes: ['formacao', 'empatia'],
      durationHours: 48, // treinos detalhados
    },
  },
  Motivator: {
    description: 'Intensidade, pressing e energia do grupo. Estilo Klopp.',
    statWeights: { motivation: 1.5, discipline: 0.9, attacking: 1.2 },
    specialties: ['mentality', 'fitness', 'attack'],
    trainingPreferences: {
      individualTypes: ['fisico', 'mental'],
      collectiveTypes: ['fisico', 'empatia'],
      durationHours: 24, // treinos intensos mas curtos
    },
  },
  Tactician: {
    description: 'Adaptação tática e equilíbrio entre setores. Estilo Ancelotti.',
    statWeights: { tactical: 1.5, defending: 1.1, attacking: 1.1 },
    specialties: ['midfield', 'setpieces', 'defense'],
    trainingPreferences: {
      individualTypes: ['tatico', 'atributos'],
      collectiveTypes: ['formacao', 'fisico'],
      durationHours: 30,
    },
  },
  Developer: {
    description: 'Desenvolvimento de jovens e construção de longo prazo.',
    statWeights: { motivation: 1.2, tactical: 1.1, discipline: 1.0 },
    specialties: ['youth', 'fitness', 'mentality'],
    trainingPreferences: {
      individualTypes: ['atributos', 'especial', 'mental'],
      collectiveTypes: ['empatia', 'formacao'],
      durationHours: 48, // desenvolvimento leva tempo
    },
  },
};

/**
 * Sistema de conhecimento do coach sobre o Olefoot.
 * Este é o "manual" que o coach conhece sobre todos os sistemas disponíveis.
 */
export const COACH_SYSTEM_KNOWLEDGE = {
  training: {
    individual: {
      fisico: L('Melhora velocidade, físico e reduz fadiga. Ideal após jogos intensos.', 'Improves pace and physical, reduces fatigue. Ideal after intense games.'),
      mental: L('Aumenta mentalidade, confiança e fair play. Importante para jogadores jovens.', 'Boosts mentality, confidence and fair play. Important for young players.'),
      tatico: L('Desenvolve tático e posicionamento. Essencial para entender formações.', 'Develops tactics and positioning. Essential for understanding formations.'),
      atributos: L('Treina passe, drible e finalização. Core técnico do jogador.', 'Trains passing, dribbling and finishing. The player’s technical core.'),
      especial: L('Especialização ofensiva avançada. Para atacantes de elite.', 'Advanced attacking specialisation. For elite forwards.'),
    },
    collective: {
      formacao: L('Melhora posicionamento coletivo e entendimento tático do grupo.', 'Improves team positioning and the group’s tactical understanding.'),
      empatia: L('Aumenta fair play e coesão do time. Reduz cartões.', 'Boosts fair play and team cohesion. Fewer cards.'),
      fisico: L('Condicionamento físico coletivo. Prepara o time para sequência de jogos.', 'Team conditioning. Prepares the squad for a run of games.'),
    },
    groups: {
      defensivo: L('Zagueiros e volantes. Foco em marcação e posicionamento.', 'Centre-backs and defensive mids. Focus on marking and positioning.'),
      criativo: L('Meio-campo. Foco em passes e criação.', 'Midfield. Focus on passing and creativity.'),
      ataque: L('Atacantes. Foco em finalização e movimentação.', 'Forwards. Focus on finishing and movement.'),
      all: L('Plantel completo. Usa para preparação pré-temporada ou integração.', 'Full squad. Use for pre-season or integration.'),
    },
    durationGuidelines: {
      short: L('6-12h: Recuperação leve ou ajuste fino pré-jogo.', '6-12h: Light recovery or pre-match fine-tuning.'),
      medium: L('24-36h: Treino padrão entre jogos.', '24-36h: Standard training between games.'),
      long: L('48-72h: Desenvolvimento profundo, ideal em semanas sem jogos.', '48-72h: Deep development, ideal in weeks without games.'),
    },
  },
  staff: {
    roles: {
      preparador_fisico: L('Acelera recuperação de fadiga e melhora ganhos de treino físico.', 'Speeds up fatigue recovery and improves physical training gains.'),
      mental: L('Aumenta mentalidade e confiança. Crítico para jogadores jovens.', 'Boosts mentality and confidence. Critical for young players.'),
      nutricao: L('Reduz fadiga e risco de lesão após partidas.', 'Reduces fatigue and injury risk after matches.'),
      tatico: L('Melhora ganhos de treino tático e posicionamento.', 'Improves tactical training gains and positioning.'),
      treinador: L('Multiplica ganhos de TODOS os treinos. Prioridade máxima de upgrade.', 'Multiplies gains from ALL training. Top upgrade priority.'),
      olheiro: L('Aumenta recompensas EXP de scouting. Útil para economia.', 'Increases scouting EXP rewards. Useful for the economy.'),
      preparador_goleiros: L('Buff específico para goleiros. Só atribua a GKs.', 'Goalkeeper-specific buff. Assign to GKs only.'),
    },
    upgradePriority: [
      'treinador', // sempre primeiro (multiplica tudo)
      'preparador_fisico', // fadiga é crítica
      'nutricao', // prevenção de lesões
      'tatico', // desenvolvimento tático
      'mental', // confiança e mentalidade
      'olheiro', // economia
      'preparador_goleiros', // nicho
    ],
    assignmentStrategy: L(`
      - Jogadores da academia (managerCreated) podem receber buff individual
      - Cada role tem limite de slots baseado no nível do Treinador
      - Priorize jogadores jovens (< 23 anos) para desenvolvimento
      - Goleiros DEVEM ter preparador_goleiros se disponível
      - Jogadores titulares devem ter preparador_fisico + nutricao
      - Jovens promissores: mental + tatico + preparador_fisico
    `, `
      - Academy players (managerCreated) can receive individual buffs
      - Each role has a slot limit based on the Head Coach level
      - Prioritise young players (< 23) for development
      - Goalkeepers MUST have preparador_goleiros if available
      - Starters should have preparador_fisico + nutricao
      - Promising youngsters: mental + tatico + preparador_fisico
    `),
  },
  structures: {
    training_center: L('Aumenta slots de treino e multiplica ganhos. Nível 4+ dá boost significativo.', 'More training slots and multiplied gains. Level 4+ gives a significant boost.'),
    medical_dept: L('Slots de tratamento e velocidade de recuperação de lesões.', 'Treatment slots and injury recovery speed.'),
    stadium: L('Aumenta receita de jogos em casa. Não afeta treinos.', 'Increases home match revenue. Does not affect training.'),
    youth_academy: L('Multiplica ganhos de treino de prospects. Essencial para Developer.', 'Multiplies prospects’ training gains. Essential for Developer.'),
  },
};
