/**
 * CoachCommandInput — input de comandos táticos com autocomplete.
 *
 * Sintaxe:
 * - @ <nome>           → fala com jogador
 * - @@ <setor>         → fala com setor
 * - @@@ <mensagem>     → fala com todo o time
 * - /<skill>           → ativa skill (autocomplete)
 * - @<nome> /<skill>   → ativa skill em jogador
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Zap, MessageSquare, Mic, MicOff, RotateCcw, Undo2 } from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import {
  parseCoachCommand,
  executeCoachCommand,
  getSkillSuggestions,
  type CommandResult,
} from '@/match/coachCommands';
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useAudioWaveform } from '@/hooks/useAudioWaveform';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { useVoiceCommandDispatch } from '@/hooks/useVoiceCommandDispatch';

interface CoachCommandInputProps {
  players: PitchPlayerState[];
  playersById: Record<string, PlayerEntity>;
  onCommandExecuted?: (result: CommandResult) => void;
  /** ID do portador da bola. */
  ballCarrierId?: string;
  /** Side do time (home/away). */
  side?: 'home' | 'away';
  /** Minuto da partida. */
  minute?: number;
  /** Obediência do time (0-100). */
  teamObedience?: number;
  /** Relação manager-jogador por ID. */
  managerRelationByPlayer?: Record<string, number>;
}

