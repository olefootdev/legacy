import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useAudioWaveform } from '@/hooks/useAudioWaveform';
import type { VoiceIntent } from '@/voiceCommand/types';

interface CommandCenterProps {
  onSubmit: (transcript: string) => void;
  onTagDispatch: (transcript: string, intent: VoiceIntent) => void;
  disabled?: boolean;
}

export function CommandCenter({ onSubmit, disabled }: CommandCenterProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const voice = useVoiceRecognition({
    lang: 'pt-BR',
    maxSecs: 5,
    onResult: (transcript) => {
      setInput(transcript);
      window.setTimeout(() => {
        onSubmit(transcript);
        setInput('');
      }, 120);
    },
    onError: () => {},
  });

  const waveform = useAudioWaveform(voice.state === 'listening');
  const listening = voice.state === 'listening';

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
    setInput('');
    inputRef.current?.focus();
  }, [input, onSubmit]);

  return (
    <div
      style={{
        padding: '8px 12px 10px',
        background: 'rgba(8,8,8,0.98)',
        borderTop: '1px solid rgba(253,225,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#0d0d0d',
          border: `1px solid ${listening ? 'rgba(253,225,0,0.55)' : 'rgba(255,255,255,0.1)'}`,
          padding: '0 4px 0 8px',
          transition: 'border-color 200ms ease',
        }}
      >
        {/* Mic button */}
        <button
          type="button"
          onMouseDown={() => !listening && voice.start()}
          onMouseUp={() => listening && voice.stop()}
          onMouseLeave={() => listening && voice.stop()}
          onTouchStart={(e) => { e.preventDefault(); !listening && voice.start(); }}
          onTouchEnd={(e) => { e.preventDefault(); listening && voice.stop(); }}
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            color: listening ? '#FDE100' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            padding: '8px 4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'color 150ms ease',
          }}
        >
          {listening ? <Mic size={15} /> : <MicOff size={15} />}
        </button>

        {/* Waveform during listening */}
        {listening && (
          <div className="flex items-end gap-px flex-shrink-0" style={{ height: 14 }}>
            {waveform.slice(0, 6).map((lv, i) => (
              <span key={i} style={{
                display: 'block',
                width: 2,
                height: `${Math.max(20, lv * 100)}%`,
                background: '#FDE100',
                borderRadius: 1,
                transition: 'height 80ms ease',
              }} />
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={listening ? (voice.transcript + voice.interim) : input}
          onChange={(e) => !listening && setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Mande um recado para o time..."
          disabled={disabled || listening}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: listening ? 'rgba(253,225,0,0.85)' : '#fff',
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
            fontSize: 12,
            padding: '9px 0',
            caretColor: '#FDE100',
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          style={{
            background: input.trim() ? '#FDE100' : 'rgba(253,225,0,0.08)',
            border: 'none',
            color: input.trim() ? '#000' : 'rgba(253,225,0,0.25)',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            padding: '7px 12px',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          ENVIAR <Send size={11} />
        </button>
      </div>
    </div>
  );
}
