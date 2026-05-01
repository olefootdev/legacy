/**
 * LegacyMinuteWatermark — minuto Moret italic, branco no campo.
 * Canto inferior direito, ambient typography.
 */
interface LegacyMinuteWatermarkProps {
  minute: number;
  phase: 'playing' | 'halftime' | 'fulltime';
  /** @deprecated não exibido — mantido por compat */
  momentLabel?: string | null;
  possessionPct?: { home: number; away: number };
}

export function LegacyMinuteWatermark({ minute, possessionPct }: LegacyMinuteWatermarkProps) {
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
      {possessionPct && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: 'flex-end', marginTop: 6,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.15em', color: '#FDE100',
          }}>
            {possessionPct.home}%
          </span>
          <div style={{
            width: 48, height: 3, display: 'flex', gap: 1, borderRadius: 1, overflow: 'hidden',
          }}>
            <div style={{
              flex: possessionPct.home, background: '#FDE100',
              transition: 'flex 600ms ease',
            }} />
            <div style={{
              flex: possessionPct.away, background: 'rgba(255,255,255,0.25)',
              transition: 'flex 600ms ease',
            }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)',
          }}>
            {possessionPct.away}%
          </span>
        </div>
      )}
    </div>
  );
}