export function CoachCommandInput({
  players,
  playersById,
  onCommandExecuted,
  ballCarrierId,
  side = 'home',
  minute = 0,
  teamObedience = 30,
  managerRelationByPlayer = {},
}: CoachCommandInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHoldingRef = useRef(false);

  // Fase 1: Feedback imediato
  const feedback = useVoiceFeedback();
  const [buttonState, setButtonState] = useState<'idle' | 'sent' | 'processing'>('idle');

  // Hook de dispatch para reducer
  const { dispatchVoiceCommand } = useVoiceCommandDispatch();

  // Fase 3: Histórico de comandos
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Fase 4: Cancelamento rápido
  const [recentCommands, setRecentCommands] = useState<Array<{
    id: string;
    timestamp: number;
    text: string;
  }>>([]);

  // Fase 2: Preview visual
  const [previewCommand, setPreviewCommand] = useState<string | null>(null);

  const voice = useVoiceRecognition({
    lang: 'pt-BR',
    maxSecs: 5,
    onStart: () => {
      setButtonState('idle');
    },
    onInterim: (interimText) => {
      // Fase 2: Preview visual durante transcrição
      setPreviewCommand(interimText);
    },
    onResult: async (transcript) => {
      setInput(transcript);
      setPreviewCommand(null);

      // Fase 1: Feedback imediato ao receber transcrição
      feedback.triggerFeedback('sent');
      setButtonState('sent');

      // Fase 3: Adiciona ao histórico
      setCommandHistory(prev => [...prev.slice(-9), transcript]);
      setHistoryIndex(-1);

      // Auto-submit após transcrição
      window.setTimeout(async () => {
        setButtonState('processing');

        // Processa comando com biblioteca + parser + validação + dispatch
        const result = await dispatchVoiceCommand({
          transcript,
          players,
          playersById,
          ballCarrierId,
          side,
          minute,
          teamObedience,
          managerRelationByPlayer,
        });

        // Fase 4: Adiciona aos comandos recentes (undo window)
        if (result.success) {
          const cmdId = `cmd_${Date.now()}`;
          setRecentCommands(prev => [...prev, {
            id: cmdId,
            timestamp: Date.now(),
            text: transcript,
          }]);

          // Remove após 3s
          window.setTimeout(() => {
            setRecentCommands(prev => prev.filter(c => c.id !== cmdId));
          }, 3000);
        }

        // Converte resultado para formato CommandResult
        const commandResult: CommandResult = {
          success: result.success,
          message: result.message,
          targetPlayers: result.targetPlayers,
        };

        onCommandExecuted?.(commandResult);

        // Fase 1: Feedback de sucesso/erro
        if (result.success) {
          feedback.triggerFeedback('success');
          setInput('');
        } else {
          feedback.triggerFeedback('error');
        }

        window.setTimeout(() => setButtonState('idle'), 500);
      }, 100);
    },
    onError: (msg) => {
      setPreviewCommand(null);
      feedback.triggerFeedback('error');
      setButtonState('idle');
      onCommandExecuted?.({
        success: false,
        message: `🎤 ${msg}`,
      });
    },
  });

  const waveform = useAudioWaveform(voice.state === 'listening');

  // Update suggestions quando input muda
  useEffect(() => {
    if (input.includes('/')) {
      const skills = getSkillSuggestions(input, players, playersById);
      setSuggestions(
        skills.map((s) => ({
          id: s.id,
          name: s.name,
          type: 'skill',
        }))
      );
      setShowSuggestions(skills.length > 0);
      setSelectedIndex(0);
    } else if (input.startsWith('@') && !input.startsWith('@@')) {
      // Autocomplete de jogadores
      const namePrefix = input.slice(1).split(/\s/)[0].toLowerCase();
      const matches = players
        .filter((p) => p.name.toLowerCase().includes(namePrefix))
        .slice(0, 5);
      setSuggestions(
        matches.map((p) => ({
          id: p.playerId,
          name: p.name,
          type: 'player',
        }))
      );
      setShowSuggestions(matches.length > 0 && namePrefix.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [input, players, playersById]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Fase 3: Histórico com setas
    if (e.key === 'ArrowUp' && !showSuggestions && commandHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex] || '');
      return;
    }

    if (e.key === 'ArrowDown' && !showSuggestions && historyIndex !== -1) {
      e.preventDefault();
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      }
      return;
    }

    if (!showSuggestions) {
      if (e.key === 'Enter') {
        handleSubmit();
      }
      return;
    }

    // Navegação no autocomplete
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: { id: string; name: string; type: string }) => {
    if (suggestion.type === 'skill') {
      // Substitui /partial por /skillId
      const beforeSlash = input.substring(0, input.lastIndexOf('/'));
      setInput(`${beforeSlash}/${suggestion.id} `);
    } else if (suggestion.type === 'player') {
      // Substitui @partial por @nome
      setInput(`@${suggestion.name} `);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    // Fase 1: Feedback imediato
    feedback.triggerFeedback('sent');
    setButtonState('processing');

    // Fase 3: Adiciona ao histórico
    setCommandHistory(prev => [...prev.slice(-9), input]);
    setHistoryIndex(-1);

    // Processa comando com biblioteca + parser + validação + dispatch
    const result = await dispatchVoiceCommand({
      transcript: input,
      players,
      playersById,
      ballCarrierId,
      side,
      minute,
      teamObedience,
      managerRelationByPlayer,
    });

    // Fase 4: Adiciona aos comandos recentes (undo window)
    if (result.success) {
      const cmdId = `cmd_${Date.now()}`;
      setRecentCommands(prev => [...prev, {
        id: cmdId,
        timestamp: Date.now(),
        text: input,
      }]);

      // Remove após 3s
      window.setTimeout(() => {
        setRecentCommands(prev => prev.filter(c => c.id !== cmdId));
      }, 3000);
    }

    // Converte resultado para formato CommandResult
    const commandResult: CommandResult = {
      success: result.success,
      message: result.message,
      targetPlayers: result.targetPlayers,
    };

    onCommandExecuted?.(commandResult);

    // Fase 1: Feedback de sucesso/erro
    if (result.success) {
      feedback.triggerFeedback('success');
      setInput('');
    } else {
      feedback.triggerFeedback('error');
    }

    window.setTimeout(() => setButtonState('idle'), 500);
  };

  const getPlaceholder = () => {
    if (input.startsWith('@@@')) return 'Mensagem para todo o time...';
    if (input.startsWith('@@')) return 'Mensagem para o setor...';
    if (input.startsWith('@')) return 'Mensagem para o jogador...';
    if (input.startsWith('/')) return 'Digite o nome da skill...';
    return '@ jogador | @@ setor | @@@ time | /skill';
  };

  const handleMicDown = () => {
    console.log('[voice] handleMicDown chamado', {
      supported: voice.supported,
      hasPermission: voice.hasPermission,
      state: voice.state,
    });

    if (!voice.supported) {
      console.log('[voice] Browser não suporta reconhecimento de voz');
      onCommandExecuted?.({
        success: false,
        message: '🎤 Este browser não suporta reconhecimento de voz',
      });
      return;
    }
    if (voice.state === 'listening') {
      console.log('[voice] Já está ouvindo, ignorando');
      return;
    }
    isHoldingRef.current = true;
    console.log('[voice] Chamando voice.start()...');
    voice.start();
  };

  const handleMicUp = () => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    if (voice.state === 'listening') {
      voice.stop();
    }
  };

  const listening = voice.state === 'listening';
  const processing = voice.state === 'processing';
  const liveText = voice.transcript + voice.interim;

  // Fase 3: Repetir último comando
  const repeatLastCommand = () => {
    if (commandHistory.length === 0) return;
    const lastCmd = commandHistory[commandHistory.length - 1];
    setInput(lastCmd);
    handleSubmit();
  };

  // Fase 4: Desfazer último comando
  const undoLastCommand = () => {
    if (recentCommands.length === 0) return;
    const last = recentCommands[recentCommands.length - 1];
    setRecentCommands(prev => prev.slice(0, -1));

    feedback.triggerFeedback('processing');
    onCommandExecuted?.({
      success: true,
      message: `↩️ Comando desfeito: "${last.text}"`,
    });
  };

  return (
    <div className="relative space-y-3">
      {/* Header do box */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-neon-yellow" />
        <h4
          className="text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-ui-sm)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Digite o comando
        </h4>
      </div>

      {/* Waveform + transcript ao vivo durante captura */}
      {(listening || processing) && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2',
            listening ? 'border-rose-400/60 bg-rose-500/10' : 'border-violet-400/60 bg-violet-500/10',
          )}
        >
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className={listening ? 'text-rose-200' : 'text-violet-200'}>
              {listening ? '🎤 Ouvindo…' : '⏳ Processando…'}
            </span>
            {listening && <span className="text-rose-300/70">max 5s</span>}
          </div>
          <div className="flex h-8 items-end justify-between gap-[2px]">
            {waveform.map((lv, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 rounded-full transition-all',
                  listening ? 'bg-rose-400' : 'bg-violet-400',
                )}
                style={{
                  height: `${Math.max(6, Math.round(lv * 32))}px`,
                  opacity: listening ? 0.9 : 0.4,
                }}
              />
            ))}
          </div>
          {liveText && <p className="mt-1 text-xs text-white/90 italic">"{liveText}"</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="w-full rounded-lg border border-white/20 bg-black/50 px-4 py-2.5 pr-10 font-mono text-sm text-white placeholder:text-white/40 focus:border-neon-yellow focus:outline-none"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {input.startsWith('/') ? (
              <Zap className="h-4 w-4 text-neon-yellow/60" />
            ) : input.startsWith('@') ? (
              <MessageSquare className="h-4 w-4 text-cyan-400/60" />
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onMouseDown={handleMicDown}
          onMouseUp={handleMicUp}
          onMouseLeave={handleMicUp}
          onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleMicUp(); }}
          disabled={!voice.supported}
          title={
            !voice.supported ? 'Browser não suporta voz' :
            !voice.hasPermission ? 'Clique para permitir acesso ao microfone' :
            'Segure pra falar (push-to-talk)'
          }
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all select-none relative',
            !voice.supported
              ? 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
              : !voice.hasPermission
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 animate-pulse'
              : listening
                ? 'border-rose-400/70 bg-rose-500 text-white animate-pulse'
                : 'border-violet-400/60 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30',
          )}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {!voice.hasPermission && voice.supported && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          )}
        </button>
        {/* Fase 3: Botão Repetir Último */}
        <button
          type="button"
          onClick={repeatLastCommand}
          disabled={commandHistory.length === 0 || listening}
          title="Repetir último comando (ou use Seta-Cima)"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg border transition-all',
            commandHistory.length > 0 && !listening
              ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
              : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
          )}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || listening}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-all',
            buttonState === 'sent' && 'animate-pulse scale-110',
            buttonState === 'processing' && 'animate-spin',
            input.trim() && !listening
              ? 'bg-neon-yellow text-black hover:bg-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Fase 4: Botão Desfazer (aparece por 3s) */}
      {recentCommands.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2">
          <button
            type="button"
            onClick={undoLastCommand}
            className="flex items-center gap-2 text-sm text-amber-200 hover:text-amber-100 transition-colors"
          >
            <Undo2 className="h-4 w-4" />
            <span>Desfazer "{recentCommands[recentCommands.length - 1]?.text.slice(0, 30)}..."</span>
          </button>
        </div>
      )}

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-12 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/20 bg-black/95 shadow-xl backdrop-blur-sm">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-neon-yellow/20 text-neon-yellow'
                  : 'text-white/80 hover:bg-white/10'
              )}
            >
              {suggestion.type === 'skill' ? (
                <Zap className="h-4 w-4 shrink-0" />
              ) : (
                <MessageSquare className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{suggestion.name}</div>
                <div className="truncate text-xs opacity-60">
                  {suggestion.type === 'skill' ? `/${suggestion.id}` : `@${suggestion.name}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Hints */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/40">
        <span className="rounded bg-white/5 px-2 py-1">@ jogador</span>
        <span className="rounded bg-white/5 px-2 py-1">@@ setor</span>
        <span className="rounded bg-white/5 px-2 py-1">@@@ time</span>
        <span className="rounded bg-white/5 px-2 py-1">/skill</span>
        {voice.supported && !voice.hasPermission && (
          <span className="rounded bg-amber-500/20 border border-amber-400/40 px-2 py-1 text-amber-200 animate-pulse">
            🎤 Clique no microfone para permitir acesso
          </span>
        )}
      </div>
    </div>
  );
}
