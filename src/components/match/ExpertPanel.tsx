/**
 * ExpertPanel — stats-heavy overlay for the Expert view mode.
 * Shows live match statistics in a broadcast-style layout.
 */
import type { TeamStats } from '@/pages/useLegacyMatchEngine';
import type { PitchPlayerState } from '@/engine/types';

const NEON = '#FDE100';

interface ExpertPanelProps {
  homeStats: TeamStats;
  awayStats: TeamStats;
  possessionPct: { home: number; away: number };
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  homeScore: number;
  awayScore: number;
  minute: number;
}

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
          color: home > away ? NEON : 'rgba(255,255,255,0.8)',
          letterSpacing: '0.04em', minWidth: 28, textAlign: 'left',
        }}>
          {home}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)', flex: 1, textAlign: 'center',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
          color: away > home ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
          letterSpacing: '0.04em', minWidth: 28, textAlign: 'right',
        }}>
          {away}
        </span>
      </div>
      <div style={{ display: 'flex', height: 3, gap: 2 }}>
        <div style={{
          flex: homePct, background: home > away ? NEON : 'rgba(253,225,0,0.4)',
          transition: 'flex 600ms ease', borderRadius: '1px 0 0 1px',
        }} />
        <div style={{
          flex: 100 - homePct, background: away > home ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
          transition: 'flex 600ms ease', borderRadius: '0 1px 1px 0',
        }} />
      </div>
    </div>
  );
}

function PossessionRing({ home, away }: { home: number; away: number }) {
  const r = 28;
  const cx = 36;
  const cy = 36;
  const circumference = 2 * Math.PI * r;
  const homeArc = (home / 100) * circumference;
  const awayArc = circumference - homeArc;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={NEON} strokeWidth={5}
          strokeDasharray={`${homeArc} ${awayArc}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 800ms ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, fill: NEON }}>
          {home}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, fill: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
          POSSE
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, background: NEON, borderRadius: 1 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em' }}>CASA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>FORA</span>
        </div>
      </div>
    </div>
  );
}

function PlayerStatsTable({ players, label }: { players: PitchPlayerState[]; label: string }) {
  const sorted = [...players].filter(p => p.role !== 'gk').sort((a, b) => {
    const aFat = a.fatigue ?? 0;
    const bFat = b.fatigue ?? 0;
    return bFat - aFat;
  });

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.25)', marginBottom: 4, paddingLeft: 2,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sorted.slice(0, 5).map((p) => {
          const fatigue = p.fatigue ?? 0;
          const fatigueColor = fatigue > 70 ? '#EF4444' : fatigue > 45 ? '#F59E0B' : '#22C55E';
          return (
            <div key={p.playerId} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 4px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800,
                color: 'rgba(255,255,255,0.2)', width: 16, textAlign: 'right',
              }}>
                {p.num}
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
                color: 'rgba(255,255,255,0.65)', flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
                color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', width: 24, textAlign: 'center',
              }}>
                {p.pos}
              </span>
              <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  width: `${fatigue}%`, height: '100%', background: fatigueColor,
                  transition: 'width 400ms ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExpertPanel({
  homeStats,
  awayStats,
  possessionPct,
  homePlayers,
  awayPlayers,
  minute,
}: ExpertPanelProps) {
  const passAccHome = homeStats.passesAttempt > 0 ? Math.round((homeStats.passesOk / homeStats.passesAttempt) * 100) : 0;
  const passAccAway = awayStats.passesAttempt > 0 ? Math.round((awayStats.passesOk / awayStats.passesAttempt) * 100) : 0;

  return (
    <div style={{
      background: 'rgba(5,5,5,0.96)',
      borderTop: '1px solid rgba(253,225,0,0.08)',
      padding: '8px 16px 6px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto',
      flex: 1,
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
          letterSpacing: '0.35em', textTransform: 'uppercase', color: NEON,
        }}>
          Expert Analytics
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
          color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em',
        }}>
          {minute}&prime; LIVE
        </div>
      </div>

      {/* Possession + Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
        <PossessionRing home={possessionPct.home} away={possessionPct.away} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <StatBar label="Finalizações" home={homeStats.shots} away={awayStats.shots} />
          <StatBar label="No alvo" home={homeStats.shotsOn} away={awayStats.shotsOn} />
          <StatBar label="Passes certos" home={homeStats.passesOk} away={awayStats.passesOk} />
          <StatBar label="Precisão %" home={passAccHome} away={passAccAway} />
          <StatBar label="Desarmes" home={homeStats.tackles} away={awayStats.tackles} />
          <StatBar label="Dribles" home={homeStats.dribblesOk} away={awayStats.dribblesOk} />
        </div>
      </div>

      {/* Player fatigue tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <PlayerStatsTable players={homePlayers} label="Fadiga — Casa" />
        <PlayerStatsTable players={awayPlayers} label="Fadiga — Fora" />
      </div>
    </div>
  );
}
