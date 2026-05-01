import { useEffect, useState } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';

export type HeatmapZone = VoiceIntent | null;

const HEATMAP_CONFIG: Record<string, { x: number; y: number; w: number; h: number; label: string; color: string }> = {
  team_press_high: { x: 0, y: 0, w: 40, h: 100, label: 'PRESSÃO ALTA', color: 'rgba(239,68,68,0.15)' },
  team_retreat: { x: 0, y: 0, w: 50, h: 100, label: 'DEFESA', color: 'rgba(59,130,246,0.12)' },
  pedal_to_metal: { x: 60, y: 0, w: 40, h: 100, label: 'ATAQUE', color: 'rgba(16,185,129,0.15)' },
  team_hold_possession: { x: 30, y: 20, w: 40, h: 60, label: 'POSSE', color: 'rgba(253,225,0,0.10)' },
  stretch_team: { x: 20, y: 10, w: 60, h: 80, label: 'AMPLITUDE', color: 'rgba(168,85,247,0.12)' },
  left_back_overlap: { x: 40, y: 70, w: 40, h: 30, label: 'OVERLAP ESQ', color: 'rgba(236,72,153,0.15)' },
  team_high_line: { x: 30, y: 0, w: 40, h: 50, label: 'LINHA ALTA', color: 'rgba(14,165,233,0.12)' },
  forwards_press_defenders: { x: 50, y: 20, w: 40, h: 60, label: 'PRESSÃO ATK', color: 'rgba(239,68,68,0.12)' },
  break_line: { x: 60, y: 30, w: 35, h: 40, label: 'PENETRAÇÃO', color: 'rgba(34,197,94,0.15)' },
  calm_team: { x: 30, y: 30, w: 40, h: 40, label: 'ESTÁVEL', color: 'rgba(107,114,128,0.10)' },
};

interface TacticalHeatmapProps {
  intent: HeatmapZone;
}

export function useTacticalHeatmap() {
  const [intent, setIntent] = useState<HeatmapZone>(null);

  const show = (newIntent: VoiceIntent) => {
    setIntent(newIntent);
    const t = setTimeout(() => setIntent(null), 3000);
    return () => clearTimeout(t);
  };

  return { intent, show };
}

export function TacticalHeatmap({ intent }: TacticalHeatmapProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!intent) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [intent]);

  if (!intent || !visible) return null;

  const cfg = HEATMAP_CONFIG[intent];
  if (!cfg) return null;

  return (
    <div
      className="absolute inset-0 z-[150] pointer-events-none"
      style={{
        animation: 'heatmapIn 280ms cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Heatmap rect */}
      <div
        style={{
          position: 'absolute',
          left: `${cfg.x}%`,
          top: `${cfg.y}%`,
          width: `${cfg.w}%`,
          height: `${cfg.h}%`,
          background: cfg.color,
          border: `2px solid ${cfg.color.replace('0.15', '0.6').replace('0.12', '0.5').replace('0.10', '0.4')}`,
          borderRadius: 2,
          boxShadow: `inset 0 0 20px ${cfg.color}`,
          animation: 'heatmapPulse 1.5s ease-in-out infinite',
        }}
      />

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: `${cfg.x + cfg.w / 2}%`,
          top: `${cfg.y + cfg.h / 2}%`,
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.15em',
          color: cfg.color.replace('0.15', '0.8').replace('0.12', '0.7').replace('0.10', '0.6'),
          textTransform: 'uppercase',
          textAlign: 'center',
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          animation: 'heatmapFade 3s ease-out forwards',
        }}
      >
        {cfg.label}
      </div>
    </div>
  );
}
