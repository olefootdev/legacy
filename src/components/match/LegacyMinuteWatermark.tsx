/**
 * LegacyMinuteWatermark — minuto Moret italic, branco no campo.
 * Canto inferior direito, ambient typography.
 */
interface LegacyMinuteWatermarkProps {
  minute: number;
  phase: 'playing' | 'halftime' | 'fulltime';
  /** @deprecated não exibido — mantido por compat */
  momentLabel?: string | null;
}

export function LegacyMinuteWatermark({ minute }: LegacyMinuteWatermarkProps) {
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
          color: '#fff',
          lineHeight: 0.85,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {minute}'
      </div>
    </div>
  );
}
