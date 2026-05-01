/**
 * SmartPanel — 1 linha contextual: formação · estilo · humor da torcida.
 */
import { useState } from 'react';
import type { FormationSchemeId } from '@/match-engine/types';
import type { PlayingStylePresetId } from '@/tactics/playingStyle';

const NEON = '#FDE100';

const FORMATIONS: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1'];

const STYLES: { id: PlayingStylePresetId; label: string }[] = [
  { id: 'BLOCO_BAIXO',      label: 'Defender' },
  { id: 'POSSE_CONTROLADA', label: 'Posse' },
  { id: 'TRANSICAO_RAPIDA', label: 'Contra-Ataque' },
  { id: 'PRESSAO_ALTA',     label: 'Pressionar' },
  { id: 'JOGO_DIRETO',      label: 'Ataque Total' },
];

export type CameraTrackMode = 'static' | 'follow' | 'actioncam';


interface SmartPanelProps {
  formation: FormationSchemeId;
  onFormationChange: (f: FormationSchemeId) => void;
  /** Mantido p/ compat: caller continua dono do playStyle, só não exibimos buttons. */
  playStyle?: PlayingStylePresetId;
  onStyleChange?: (s: PlayingStylePresetId) => void;
  fanMood: number;
  cameraTrack?: CameraTrackMode;
  onCameraTrackChange?: (m: CameraTrackMode) => void;
}

export function SmartPanel({ formation, onFormationChange, fanMood, cameraTrack = 'static', onCameraTrackChange }: SmartPanelProps) {
  const [showFormations, setShowFormations] = useState(false);

  const moodColor = fanMood >= 70 ? NEON : fanMood >= 40 ? '#f97316' : '#ef4444';
  const moodLabel = fanMood >= 70 ? 'ANIMADA' : fanMood >= 40 ? 'NERVOSA' : 'VAIANDO';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'rgba(8,8,8,0.98)',
      borderTop: '1px solid rgba(253,225,0,0.06)',
      borderBottom: '1px solid rgba(253,225,0,0.06)',
      flexShrink: 0, position: 'relative',
      userSelect: 'none',
    }}>

      {/* ── Bloco 1: Formação ── */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        <button type="button" onClick={() => setShowFormations(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'transparent', border: 'none', padding: '7px 14px', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 14, fontWeight: 700, color: NEON, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{formation}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>▾</span>
        </button>
        {showFormations && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#0d0d0d', border: '1px solid rgba(253,225,0,0.18)', zIndex: 400, minWidth: 100 }}>
            {FORMATIONS.map(f => (
              <button key={f} type="button"
                onClick={() => { onFormationChange(f); setShowFormations(false); }}
                style={{ display: 'block', width: '100%', background: f === formation ? 'rgba(253,225,0,0.08)' : 'transparent', border: 'none', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 13, color: f === formation ? NEON : 'rgba(255,255,255,0.6)', textAlign: 'left', transition: 'background 120ms' }}
                onMouseEnter={e => { if (f !== formation) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (f !== formation) e.currentTarget.style.background = 'transparent'; }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bloco 2: Câmera (toggle Action) ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {(() => {
          const active = cameraTrack === 'actioncam';
          return (
            <button
              type="button"
              onClick={() => onCameraTrackChange?.(active ? 'static' : 'actioncam')}
              aria-pressed={active}
              style={{
                background: active ? NEON : 'transparent',
                border: `1px solid ${active ? NEON : 'rgba(255,255,255,0.18)'}`,
                color: active ? '#000' : 'rgba(255,255,255,0.55)',
                fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                padding: '5px 12px', cursor: 'pointer', transition: 'all 150ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = NEON; e.currentTarget.style.borderColor = 'rgba(253,225,0,0.45)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; } }}
            >
              Action
            </button>
          );
        })()}
      </div>

      {/* ── Bloco 3: Humor da torcida — apenas status ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', marginLeft: 'auto' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.26em', color: moodColor, whiteSpace: 'nowrap', transition: 'color 600ms' }}>
          {moodLabel}
        </span>
      </div>
    </div>
  );
}

export type { PlayingStylePresetId as PlayStyle };
