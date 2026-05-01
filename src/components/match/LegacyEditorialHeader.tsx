/**
 * LegacyEditorialHeader — header editorial Legacy Tech.
 * Eyebrow Agency + Headline Moret + régua amarela + score Moret tabular.
 * Linha de controle padronizada: POSSE • Formação • Action.
 * SAIR no canto superior direito.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import type { FormationSchemeId } from '@/match-engine/types';

const NEON = '#FDE100';

const FORMATIONS: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1'];

interface LegacyEditorialHeaderProps {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  possession: 'home' | 'away';
  phase: 'playing' | 'halftime' | 'fulltime';
  formation?: FormationSchemeId;
  onFormationChange?: (f: FormationSchemeId) => void;
  actionCam?: boolean;
  onActionCamToggle?: () => void;
  onExit?: () => void;
  viewMode?: 'aerial' | 'expert';
  onViewModeChange?: (m: 'aerial' | 'expert') => void;
}

export function LegacyEditorialHeader({
  homeName, awayName, homeScore, awayScore, minute, possession, phase,
  formation, onFormationChange, actionCam = false, onActionCamToggle, onExit,
  viewMode = 'aerial', onViewModeChange,
}: LegacyEditorialHeaderProps) {
  const eyebrow = phase === 'halftime' ? 'OLEFOOT • INTERVALO' : phase === 'fulltime' ? 'OLEFOOT • ENCERRADO' : 'OLEFOOT • LEGACY MODE';
  const [showFormations, setShowFormations] = useState(false);
  const [showViewModes, setShowViewModes] = useState(false);

  const dotStyle: React.CSSProperties = {
    color: 'rgba(253,225,0,0.4)',
    fontFamily: 'var(--font-display)',
    fontSize: 9,
    fontWeight: 800,
  };

  return (
    <header
      style={{
        position: 'relative',
        padding: '12px 20px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#0D0D0D',
      }}
    >
      {/* Rail amarelo esquerdo */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 3,
          background: NEON,
        }}
      />

      {/* SAIR — canto superior direito */}
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="Sair da partida"
          title="Sair"
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
        >
          <X size={12} strokeWidth={2.5} />
          Sair
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        {/* Esquerda: eyebrow + título + linha de controles */}
        <div style={{ minWidth: 0, flex: 1, paddingRight: 60 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.32em',
              color: NEON,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(20px, 3.4vw, 30px)',
              letterSpacing: '-0.02em',
              color: '#fff',
              lineHeight: 0.95,
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {homeName} <span style={{ color: 'rgba(255,255,255,0.35)' }}>vs</span> {awayName}
          </h1>
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 48,
              height: 3,
              background: NEON,
              marginTop: 6,
            }}
          />

          {/* Linha de controle: View Mode • Formação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {onViewModeChange && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowViewModes(v => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.32em',
                    color: NEON,
                    textTransform: 'uppercase',
                  }}
                >
                  {viewMode === 'aerial' ? 'Aerial' : 'Expert'}
                  <span style={{ fontSize: 7, color: 'rgba(253,225,0,0.55)' }}>▾</span>
                </button>
                {showViewModes && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid rgba(253,225,0,0.18)', zIndex: 400, minWidth: 120 }}>
                    {(['aerial', 'expert'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { onViewModeChange(m); setShowViewModes(false); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          background: m === viewMode ? 'rgba(253,225,0,0.08)' : 'transparent',
                          border: 'none',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-display)',
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.2em',
                          color: m === viewMode ? NEON : 'rgba(255,255,255,0.6)',
                          textAlign: 'left',
                          textTransform: 'uppercase',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={e => { if (m !== viewMode) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (m !== viewMode) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {m === 'aerial' ? 'Aerial' : 'Expert'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formation && onFormationChange && (
              <>
                {onViewModeChange && <span style={dotStyle}>•</span>}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowFormations(v => !v)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-display)',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.32em',
                      color: NEON,
                      textTransform: 'uppercase',
                    }}
                  >
                    {formation}
                    <span style={{ fontSize: 7, color: 'rgba(253,225,0,0.55)' }}>▾</span>
                  </button>
                  {showFormations && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0d0d0d', border: '1px solid rgba(253,225,0,0.18)', zIndex: 400, minWidth: 100 }}>
                      {FORMATIONS.map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => { onFormationChange(f); setShowFormations(false); }}
                          style={{
                            display: 'block',
                            width: '100%',
                            background: f === formation ? 'rgba(253,225,0,0.08)' : 'transparent',
                            border: 'none',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-serif-hero)',
                            fontStyle: 'italic',
                            fontSize: 13,
                            color: f === formation ? NEON : 'rgba(255,255,255,0.6)',
                            textAlign: 'left',
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={e => { if (f !== formation) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (f !== formation) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Direita: Score Moret gigante */}
        <div
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 'clamp(40px, 7.5vw, 68px)',
            letterSpacing: '-0.04em',
            color: '#fff',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 0.9,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexShrink: 0,
            marginTop: 18,
          }}
        >
          <span style={{ color: homeScore >= awayScore ? '#fff' : 'rgba(255,255,255,0.45)' }}>{homeScore}</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.55em' }}>—</span>
          <span style={{ color: awayScore > homeScore ? '#fff' : 'rgba(255,255,255,0.45)' }}>{awayScore}</span>
        </div>
      </div>
    </header>
  );
}
