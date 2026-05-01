import { useEffect, useState } from 'react';

export type SectorZone = 'def' | 'mid' | 'att' | null;

const SECTOR_CONFIG = {
  def: { label: 'DEFESA',    xPct: 0,   wPct: 35, color: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.5)' },
  mid: { label: 'MEIO',      xPct: 35,  wPct: 30, color: 'rgba(253,225,0,0.08)',   border: 'rgba(253,225,0,0.45)' },
  att: { label: 'ATAQUE',    xPct: 65,  wPct: 35, color: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.5)' },
};

interface SectorFocusProps {
  zone: SectorZone;
}

export function SectorFocus({ zone }: SectorFocusProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!zone) { setVisible(false); return; }
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(t);
  }, [zone]);

  if (!zone || !visible) return null;

  const cfg = SECTOR_CONFIG[zone];

  return (
    <div
      className="absolute inset-0 z-[160] pointer-events-none"
      style={{ animation: 'sectorIn 220ms ease-out both' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${cfg.xPct}%`,
          width: `${cfg.wPct}%`,
          background: cfg.color,
          border: `1px solid ${cfg.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'sectorIn 220ms ease-out both',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.35em',
          color: cfg.border,
          textTransform: 'uppercase',
          opacity: 0.9,
        }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}
