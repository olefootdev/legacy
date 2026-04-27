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
    label: 'Como ganhar EXP?',
    question: 'Como eu ganho EXP no Olefoot? Quais são as melhores formas de evoluir rápido?',
    category: 'inicio',
  },
  {
    label: 'Diferença entre partidas',
    question: 'Qual a diferença entre Partida Rápida, Partida Auto e Partida ao Vivo?',
    category: 'partida',
  },
  {
    label: 'Como funciona BRO?',
    question: 'O que é BRO e como eu uso essa moeda no jogo?',
    category: 'economia',
  },
  {
    label: 'Comprar jogadores',
    question: 'Como eu compro jogadores no mercado? O que são cartas Genesis?',
    category: 'mercado',
  },
  {
    label: 'Melhorar meu time',
    question: 'Como eu melhoro meu time? Quais atributos são mais importantes?',
    category: 'inicio',
  },
  {
    label: 'Formações táticas',
    question: 'Quais formações estão disponíveis e como escolher a melhor para meu time?',
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
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        content:
          'Desculpe, tive um problema ao processar sua pergunta. Tente novamente ou reformule a pergunta.',
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
        className="fixed bottom-20 left-4 z-50 flex h-12 w-12 sm:h-14 sm:w-14 sm:bottom-6 sm:left-6 items-center justify-center rounded-full bg-gradient-to-br from-neon-yellow to-amber-400 text-black shadow-[0_0_30px_rgba(253,225,0,0.6)] transition-all hover:scale-110 hover:shadow-[0_0_40px_rgba(253,225,0,0.8)]"
        aria-label="Abrir assistente IA"
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-cyan-400 text-[8px] sm:text-[9px] font-bold text-black">
          IA
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
            'flex items-center gap-3 rounded-lg border-2 border-neon-yellow/40 bg-black/95 px-4 py-3 shadow-[0_0_30px_rgba(253,225,0,0.3)] backdrop-blur-sm transition-all hover:border-neon-yellow/60 hover:shadow-[0_0_40px_rgba(253,225,0,0.5)]',
            'cursor-grab active:cursor-grabbing',
          )}
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neon-yellow/20 to-amber-400/20">
            <MessageCircle className="h-5 w-5 text-neon-yellow" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[8px] font-bold text-black">
              IA
            </span>
          </div>
          <div className="text-left pointer-events-none">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-neon-yellow">
              Assistente IA
            </p>
            <p className="text-[10px] text-white/60">
              {messages.length > 0 ? `${messages.length} mensagens` : 'Pergunte qualquer coisa'}
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
      <div className="flex h-full flex-col overflow-hidden rounded-lg border-2 border-neon-yellow/40 bg-deep-black shadow-[0_0_40px_rgba(253,225,0,0.4)]">
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
            'relative z-10 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-neon-yellow/10 via-black to-black px-4 py-3 backdrop-blur-sm',
            'cursor-grab active:cursor-grabbing select-none',
          )}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neon-yellow/20 to-amber-400/20 border-2 border-neon-yellow/40">
              <MessageCircle className="h-5 w-5 text-neon-yellow" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[8px] font-bold text-black">
                IA
              </span>
            </div>
            <div>
              <h3 className="font-display text-sm font-black uppercase tracking-wider text-neon-yellow">
                Assistente IA
              </h3>
              <p className="flex items-center gap-1 text-[10px] text-white/50">
                <Move className="h-3 w-3" />
                Arraste para mover
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Minimizar"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neon-yellow/10 border-2 border-neon-yellow/30">
                <Sparkles className="h-8 w-8 text-neon-yellow" strokeWidth={2.5} />
              </div>
              <h4 className="font-display text-lg font-black uppercase tracking-wide text-white mb-2">
                Olá, Manager!
              </h4>
              <p className="text-sm text-white/60 leading-relaxed max-w-xs">
                Sou seu assistente IA. Pergunte qualquer coisa sobre o Olefoot — estou sempre
                atualizado com todas as funcionalidades do jogo.
              </p>
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-yellow/20 border border-neon-yellow/40">
                  <Sparkles className="h-4 w-4 text-neon-yellow" strokeWidth={2.5} />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2.5',
                  msg.role === 'user'
                    ? 'bg-neon-yellow/20 border border-neon-yellow/40 text-white'
                    : 'bg-white/5 border border-white/10 text-white/90',
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="flex items-center gap-1 text-[9px] text-white/40 uppercase tracking-wider mb-1">
                      <BookOpen className="h-3 w-3" />
                      Fontes consultadas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((source, i) => (
                        <span
                          key={i}
                          className="text-[9px] text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded"
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-yellow/20 border border-neon-yellow/40">
                <Loader2 className="h-4 w-4 text-neon-yellow animate-spin" strokeWidth={2.5} />
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2.5">
                <p className="text-sm text-white/60">Pensando...</p>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {showQuickQuestions && messages.length === 0 && (
          <div className="border-t border-white/10 bg-black/40 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">
              <Zap className="h-3 w-3" />
              Perguntas rápidas
            </p>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q.question)}
                  className="rounded border border-white/10 bg-white/5 px-2.5 py-2 text-left text-[11px] text-white/70 transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-white"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/60 p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa sobre o Olefoot..."
              disabled={isLoading}
              className="flex-1 rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-neon-yellow/60 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-neon-yellow text-black transition-all hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar"
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
