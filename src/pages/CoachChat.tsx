import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Send, Bot, User, Sparkles, TrendingUp, Users, Dumbbell, ChevronLeft, Zap, Check } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { CoachConversationEngine } from '@/coach/coachConversation';
import type { ConversationMessage } from '@/coach/types';
import { BackButton } from '@/components/BackButton';
import { suggestTraining, suggestStaff } from '@/coach/coachApi';
import { createTrainingAction, createUpgradeStaffAction } from '@/coach/coachActions';
import { cn } from '@/lib/utils';
import { L, LOCALE } from '@/i18n/L';

/** Rótulo de tela do grupo de treino — o valor (`defensivo`…) segue intacto. */
const ROTULO_GRUPO: Record<string, string> = {
  defensivo: L('defensivo', 'defensive'),
  criativo: L('criativo', 'creative'),
  ataque: L('ataque', 'attack'),
  all: L('all', 'all'),
};

function buildWelcomeMessage(engine: CoachConversationEngine, coachName: string): ConversationMessage {
  const ctx = engine.buildTeamContext();

  const fatigueNote =
    ctx.averageFatigue > 60
      ? L(`Fadiga média alta (${Math.round(ctx.averageFatigue)}%) — recomendo treino de recuperação.`, `High average fatigue (${Math.round(ctx.averageFatigue)}%) — I recommend recovery training.`)
      : ctx.averageFatigue < 30
        ? L(`Plantel descansado (${Math.round(ctx.averageFatigue)}%) — bom momento para desenvolvimento.`, `Squad is rested (${Math.round(ctx.averageFatigue)}%) — good time for development.`)
        : L(`Fadiga média em ${Math.round(ctx.averageFatigue)}% — situação controlada.`, `Average fatigue at ${Math.round(ctx.averageFatigue)}% — under control.`);

  const injuryNote = ctx.injuredPlayers > 0
    ? L(`\n• ${ctx.injuredPlayers} jogador(es) lesionado(s).`, `\n• ${ctx.injuredPlayers} injured player(s).`)
    : '';

  const matchNote = ctx.nextMatch
    ? L(`\n• Próximo jogo: **${ctx.nextMatch.opponent}** em ${ctx.nextMatch.daysUntil} dia(s).`, `\n• Next match: **${ctx.nextMatch.opponent}** in ${ctx.nextMatch.daysUntil} day(s).`)
    : '';

  const content = L(`Olá, manager! Sou o **${coachName}**, teu assistente técnico.

Aqui está o resumo rápido do plantel:
• ${ctx.totalPlayers} jogadores disponíveis. ${fatigueNote}${injuryNote}${matchNote}
• Treinos em execução: ${ctx.runningTrainingPlans}
• Treinador nível ${ctx.staffLevels.treinador ?? 1}

Como posso ajudar? Usa os botões abaixo ou escreve diretamente.`, `Hi, manager! I'm **${coachName}**, your assistant coach.

Quick squad summary:
• ${ctx.totalPlayers} players available. ${fatigueNote}${injuryNote}${matchNote}
• Training sessions running: ${ctx.runningTrainingPlans}
• Head coach level ${ctx.staffLevels.treinador ?? 1}

How can I help? Use the buttons below or type directly.`);

  return { role: 'assistant', content, timestamp: Date.now() };
}

