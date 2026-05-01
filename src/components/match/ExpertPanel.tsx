/**
 * ExpertPanel — 3 barras inteligentes + tabela de jogadores.
 * Decisões Certas | Confiança | Tático
 */
import type { PitchPlayerState } from '@/engine/types';

const NEON = '#FDE100';

interface ExpertBars {
  decisions: { home: number; away: number };
  confidence: { home: number; away: number; homeLabel: string; awayLabel: string };
  tactical: { home: number; away: number };
}

interface ExpertPanelProps {
  expertBars: ExpertBars;
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  minute: number;
}

function barColor(value: number): string {
  if (value >= 70) return '#22C55E';
  if (value >= 45) return NEON;
  if (value >= 25) return '#F59E0B';
  return '#EF4444';
}

function SmartBar({ label, home, away, subtitle }: {
  label: string;
  home: number;
  away: number;
  subtitle?: { home: string; away: string };
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 6,
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Home side */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700,
            fontSize: 28, color: barColor(home), lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 600ms ease',
          }}>
            {home}
          </div>
          {subtitle && (
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)', marginTop: 2,
            }}>
              {subtitle.home}
            </div>
          )}
        </div>

        {/* Dual bar */}
        <div style={{ width: 4, display: 'flex', flexDirection: 'column', gap: 2, height: 32 }}>
          <div style={{
            flex: 1, borderRadius: 2, overflow: 'hidden',
            background: 'rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: '100%', height: `${home}%`,
              background: barColor(home),
              transition: 'height 600ms ease, background 600ms ease',
              position: 'relative', bottom: 0,
            }} />
          </div>
          <div style={{
            flex: 1, borderRadius: 2, overflow: 'hidden',
            background: 'rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: '100%', height: `${away}%`,
              background: barColor(away),
              transition: 'height 600ms ease, background 600ms ease',
            }} />
          </div>
        </div>

        {/* Away side */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700,
            fontSize: 28, color: barColor(away), lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 600ms ease',
          }}>
            {away}
          </div>
          {subtitle && (
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)', marginTop: 2,
            }}>
              {subtitle.away}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: PitchPlayerState }) {
  const fatigue = player.fatigue ?? 0;
  const fatigueColor = fatigue > 70 ? '#EF4444' : fatigue > 45 ? '#F59E0B' : '#22C55E';
  const staminaPct = Math.max(0, 100 - fatigue);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 6px',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: `2px solid ${fatigueColor}`,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800,
        color: 'rgba(255,255,255,0.2)', width: 18, textAlign: 'right',
      }}>
        {player.num}
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
        color: 'rgba(255,255,255,0.7)', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {player.name}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
        color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', width: 26, textAlign: 'center',
      }}>
        {player.pos}
      </span>
      <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${staminaPct}%`, height: '100%', background: fatigueColor,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  );
}

function PlayerList({ players, label }: { players: PitchPlayerState[]; label: string }) {
  const sorted = [...players].filter(p => p.role !== 'gk').sort((a, b) => {
    return (b.fatigue ?? 0) - (a.fatigue ?? 0);
  });

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.2)', marginBottom: 4, paddingLeft: 2,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sorted.slice(0, 5).map((p) => (
          <PlayerRow key={p.playerId} player={p} />
        ))}
      </div>
    </div>
  );
}

export function ExpertPanel({
  expertBars,
  homePlayers,
  awayPlayers,
  minute,
}: ExpertPanelProps) {
  return (
    <div style={{
      background: 'rgba(5,5,5,0.96)',
      borderTop: '1px solid rgba(253,225,0,0.08)',
      padding: '8px 16px 6px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, background: NEON, borderRadius: 1 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>CASA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>FORA</span>
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em',
          }}>
            {minute}&prime;
          </span>
        </div>
      </div>

      {/* 3 Smart Bars */}
      <div style={{
        display: 'flex', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        padding: '10px 0',
      }}>
        <SmartBar
          label="Decisões"
          home={expertBars.decisions.home}
          away={expertBars.decisions.away}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
        <SmartBar
          label="Confiança"
          home={expertBars.confidence.home}
          away={expertBars.confidence.away}
          subtitle={{
            home: expertBars.confidence.homeLabel,
            away: expertBars.confidence.awayLabel,
          }}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
        <SmartBar
          label="Tático"
          home={expertBars.tactical.home}
          away={expertBars.tactical.away}
        />
      </div>

      {/* Player tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <PlayerList players={homePlayers} label="Elenco — Casa" />
        <PlayerList players={awayPlayers} label="Elenco — Fora" />
      </div>
    </div>
  );
}
