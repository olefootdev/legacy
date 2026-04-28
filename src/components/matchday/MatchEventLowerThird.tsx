/**
 * MatchEventLowerThird (F3 — Olefoot Broadcast)
 *
 * Banda diegética de transmissão (broadcast lower-third).
 * Aparece para cartão / falta perigosa / substituição / defesa importante.
 * Auto-dismiss configurável; toca padrões da CSS `.ole-lt`.
 */
import { useEffect, useState } from 'react';

export type EventTone = 'card-yellow' | 'card-red' | 'foul' | 'sub' | 'save';

export interface MatchEventLowerThirdProps {
  tone: EventTone;
  /** Headline curto (ex: "CARTÃO AMARELO"). */
  label: string;
  /** Linha 2 (ex: "#7 Silva — falta dura no meio-campo"). */
  detail?: string;
  /** Minuto do evento. */
  minute?: number | null;
  /** Bumped externamente para disparar. Quando muda, o banner reentra. */
  triggerKey: string | null;
  /** ms até auto-dismiss (default 2400). */
  durationMs?: number;
  onDismiss?: () => void;
}

const TONE_LABEL: Record<EventTone, string> = {
  'card-yellow': 'Amarelo',
  'card-red': 'Vermelho',
  foul: 'Falta',
  sub: 'Substituição',
  save: 'Defesa',
};

export function MatchEventLowerThird({
  tone,
  label,
  detail,
  minute,
  triggerKey,
  durationMs = 2400,
  onDismiss,
}: MatchEventLowerThirdProps) {
  const [state, setState] = useState<'idle' | 'entering' | 'visible' | 'exiting'>('idle');

  useEffect(() => {
    if (triggerKey == null) return;
    setState('entering');
    const visTimer = window.setTimeout(() => setState('visible'), 420);
    const exitTimer = window.setTimeout(() => setState('exiting'), durationMs);
    const doneTimer = window.setTimeout(() => {
      setState('idle');
      onDismiss?.();
    }, durationMs + 420);
    return () => {
      clearTimeout(visTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [triggerKey, durationMs, onDismiss]);

  if (state === 'idle') return null;

  return (
    <div
      className="fixed left-0 z-[300] pointer-events-none"
      style={{ bottom: 'calc(var(--letterbox-h) + 18px)' }}
    >
      <div
        className="ole-lt"
        data-tone={tone}
        data-state={state === 'exiting' ? 'exiting' : 'entering'}
      >
        <div className="flex items-center gap-4 min-w-[260px]">
          {/* Eyebrow + minuto */}
          <div className="flex flex-col items-start gap-0.5 leading-tight">
            <span
              className="font-ui font-bold"
              style={{
                fontSize: '9px',
                letterSpacing: '0.36em',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              {TONE_LABEL[tone]}
            </span>
            {minute != null && (
              <span
                className="font-display font-black tabular-nums leading-none"
                style={{
                  fontSize: '18px',
                  color:
                    tone === 'card-red'
                      ? 'var(--color-event-card-red)'
                      : tone === 'card-yellow'
                        ? 'var(--color-event-card-yellow)'
                        : tone === 'save'
                          ? 'var(--color-event-save)'
                          : tone === 'sub'
                            ? 'var(--color-event-substitution)'
                            : 'var(--color-event-foul)',
                }}
              >
                {minute}'
              </span>
            )}
          </div>
          <div
            style={{
              width: '1px',
              height: '32px',
              background: 'rgba(255,255,255,0.18)',
            }}
          />
          {/* Label + detail */}
          <div className="flex flex-col gap-0.5 leading-tight">
            <span
              className="font-display font-black uppercase text-white"
              style={{
                fontSize: '16px',
                letterSpacing: '0.06em',
              }}
            >
              {label}
            </span>
            {detail && (
              <span
                className="font-ui text-white/70"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                }}
              >
                {detail}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
