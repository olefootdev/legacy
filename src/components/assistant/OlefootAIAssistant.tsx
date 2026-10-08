/**
 * Assistente IA do Olefoot — responde perguntas sobre o jogo usando knowledge base atualizada.
 * Integra com backend para processar contexto do código e responder com precisão.
 */

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'motion/react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  BookOpen,
  Zap,
  HelpCircle,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { CABECALHO_IDIOMA } from '@/i18n/cabecalho';

// Mesmo padrão dos outros clients (coachApi/quickPlanClient): prioriza env
// VITE_OLEFOOT_API_URL — path relativo não funciona porque o front (Vite/
// Cloudflare) não serve a API do Hono.
const API_BASE =
  import.meta.env.VITE_OLEFOOT_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[]; // Arquivos/páginas que foram consultados
}

interface QuickQuestion {
  label: string;
  question: string;
  category: 'inicio' | 'partida' | 'economia' | 'mercado';
}

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    label: L('Como ganhar EXP?', 'How to earn EXP?'),
    question: L('Como eu ganho EXP no Olefoot? Quais são as melhores formas de evoluir rápido?', 'How do I earn EXP in Olefoot? What are the best ways to level up fast?'),
    category: 'inicio',
  },
  {
    label: L('Diferença entre partidas', 'Match types'),
    question: L('Qual a diferença entre Partida Rápida, Partida Auto e Partida ao Vivo?', 'What is the difference between Quick Match, Auto Match and Live Match?'),
    category: 'partida',
  },
  {
    label: L('Como funciona BRO?', 'How does BRO work?'),
    question: L('O que é BRO e como eu uso essa moeda no jogo?', 'What is BRO and how do I use this currency in the game?'),
    category: 'economia',
  },
  {
    label: L('Comprar jogadores', 'Buy players'),
    question: L('Como eu compro jogadores no mercado? O que são cartas Genesis?', 'How do I buy players in the Market? What are Genesis cards?'),
    category: 'mercado',
  },
  {
    label: L('Melhorar meu time', 'Improve my team'),
    question: L('Como eu melhoro meu time? Quais atributos são mais importantes?', 'How do I improve my team? Which attributes matter most?'),
    category: 'inicio',
  },
  {
    label: L('Formações táticas', 'Formations'),
    question: L('Quais formações estão disponíveis e como escolher a melhor para meu time?', 'Which formations are available and how do I pick the best one for my team?'),
    category: 'partida',
  },
];

interface OlefootAIAssistantProps {
  /** Se true, abre automaticamente. */
  autoOpen?: boolean;
  /** Pergunta inicial pré-carregada. */
  initialQuestion?: string;
}

