/**
 * FalePlayerBar — comando do Legacy Mode (editorial Legacy Tech).
 * Eyebrow Agency + linha mic + input + send + ATIVAR LEGACY.
 * Feedback Moret italic. Fixa no rodapé.
 */
import { useCallback, useState } from 'react';
import { Mic, Send, Sparkles } from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { processVoiceCommand, type VoiceCommandResult } from '@/voiceCommand/voiceCommandProcessor';

const NEON = '#FDE100';

interface FalePlayerBarProps {
  players: PitchPlayerState[];
  ballCarrierId?: string;
  minute: number;
  onLegacyToggle?: (active: boolean) => void;
  onIntent?: (result: VoiceCommandResult) => void;
}

export function FalePlayerBar({
  players,
  ballCarrierId,
  minute,
  onLegacyToggle,
  onIntent,
}: FalePlayerBarProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; intent?: string; player?: string; raw: string } | null>(null);
  const [legacyActive, setLegacyActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (raw: string) => {
    const transcript = raw.trim();
    if (!transcript || busy) return;
    setBusy(true);
    try {
      const res = await processVoiceCommand({
        transcript,
        players,
        playersById: {},
        ballCarrierId,
        side: 'home',
        minute,
      });
      onIntent?.(res);
      const player = res.targetPlayers?.[0]
        ? players.find((p) => p.playerId === res.targetPlayers?.[0])?.name?.split(' ')[0]
        : undefined;
      setFeedback({
        ok: res.success,
        intent: res.intent,
        player,
        raw: res.success ? transcript : res.message,
      });
      if (res.success) setText('');
    } catch (err) {
      setFeedback({ ok: false, raw: (err as Error).message });
    } finally {
      setBusy(false);
      window.setTimeout(() => setFeedback(null), 4000);
    }
  }, [players, ballCarrierId, minute, busy, onIntent]);

  const voice = useVoiceRecognition({
    lang: 'pt-BR',
    maxSecs: 5,
    onResult: (t) => submit(t),
    onError: (m) => setFeedback({ ok: false, raw: m }),
    onInterim: (t) => setText(t),
  });

  const listening = voice.state === 'listening';

  const toggleLegacy = () => {
    const next = !legacyActive;
    setLegacyActive(next);
    onLegacyToggle?.(next);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 140,
        background: 'rgba(13,13,13,0.96)',
        backdropFilter: 'blur(8px)',
        borderTop: `1px solid rgba(253,225,0,0.18)`,
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
      }}
    >
      {/* Régua amarela superior (animada quando ouvindo) */}
      <div
        aria-hidden
        style={{
          height: 2,
          width: '100%',
          background: listening
            ? `linear-gradient(90deg, transparent 0%, ${NEON} 50%, transparent 100%)`
            : `linear-gradient(90deg, transparent 0%, rgba(253,225,0,0.55) 50%, transparent 100%)`,
          animation: listening ? 'shimmer 1.4s ease-in-out infinite' : 'none',
        }}
      />

      {/* Feedback Moret — sobre a barra */}
      {feedback && (
        <div
          style={{
            padding: '10px 20px 6px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {feedback.ok && feedback.intent ? (
            <>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.32em',
                  color: NEON,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {feedback.intent.replace(/_/g, ' ')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: 16,
                  letterSpacing: '-0.01em',
                  color: '#fff',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {feedback.player ? `${feedback.player}, ` : ''}{feedback.raw.toLowerCase()}.
              </span>
            </>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.24em',
                color: '#EF4444',
                textTransform: 'uppercase',
              }}
            >
              ⚠ {feedback.raw}
            </span>
          )}
        </div>
      )}

      {/* Eyebrow + linha de input */}
      <div style={{ padding: '10px 20px 14px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.32em',
            color: NEON,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Fale com o time
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mic */}
          <button
            type="button"
            onClick={() => (listening ? voice.stop() : voice.start())}
            disabled={!voice.supported}
            aria-label={listening ? 'Parar captura' : 'Falar com o time'}
            title={voice.supported ? (listening ? 'Parar' : 'Falar') : 'Voz não suportada'}
            style={{
              background: listening ? '#EF4444' : 'transparent',
              border: `1px solid ${listening ? '#EF4444' : 'rgba(253,225,0,0.55)'}`,
              color: listening ? '#fff' : NEON,
              width: 44,
              height: 44,
              borderRadius: 4,
              cursor: voice.supported ? 'pointer' : 'not-allowed',
              opacity: voice.supported ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms',
              boxShadow: listening ? '0 0 16px rgba(239,68,68,0.55)' : 'none',
            }}
          >
            <Mic size={18} strokeWidth={listening ? 2.5 : 2} />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(text);
            }}
            placeholder={listening ? 'ouvindo…' : 'diga ao Lucas para chutar…'}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontStyle: 'italic',
              fontSize: 13,
              padding: '0 14px',
              height: 44,
              outline: 'none',
              borderRadius: 4,
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(253,225,0,0.55)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
          />

          {/* Send icon */}
          <button
            type="button"
            onClick={() => submit(text)}
            disabled={!text.trim() || busy}
            aria-label="Enviar comando"
            title="Enviar"
            style={{
              background: text.trim() && !busy ? NEON : 'transparent',
              color: text.trim() && !busy ? '#000' : 'rgba(253,225,0,0.4)',
              border: `1px solid ${text.trim() && !busy ? NEON : 'rgba(253,225,0,0.25)'}`,
              width: 44,
              height: 44,
              borderRadius: 4,
              cursor: text.trim() && !busy ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 150ms',
              boxShadow: text.trim() && !busy ? '0 8px 24px rgba(253,225,0,0.18)' : 'none',
            }}
          >
            <Send size={16} strokeWidth={2.5} />
          </button>

          {/* Legacy — botão quadrado, Moret italic */}
          <button
            type="button"
            onClick={toggleLegacy}
            aria-pressed={legacyActive}
            aria-label={legacyActive ? 'Desativar Legacy' : 'Ativar Legacy'}
            title={legacyActive ? 'Legacy ativo' : 'Ativar Legacy'}
            style={{
              background: legacyActive ? '#0D0D0D' : NEON,
              color: legacyActive ? NEON : '#000',
              border: `2px solid ${NEON}`,
              width: 44,
              height: 44,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 200ms',
              boxShadow: legacyActive
                ? '0 0 18px rgba(253,225,0,0.65)'
                : '0 8px 24px rgba(253,225,0,0.18)',
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              padding: 0,
            }}
          >
            Legacy
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
