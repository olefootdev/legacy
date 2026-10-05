/**
 * Assistente AI - FAB flutuante com chat interativo
 * Faz substituições automáticas por lesão e responde a comandos do usuário
 */
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

// ─── Tipos de chat ────────────────────────────────────────────────────────
interface ChatChoice {
  /** Texto exibido no botão (já com numeração se quiser ex: "1) Mudar formação") */
  label: string;
  /** Identificador opaco passado pro handler */
  value: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** Se presente, renderiza botões clicáveis abaixo da mensagem do assistente. */
  choices?: ChatChoice[];
  /** Handler chamado quando o usuário clica em uma opção. */
  onChoice?: (value: string, label: string) => void;
}

/** Script de halftime — opções pré-computadas pra cada nó da árvore. */
export interface HalftimeScript {
  formations: Array<{ id: string; label: string }>; // mín. 5
  playStyles: Array<{ id: string; label: string }>; // mín. 3
  tiredPlayers: Array<{ id: string; label: string }>; // top 3
  onPickFormation: (id: string) => void;
  onPickPlayStyle: (id: string) => void;
  onPickTiredPlayer: (id: string) => void;
  onClose: () => void;
}

interface AssistantAIProps {
  onSubstitution?: (outPlayerId: string, inPlayerId: string, reason: 'injury' | 'tactical') => void;
  onTacticalChange?: (command: string) => void;
  availablePlayers?: Array<{ id: string; name: string; position: string; fatigue: number }>;
  benchPlayers?: Array<{ id: string; name: string; position: string }>;
  /** Quando essa key muda, o painel abre e roda o script de intervalo. */
  halftimeOpenKey?: string | number | null;
  halftimeScript?: HalftimeScript;
}

