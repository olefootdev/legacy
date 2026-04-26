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
import { Send, Zap, MessageSquare } from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import {
  parseCoachCommand,
  executeCoachCommand,
  getSkillSuggestions,
  type CommandResult,
} from '@/match/coachCommands';
import { cn } from '@/lib/utils';

interface CoachCommandInputProps {
  players: PitchPlayerState[];
  playersById: Record<string, PlayerEntity>;
  onCommandExecuted?: (result: CommandResult) => void;
}

export function CoachCommandInput({
  players,
  playersById,
  onCommandExecuted,
}: CoachCommandInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = () => {
    if (!input.trim()) return;

    const parsed = parseCoachCommand(input);
    if (!parsed) {
      onCommandExecuted?.({
        success: false,
        message: 'Comando inválido',
      });
      return;
    }

    const result = executeCoachCommand(parsed, players, playersById);
    onCommandExecuted?.(result);

    if (result.success) {
      setInput('');
    }
  };

  const getPlaceholder = () => {
    if (input.startsWith('@@@')) return 'Mensagem para todo o time...';
    if (input.startsWith('@@')) return 'Mensagem para o setor...';
    if (input.startsWith('@')) return 'Mensagem para o jogador...';
    if (input.startsWith('/')) return 'Digite o nome da skill...';
    return '@ jogador | @@ setor | @@@ time | /skill';
  };

  return (
    <div className="relative">
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
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-all',
            input.trim()
              ? 'bg-neon-yellow text-black hover:bg-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

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
      </div>
    </div>
  );
}
