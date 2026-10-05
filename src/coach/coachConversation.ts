import type { CoachAgent, TeamContext, ManagerInstruction, ConversationMessage } from './types';
import type { OlefootGameState } from '@/game/types';
import { COACH_SYSTEM_KNOWLEDGE } from './defaultCoach';
import { chatWithCoach } from './coachApi';
import { overallFromAttributes } from '@/entities/player';
import { L, LOCALE, emIngles } from '@/i18n/L';

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
    if (/^(oi|olá|hey|bom dia|boa tarde|boa noite|hi|hello|good morning|good afternoon|good evening)/.test(lower)) {
      return { type: 'greeting' };
    }

    // Instruções (manager ensinando o coach)
    if (
      /sempre|nunca|prefiro|quero que|não gosto|lembre|importante|priorize|always|never|i prefer|i want you|i don't like|remember|important|prioriti[sz]e/.test(lower)
    ) {
      let category = 'general';
      if (/treino|training/.test(lower)) category = 'training';
      if (/staff|profission/.test(lower)) category = 'staff';
      if (/escalação|lineup|formação|formation/.test(lower)) category = 'lineup';
      return { type: 'instruction', category };
    }

    // Perguntas sobre treino
    if (/treino|training|treinar|train/.test(lower)) {
      let subtype = 'general';
      if (/individual/.test(lower)) subtype = 'individual';
      if (/coletivo|colectivo|collective|team training/.test(lower)) subtype = 'collective';
      if (/quanto tempo|duração|horas|how long|duration|hours/.test(lower)) subtype = 'duration';
      if (/tipo|qual|type|which/.test(lower)) subtype = 'type';
      return { type: 'training_question', subtype };
    }

    // Perguntas sobre staff
    if (/staff|profission|preparador|treinador|coach/.test(lower)) {
      let subtype = 'general';
      if (/upgrade|evoluir|melhorar|improve/.test(lower)) subtype = 'upgrade';
      if (/atribuir|assign|distribuir/.test(lower)) subtype = 'assignment';
      if (/prioridade|priority/.test(lower)) subtype = 'priority';
      return { type: 'staff_question', subtype };
    }

    // Pedidos de sugestão
    if (/sugere|sugestão|recomenda|o que|devo|suggest|recommend|what should|should i/.test(lower)) {
      if (/treino|train/.test(lower)) return { type: 'training_suggestion' };
      if (/staff/.test(lower)) return { type: 'staff_suggestion' };
      return { type: 'team_analysis' };
    }

    // Análise do time
    if (/analise|análise|status|situação|como está|analy[sz]e|analysis|how is/.test(lower)) {
      return { type: 'team_analysis' };
    }

    return { type: 'general' };
  }

  private handleGreeting(): string {
    const greetings = [
      L(`Olá, manager! Sou o ${this.coach.name}. Como posso ajudar com o time hoje?`, `Hi, manager! I'm ${this.coach.name}. How can I help with the team today?`),
      L(`Bom dia! Pronto para trabalhar. O que precisas?`, `Good morning! Ready to work. What do you need?`),
      L(`Olá! Vamos preparar o time?`, `Hi! Shall we get the team ready?`),
    ];
    return greetings[Math.floor(Math.random() * greetings.length)]!;
  }

  private handleTrainingQuestion(message: string, subtype?: string): string {
    const context = this.buildTeamContext();

    if (subtype === 'individual') {
      const lista = Object.entries(COACH_SYSTEM_KNOWLEDGE.training.individual)
  .map(([type, desc]) => `• **${type}**: ${desc}`)
  .join('\n');
      return L(`**Treinos Individuais disponíveis:**

${lista}

Atualmente tens ${context.runningTrainingPlans} treinos em execução.
Centro de Treino nível ${context.trainingCenterLevel} permite até ${this.getMaxTrainingSlots()} jogadores por sessão.`, `**Available individual training:**

${lista}

You currently have ${context.runningTrainingPlans} training sessions running.
Training Centre level ${context.trainingCenterLevel} allows up to ${this.getMaxTrainingSlots()} players per session.`);
    }

    if (subtype === 'collective') {
      const tipos = Object.entries(COACH_SYSTEM_KNOWLEDGE.training.collective)
  .map(([type, desc]) => `• **${type}**: ${desc}`)
  .join('\n');
      const grupos = Object.entries(COACH_SYSTEM_KNOWLEDGE.training.groups)
  .map(([group, desc]) => `• **${group}**: ${desc}`)
  .join('\n');
      return L(`**Treinos Coletivos disponíveis:**

${tipos}

**Grupos:**
${grupos}

Fadiga média do plantel: ${Math.round(context.averageFatigue)}%`, `**Available team training:**

${tipos}

**Groups:**
${grupos}

Squad average fatigue: ${Math.round(context.averageFatigue)}%`);
    }

    if (subtype === 'duration') {
      const guia = Object.entries(COACH_SYSTEM_KNOWLEDGE.training.durationGuidelines)
  .map(([key, desc]) => `• ${desc}`)
  .join('\n');
      const horas = context.nextMatch && context.nextMatch.daysUntil < 2 ? '6-12h' : '24-36h';
      return L(`**Orientação de duração de treinos:**

${guia}

${context.nextMatch ? `Próximo jogo em ${context.nextMatch.daysUntil} dias. Recomendo treinos de ${horas}.` : 'Sem jogos agendados. Podes fazer treinos longos (48-72h) para desenvolvimento.'}`, `**Training duration guide:**

${guia}

${context.nextMatch ? `Next game in ${context.nextMatch.daysUntil} days. I recommend ${horas} sessions.` : 'No games scheduled. You can run long sessions (48-72h) for development.'}`);
    }

    return L(`Sobre treinos: temos ${context.totalPlayers} jogadores disponíveis (${context.injuredPlayers} lesionados).
Fadiga média: ${Math.round(context.averageFatigue)}%.

Posso sugerir um plano de treino específico se quiseres. Basta pedir "sugere um treino".`, `On training: we have ${context.totalPlayers} players available (${context.injuredPlayers} injured).
Average fatigue: ${Math.round(context.averageFatigue)}%.

I can suggest a specific training plan if you like. Just ask "suggest a training session".`);
  }

  private handleStaffQuestion(message: string, subtype?: string): string {
    const context = this.buildTeamContext();

    if (subtype === 'upgrade') {
      const priorities = COACH_SYSTEM_KNOWLEDGE.staff.upgradePriority;
      const lista = priorities
  .map((role, i) => {
    const level = context.staffLevels[role as keyof typeof context.staffLevels] ?? 1;
    const desc = COACH_SYSTEM_KNOWLEDGE.staff.roles[role as keyof typeof COACH_SYSTEM_KNOWLEDGE.staff.roles];
    return L(`${i + 1}. **${role}** (nível ${level}): ${desc}`, `${i + 1}. **${role}** (level ${level}): ${desc}`);
  })
  .join('\n\n');
      const exp = Math.round(context.availableExp).toLocaleString(LOCALE);
      const bro = (context.availableBro / 100).toFixed(2);
      return L(`**Prioridade de upgrade de Staff:**

${lista}

Tens ${exp} EXP e ${bro} BRO disponíveis.`, `**Staff upgrade priority:**

${lista}

You have ${exp} EXP and ${bro} BRO available.`);
    }

    if (subtype === 'assignment') {
      return L(`**Estratégia de atribuição de Staff:**

${COACH_SYSTEM_KNOWLEDGE.staff.assignmentStrategy}

Atualmente tens ${context.staffAssignedCount} atribuições ativas.
Slots disponíveis por role: ${context.staffSlotsAvailable}`, `**Staff assignment strategy:**

${COACH_SYSTEM_KNOWLEDGE.staff.assignmentStrategy}

You currently have ${context.staffAssignedCount} active assignments.
Slots available per role: ${context.staffSlotsAvailable}`);
    }

    if (subtype === 'priority') {
      const topPriority = COACH_SYSTEM_KNOWLEDGE.staff.upgradePriority[0];
      const level = context.staffLevels[topPriority as keyof typeof context.staffLevels] ?? 1;
      const porque = COACH_SYSTEM_KNOWLEDGE.staff.roles[topPriority as keyof typeof COACH_SYSTEM_KNOWLEDGE.staff.roles];
      return L(`A prioridade máxima é sempre **${topPriority}** (atualmente nível ${level}).

Porquê? ${porque}

Depois disso: preparador físico, nutrição, tático, mental, olheiro, preparador de goleiros (nessa ordem).`, `Top priority is always **${topPriority}** (currently level ${level}).

Why? ${porque}

After that: fitness coach, nutrition, tactics, mental, scout, goalkeeping coach (in that order).`);
    }

    return L(`Sobre staff: tens ${Object.keys(context.staffLevels).length} profissionais contratados.

Posso explicar prioridades de upgrade, estratégia de atribuição ou analisar teu staff atual. O que preferes?`, `On staff: you have ${Object.keys(context.staffLevels).length} professionals hired.

I can explain upgrade priorities, assignment strategy or analyse your current staff. What would you like?`);
  }

  private suggestTrainingPlan(): string {
    const context = this.buildTeamContext();
    const personality = this.coach.personality;

    // Análise da situação
    const highFatigue = context.averageFatigue > 60;
    const lowFatigue = context.averageFatigue < 30;
    const hasNextMatch = context.nextMatch && context.nextMatch.daysUntil <= 3;

    let suggestion = L('**Sugestão de Treino:**\n\n', '**Training Suggestion:**\n\n');

    if (highFatigue) {
      suggestion += L(`⚠️ Fadiga média alta (${Math.round(context.averageFatigue)}%). Recomendo:\n`, `⚠️ High average fatigue (${Math.round(context.averageFatigue)}%). I recommend:\n`);
      suggestion += L(`• Treino **físico individual** de 12-24h para recuperação\n`, `• **Individual physical** training of 12-24h for recovery\n`);
      suggestion += L(`• Ou treino **coletivo físico** leve (6-12h) para todo o plantel\n`, `• Or light **team physical** training (6-12h) for the whole squad\n`);
      suggestion += L(`• Evitar treinos intensos até fadiga baixar para <50%\n`, `• Avoid intense sessions until fatigue drops below 50%\n`);
    } else if (hasNextMatch) {
      suggestion += L(`🎯 Jogo contra ${context.nextMatch!.opponent} em ${context.nextMatch!.daysUntil} dias.\n`, `🎯 Game vs ${context.nextMatch!.opponent} in ${context.nextMatch!.daysUntil} days.\n`);
      suggestion += L(`• Treino **tático coletivo** de 24h (grupo: all)\n`, `• 24h **team tactical** training (group: all)\n`);
      suggestion += L(`• Foco em **formação** para ajustar posicionamento\n`, `• Focus on **shape** to fine-tune positioning\n`);
      suggestion += L(`• Treino **mental individual** para titulares (confiança)\n`, `• **Individual mental** training for starters (confidence)\n`);
    } else if (lowFatigue) {
      suggestion += L(`✅ Plantel descansado (fadiga ${Math.round(context.averageFatigue)}%). Momento ideal para desenvolvimento:\n`, `✅ Squad rested (fatigue ${Math.round(context.averageFatigue)}%). Ideal time for development:\n`);
      if (personality === 'Developer' || personality === 'Visionary') {
        suggestion += L(`• Treino **atributos individual** de 48h (passe, drible, finalização)\n`, `• 48h **individual attributes** training (passing, dribbling, finishing)\n`);
        suggestion += L(`• Treino **coletivo formação** de 36h (grupo: all)\n`, `• 36h **team shape** training (group: all)\n`);
        suggestion += L(`• Foco em jogadores jovens (<23 anos)\n`, `• Focus on young players (<23)\n`);
      } else if (personality === 'Pragmatic') {
        suggestion += L(`• Treino **tático individual** de 36h\n`, `• 36h **individual tactical** training\n`);
        suggestion += L(`• Treino **coletivo formação** de 24h (grupo: defensivo)\n`, `• 24h **team shape** training (group: defensive)\n`);
        suggestion += L(`• Reforçar disciplina tática\n`, `• Reinforce tactical discipline\n`);
      } else {
        suggestion += L(`• Treino **atributos individual** de 36h\n`, `• 36h **individual attributes** training\n`);
        suggestion += L(`• Treino **coletivo empatia** de 24h (coesão do grupo)\n`, `• 24h **team empathy** training (group cohesion)\n`);
      }
    } else {
      suggestion += L(`📊 Situação normal. Sugestão balanceada:\n`, `📊 Normal situation. Balanced suggestion:\n`);
      suggestion += L(`• Treino **tático individual** de 24h (2-3 jogadores)\n`, `• 24h **individual tactical** training (2-3 players)\n`);
      suggestion += L(`• Treino **coletivo formação** de 24h (grupo: criativo)\n`, `• 24h **team shape** training (group: creative)\n`);
    }

    suggestion += L(`\n💡 Centro de Treino nível ${context.trainingCenterLevel} dá boost de ganhos.`, `\n💡 Training Centre level ${context.trainingCenterLevel} boosts gains.`);

    return suggestion;
  }

  private suggestStaffActions(): string {
    const context = this.buildTeamContext();
    const suggestions: string[] = [];

    // Analisa cada role
    const treinadorLevel = context.staffLevels.treinador ?? 1;
    if (treinadorLevel < 3 && context.availableExp >= 3_500_000) {
      suggestions.push(
        L(`🔥 **PRIORIDADE MÁXIMA**: Upgrade Treinador para nível ${treinadorLevel + 1} (${treinadorLevel === 1 ? '3.5M' : '9M'} EXP). Multiplica TODOS os ganhos de treino.`, `🔥 **TOP PRIORITY**: Upgrade Head Coach to level ${treinadorLevel + 1} (${treinadorLevel === 1 ? '3.5M' : '9M'} EXP). Multiplies ALL training gains.`),
      );
    }

    const prepFisicoLevel = context.staffLevels.preparador_fisico ?? 1;
    if (prepFisicoLevel < 3 && context.averageFatigue > 50) {
      suggestions.push(
        L(`⚡ Plantel cansado. Upgrade Preparador Físico para acelerar recuperação.`, `⚡ Squad tired. Upgrade the Fitness Coach to speed up recovery.`),
      );
    }

    const nutricaoLevel = context.staffLevels.nutricao ?? 1;
    if (nutricaoLevel < 2 && context.averageInjuryRisk > 30) {
      suggestions.push(
        L(`🏥 Risco de lesão elevado. Upgrade Nutrição para prevenção.`, `🏥 High injury risk. Upgrade Nutrition for prevention.`),
      );
    }

    if (context.staffAssignedCount === 0) {
      suggestions.push(
        L(`👥 Nenhum staff atribuído a jogadores. Vai em /team/staff para ativar buffs individuais nos jogadores da academia.`, `👥 No staff assigned to players. Go to /team/staff to activate individual buffs for academy players.`),
      );
    }

    if (suggestions.length === 0) {
      const niveis = Object.entries(context.staffLevels)
  .map(([role, level]) => L(`• ${role}: nível ${level}`, `• ${role}: level ${level}`))
  .join('\n');
      return L(`✅ Staff está bem configurado no momento. Continue monitorando após jogos e treinos.

Níveis atuais:
${niveis}`, `✅ Staff is well set up right now. Keep monitoring after games and training.

Current levels:
${niveis}`);
    }

    return L(`**Sugestões de Staff:**\n\n${suggestions.join('\n\n')}`, `**Staff Suggestions:**\n\n${suggestions.join('\n\n')}`);
  }

  private analyzeTeamStatus(): string {
    const context = this.buildTeamContext();

    if (emIngles()) {
      return `**Squad Analysis:**

📊 **Players:**
• Total: ${context.totalPlayers}
• Injured: ${context.injuredPlayers}
• Suspended: ${context.suspendedPlayers}
• Average overall: ${Math.round(context.averageOverall)}

⚡ **Fitness:**
• Average fatigue: ${Math.round(context.averageFatigue)}% ${context.averageFatigue > 60 ? '⚠️ HIGH' : context.averageFatigue < 30 ? '✅ GREAT' : ''}
• Injury risk: ${Math.round(context.averageInjuryRisk)}% ${context.averageInjuryRisk > 40 ? '⚠️ HIGH' : ''}

🏋️ **Training:**
• Running: ${context.runningTrainingPlans}
• Completed: ${context.completedTrainingPlans}
• Training Centre: level ${context.trainingCenterLevel}

👥 **Staff:**
• Head Coach: level ${context.staffLevels.treinador ?? 1}
• Active assignments: ${context.staffAssignedCount}

${context.nextMatch ? `⚽ **Next game:** ${context.nextMatch.opponent} (${context.nextMatch.isHome ? 'Home' : 'Away'}) in ${context.nextMatch.daysUntil} days` : ''}

${this.getQuickRecommendation(context)}`;
    }
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
      return L(`\n💡 **Recomendação:** Plantel muito cansado. Priorize recuperação (treino físico leve ou descanso).`, `\n💡 **Recommendation:** Squad very tired. Prioritise recovery (light physical training or rest).`);
    }
    if (context.injuredPlayers > 3) {
      return L(`\n💡 **Recomendação:** Muitos lesionados. Considere upgrade do Departamento Médico.`, `\n💡 **Recommendation:** Many injured. Consider upgrading the Medical Department.`);
    }
    if (context.staffLevels.treinador < 3) {
      return L(`\n💡 **Recomendação:** Upgrade do Treinador multiplica ganhos de treino. Prioridade máxima.`, `\n💡 **Recommendation:** Upgrading the Head Coach multiplies training gains. Top priority.`);
    }
    if (context.nextMatch && context.nextMatch.daysUntil <= 2) {
      return L(`\n💡 **Recomendação:** Jogo próximo. Treino tático leve (12-24h) para ajustar formação.`, `\n💡 **Recommendation:** Game coming up. Light tactical training (12-24h) to fine-tune the shape.`);
    }
    return L(`\n💡 **Recomendação:** Situação estável. Bom momento para treinos de desenvolvimento (36-48h).`, `\n💡 **Recommendation:** Stable situation. Good time for development training (36-48h).`);
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

    return L(`✅ Entendido e memorizado: "${message}"

Vou aplicar essa orientação nas minhas sugestões futuras. Podes desativar ou modificar isso a qualquer momento.

${this.coach.memory.managerInstructions.length} instruções ativas no total.`, `✅ Got it and saved: "${message}"

I'll apply this guidance to my future suggestions. You can turn it off or change it at any time.

${this.coach.memory.managerInstructions.length} active instructions in total.`);
  }

  private detectPriority(message: string): 'high' | 'medium' | 'low' {
    const lower = message.toLowerCase();
    if (/sempre|nunca|crítico|essencial|obrigatório|always|never|critical|essential|mandatory/.test(lower)) return 'high';
    if (/prefiro|importante|priorize|prefer|important|prioriti[sz]e/.test(lower)) return 'medium';
    return 'low';
  }

  private learnFromInstruction(instruction: ManagerInstruction): void {
    const lower = instruction.instruction.toLowerCase();

    // Aprende preferências de treino
    if (instruction.category === 'training') {
      if (/individual/.test(lower)) {
        // Extrai tipos mencionados
        if (/físico|fisico|physical/.test(lower))
          this.coach.memory.trainingKnowledge.preferredIndividualTypes.push('fisico');
        if (/mental/.test(lower))
          this.coach.memory.trainingKnowledge.preferredIndividualTypes.push('mental');
        if (/tático|tatico|tactical/.test(lower))
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
    return L(`Entendi. Posso ajudar com:

• **Treinos**: sugestões, tipos, duração
• **Staff**: upgrades, atribuições, prioridades
• **Análise**: status do plantel, condição física
• **Aprendizado**: ensina-me tuas preferências (ex: "sempre priorize treino tático")

O que precisas?`, `Got it. I can help with:

• **Training**: suggestions, types, duration
• **Staff**: upgrades, assignments, priorities
• **Analysis**: squad status, fitness
• **Learning**: teach me your preferences (e.g. "always prioritise tactical training")

What do you need?`);
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
      (sum, p) => sum + overallFromAttributes(p.attrs, p.pos),
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

      favoriteTeam: this.gameState.userSettings.favoriteRealTeam?.name ?? undefined,

      ...this.getRecentMatchContext(),
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

  private getRecentMatchContext(): Pick<TeamContext, 'recentResults' | 'recentForm'> {
    const results = this.gameState.results ?? [];
    const clubName = this.gameState.club.name;
    const last5 = results.slice(-5);

    const recentResults = last5.map((r) => {
      const isHome = r.home === clubName;
      const scoreFor = isHome ? r.scoreHome : r.scoreAway;
      const scoreAgainst = isHome ? r.scoreAway : r.scoreHome;
      const opponent = isHome ? r.away : r.home;
      return { opponent, result: r.result, scoreFor, scoreAgainst };
    });

    const recentForm = last5.map((r) =>
      r.result === 'win' ? 'W' : r.result === 'draw' ? 'D' : 'L'
    ) as Array<'W' | 'D' | 'L'>;

    return { recentResults, recentForm };
  }
}
