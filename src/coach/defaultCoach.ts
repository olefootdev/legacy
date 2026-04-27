import { nanoid } from 'nanoid';
import type { CoachAgent, CoachPersonality } from './types';

/**
 * Cria o coach agent default que cada manager recebe.
 * Este coach começa "neutro" e desenvolve personalidade através das conversas com o manager.
 */
export function createDefaultCoachAgent(): CoachAgent {
  return {
    id: nanoid(),
    name: 'Assistente Técnico',
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
        playerAssignmentStrategy: 'Ainda não definida. Aguardando orientação do manager.',
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
      fisico: 'Melhora velocidade, físico e reduz fadiga. Ideal após jogos intensos.',
      mental: 'Aumenta mentalidade, confiança e fair play. Importante para jogadores jovens.',
      tatico: 'Desenvolve tático e posicionamento. Essencial para entender formações.',
      atributos: 'Treina passe, drible e finalização. Core técnico do jogador.',
      especial: 'Especialização ofensiva avançada. Para atacantes de elite.',
    },
    collective: {
      formacao: 'Melhora posicionamento coletivo e entendimento tático do grupo.',
      empatia: 'Aumenta fair play e coesão do time. Reduz cartões.',
      fisico: 'Condicionamento físico coletivo. Prepara o time para sequência de jogos.',
    },
    groups: {
      defensivo: 'Zagueiros e volantes. Foco em marcação e posicionamento.',
      criativo: 'Meio-campo. Foco em passes e criação.',
      ataque: 'Atacantes. Foco em finalização e movimentação.',
      all: 'Plantel completo. Usa para preparação pré-temporada ou integração.',
    },
    durationGuidelines: {
      short: '6-12h: Recuperação leve ou ajuste fino pré-jogo.',
      medium: '24-36h: Treino padrão entre jogos.',
      long: '48-72h: Desenvolvimento profundo, ideal em semanas sem jogos.',
    },
  },
  staff: {
    roles: {
      preparador_fisico: 'Acelera recuperação de fadiga e melhora ganhos de treino físico.',
      mental: 'Aumenta mentalidade e confiança. Crítico para jogadores jovens.',
      nutricao: 'Reduz fadiga e risco de lesão após partidas.',
      tatico: 'Melhora ganhos de treino tático e posicionamento.',
      treinador: 'Multiplica ganhos de TODOS os treinos. Prioridade máxima de upgrade.',
      olheiro: 'Aumenta recompensas EXP de scouting. Útil para economia.',
      preparador_goleiros: 'Buff específico para goleiros. Só atribua a GKs.',
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
    assignmentStrategy: `
      - Jogadores da academia (managerCreated) podem receber buff individual
      - Cada role tem limite de slots baseado no nível do Treinador
      - Priorize jogadores jovens (< 23 anos) para desenvolvimento
      - Goleiros DEVEM ter preparador_goleiros se disponível
      - Jogadores titulares devem ter preparador_fisico + nutricao
      - Jovens promissores: mental + tatico + preparador_fisico
    `,
  },
  structures: {
    training_center: 'Aumenta slots de treino e multiplica ganhos. Nível 4+ dá boost significativo.',
    medical_dept: 'Slots de tratamento e velocidade de recuperação de lesões.',
    stadium: 'Aumenta receita de jogos em casa. Não afeta treinos.',
    youth_academy: 'Multiplica ganhos de treino de prospects. Essencial para Developer.',
  },
};
