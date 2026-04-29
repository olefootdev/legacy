import type { CoachAgent, TeamContext, ManagerInstruction, ConversationMessage } from './types';
import type { OlefootGameState } from '@/game/types';
import { COACH_SYSTEM_KNOWLEDGE } from './defaultCoach';
import { chatWithCoach } from './coachApi';
import { overallFromAttributes } from '@/entities/player';

/**
 * Engine de conversação do Coach Agent.
 * Processa mensagens do manager e gera respostas via Claude Haiku.
 */
export class CoachConversationEngine {
  constructor(
    private coach: CoachAgent,
    private gameState: OlefootGameState,
  ) {}

  /**
   * Processa mensagem do manager e retorna resposta do coach via LLM.
   */
  async chat(userMessage: string): Promise<string> {
    const teamContext = this.buildTeamContext();

    // Chama backend com Claude Haiku
    const response = await chatWithCoach(
      this.coach,
      teamContext,
      userMessage,
      this.coach.conversationContext.map(m => ({
        role: m.role,
        content: m.content,
      }))
    );

    if (!response.ok) {
      // Fallback para heurística se API falhar
      return this.chatFallback(userMessage);
    }

    const assistantMessage = response.response || '';

    // Se o LLM detectou uma instrução, salva na memória
    if (response.instruction) {
      this.coach.memory.managerInstructions.push(response.instruction);
      this.learnFromInstruction(response.instruction);
    }

    return assistantMessage;
  }

  /**
   * Fallback heurístico caso API falhe.
   */
  private chatFallback(userMessage: string): string {
    const intent = this.detectIntent(userMessage);

    let response = '';
    switch (intent.type) {
      case 'greeting':
        response = this.handleGreeting();
        break;
      case 'training_question':
        response = this.handleTrainingQuestion(userMessage, intent.subtype);
        break;
      case 'staff_question':
        response = this.handleStaffQuestion(userMessage, intent.subtype);
        break;
      case 'training_suggestion':
        response = this.suggestTrainingPlan();
        break;
      case 'staff_suggestion':
        response = this.suggestStaffActions();
        break;
      case 'team_analysis':
        response = this.analyzeTeamStatus();
        break;
      case 'instruction':
        response = this.handleInstructionFallback(userMessage, intent.category);
        break;
      default:
        response = this.handleGeneral(userMessage);
    }

    return response;
  }

  private detectIntent(message: string): {
    type: string;
    subtype?: string;
    category?: string;
  } {
    const lower = message.toLowerCase();

    // Saudações
    if (/^(oi|olá|hey|bom dia|boa tarde|boa noite)/.test(lower)) {
      return { type: 'greeting' };
    }

    // Instruções (manager ensinando o coach)
    if (
      /sempre|nunca|prefiro|quero que|não gosto|lembre|importante|priorize/.test(lower)
    ) {
      let category = 'general';
      if (/treino|training/.test(lower)) category = 'training';
      if (/staff|profission/.test(lower)) category = 'staff';
      if (/escalação|lineup|formação/.test(lower)) category = 'lineup';
      return { type: 'instruction', category };
    }

    // Perguntas sobre treino
    if (/treino|training|treinar/.test(lower)) {
      let subtype = 'general';
      if (/individual/.test(lower)) subtype = 'individual';
      if (/coletivo|colectivo/.test(lower)) subtype = 'collective';
      if (/quanto tempo|duração|horas/.test(lower)) subtype = 'duration';
      if (/tipo|qual/.test(lower)) subtype = 'type';
      return { type: 'training_question', subtype };
    }

    // Perguntas sobre staff
    if (/staff|profission|preparador|treinador/.test(lower)) {
      let subtype = 'general';
      if (/upgrade|evoluir|melhorar/.test(lower)) subtype = 'upgrade';
      if (/atribuir|assign|distribuir/.test(lower)) subtype = 'assignment';
      if (/prioridade/.test(lower)) subtype = 'priority';
      return { type: 'staff_question', subtype };
    }

    // Pedidos de sugestão
    if (/sugere|sugestão|recomenda|o que|devo/.test(lower)) {
      if (/treino/.test(lower)) return { type: 'training_suggestion' };
      if (/staff/.test(lower)) return { type: 'staff_suggestion' };
      return { type: 'team_analysis' };
    }

    // Análise do time
    if (/analise|análise|status|situação|como está/.test(lower)) {
      return { type: 'team_analysis' };
    }

    return { type: 'general' };
  }

