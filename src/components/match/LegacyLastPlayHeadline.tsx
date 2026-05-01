/**
 * LegacyLastPlayHeadline — última jogada como manchete editorial.
 * Eyebrow Agency (kind + minute) + frase Moret italic + régua. Fade após 4s.
 */
import { useEffect, useState } from 'react';

const NEON = '#FDE100';

const KIND_LABELS: Record<string, string> = {
  goal: 'GOL',
  shot: 'FINALIZAÇÃO',
  rebound: 'REBOTE',
  corner: 'ESCANTEIO',
  freekick: 'FALTA',
  possession_change: 'POSSE',
  pass: 'PASSE',
  tackle: 'DESARME',
  interception: 'INTERCEPTAÇÃO',
  save: 'DEFESA',
};

interface LegacyLastPlayHeadlineProps {
  text: string | null;
  kind?: string;
  minute: number;
  isGoal?: boolean;
}

export function LegacyLastPlayHeadline({ text, kind, minute, isGoal }: LegacyLastPlayHeadlineProps) {
  const [visible, setVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<{ text: string; kind?: string; minute: number } | null>(null);

  useEffect(() => {
    if (!text) return;
    setSnapshot({ text, kind, minute });
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), isGoal ? 6000 : 4000);
    return () => window.clearTimeout(t);
  }, [text, kind, minute, isGoal]);

  if (!snapshot) return null;

  const label = (snapshot.kind && KIND_LABELS[snapshot.kind]) ?? 'JOGADA';

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 20,
        maxWidth: '55%',
        zIndex: 90,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 320ms ease-out, transform 320ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 4,
          padding: '8px 14px 10px',
          background: 'rgba(8,8,8,0.85)',
          borderLeft: `3px solid ${NEON}`,
          backdropFilter: 'blur(4px)',
          maxWidth: '100%',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.32em',
            color: NEON,
            textTransform: 'uppercase',
          }}
        >
          {label} · {snapshot.minute}'
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: isGoal ? 'clamp(22px, 3.5vw, 30px)' : 'clamp(14px, 1.8vw, 18px)',
            letterSpacing: '-0.02em',
            color: isGoal ? NEON : '#fff',
            lineHeight: 1.15,
            textShadow: isGoal ? '0 0 18px rgba(253,225,0,0.55)' : 'none',
          }}
        >
          {snapshot.text}
        </div>
      </div>
    </div>
  );
}
