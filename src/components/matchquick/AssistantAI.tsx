/**
 * Assistente AI - FAB flutuante com chat interativo
 * Faz substituições automáticas por lesão e responde a comandos do usuário
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantAIProps {
  onSubstitution?: (outPlayerId: string, inPlayerId: string, reason: 'injury' | 'tactical') => void;
  onTacticalChange?: (command: string) => void;
  availablePlayers?: Array<{ id: string; name: string; position: string; fatigue: number }>;
  benchPlayers?: Array<{ id: string; name: string; position: string }>;
}

export function AssistantAI({
  onSubstitution,
  onTacticalChange,
  availablePlayers = [],
  benchPlayers = []
}: AssistantAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input quando abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Detectar lesões automaticamente e fazer substituição
  useEffect(() => {
    const injuredPlayer = availablePlayers.find(p => p.fatigue >= 95);
    if (injuredPlayer && benchPlayers.length > 0) {
      // Encontrar substituto da mesma posição
      const substitute = benchPlayers.find(b => b.position === injuredPlayer.position) || benchPlayers[0];

      if (substitute && onSubstitution) {
        // Notificar no chat
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          text: `🚑 Substituição automática: ${injuredPlayer.name} saiu lesionado. ${substitute.name} entrou em campo.`
        }]);

        // Executar substituição
        onSubstitution(injuredPlayer.id, substitute.id, 'injury');
      }
    }
  }, [availablePlayers, benchPlayers, onSubstitution]);

  const processCommand = async (userMessage: string) => {
    setIsProcessing(true);

    // Adicionar mensagem do usuário
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);

    // Simular processamento (aqui você pode integrar com API de IA real)
    await new Promise(resolve => setTimeout(resolve, 800));

    const lowerMsg = userMessage.toLowerCase();
    let response = '';

    // Comandos de substituição
    if (lowerMsg.includes('substituir') || lowerMsg.includes('trocar')) {
      if (benchPlayers.length === 0) {
        response = '❌ Não há jogadores disponíveis no banco para substituição.';
      } else {
        // Encontrar jogador mais cansado
        const mostTired = availablePlayers.reduce((prev, curr) =>
          curr.fatigue > prev.fatigue ? curr : prev
        );

        const substitute = benchPlayers.find(b => b.position === mostTired.position) || benchPlayers[0];

        if (substitute && onSubstitution) {
          onSubstitution(mostTired.id, substitute.id, 'tactical');
          response = `✅ Substituição realizada: ${mostTired.name} saiu, ${substitute.name} entrou.`;
        }
      }
    }
    // Comandos táticos
    else if (lowerMsg.includes('pressão') || lowerMsg.includes('pressao') || lowerMsg.includes('atacar')) {
      if (onTacticalChange) {
        onTacticalChange('PRESSAO_ALTA');
        response = '🔥 Tática alterada para PRESSÃO ALTA. Time mais agressivo!';
      }
    }
    else if (lowerMsg.includes('defender') || lowerMsg.includes('defesa') || lowerMsg.includes('segurar')) {
      if (onTacticalChange) {
        onTacticalChange('BLOCO_BAIXO');
        response = '🛡️ Tática alterada para BLOCO BAIXO. Defesa reforçada!';
      }
    }
    else if (lowerMsg.includes('equilibr') || lowerMsg.includes('balanc') || lowerMsg.includes('normal')) {
      if (onTacticalChange) {
        onTacticalChange('POSSE_CONTROLADA');
        response = '⚖️ Tática alterada para POSSE CONTROLADA. Jogo equilibrado!';
      }
    }
    else if (lowerMsg.includes('contra') || lowerMsg.includes('rápid') || lowerMsg.includes('rapido')) {
      if (onTacticalChange) {
        onTacticalChange('TRANSICAO_RAPIDA');
        response = '⚡ Tática alterada para TRANSIÇÃO RÁPIDA. Contra-ataques ativados!';
      }
    }
    // Análise do jogo
    else if (lowerMsg.includes('como') && (lowerMsg.includes('jogo') || lowerMsg.includes('partida'))) {
      const avgFatigue = availablePlayers.reduce((sum, p) => sum + p.fatigue, 0) / availablePlayers.length;
      response = `📊 Análise do jogo:\n• Fadiga média: ${Math.round(avgFatigue)}%\n• Jogadores disponíveis: ${availablePlayers.length}\n• Banco: ${benchPlayers.length} jogadores`;
    }
    // Resposta padrão
    else {
      response = `Entendi! Posso ajudar com:\n• "Substituir jogador cansado"\n• "Pressionar mais"\n• "Defender resultado"\n• "Como está o jogo?"`;
    }

    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    setIsProcessing(false);
    setMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      processCommand(message.trim());
    }
  };

  return (
    <>
      {/* FAB - Botão flutuante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[100] flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all hover:scale-110 hover:shadow-[0_0_40px_rgba(168,85,247,0.8)]"
            aria-label="Assistente AI"
          >
            <Bot className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[100] w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] flex flex-col rounded-xl border-2 border-purple-500/60 bg-gradient-to-br from-black via-purple-950/40 to-black shadow-[0_0_40px_rgba(168,85,247,0.4)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-purple-500/30 bg-purple-900/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/30 border-2 border-purple-500">
                  <Bot className="h-5 w-5 text-purple-300" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-black uppercase tracking-wider text-purple-300">
                    Assistente AI
                  </h3>
                  <p className="text-[10px] text-white/50">Como posso ajudar?</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px]">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Bot className="h-12 w-12 text-purple-500/40 mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-white/60 mb-2">Olá! Sou seu assistente tático.</p>
                  <p className="text-xs text-white/40 max-w-xs">
                    Faço substituições automáticas por lesão e posso ajudar com táticas durante o jogo.
                  </p>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-2',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/30">
                        <Bot className="h-3.5 w-3.5 text-purple-300" strokeWidth={2.5} />
                      </div>
                    )}
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 max-w-[80%]',
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/90 border border-white/10'
                      )}
                    >
                      <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                    </div>
                  </motion.div>
                ))
              )}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 justify-start"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/30">
                    <Bot className="h-3.5 w-3.5 text-purple-300" strokeWidth={2.5} />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-white/10 border border-white/10">
                    <Loader2 className="h-4 w-4 text-purple-300 animate-spin" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-purple-500/30 bg-black/40 p-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={isProcessing}
                  className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-500/60 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || isProcessing}
                  className="flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-white transition-all hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