  private handleGreeting(): string {
    const greetings = [
      `Olá, manager! Sou o ${this.coach.name}. Como posso ajudar com o time hoje?`,
      `Bom dia! Pronto para trabalhar. O que precisas?`,
      `Olá! Vamos preparar o time?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }

  private handleTrainingQuestion(message: string, subtype?: string): string {
    const context = this.buildTeamContext();

    if (subtype === 'individual') {
      return `**Treinos Individuais disponíveis:**

${Object.entries(COACH_SYSTEM_KNOWLEDGE.training.individual)
  .map(([type, desc]) => `• **${type}**: ${desc}`)
  .join('\n')}

Atualmente tens ${context.runningTrainingPlans} treinos em execução.
Centro de Treino nível ${context.trainingCenterLevel} permite até ${this.getMaxTrainingSlots()} jogadores por sessão.`;
    }

    if (subtype === 'collective') {
      return `**Treinos Coletivos disponíveis:**

${Object.entries(COACH_SYSTEM_KNOWLEDGE.training.collective)
  .map(([type, desc]) => `• **${type}**: ${desc}`)
  .join('\n')}

**Grupos:**
${Object.entries(COACH_SYSTEM_KNOWLEDGE.training.groups)
  .map(([group, desc]) => `• **${group}**: ${desc}`)
  .join('\n')}

Fadiga média do plantel: ${Math.round(context.averageFatigue)}%`;
    }

    if (subtype === 'duration') {
      return `**Orientação de duração de treinos:**

${Object.entries(COACH_SYSTEM_KNOWLEDGE.training.durationGuidelines)
  .map(([key, desc]) => `• ${desc}`)
  .join('\n')}

${context.nextMatch ? `Próximo jogo em ${context.nextMatch.daysUntil} dias. Recomendo treinos de ${context.nextMatch.daysUntil < 2 ? '6-12h' : '24-36h'}.` : 'Sem jogos agendados. Podes fazer treinos longos (48-72h) para desenvolvimento.'}`;
    }

    return `Sobre treinos: temos ${context.totalPlayers} jogadores disponíveis (${context.injuredPlayers} lesionados).
Fadiga média: ${Math.round(context.averageFatigue)}%.

Posso sugerir um plano de treino específico se quiseres. Basta pedir "sugere um treino".`;
  }

  private handleStaffQuestion(message: string, subtype?: string): string {
    const context = this.buildTeamContext();

    if (subtype === 'upgrade') {
      const priorities = COACH_SYSTEM_KNOWLEDGE.staff.upgradePriority;
      return `**Prioridade de upgrade de Staff:**

${priorities
  .map((role, i) => {
    const level = context.staffLevels[role as keyof typeof context.staffLevels] ?? 1;
    const desc = COACH_SYSTEM_KNOWLEDGE.staff.roles[role as keyof typeof COACH_SYSTEM_KNOWLEDGE.staff.roles];
    return `${i + 1}. **${role}** (nível ${level}): ${desc}`;
  })
  .join('\n\n')}

Tens ${Math.round(context.availableExp).toLocaleString('pt-BR')} EXP e ${(context.availableBro / 100).toFixed(2)} BRO disponíveis.`;
    }

    if (subtype === 'assignment') {
      return `**Estratégia de atribuição de Staff:**

${COACH_SYSTEM_KNOWLEDGE.staff.assignmentStrategy}

Atualmente tens ${context.staffAssignedCount} atribuições ativas.
Slots disponíveis por role: ${context.staffSlotsAvailable}`;
    }

    if (subtype === 'priority') {
      const topPriority = COACH_SYSTEM_KNOWLEDGE.staff.upgradePriority[0];
      const level = context.staffLevels[topPriority as keyof typeof context.staffLevels] ?? 1;
      return `A prioridade máxima é sempre **${topPriority}** (atualmente nível ${level}).

Porquê? ${COACH_SYSTEM_KNOWLEDGE.staff.roles[topPriority as keyof typeof COACH_SYSTEM_KNOWLEDGE.staff.roles]}

Depois disso: preparador físico, nutrição, tático, mental, olheiro, preparador de goleiros (nessa ordem).`;
    }

    return `Sobre staff: tens ${Object.keys(context.staffLevels).length} profissionais contratados.

Posso explicar prioridades de upgrade, estratégia de atribuição ou analisar teu staff atual. O que preferes?`;
  }

  private suggestTrainingPlan(): string {
    const context = this.buildTeamContext();
    const personality = this.coach.personality;

    // Análise da situação
    const highFatigue = context.averageFatigue > 60;
    const lowFatigue = context.averageFatigue < 30;
    const hasNextMatch = context.nextMatch && context.nextMatch.daysUntil <= 3;

    let suggestion = '**Sugestão de Treino:**\n\n';

    if (highFatigue) {
      suggestion += `⚠️ Fadiga média alta (${Math.round(context.averageFatigue)}%). Recomendo:\n`;
      suggestion += `• Treino **físico individual** de 12-24h para recuperação\n`;
      suggestion += `• Ou treino **coletivo físico** leve (6-12h) para todo o plantel\n`;
      suggestion += `• Evitar treinos intensos até fadiga baixar para <50%\n`;
    } else if (hasNextMatch) {
      suggestion += `🎯 Jogo contra ${context.nextMatch!.opponent} em ${context.nextMatch!.daysUntil} dias.\n`;
      suggestion += `• Treino **tático coletivo** de 24h (grupo: all)\n`;
      suggestion += `• Foco em **formação** para ajustar posicionamento\n`;
      suggestion += `• Treino **mental individual** para titulares (confiança)\n`;
    } else if (lowFatigue) {
      suggestion += `✅ Plantel descansado (fadiga ${Math.round(context.averageFatigue)}%). Momento ideal para desenvolvimento:\n`;
      if (personality === 'Developer' || personality === 'Visionary') {
        suggestion += `• Treino **atributos individual** de 48h (passe, drible, finalização)\n`;
        suggestion += `• Treino **coletivo formação** de 36h (grupo: all)\n`;
        suggestion += `• Foco em jogadores jovens (<23 anos)\n`;
      } else if (personality === 'Pragmatic') {
        suggestion += `• Treino **tático individual** de 36h\n`;
        suggestion += `• Treino **coletivo formação** de 24h (grupo: defensivo)\n`;
        suggestion += `• Reforçar disciplina tática\n`;
      } else {
        suggestion += `• Treino **atributos individual** de 36h\n`;
        suggestion += `• Treino **coletivo empatia** de 24h (coesão do grupo)\n`;
      }
    } else {
      suggestion += `📊 Situação normal. Sugestão balanceada:\n`;
      suggestion += `• Treino **tático individual** de 24h (2-3 jogadores)\n`;
      suggestion += `• Treino **coletivo formação** de 24h (grupo: criativo)\n`;
    }

    suggestion += `\n💡 Centro de Treino nível ${context.trainingCenterLevel} dá boost de ganhos.`;

    return suggestion;
  }

  private suggestStaffActions(): string {
    const context = this.buildTeamContext();
    const suggestions: string[] = [];

    // Analisa cada role
    const treinadorLevel = context.staffLevels.treinador ?? 1;
    if (treinadorLevel < 3 && context.availableExp >= 3_500_000) {
      suggestions.push(
        `🔥 **PRIORIDADE MÁXIMA**: Upgrade Treinador para nível ${treinadorLevel + 1} (${treinadorLevel === 1 ? '3.5M' : '9M'} EXP). Multiplica TODOS os ganhos de treino.`,
      );
    }

    const prepFisicoLevel = context.staffLevels.preparador_fisico ?? 1;
    if (prepFisicoLevel < 3 && context.averageFatigue > 50) {
      suggestions.push(
        `⚡ Plantel cansado. Upgrade Preparador Físico para acelerar recuperação.`,
      );
    }

    const nutricaoLevel = context.staffLevels.nutricao ?? 1;
    if (nutricaoLevel < 2 && context.averageInjuryRisk > 30) {
      suggestions.push(
        `🏥 Risco de lesão elevado. Upgrade Nutrição para prevenção.`,
      );
    }

    if (context.staffAssignedCount === 0) {
      suggestions.push(
        `👥 Nenhum staff atribuído a jogadores. Vai em /team/staff para ativar buffs individuais nos jogadores da academia.`,
      );
    }

    if (suggestions.length === 0) {
      return `✅ Staff está bem configurado no momento. Continue monitorando após jogos e treinos.

Níveis atuais:
${Object.entries(context.staffLevels)
  .map(([role, level]) => `• ${role}: nível ${level}`)
  .join('\n')}`;
    }

    return `**Sugestões de Staff:**\n\n${suggestions.join('\n\n')}`;
  }

  private analyzeTeamStatus(): string {
    const context = this.buildTeamContext();

    return `**Análise do Plantel:**

📊 **Jogadores:**
• Total: ${context.totalPlayers}
• Lesionados: ${context.injuredPlayers}
• Suspensos: ${context.suspendedPlayers}
• Overall médio: ${Math.round(context.averageOverall)}

⚡ **Condição Física:**
• Fadiga média: ${Math.round(context.averageFatigue)}% ${context.averageFatigue > 60 ? '⚠️ ALTA' : context.averageFatigue < 30 ? '✅ ÓTIMA' : ''}
• Risco de lesão: ${Math.round(context.averageInjuryRisk)}% ${context.averageInjuryRisk > 40 ? '⚠️ ELEVADO' : ''}

🏋️ **Treinos:**
• Em execução: ${context.runningTrainingPlans}
• Concluídos: ${context.completedTrainingPlans}
• Centro de Treino: nível ${context.trainingCenterLevel}

👥 **Staff:**
• Treinador: nível ${context.staffLevels.treinador ?? 1}
• Atribuições ativas: ${context.staffAssignedCount}

${context.nextMatch ? `⚽ **Próximo jogo:** ${context.nextMatch.opponent} (${context.nextMatch.isHome ? 'Casa' : 'Fora'}) em ${context.nextMatch.daysUntil} dias` : ''}

${this.getQuickRecommendation(context)}`;
  }

  private getQuickRecommendation(context: TeamContext): string {
    if (context.averageFatigue > 65) {
      return `\n💡 **Recomendação:** Plantel muito cansado. Priorize recuperação (treino físico leve ou descanso).`;
    }
    if (context.injuredPlayers > 3) {
      return `\n💡 **Recomendação:** Muitos lesionados. Considere upgrade do Departamento Médico.`;
    }
    if (context.staffLevels.treinador < 3) {
      return `\n💡 **Recomendação:** Upgrade do Treinador multiplica ganhos de treino. Prioridade máxima.`;
    }
    if (context.nextMatch && context.nextMatch.daysUntil <= 2) {
      return `\n💡 **Recomendação:** Jogo próximo. Treino tático leve (12-24h) para ajustar formação.`;
    }
    return `\n💡 **Recomendação:** Situação estável. Bom momento para treinos de desenvolvimento (36-48h).`;
  }

  private handleInstructionFallback(
    message: string,
    category: string,
  ): string {
    const instruction: ManagerInstruction = {
      timestamp: Date.now(),
      instruction: message,
      context: 'Conversa com o manager',
      priority: this.detectPriority(message),
      active: true,
      category: category as ManagerInstruction['category'],
    };

    this.coach.memory.managerInstructions.push(instruction);
    this.learnFromInstruction(instruction);

    return `✅ Entendido e memorizado: "${message}"

Vou aplicar essa orientação nas minhas sugestões futuras. Podes desativar ou modificar isso a qualquer momento.

${this.coach.memory.managerInstructions.length} instruções ativas no total.`;
  }

  private detectPriority(message: string): 'high' | 'medium' | 'low' {
    const lower = message.toLowerCase();
    if (/sempre|nunca|crítico|essencial|obrigatório/.test(lower)) return 'high';
    if (/prefiro|importante|priorize/.test(lower)) return 'medium';
    return 'low';
  }

  private learnFromInstruction(instruction: ManagerInstruction): void {
    const lower = instruction.instruction.toLowerCase();

    // Aprende preferências de treino
    if (instruction.category === 'training') {
      if (/individual/.test(lower)) {
        // Extrai tipos mencionados
        if (/físico|fisico/.test(lower))
          this.coach.memory.trainingKnowledge.preferredIndividualTypes.push('fisico');
        if (/mental/.test(lower))
          this.coach.memory.trainingKnowledge.preferredIndividualTypes.push('mental');
        if (/tático|tatico/.test(lower))
          this.coach.memory.trainingKnowledge.preferredIndividualTypes.push('tatico');
      }

      // Aprende duração preferida
      const durationMatch = lower.match(/(\d+)\s*h/);
      if (durationMatch) {
        this.coach.memory.trainingKnowledge.typicalDurationHours = parseInt(
          durationMatch[1]!,
          10,
        );
      }
    }

    // Aprende preferências de staff
    if (instruction.category === 'staff') {
      // Extrai roles mencionadas
      const roles = [
        'preparador_fisico',
        'mental',
        'nutricao',
        'tatico',
        'treinador',
        'olheiro',
        'preparador_goleiros',
      ];
      for (const role of roles) {
        if (lower.includes(role.replace('_', ' '))) {
          if (!this.coach.memory.staffKnowledge.priorityRoles.includes(role as any)) {
            this.coach.memory.staffKnowledge.priorityRoles.push(role as any);
          }
        }
      }
    }
  }

  private handleGeneral(message: string): string {
    return `Entendi. Posso ajudar com:

• **Treinos**: sugestões, tipos, duração
• **Staff**: upgrades, atribuições, prioridades
• **Análise**: status do plantel, condição física
• **Aprendizado**: ensina-me tuas preferências (ex: "sempre priorize treino tático")

O que precisas?`;
  }

  /**
   * Constrói o contexto do time (público para uso externo)
   */
  public buildTeamContext(): TeamContext {
    const players = Object.values(this.gameState.players);
    const health = this.gameState.playerHealth;
    const healthOf = (p: typeof players[number]) =>
      health?.[p.id] ?? null;

    const isAvailable = (p: typeof players[number]) => {
      const h = healthOf(p);
      if (h) return h.outForMatches <= 0 && h.suspendedMatches <= 0;
      return p.outForMatches <= 0;
    };
    const fatigueOf = (p: typeof players[number]) => healthOf(p)?.fatigue ?? p.fatigue;
    const injuryRiskOf = (p: typeof players[number]) => healthOf(p)?.injuryRisk ?? p.injuryRisk;
    const isInjured = (p: typeof players[number]) => {
      const h = healthOf(p);
      if (h) return h.outForMatches > 0 && !!h.injurySeverity;
      return p.outForMatches > 0;
    };
    const isSuspended = (p: typeof players[number]) => (healthOf(p)?.suspendedMatches ?? 0) > 0;

    const availablePlayers = players.filter(isAvailable);

    const totalFatigue = availablePlayers.reduce((sum, p) => sum + fatigueOf(p), 0);
    const totalInjuryRisk = availablePlayers.reduce((sum, p) => sum + injuryRiskOf(p), 0);
    const totalOverall = availablePlayers.reduce(
      (sum, p) => sum + overallFromAttributes(p.attrs),
      0,
    );

    const staffAssignedCount = Object.keys(
      this.gameState.manager.staff.assignedByPlayer ?? {},
    ).length;

    return {
      totalPlayers: availablePlayers.length,
      injuredPlayers: players.filter(isInjured).length,
      suspendedPlayers: players.filter(isSuspended).length,
      averageFatigue:
        availablePlayers.length > 0 ? totalFatigue / availablePlayers.length : 0,
      averageInjuryRisk:
        availablePlayers.length > 0
          ? totalInjuryRisk / availablePlayers.length
          : 0,
      averageOverall:
        availablePlayers.length > 0 ? totalOverall / availablePlayers.length : 0,

      staffLevels: this.gameState.manager.staff.roles,
      staffSlotsAvailable: this.getMaxTrainingSlots(),
      staffAssignedCount,

      runningTrainingPlans: this.gameState.manager.trainingPlans.filter(
        (p) => p.status === 'running',
      ).length,
      completedTrainingPlans: this.gameState.manager.trainingPlans.filter(
        (p) => p.status === 'completed',
      ).length,
      trainingCenterLevel: this.gameState.structures.training_center ?? 1,

      availableExp: this.gameState.finance.ole,
      availableBro: this.gameState.finance.broCents,

      nextMatch: this.getNextMatch(),
    };
  }

  private getMaxTrainingSlots(): number {
    const treinadorLevel = this.gameState.manager.staff.roles.treinador ?? 1;
    if (treinadorLevel >= 3) return 5;
    if (treinadorLevel >= 2) return 3;
    return 1;
  }

  private getNextMatch(): TeamContext['nextMatch'] | undefined {
    // Pega fixtures de todas as ligas
    const allFixtures: any[] = [];
    const leagueSchedule = this.gameState.leagueSchedule?.byLeagueId ?? {};

    for (const bucket of Object.values(leagueSchedule)) {
      if (bucket.fixtures) {
        allFixtures.push(...bucket.fixtures.filter((f: any) => f.status === 'scheduled'));
      }
    }

    if (allFixtures.length === 0) return undefined;

    // Ordena por data mais próxima
    allFixtures.sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());

    const next = allFixtures[0];
    if (!next) return undefined;

    const now = Date.now();
    const matchDate = new Date(next.dateIso).getTime();
    const daysUntil = Math.ceil((matchDate - now) / (1000 * 60 * 60 * 24));

    // Verifica se o clube do manager é home ou away
    const clubId = this.gameState.club.id;
    const isHome = next.homeTeamId === clubId;
    const opponent = isHome ? next.awayName : next.homeName;

    return {
      opponent,
      isHome,
      daysUntil: Math.max(0, daysUntil),
    };
  }
}