export function AssistantAI({
  onSubstitution,
  onTacticalChange,
  availablePlayers = [],
  benchPlayers = [],
  halftimeOpenKey,
  halftimeScript,
}: AssistantAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input quando abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // ─── Halftime: dispara script quando a key muda ───────────────────────
  // Refs estáveis para evitar reset do efeito a cada render do pai.
  const halftimeScriptRef = useRef<HalftimeScript | undefined>(halftimeScript);
  useEffect(() => {
    halftimeScriptRef.current = halftimeScript;
  }, [halftimeScript]);

  // Helper que constrói os botões da árvore de halftime.
  const buildHalftimeChoiceHandler = () => {
    return (value: string, label: string) => {
      const script = halftimeScriptRef.current;
      if (!script) return;
      // Eco da escolha do usuário
      setChatHistory((prev) => [...prev, { role: 'user', text: label }]);

      if (value === 'ht:menu:formation') {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: L('Qual formação você quer adotar?', 'Which formation do you want?'),
            choices: script.formations.map((f, i) => ({
              label: `${i + 1}) ${f.label}`,
              value: `ht:formation:${f.id}`,
            })),
            onChoice: buildHalftimeChoiceHandler(),
          },
        ]);
        return;
      }
      if (value === 'ht:menu:style') {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: L('Qual estilo de jogo?', 'Which play style?'),
            choices: script.playStyles.map((s, i) => ({
              label: `${i + 1}) ${s.label}`,
              value: `ht:style:${s.id}`,
            })),
            onChoice: buildHalftimeChoiceHandler(),
          },
        ]);
        return;
      }
      if (value === 'ht:menu:sub') {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: L('Top 3 mais cansados — quem sai?', 'Top 3 most tired — who comes off?'),
            choices: script.tiredPlayers.map((p, i) => ({
              label: `${i + 1}) ${p.label}`,
              value: `ht:sub:${p.id}`,
            })),
            onChoice: buildHalftimeChoiceHandler(),
          },
        ]);
        return;
      }
      // Aplicação da escolha final
      if (value.startsWith('ht:formation:')) {
        const id = value.slice('ht:formation:'.length);
        script.onPickFormation(id);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', text: L('Formação ajustada. Bom jogo!', 'Formation set. Good game!') },
        ]);
        return;
      }
      if (value.startsWith('ht:style:')) {
        const id = value.slice('ht:style:'.length);
        script.onPickPlayStyle(id);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', text: L('Estilo aplicado. Vai com tudo!', 'Style applied. Go for it!') },
        ]);
        return;
      }
      if (value.startsWith('ht:sub:')) {
        const id = value.slice('ht:sub:'.length);
        script.onPickTiredPlayer(id);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', text: L('Beleza, vou abrir o banco pra você escolher quem entra.', 'Okay, opening the bench so you can pick who comes on.') },
        ]);
        return;
      }
    };
  };

  useEffect(() => {
    if (halftimeOpenKey == null) return;
    const script = halftimeScriptRef.current;
    if (!script) return;
    setIsOpen(true);
    setChatHistory([
      {
        role: 'assistant',
        text: L('Intervalo. Quer mudar algo?', 'Half-time. Want to change anything?'),
        choices: [
          { label: L('1) Mudar formação', '1) Change formation'), value: 'ht:menu:formation' },
          { label: L('2) Estilo de jogo', '2) Play style'), value: 'ht:menu:style' },
          { label: L('3) Substituir jogador', '3) Substitute player'), value: 'ht:menu:sub' },
        ],
        onChoice: buildHalftimeChoiceHandler(),
      },
    ]);
  }, [halftimeOpenKey]);

  // (Removido) — o trigger de fadiga >= 95 disparava substituição falsa antes
  // do apito porque o efeito re-rodava a cada render e não tinha guard de
  // jogador-único. O fluxo real de lesão é tratado pelo reducer via
  // `live.quickInjurySub` em MatchQuick.tsx (linhas ~1303-1408).

  const processCommand = async (userMessage: string) => {
    setIsProcessing(true);

    // Adicionar mensagem do usuário
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);

    // Simular processamento (aqui você pode integrar com API de IA real)
    await new Promise(resolve => setTimeout(resolve, 800));

    const lowerMsg = userMessage.toLowerCase();
    let response = '';

    // Comandos de substituição
    if (lowerMsg.includes('substituir') || lowerMsg.includes('trocar') || lowerMsg.includes('sub') || lowerMsg.includes('swap')) {
      if (benchPlayers.length === 0) {
        response = L('Não há jogadores disponíveis no banco para substituição.', 'No players available on the bench.');
      } else {
        // Encontrar jogador mais cansado
        const mostTired = availablePlayers.reduce((prev, curr) =>
          curr.fatigue > prev.fatigue ? curr : prev
        );

        const substitute = benchPlayers.find(b => b.position === mostTired.position) || benchPlayers[0];

        if (substitute && onSubstitution) {
          onSubstitution(mostTired.id, substitute.id, 'tactical');
          response = L(`Substituição realizada: ${mostTired.name} saiu, ${substitute.name} entrou.`, `Substitution made: ${mostTired.name} off, ${substitute.name} on.`);
        }
      }
    }
    // Comandos táticos
    else if (lowerMsg.includes('pressão') || lowerMsg.includes('pressao') || lowerMsg.includes('atacar') || lowerMsg.includes('press') || lowerMsg.includes('attack')) {
      if (onTacticalChange) {
        onTacticalChange('PRESSAO_ALTA');
        response = L('Tática alterada para PRESSÃO ALTA. Time mais agressivo!', 'Tactics set to HIGH PRESS. More aggressive team!');
      }
    }
    else if (lowerMsg.includes('defender') || lowerMsg.includes('defesa') || lowerMsg.includes('segurar') || lowerMsg.includes('defend') || lowerMsg.includes('hold')) {
      if (onTacticalChange) {
        onTacticalChange('BLOCO_BAIXO');
        response = L('Tática alterada para BLOCO BAIXO. Defesa reforçada!', 'Tactics set to LOW BLOCK. Defense reinforced!');
      }
    }
    else if (lowerMsg.includes('equilibr') || lowerMsg.includes('balanc') || lowerMsg.includes('normal')) {
      if (onTacticalChange) {
        onTacticalChange('POSSE_CONTROLADA');
        response = L('Tática alterada para POSSE CONTROLADA. Jogo equilibrado!', 'Tactics set to CONTROLLED POSSESSION. Balanced game!');
      }
    }
    else if (lowerMsg.includes('contra') || lowerMsg.includes('rápid') || lowerMsg.includes('rapido') || lowerMsg.includes('counter') || lowerMsg.includes('fast')) {
      if (onTacticalChange) {
        onTacticalChange('TRANSICAO_RAPIDA');
        response = L('Tática alterada para TRANSIÇÃO RÁPIDA. Contra-ataques ativados!', 'Tactics set to FAST TRANSITION. Counter-attacks on!');
      }
    }
    // Análise do jogo
    else if ((lowerMsg.includes('como') && (lowerMsg.includes('jogo') || lowerMsg.includes('partida'))) || (lowerMsg.includes('how') && (lowerMsg.includes('game') || lowerMsg.includes('match')))) {
      const avgFatigue = availablePlayers.reduce((sum, p) => sum + p.fatigue, 0) / availablePlayers.length;
      response = L(`Análise do jogo:\n• Fadiga média: ${Math.round(avgFatigue)}%\n• Jogadores disponíveis: ${availablePlayers.length}\n• Banco: ${benchPlayers.length} jogadores`, `Match analysis:\n• Average fatigue: ${Math.round(avgFatigue)}%\n• Available players: ${availablePlayers.length}\n• Bench: ${benchPlayers.length} players`);
    }
    // Resposta padrão
    else {
      response = L(`Entendi! Posso ajudar com:\n• "Substituir jogador cansado"\n• "Pressionar mais"\n• "Defender resultado"\n• "Como está o jogo?"`, `Got it! I can help with:\n• "Sub tired player"\n• "Press more"\n• "Defend the lead"\n• "How's the game going?"`);
    }

    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    setIsProcessing(false);
    setMessage('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      processCommand(message.trim());
    }
  };

  return (
    <>
      {/* FAB — botão flutuante editorial Legacy Tech (sem gradiente, neon-yellow rail) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[100] flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center bg-deep-black border-2 border-neon-yellow text-neon-yellow transition-colors hover:bg-neon-yellow hover:text-black"
            style={{ borderRadius: 'var(--radius-pill)' }}
            aria-label={L('Assistente tático', 'Tactical assistant')}
          >
            <Bot className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel — refatorado com tokens Legacy Tech */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[100] w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] flex flex-col overflow-hidden border border-l-[3px] border-[var(--color-border)] border-l-neon-yellow bg-dark-gray"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {/* Header editorial */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-divider-yellow)] bg-deep-black/60 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-9 w-9 items-center justify-center bg-neon-yellow text-black"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <Bot className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p
                    className="font-display uppercase text-neon-yellow truncate"
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                      lineHeight: 1,
                    }}
                  >
                    {L('Assistente Tático', 'Tactical Assistant')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                style={{ borderRadius: 'var(--radius-sm)' }}
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px] bg-dark-gray">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
                  <span
                    className="block h-[2px] w-10 bg-neon-yellow/70 mb-1"
                    aria-hidden
                  />
                  <p
                    className="font-display uppercase text-white/85"
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.24em',
                    }}
                  >
                    {L('Olá, treinador', 'Hello, coach')}
                  </p>
                  <p className="text-xs text-white/45 max-w-xs leading-relaxed">
                    {L('Peça tática, substituição ou leitura do jogo.', 'Ask for tactics, a sub or a match read.')}
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
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center bg-neon-yellow text-black"
                        style={{ borderRadius: 'var(--radius-sm)' }}
                      >
                        <Bot className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 max-w-[85%]">
                      <div
                        className={cn(
                          'px-3 py-2 border',
                          msg.role === 'user'
                            ? 'bg-neon-yellow text-black border-neon-yellow font-bold'
                            : 'bg-deep-black/60 text-white/90 border-white/10'
                        )}
                        style={{ borderRadius: 'var(--radius-sm)' }}
                      >
                        <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                      </div>
                      {msg.role === 'assistant' && msg.choices && msg.choices.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {msg.choices.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => msg.onChoice?.(c.value, c.label)}
                              className="text-left border border-neon-yellow/45 bg-neon-yellow/[0.06] px-3 py-2 text-xs text-neon-yellow font-display font-bold uppercase tracking-wider transition-all hover:bg-neon-yellow hover:text-black hover:border-neon-yellow active:scale-[0.98]"
                              style={{
                                fontSize: '11px',
                                letterSpacing: '0.12em',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
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
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center bg-neon-yellow text-black"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </div>
                  <div
                    className="px-3 py-2 bg-deep-black/60 border border-white/10"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <Loader2 className="h-4 w-4 text-neon-yellow animate-spin" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-[var(--color-divider-yellow)] bg-deep-black/60 p-3"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={L('Digite o comando...', 'Type a command...')}
                  disabled={isProcessing}
                  className="flex-1 border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-neon-yellow/60 focus:outline-none disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                />
                <button
                  type="submit"
                  disabled={!message.trim() || isProcessing}
                  className="inline-flex items-center justify-center bg-neon-yellow px-4 py-2 text-black font-display font-black uppercase tracking-wider transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  aria-label={L('Enviar', 'Send')}
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
