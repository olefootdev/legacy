import { useState, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { L } from '@/i18n/L';

interface Props {
  disabled?: boolean;
  minuteApprox: number;
}

export function CoachTechnicalCommandsBlock({ disabled, minuteApprox }: Props) {
  const dispatch = useGameDispatch();
  const [text, setText] = useState('');
  const headCmd = useGameStore((s) => s.liveMatch?.liveStory?.coachCommandLog[0]);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    dispatch({ type: 'COACH_TECHNICAL_COMMAND', text: t });
    setText('');
  }, [text, disabled, dispatch]);

  return (
    <div className="w-full border-t border-white/10 bg-black/70 px-3 py-2 space-y-2 shrink-0">
      <div className="text-[9px] font-display font-bold uppercase tracking-widest text-white/50">
        {L('Comandos técnicos', 'Technical commands')}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex-1 flex gap-1.5 min-w-0">
          <input
            type="text"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder={L(`Instrução (~${minuteApprox}')…`, `Instruction (~${minuteApprox}')…`)}
            className="flex-1 min-w-0 bg-black/80 border border-white/15 rounded px-2 py-1.5 text-[11px] text-white placeholder:text-white/35 focus:border-neon-yellow/60 outline-none disabled:opacity-40"
            aria-label={L('Comando técnico em texto', 'Technical command as text')}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={send}
            className="shrink-0 px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider bg-neon-yellow text-black rounded hover:opacity-90 disabled:opacity-40"
          >
            {L('Enviar', 'Send')}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40 border border-white/10 rounded px-2 py-1.5 bg-black/50">
          <Mic className="w-3.5 h-3.5 shrink-0 opacity-50" aria-hidden />
          <span>{L('Áudio — em breve', 'Audio — coming soon')}</span>
        </div>
      </div>
      {headCmd && (
        <p
          className={`text-[10px] leading-snug ${headCmd.relevant ? 'text-neon-green' : 'text-white/45'}`}
        >
          {headCmd.relevant
            ? L('Comando relevante: pesos do roteiro ajustados.', 'Relevant command: script weights adjusted.')
            : L('Comando registrado — sem efeito tático nos pesos.', 'Command logged — no tactical effect on weights.')}
          <span className="text-white/30"> · {headCmd.text.slice(0, 48)}</span>
        </p>
      )}
    </div>
  );
}
