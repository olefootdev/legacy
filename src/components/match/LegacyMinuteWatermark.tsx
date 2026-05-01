/**
 * LegacyMinuteWatermark — minuto gigante em Moret italic, opacity baixa.
 * Sobre o gramado, canto inferior direito, ambient typography.
 */
const NEON = '#FDE100';

interface LegacyMinuteWatermarkProps {
  minute: number;
  phase: 'playing' | 'halftime' | 'fulltime';
  momentLabel?: string | null;
}

export function LegacyMinuteWatermark({ minute, phase, momentLabel }: LegacyMinuteWatermarkProps) {
  const phaseText = phase === 'halftime' ? 'INTERVALO' : phase === 'fulltime' ? 'FIM DE JOGO' : (momentLabel ?? 'BOLA ROLANDO');

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        bottom: 16,
        zIndex: 50,
        pointerEvents: 'none',
        textAlign: 'right',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 'clamp(48px, 8vw, 88px)',
          letterSpacing: '-0.04em',
          color: 'rgba(255,255,255,0.12)',
          lineHeight: 0.85,
          fontVariantNumeric: 'tabular-nums',
          textShadow: phase === 'playing' ? `0 0 32px rgba(253,225,0,0.08)` : 'none',
        }}
      >
        {minute}'
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.32em',
          color: 'rgba(253,225,0,0.35)',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {phaseText}
      </div>
    </div>
  );
}
