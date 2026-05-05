/**
 * LegacyMatchHUD — placar compacto com brasões, momentum e câmera inline.
 */
import { useEffect, useRef, useState } from 'react';
import { BRAZILIAN_CLUBS } from '@/settings/brazilianClubs';

interface LegacyMatchHUDProps {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeCrestUrl?: string | null;
  homeScore: number;
  awayScore: number;
  matchMinute: number;
  possession: 'home' | 'away';
  ballX: number;
  phase?: 'playing' | 'halftime' | 'fulltime';
  cameraMode?: 'aerial' | 'broadcast' | 'firstperson';
  onCameraChange?: (mode: 'aerial' | 'broadcast' | 'firstperson') => void;
  /** Called when user picks an away club */
  onAwayClubChange?: (club: { name: string; logo: string }) => void;
  awayClub?: { name: string; logo: string } | null;
}

const NEON = '#FDE100';

export function LegacyMatchHUD({
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeCrestUrl,
  homeScore,
  awayScore,
  matchMinute,
  possession,
  ballX,
  phase,
  cameraMode = 'aerial',
  onCameraChange,
  onAwayClubChange,
  awayClub,
}: LegacyMatchHUDProps) {
  const [smoothMomentum, setSmoothMomentum] = useState(50);
  const momentumRef = useRef(50);
  const [shakeHome, setShakeHome] = useState(false);
  const [shakeAway, setShakeAway] = useState(false);
  const [minutePulse, setMinutePulse] = useState(false);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const prevHome = useRef(homeScore);
  const prevAway = useRef(awayScore);
  const prevMinute = useRef(matchMinute);

  useEffect(() => {
    const possessionBias = possession === 'home' ? 65 : 35;
    const target = possessionBias * 0.6 + ballX * 0.4;
    momentumRef.current = momentumRef.current + (target - momentumRef.current) * 0.12;
    setSmoothMomentum(momentumRef.current);
  }, [possession, ballX]);

  useEffect(() => {
    if (homeScore > prevHome.current) { setShakeHome(true); window.setTimeout(() => setShakeHome(false), 500); }
    prevHome.current = homeScore;
  }, [homeScore]);

  useEffect(() => {
    if (awayScore > prevAway.current) { setShakeAway(true); window.setTimeout(() => setShakeAway(false), 500); }
    prevAway.current = awayScore;
  }, [awayScore]);

  useEffect(() => {
    if (matchMinute !== prevMinute.current) {
      setMinutePulse(true);
      window.setTimeout(() => setMinutePulse(false), 400);
      prevMinute.current = matchMinute;
    }
  }, [matchMinute]);

  const homePct = Math.round(smoothMomentum);
  const awayPct = 100 - homePct;
  const homeLeads = homeScore > awayScore;
  const awayLeads = awayScore > homeScore;
  const phaseLabel = phase === 'halftime' ? 'INT' : phase === 'fulltime' ? 'FIM' : null;

  return (
    <div style={{ background: 'rgba(5,5,5,0.98)', borderBottom: '1px solid rgba(253,225,0,0.08)', flexShrink: 0, userSelect: 'none', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 4px', gap: 8 }}>

        {/* ── Time casa ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {/* Brasão */}
          {homeCrestUrl ? (
            <img src={homeCrestUrl} alt={homeName ?? homeShort}
              style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
              referrerPolicy="no-referrer" draggable={false} />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${NEON}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800, color: NEON, letterSpacing: '0.1em' }}>
                {homeShort.slice(0, 3)}
              </span>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: possession === 'home' ? NEON : 'transparent', border: `1px solid ${possession === 'home' ? NEON : 'rgba(253,225,0,0.2)'}`, flexShrink: 0, transition: 'background 300ms', boxShadow: possession === 'home' ? `0 0 5px ${NEON}` : 'none' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: homeLeads ? NEON : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72 }}>
                {homeName ?? homeShort}
              </span>
            </div>
          </div>
        </div>

        {/* ── Centro: score + minuto + momentum + câmera ── */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Scores */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 36, fontWeight: 700, lineHeight: 1, color: homeLeads ? NEON : '#fff', letterSpacing: '-0.02em', transition: 'color 300ms', animation: shakeHome ? 'hudScoreShake 0.45s ease both' : 'none', display: 'inline-block' }}>
              {homeScore}
            </span>
            <span style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 20, color: 'rgba(255,255,255,0.18)', lineHeight: 1, padding: '0 2px' }}>–</span>
            <span style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 36, fontWeight: 700, lineHeight: 1, color: awayLeads ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)', letterSpacing: '-0.02em', transition: 'color 300ms', animation: shakeAway ? 'hudScoreShake 0.45s ease both' : 'none', display: 'inline-block' }}>
              {awayScore}
            </span>
          </div>

          {/* Minuto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2 }}>
            {phaseLabel ? (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.3em', color: NEON }}>{phaseLabel}</span>
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: minutePulse ? NEON : 'rgba(255,255,255,0.35)', transition: 'color 200ms' }}>
                {matchMinute}&prime;
              </span>
            )}
            {/* Camera toggle inline — pequeno */}
            {onCameraChange && (
              <div style={{ display: 'flex', gap: 2 }}>
                {(['aerial', 'firstperson', 'broadcast'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => onCameraChange(m)}
                    style={{ background: cameraMode === m ? NEON : 'rgba(255,255,255,0.06)', color: cameraMode === m ? '#000' : 'rgba(255,255,255,0.35)', border: 'none', fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '2px 6px', cursor: 'pointer', transition: 'all 150ms' }}>
                    {m === 'aerial' ? 'AER' : m === 'firstperson' ? 'CINE' : 'BRD'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barra de momentum */}
          <div style={{ width: 110, height: 2, background: 'rgba(255,255,255,0.07)', marginTop: 3, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${homePct}%`, background: NEON, transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)', boxShadow: homePct > 65 ? `0 0 6px ${NEON}` : 'none' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${awayPct}%`, background: 'rgba(255,255,255,0.5)', transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: 1, background: 'rgba(255,255,255,0.12)', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 110, marginTop: 1 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, color: homePct > 55 ? NEON : 'rgba(255,255,255,0.18)', transition: 'color 300ms' }}>{homePct}%</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, color: awayPct > 55 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)', transition: 'color 300ms' }}>{awayPct}%</span>
          </div>
        </div>

        {/* ── Time visitante ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          <div style={{ minWidth: 0, textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: awayLeads ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72 }}>
                {awayClub?.name ?? awayName ?? awayShort}
              </span>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: possession === 'away' ? 'rgba(255,255,255,0.8)' : 'transparent', border: `1px solid ${possession === 'away' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)'}`, flexShrink: 0, transition: 'background 300ms' }} />
            </div>
          </div>
          {/* Brasão adversário — clicável apenas quando há callback */}
          {onAwayClubChange ? (
            <button type="button" onClick={() => setShowClubPicker(v => !v)}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              title="Escolher clube adversário"
            >
              {awayClub?.logo ? (
                <img src={awayClub.logo} alt={awayClub.name}
                  style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.85 }}
                  referrerPolicy="no-referrer" draggable={false} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                    {awayShort.slice(0, 3)}
                  </span>
                </div>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Club picker dropdown ── */}
      {showClubPicker && (
        <div style={{
          position: 'absolute', top: '100%', right: 8, zIndex: 500,
          background: '#0d0d0d', border: '1px solid rgba(253,225,0,0.2)',
          width: 200, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        }}>
          {BRAZILIAN_CLUBS.map((club) => (
            <button key={club.id} type="button"
              onClick={() => { onAwayClubChange?.({ name: club.name, logo: club.logo ?? '' }); setShowClubPicker(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '7px 10px', cursor: 'pointer', transition: 'background 120ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(253,225,0,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {club.logo && <img src={club.logo} alt={club.name} style={{ width: 20, height: 20, objectFit: 'contain' }} referrerPolicy="no-referrer" />}
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>
                {club.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