export function OlefootAIAssistant({ autoOpen = false, initialQuestion }: OlefootAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setPosition({ x: info.offset.x, y: info.offset.y });
    setIsDragging(false);
  };

  useEffect(() => {
    if (initialQuestion && isOpen) {
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowQuickQuestions(false);

    try {
      // Chama backend que processa a pergunta com contexto do código
      const response = await fetch(`${API_BASE}/api/assistant/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CABECALHO_IDIOMA },
        body: JSON.stringify({
          question: text,
          conversationHistory: messages.slice(-4), // últimas 4 mensagens para contexto
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        sources: data.sources, // Arquivos consultados
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Assistant error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: L(
          'Desculpe, tive um problema ao processar sua pergunta. Tente novamente ou reformule a pergunta.',
          'Sorry, something went wrong with your question. Try again or rephrase it.',
        ),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      handleSendMessage(input.trim());
    }
  };

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-4 z-50 flex h-12 w-12 sm:h-14 sm:w-14 sm:bottom-6 sm:left-6 items-center justify-center rounded-full bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-colors hover:bg-papel"
        aria-label={L('Abrir assistente IA', 'Open AI assistant')}
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border-2 border-asfalto-27 bg-papel font-prova text-[8px] sm:text-[9px] font-bold text-asfalto-27">
          {L('IA', 'AI')}
        </span>
      </motion.button>
    );
  }

  if (isMinimized) {
    return (
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x: position.x, y: position.y }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={cn('fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50', isDragging && 'cursor-grabbing')}
      >
        <button
          onPointerDown={(e) => {
            // Se clicar no botão, inicia drag
            dragControls.start(e);
          }}
          onClick={(e) => {
            // Se não arrastou, expande o assistente
            if (!isDragging) {
              setIsMinimized(false);
            }
          }}
          className={cn(
            'flex items-center gap-3 border-2 border-linha bg-asfalto-27 px-4 py-3 transition-colors hover:border-papel',
            'cursor-grab active:cursor-grabbing',
          )}
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-rua">
            <MessageCircle className="h-5 w-5 text-rua" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-papel font-prova text-[8px] font-bold text-asfalto-27">
              {L('IA', 'AI')}
            </span>
          </div>
          <div className="text-left pointer-events-none">
            <p className="font-impact text-[17px] uppercase leading-[1.1] text-papel">
              {L('Assistente IA', 'AI Assistant')}
            </p>
            <p className="font-prova text-[11px] text-mudo">
              {messages.length > 0 ? L(`${messages.length} mensagens`, `${messages.length} messages`) : L('Pergunte qualquer coisa', 'Ask anything')}
            </p>
          </div>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      style={{ x: position.x, y: position.y }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={cn(
        'fixed bottom-20 left-2 right-2 sm:bottom-6 sm:left-6 sm:right-auto z-50 flex h-[70vh] max-h-[600px] sm:h-[600px] w-auto sm:w-full sm:max-w-md flex-col',
        isDragging && 'cursor-grabbing',
      )}
    >
      <div className="flex h-full flex-col overflow-hidden border-2 border-linha bg-asfalto-27">
        {/* Header - Draggable */}
        <div
          onPointerDown={(e) => {
            // Só inicia drag se clicar na área do header (não nos botões)
            const target = e.target as HTMLElement;
            if (!target.closest('button')) {
              dragControls.start(e);
            }
          }}
          className={cn(
            'relative z-10 flex items-center justify-between border-b-2 border-linha bg-concreto px-4 py-3',
            'cursor-grab active:cursor-grabbing select-none',
          )}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-rua">
              <MessageCircle className="h-5 w-5 text-rua" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-papel font-prova text-[8px] font-bold text-asfalto-27">
                {L('IA', 'AI')}
              </span>
            </div>
            <div>
              <h3 className="font-impact text-[19px] uppercase leading-[1.1] text-papel">
                {L('Assistente IA', 'AI Assistant')}
              </h3>
              <p className="flex items-center gap-1 font-prova text-[11px] text-mudo">
                <Move className="h-3 w-3" />
                {L('Arraste para mover', 'Drag to move')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="p-2 text-mudo transition-colors hover:text-papel"
              aria-label={L('Minimizar', 'Minimize')}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-2 text-mudo transition-colors hover:text-papel"
              aria-label={L('Fechar', 'Close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-rua">
                <Sparkles className="h-8 w-8 text-rua" strokeWidth={2.5} />
              </div>
              <h4 className="font-voz text-[34px] leading-none text-papel">
                {L('Olá, Manager!', 'Hi, Manager!')}
              </h4>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-rua">
                  <Sparkles className="h-4 w-4 text-rua" strokeWidth={2.5} />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] px-4 py-2.5',
                  msg.role === 'user'
                    ? 'rotate-[-0.6deg] bg-cal text-asfalto-27 shadow-[3px_3px_0_rgba(0,0,0,0.5)]'
                    : 'border-l-[3px] border-rua bg-concreto text-papel',
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 border-t-2 border-dashed border-linha pt-2">
                    <p className="mb-1 flex items-center gap-1 font-prova text-[9px] uppercase tracking-[0.14em] text-mudo">
                      <BookOpen className="h-3 w-3" />
                      {L('Fontes consultadas', 'Sources')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((source, i) => (
                        <span
                          key={i}
                          className="border border-linha px-1.5 py-0.5 font-prova text-[9.5px] text-mudo"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-rua">
                <Loader2 className="h-4 w-4 animate-spin text-rua" strokeWidth={2.5} />
              </div>
              <div className="border-l-[3px] border-rua bg-concreto px-4 py-2.5">
                <p className="font-voz text-[18px] text-suave">{L('Pensando...', 'Thinking...')}</p>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {showQuickQuestions && messages.length === 0 && (
          <div className="border-t-2 border-linha bg-concreto p-3">
            <p className="mb-2 flex items-center gap-1.5 font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">
              <Zap className="h-3 w-3" />
              {L('Perguntas rápidas', 'Quick questions')}
            </p>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q.question)}
                  className="border-2 border-linha bg-asfalto-27 px-2.5 py-2 text-left text-[12px] text-suave transition-colors hover:border-rua hover:text-papel"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t-2 border-linha bg-concreto p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={L('Pergunte qualquer coisa sobre o Olefoot...', 'Ask anything about Olefoot...')}
              disabled={isLoading}
              className="min-w-0 flex-1 border-2 border-linha bg-asfalto-27 px-3 py-2.5 text-[14px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-rua text-asfalto-27 transition-colors hover:bg-papel disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={L('Enviar', 'Send')}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
              ) : (
                <Send className="h-5 w-5" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
