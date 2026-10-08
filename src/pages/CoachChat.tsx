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
import { SecaoRua } from '@/components/ui/Rua';
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
        <p className="border-2 border-dashed border-fio p-6 font-voz text-[24px] text-suave">{L('Coach não disponível.', 'Coach unavailable.')}</p>
      </div>
    );
  }

  const disponiveis = Object.values(gameState.players).filter((p) => p.outForMatches <= 0);
  const fadigaMedia = Math.round(disponiveis.reduce((sum, p) => sum + p.fatigue, 0) / Math.max(1, disponiveis.length));
  const ativas = coach.memory.managerInstructions.filter((i) => i.active);

  return (
    <div className="relative w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-32 sm:pb-8">
      <div className="relative z-10 w-full max-w-4xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-5">
        <BackButton to="/clube/staff" label="Staff" />

        {/* Header do Coach */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-w-0 flex-col gap-3"
        >
          <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Treinador · Assistente de IA', 'Coach · AI Assistant')}
          </span>
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-rua">
              <Bot className="h-7 w-7 text-rua" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-voz text-[clamp(32px,9vw,46px)] leading-none text-papel">{coach.name}</h1>
              <p className="mt-1 font-prova text-[11px] font-bold uppercase tracking-[0.08em] text-mudo">
                {coach.personality} · {L('Reputação', 'Reputation')} {coach.reputation}/100
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-px bg-linha">
            {[
              [L('Tático', 'Tactical'), `${coach.tactical}/20`],
              [L('Motivação', 'Motivation'), `${coach.motivation}/20`],
              [L('Autonomia', 'Autonomy'), `${coach.autonomyLevel}%`],
            ].map(([l, v]) => (
              <div key={l} className="bg-asfalto-27 px-3 py-2.5">
                <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{l}</dt>
                <dd className="font-impact text-[22px] leading-none text-papel tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.header>

        {/* Quick Context */}
        <motion.dl
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-px bg-linha sm:grid-cols-4"
        >
          {[
            { icon: Users, l: L('Jogadores', 'Players'), v: String(disponiveis.length) },
            { icon: TrendingUp, l: L('Fadiga', 'Fatigue'), v: `${fadigaMedia}%` },
            { icon: Dumbbell, l: L('Treinos', 'Training'), v: String(gameState.manager.trainingPlans.filter((p) => p.status === 'running').length) },
            { icon: Sparkles, l: 'Staff', v: `N${gameState.manager.staff.roles.treinador ?? 1}` },
          ].map(({ icon: Icon, l, v }) => (
            <div key={l} className="bg-concreto px-3 py-2.5">
              <dt className="flex items-center gap-1.5 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">
                <Icon className="h-3.5 w-3.5" /> {l}
              </dt>
              <dd className="mt-0.5 font-impact text-[22px] leading-none text-papel tabular-nums">{v}</dd>
            </div>
          ))}
        </motion.dl>

        {/* Chat Messages */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-[min(520px,62vh)] flex-col bg-concreto p-3 sm:p-4"
        >
          <div className="mb-3 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1 py-1">
            {messages.length === 0 && (
              <div className="border-2 border-dashed border-fio p-5">
                <p className="font-voz text-[22px] leading-tight text-papel">
                  {L('Olá! Sou o teu assistente técnico. Posso ajudar com treinos, staff e análise do plantel.', 'Hi! I am your assistant coach. I can help with training, staff and squad analysis.')}
                </p>
                <p className="mt-2 font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
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
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-rua">
                    <Bot className="h-4 w-4 text-rua" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[82%] p-3 text-[14px] leading-relaxed',
                    msg.role === 'user'
                      // A fala do manager é um lambe de cal colado (levemente torto).
                      ? 'rotate-[-0.6deg] bg-cal text-asfalto-27 shadow-[3px_3px_0_rgba(0,0,0,0.5)]'
                      : 'border-l-[3px] border-rua bg-asfalto-27 text-papel',
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className="mt-1 font-prova text-[10px] opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString(LOCALE, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-linha">
                    <User className="h-4 w-4 text-papel" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-rua">
                  <Bot className="h-4 w-4 animate-pulse text-rua" />
                </div>
                <div className="border-l-[3px] border-rua bg-asfalto-27 p-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce bg-mudo" />
                    <div className="h-2 w-2 animate-bounce bg-mudo delay-100" />
                    <div className="h-2 w-2 animate-bounce bg-mudo delay-200" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t-2 border-linha pt-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={L('Escreve tua mensagem...', 'Type your message...')}
                className="min-w-0 flex-1 resize-none border-2 border-linha bg-asfalto-27 px-3 py-2 text-[14px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none"
                rows={2}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                aria-label={L('Enviar', 'Send')}
                className="inline-flex w-14 shrink-0 items-center justify-center bg-rua text-asfalto-27 transition-colors hover:bg-papel disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-4"
        >
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action)}
              disabled={loading || suggestingAction}
              className={cn(
                'relative z-20 min-h-[48px] px-3 py-2.5 text-left font-impact text-[14px] uppercase leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                action.action
                  ? 'border-2 border-rua text-rua hover:bg-rua hover:text-asfalto-27'
                  : 'border-2 border-linha text-papel hover:border-papel',
              )}
            >
              {action.action && <Zap className="mr-1 inline h-3 w-3" />}
              {action.label}
            </button>
          ))}
        </motion.div>

        {/* Instruções Ativas */}
        {ativas.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <SecaoRua label={L('Instruções Ativas', 'Active Instructions')} aside={ativas.length} />
            <div className="flex flex-col gap-px bg-linha">
              {ativas
                .slice(-5)
                .map((instruction, i) => (
                  <div key={i} className="bg-asfalto-27 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[14px] text-papel">{instruction.instruction}</span>
                        <div className="mt-0.5 font-prova text-[10px] text-mudo">
                          {instruction.category} · {instruction.priority}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 px-1.5 py-0.5 font-prova text-[9px] font-bold uppercase',
                          instruction.priority === 'high'
                            ? 'border border-baixa text-baixa'
                            : instruction.priority === 'medium'
                              ? 'border border-rua text-rua'
                              : 'border border-linha text-mudo',
                        )}
                      >
                        {instruction.priority}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
