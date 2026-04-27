import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, User, Sparkles, TrendingUp, Users, Dumbbell, ChevronLeft, Zap, Check } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { CoachConversationEngine } from '@/coach/coachConversation';
import type { ConversationMessage } from '@/coach/types';
import { BackButton } from '@/components/BackButton';
import { suggestTraining, suggestStaff } from '@/coach/coachApi';
import { createTrainingAction, createUpgradeStaffAction } from '@/coach/coachActions';
import { cn } from '@/lib/utils';

export function CoachChat() {
  const gameState = useGameStore((state) => state);
  const dispatch = useGameDispatch();
  const coach = gameState.manager.coach;

  const [messages, setMessages] = useState<ConversationMessage[]>(
    coach?.conversationContext ?? []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestingAction, setSuggestingAction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationEngine = new CoachConversationEngine(coach!, gameState);

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
        content: 'Desculpa, tive um problema ao processar isso. Podes tentar novamente?',
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
    { label: 'Analisa o time', prompt: 'Analisa a situação atual do plantel' },
    { label: 'Sugere treino', prompt: 'Sugere um plano de treino', action: 'suggest_training' },
    { label: 'Prioridades staff', prompt: 'Quais as prioridades de upgrade de staff?', action: 'suggest_staff' },
    { label: 'Próximo jogo', prompt: 'Como preparar para o próximo jogo?' },
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
      content: 'Sugere um plano de treino e executa se eu aprovar',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const teamContext = conversationEngine.buildTeamContext();
      const result = await suggestTraining(coach, teamContext);

      if (!result.ok || !result.suggestion) {
        throw new Error(result.error || 'Erro ao gerar sugestão');
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
        content: `✅ **Sugestão de Treino Criada**

**Tipo**: ${suggestion.mode === 'individual' ? 'Individual' : 'Coletivo'} - ${suggestion.trainingType}
**Grupo**: ${suggestion.group}
**Duração**: ${suggestion.durationHours}h
**Prioridade**: ${suggestion.priority}

**Justificativa:**
${suggestion.reasoning}

📋 Criei uma ação pendente para aprovação. Verifica o card no canto inferior direito da tela para aprovar ou rejeitar.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('[handleSuggestTraining] Erro:', error);
      const errorMsg: ConversationMessage = {
        role: 'assistant',
        content: `❌ Erro ao criar sugestão de treino: ${error.message}`,
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
      content: 'Sugere ações de staff e executa se eu aprovar',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const teamContext = conversationEngine.buildTeamContext();
      const result = await suggestStaff(coach, teamContext);

      if (!result.ok || !result.suggestions || result.suggestions.length === 0) {
        throw new Error(result.error || 'Nenhuma sugestão disponível');
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
        content: `✅ **Sugestões de Staff Criadas**

${suggestionsList}

📋 Criei ${actionsCreated} ação(ões) pendente(s) para aprovação. Verifica os cards no canto inferior direito da tela.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error('[handleSuggestStaff] Erro:', error);
      const errorMsg: ConversationMessage = {
        role: 'assistant',
        content: `❌ Erro ao criar sugestões de staff: ${error.message}`,
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
          <Bot className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">Coach não disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-32 sm:pb-8">
      <div className="relative z-10 w-full max-w-4xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-4">
        <BackButton to="/team/staff" label="Staff" />

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
              <p className="text-xs text-gray-400 mt-0.5">
                {coach.personality} · Reputação {coach.reputation}/100
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <div className="text-center">
                <div className="text-gray-500 uppercase text-[10px]">Tático</div>
                <div className="text-white font-bold">{coach.tactical}/20</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 uppercase text-[10px]">Motivação</div>
                <div className="text-white font-bold">{coach.motivation}/20</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 uppercase text-[10px]">Autonomia</div>
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
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">Jogadores</span>
            </div>
            <div className="text-white text-base font-black">
              {Object.values(gameState.players).filter((p) => p.outForMatches <= 0).length}
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">Fadiga</span>
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
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
              <Dumbbell className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px] font-medium">Treinos</span>
            </div>
            <div className="text-white text-base font-black">
              {gameState.manager.trainingPlans.filter((p) => p.status === 'running').length}
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
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
                <p className="text-sm text-gray-400">
                  Olá! Sou o teu assistente técnico. Posso ajudar com treinos, staff e análise do plantel.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Usa os botões abaixo ou escreve tua pergunta.
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
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
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
                placeholder="Escreve tua mensagem..."
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Instruções Ativas ({coach.memory.managerInstructions.filter((i) => i.active).length})
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
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {instruction.category} · {instruction.priority}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          instruction.priority === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : instruction.priority === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-gray-400'
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
