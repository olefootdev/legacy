/**
 * ExpertPanel — 3 barras inteligentes (só nosso time) + elenco + status adversário.
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
  minute: number;
}

function barColor(value: number): string {
  if (value >= 70) return '#22C55E';
  if (value >= 45) return NEON;
  if (value >= 25) return '#F59E0B';
  return '#EF4444';
}

function SmartBar({ label, value, subtitle }: {
  label: string;
  value: number;
  subtitle?: string;
}) {
  const color = barColor(value);
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.3)', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700,
        fontSize: 32, color, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 600ms ease',
      }}>
        {value}
      </div>
      {/* Horizontal bar */}
      <div style={{
        width: '80%', height: 3, margin: '6px auto 0',
        background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${value}%`, height: '100%', background: color,
          transition: 'width 600ms ease, background 600ms ease',
          borderRadius: 2,
        }} />
      </div>
      {subtitle && (
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.25)', marginTop: 4,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player }: { player: PitchPlayerState }) {
  const fatigue = player.fatigue ?? 0;
  const fatigueColor = fatigue > 70 ? '#EF4444' : fatigue > 45 ? '#F59E0B' : '#22C55E';
  const staminaPct = Math.max(0, 100 - fatigue);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 8px',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: `2px solid ${fatigueColor}`,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
        color: NEON, width: 20, textAlign: 'right',
        opacity: 0.6,
      }}>
        {player.num}
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
        color: 'rgba(255,255,255,0.75)', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {player.name}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
        color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', width: 28, textAlign: 'center',
      }}>
        {player.pos}
      </span>
      <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${staminaPct}%`, height: '100%', background: fatigueColor,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  );
}

function deriveAdversaryStatus(bars: ExpertBars): {
  label: string;
  color: string;
  description: string;
} {
  const conf = bars.confidence.away;
  const dec = bars.decisions.away;
  const tact = bars.tactical.away;
  const confLabel = bars.confidence.awayLabel;

  if (confLabel === 'abalado' || conf < 20) {
    return { label: 'Desmoronando', color: '#EF4444', description: 'Moral destruída, erros em série' };
  }
  if (dec < 30 && conf < 40) {
    return { label: 'Errando muito', color: '#EF4444', description: 'Decisões ruins, time perdido' };
  }
  if (confLabel === 'tenso') {
    return { label: 'Pressionado', color: '#F59E0B', description: 'Sentindo a pressão, pode cometer erros' };
  }
  if (tact < 30 && dec < 45) {
    return { label: 'Desorganizado', color: '#F59E0B', description: 'Fora de posição, sem padrão de jogo' };
  }
  if (dec >= 70 && conf >= 65 && tact >= 60) {
    return { label: 'Dominando', color: '#EF4444', description: 'Adversário forte, atenção total' };
  }
  if (confLabel === 'embalado') {
    return { label: 'Embalado', color: '#F59E0B', description: 'Confiante e perigoso' };
  }
  if (conf >= 60 && dec >= 55) {
    return { label: 'Confortável', color: '#F59E0B', description: 'Jogando sem pressão' };
  }
  if (conf < 45 && dec < 50) {
    return { label: 'Com medo', color: '#22C55E', description: 'Hesitante, evitando riscos' };
  }
  if (confLabel === 'confiante') {
    return { label: 'Confiante', color: 'rgba(255,255,255,0.5)', description: 'Jogando no ritmo deles' };
  }
  return { label: 'Estável', color: 'rgba(255,255,255,0.4)', description: 'Sem vantagem clara' };
}

export function ExpertPanel({
  expertBars,
  homePlayers,
  minute,
}: ExpertPanelProps) {
  const sorted = [...homePlayers].filter(p => p.role !== 'gk').sort((a, b) => {
    return (b.fatigue ?? 0) - (a.fatigue ?? 0);
  });

  const adversary = deriveAdversaryStatus(expertBars);

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
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
          color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em',
        }}>
          {minute}&prime; LIVE
        </span>
      </div>

      {/* 3 Smart Bars — nosso time apenas */}
      <div style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        padding: '10px 0',
      }}>
        <SmartBar
          label="Decisões"
          value={expertBars.decisions.home}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        <SmartBar
          label="Confiança"
          value={expertBars.confidence.home}
          subtitle={expertBars.confidence.homeLabel}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        <SmartBar
          label="Tático"
          value={expertBars.tactical.home}
        />
      </div>

      {/* Elenco — nosso time */}
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.2)', marginBottom: 4, paddingLeft: 2,
        }}>
          Elenco
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sorted.map((p) => (
            <PlayerRow key={p.playerId} player={p} />
          ))}
        </div>
      </div>

      {/* Status Adversário */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        paddingTop: 8,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.2)', marginBottom: 6, paddingLeft: 2,
        }}>
          Status Adversário
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${adversary.color}22`,
          borderLeft: `3px solid ${adversary.color}`,
        }}>
          <div style={{
            fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700,
            fontSize: 18, color: adversary.color, lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {adversary.label}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
            color: 'rgba(255,255,255,0.35)', lineHeight: 1.3,
          }}>
            {adversary.description}
          </div>
        </div>
      </div>
    </div>
  );
}
