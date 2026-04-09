import { useState } from 'react';
import { PitchViewer, type CameraMode } from './PitchViewer';
import type { MatchVisualState } from './matchVisualState';

const CAMERA_MODES: { key: CameraMode; label: string }[] = [
  { key: 'tv', label: 'TV' },
  { key: 'cabine', label: 'Cabine' },
  { key: 'drone', label: 'Drone' },
  { key: 'motion', label: 'Motion' },
];

const MATCH_STATES: { key: MatchVisualState; label: string }[] = [
  { key: 'BOLA_VIVA', label: 'Bola Viva' },
  { key: 'LATERAL', label: 'Lateral' },
  { key: 'ESCANTEIO', label: 'Escanteio' },
  { key: 'TIRO_DE_META', label: 'Tiro de Meta' },
];

export function App() {
  const [cameraMode, setCameraMode] = useState<CameraMode>('tv');
  const [cameraZoom, setCameraZoom] = useState(0);
  const [showThirds, setShowThirds] = useState(false);
  const [showGrid8x5, setShowGrid8x5] = useState(false);
  const [matchState, setMatchState] = useState<MatchVisualState>('BOLA_VIVA');
  const [bridgeLog, setBridgeLog] = useState<string | null>(null);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0a0c10' }}>
      <PitchViewer
        cameraMode={cameraMode}
        cameraZoom={cameraZoom}
        showThirds={showThirds}
        showGrid8x5={showGrid8x5}
        matchState={matchState}
        onSnapshotApplied={() => setBridgeLog('Snapshot aplicado')}
      />

      {/* Top bar: camera controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'auto',
          fontFamily: 'system-ui, sans-serif',
          zIndex: 10,
        }}
      >
        <span style={{ color: '#8899aa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
          OLEFOOT · pitch viewer
        </span>
        {CAMERA_MODES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCameraMode(key)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: cameraMode === key ? '1px solid #E4FF00' : '1px solid #333',
              background: cameraMode === key ? 'rgba(228,255,0,0.12)' : '#111',
              color: cameraMode === key ? '#E4FF00' : '#ccc',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <label
          style={{
            color: '#8899aa',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Zoom
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(cameraZoom * 100)}
            onChange={(e) => setCameraZoom(Number(e.target.value) / 100)}
            style={{ width: 120, accentColor: '#E4FF00' }}
            aria-label="Zoom"
          />
        </label>
        <label style={{ color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showThirds} onChange={(e) => setShowThirds(e.target.checked)} />
          Terços
        </label>
        <label style={{ color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showGrid8x5} onChange={(e) => setShowGrid8x5(e.target.checked)} />
          Grade 8×5
        </label>
        {bridgeLog && (
          <span style={{ color: '#6c6', fontSize: 10 }}>{bridgeLog}</span>
        )}
      </div>

      {/* Bottom bar: match state buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto',
          fontFamily: 'system-ui, sans-serif',
          zIndex: 10,
        }}
      >
        {MATCH_STATES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMatchState(key)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: matchState === key ? '1px solid #4ade80' : '1px solid #444',
              background: matchState === key ? 'rgba(74,222,128,0.15)' : 'rgba(17,17,17,0.85)',
              color: matchState === key ? '#4ade80' : '#bbb',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