export function CoachChat() {
  const location = useLocation();
  const gameState = useGameStore((state) => state);
  const dispatch = useGameDispatch();
  const coach = gameState.manager.coach;

  const conversationEngine = new CoachConversationEngine(coach!, gameState);

  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    const saved = coach?.conversationContext ?? [];
    if (saved.length > 0) return saved;
    return [buildWelcomeMessage(conversationEngine, coach?.name ?? L('Assistente Técnico', 'Assistant Coach'))];
  });

  const draft = (location.state as { draft?: string } | null)?.draft ?? '';
  const [input, setInput] = useState(draft);
  const [loading, setLoading] = useState(false);
  const [suggestingAction, setSuggestingAction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Adiciona mensagem do manager
    const newUserMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newUserMsg]);

    try {
      // Chama coach agent
      const response = await conversationEngine.chat(userMessage);

      // Adiciona resposta do coach
      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Erro ao conversar com coach:', error);
      const errorMsg: ConversationMessage = {
        role: 'assistant',
        content: L('Desculpa, tive um problema ao processar isso. Podes tentar novamente?', 'Sorry, something went wrong. Can you try again?'),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: L('Analisa o time', 'Analyze team'), prompt: L('Analisa a situação atual do plantel', 'Analyze the current squad situation') },
    { label: L('Sugere treino', 'Suggest training'), prompt: L('Sugere um plano de treino', 'Suggest a training plan'), action: 'suggest_training' },
    { label: L('Prioridades staff', 'Staff priorities'), prompt: L('Quais as prioridades de upgrade de staff?', 'What are the staff upgrade priorities?'), action: 'suggest_staff' },
    { label: L('Próximo jogo', 'Next match'), prompt: L('Como preparar para o próximo jogo?', 'How should I prepare for the next match?') },
  ];

  const handleQuickAction = async (action: typeof quickActions[0]) => {
    if (action.action === 'suggest_training') {
      await handleSuggestTraining();
    } else if (action.action === 'suggest_staff') {
      await handleSuggestStaff();
    } else {
      setInput(action.prompt);
      setTimeout(() => sendMessage(), 100);
    }
  };

  const handleSuggestTraining = async () => {
    if (!coach || suggestingAction) return;

    setSuggestingAction(true);

    // Adiciona mensagem do manager
    const userMsg: ConversationMessage = {
      role: 'user',
      content: L('Sugere um plano de treino e executa se eu aprovar', 'Suggest a training plan and run it if I approve'),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const teamContext = conversationEngine.buildTeamContext();
      const result = await suggestTraining(coach, teamContext);

      if (!result.ok || !result.suggestion) {
        throw new Error(result.error || L('Erro ao gerar sugestão', 'Could not generate suggestion'));
      }

      const suggestion = result.suggestion;

      // Cria ação executável
      const action = createTrainingAction(
        coach,
        teamContext,
        suggestion,
        [] // playerIds vazios para coletivo, ou pode pedir ao manager
      );

      // Adiciona ao estado
      dispatch({ type: 'COACH_ADD_PENDING_ACTION', action });

      // Resposta do coach
      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: L(`**Sugestão de Treino Criada**

**Tipo**: ${suggestion.mode === 'individual' ? 'Individual' : 'Coletivo'} - ${suggestion.trainingType}
**Grupo**: ${suggestion.group}
**Duração**: ${suggestion.durationHours}h
**Prioridade**: ${suggestion.priority}

**Justificativa:**
${suggestion.reasoning}

Criei uma ação pendente para aprovação. Verifica o card no canto inferior direito da tela para aprovar ou rejeitar.`, `**Training Suggestion Created**

**Type**: ${suggestion.mode === 'individual' ? 'Individual' : 'Team'} - ${suggestion.trainingType}
**Group**: ${ROTULO_GRUPO[suggestion.group] ?? suggestion.group}
**Duration**: ${suggestion.durationHours}h
**Priority**: ${suggestion.priority}

**Reasoning:**
${suggestion.reasoning}

I created a pending action for approval. Check the card in the bottom-right corner to approve or reject.`),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('[handleSuggestTraining] Erro:', error);
      const errorMsg: ConversationMessage = {
        role: 'assistant',
        content: L(`Erro ao criar sugestão de treino: ${error.message}`, `Could not create training suggestion: ${error.message}`),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSuggestingAction(false);
    }
  };

  const handleSuggestStaff = async () => {
    if (!coach || suggestingAction) return;

    setSuggestingAction(true);

    // Adiciona mensagem do manager
    const userMsg: ConversationMessage = {
      role: 'user',
      content: L('Sugere ações de staff e executa se eu aprovar', 'Suggest staff actions and run them if I approve'),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const teamContext = conversationEngine.buildTeamContext();
      const result = await suggestStaff(coach, teamContext);

      if (!result.ok || !result.suggestions || result.suggestions.length === 0) {
        throw new Error(result.error || L('Nenhuma sugestão disponível', 'No suggestions available'));
      }

      const suggestions = result.suggestions;

      // Cria ações executáveis para cada sugestão
      let actionsCreated = 0;
      for (const suggestion of suggestions.slice(0, 3)) { // máximo 3 ações
        if (suggestion.type === 'upgrade') {
          const action = createUpgradeStaffAction(coach, teamContext, {
            role: suggestion.role as any,
            action: suggestion.action,
            reasoning: suggestion.reasoning,
            priority: suggestion.priority,
            cost: suggestion.cost!,
          });
          dispatch({ type: 'COACH_ADD_PENDING_ACTION', action });
          actionsCreated++;
        }
      }

      // Resposta do coach
      const suggestionsList = suggestions
        .slice(0, 3)
        .map((s, i) => `${i + 1}. **${s.action}** (${s.priority})\n   ${s.reasoning}`)
        .join('\n\n');

      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: L(`**Sugestões de Staff Criadas**

${suggestionsList}

Criei ${actionsCreated} ação(ões) pendente(s) para aprovação. Verifica os cards no canto inferior direito da tela.`, `**Staff Suggestions Created**

${suggestionsList}

I created ${actionsCreated} pending action(s) for approval. Check the cards in the bottom-right corner.`),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('[handleSuggestStaff] Erro:', error);
      const errorMsg: ConversationMessage = {
        role: 'assistant',
        content: L(`Erro ao criar sugestões de staff: ${error.message}`, `Could not create staff suggestions: ${error.message}`),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSuggestingAction(false);
    }
  };

  if (!coach) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-8">
        <div className="sports-panel p-6 text-center">
          <Bot className="w-12 h-12 mx-auto text-white/45 mb-4" />
          <p className="text-white/50">{L('Coach não disponível', 'Coach unavailable')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-32 sm:pb-8">
      <div className="relative z-10 w-full max-w-4xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-4">
        <BackButton to="/clube/staff" label="Staff" />

        <div className="ole-eyebrow !text-neon-yellow">
          <span>{L('Treinador · Assistente de IA', 'Coach · AI Assistant')}</span>
        </div>

        {/* Header do Coach */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sports-panel p-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-neon-yellow/20 flex items-center justify-center">
              <Bot className="w-8 h-8 text-neon-yellow" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-display font-black uppercase tracking-wider text-white">
                {coach.name}
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                {coach.personality} · {L('Reputação', 'Reputation')} {coach.reputation}/100
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <div className="text-center">
                <div className="text-white/45 uppercase text-[10px]">{L('Tático', 'Tactical')}</div>
                <div className="text-white font-bold">{coach.tactical}/20</div>
              </div>
              <div className="text-center">
                <div className="text-white/45 uppercase text-[10px]">{L('Motivação', 'Motivation')}</div>
                <div className="text-white font-bold">{coach.motivation}/20</div>
              </div>
              <div className="text-center">
                <div className="text-white/45 uppercase text-[10px]">{L('Autonomia', 'Autonomy')}</div>
                <div className="text-neon-yellow font-bold">{coach.autonomyLevel}%</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Context */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-white/45 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">{L('Jogadores', 'Players')}</span>
            </div>
            <div className="text-white text-base font-black">
              {Object.values(gameState.players).filter((p) => p.outForMatches <= 0).length}
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-white/45 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">{L('Fadiga', 'Fatigue')}</span>
            </div>
            <div className="text-white text-base font-black">
              {Math.round(
                Object.values(gameState.players)
                  .filter((p) => p.outForMatches <= 0)
                  .reduce((sum, p) => sum + p.fatigue, 0) /
                  Math.max(1, Object.values(gameState.players).filter((p) => p.outForMatches <= 0).length)
              )}%
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-white/45 mb-1">
              <Dumbbell className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">{L('Treinos', 'Training')}</span>
            </div>
            <div className="text-white text-base font-black">
              {gameState.manager.trainingPlans.filter((p) => p.status === 'running').length}
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-white/45 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">Staff</span>
            </div>
            <div className="text-white text-base font-black">
              N{gameState.manager.staff.roles.treinador ?? 1}
            </div>
          </div>
        </motion.div>

        {/* Chat Messages */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sports-panel p-4 h-[min(500px,60vh)] flex flex-col"
        >
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <p className="text-sm text-white/50">
                  {L('Olá! Sou o teu assistente técnico. Posso ajudar com treinos, staff e análise do plantel.', 'Hi! I am your assistant coach. I can help with training, staff and squad analysis.')}
                </p>
                <p className="text-xs text-white/45 mt-2">
                  {L('Usa os botões abaixo ou escreve tua pergunta.', 'Use the buttons below or type your question.')}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-neon-yellow/20 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-neon-yellow" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-neon-yellow text-black'
                      : 'bg-black/60 border border-white/10 text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString(LOCALE, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-neon-yellow/20 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-neon-yellow animate-pulse" />
                </div>
                <div className="bg-black/60 border border-white/10 rounded-lg p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 pt-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={L('Escreve tua mensagem...', 'Type your message...')}
                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-neon-yellow/50"
                rows={2}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-4 bg-neon-yellow text-black rounded font-bold uppercase text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-yellow/90 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-4"
        >
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action)}
              disabled={loading || suggestingAction}
              className={cn(
                "relative z-20 bg-white/5 border border-white/10 rounded px-3 py-2.5 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]",
                action.action && "border-neon-yellow/30 hover:border-neon-yellow/50"
              )}
            >
              {action.action && <Zap className="w-3 h-3 inline mr-1 text-neon-yellow" />}
              {action.label}
            </button>
          ))}
        </motion.div>

        {/* Instruções Ativas */}
        {coach.memory.managerInstructions.filter((i) => i.active).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="sports-panel p-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              {L('Instruções Ativas', 'Active Instructions')} ({coach.memory.managerInstructions.filter((i) => i.active).length})
            </h3>
            <div className="space-y-1.5">
              {coach.memory.managerInstructions
                .filter((i) => i.active)
                .slice(-5)
                .map((instruction, i) => (
                  <div
                    key={i}
                    className="bg-black/40 border border-white/10 rounded p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-white">{instruction.instruction}</span>
                        <div className="text-[10px] text-white/45 mt-0.5">
                          {instruction.category} · {instruction.priority}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          instruction.priority === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : instruction.priority === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-white/50'
                        }`}
                      >
                        {instruction.priority}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
