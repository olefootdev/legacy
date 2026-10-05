/**
 * ExpertPanel — 3 barras inteligentes (só nosso time) + elenco + status adversário.
 */
import type { PitchPlayerState } from '@/engine/types';
import { posLabel } from './posLabel';

import { L } from '@/i18n/L';
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
  if (value >= 25) return '#FF9F1C';
  return '#FF4D4D';
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
        fontFamily: 'var(--font-serif-hero)', fontWeight: 700,
        fontSize: 32, color, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 600ms ease',
      }}>
        {Math.round(value)}
      </div>
      {/* Horizontal bar */}
      <div style={{
        width: '80%', height: 3, margin: '6px auto 0',
        background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.round(value))}%`, height: '100%', background: color,
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
  const fatigueColor = fatigue > 70 ? '#FF4D4D' : fatigue > 45 ? '#FF9F1C' : '#22C55E';
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
        {posLabel(player.pos)}
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

/** Rótulo de tela do humor ('embalado'…) — o valor continua o mesmo no código. */
const MORALE_LABEL: Record<string, string> = {
  embalado: L('embalado', 'on a roll'),
  confiante: L('confiante', 'confident'),
  'estável': L('estável', 'steady'),
  tenso: L('tenso', 'tense'),
  abalado: L('abalado', 'shaken'),
};

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
    return { label: L('Desmoronando', 'Collapsing'), color: '#FF4D4D', description: L('Moral destruída, erros em série', 'Morale shattered, error after error') };
  }
  if (dec < 30 && conf < 40) {
    return { label: L('Errando muito', 'Error-prone'), color: '#FF4D4D', description: L('Decisões ruins, time perdido', 'Bad decisions, team lost') };
  }
  if (confLabel === 'tenso') {
    return { label: L('Pressionado', 'Under pressure'), color: '#FF9F1C', description: L('Sentindo a pressão, pode cometer erros', 'Feeling the pressure, may make mistakes') };
  }
  if (tact < 30 && dec < 45) {
    return { label: L('Desorganizado', 'Disorganised'), color: '#FF9F1C', description: L('Fora de posição, sem padrão de jogo', 'Out of position, no pattern of play') };
  }
  if (dec >= 70 && conf >= 65 && tact >= 60) {
    return { label: L('Dominando', 'Dominating'), color: '#FF4D4D', description: L('Adversário forte, atenção total', 'Strong opponent, full focus') };
  }
  if (confLabel === 'embalado') {
    return { label: L('Embalado', 'On a roll'), color: '#FF9F1C', description: L('Confiante e perigoso', 'Confident and dangerous') };
  }
  if (conf >= 60 && dec >= 55) {
    return { label: L('Confortável', 'Comfortable'), color: '#FF9F1C', description: L('Jogando sem pressão', 'Playing without pressure') };
  }
  if (conf < 45 && dec < 50) {
    return { label: L('Com medo', 'Scared'), color: '#22C55E', description: L('Hesitante, evitando riscos', 'Hesitant, avoiding risks') };
  }
  if (confLabel === 'confiante') {
    return { label: L('Confiante', 'Confident'), color: 'rgba(255,255,255,0.5)', description: L('Jogando no ritmo deles', 'Playing at their tempo') };
  }
  return { label: L('Estável', 'Steady'), color: 'rgba(255,255,255,0.4)', description: L('Sem vantagem clara', 'No clear edge') };
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
          label={L('Decisões', 'Decisions')}
          value={expertBars.decisions.home}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        <SmartBar
          label={L('Confiança', 'Confidence')}
          value={expertBars.confidence.home}
          subtitle={MORALE_LABEL[expertBars.confidence.homeLabel] ?? expertBars.confidence.homeLabel}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
        <SmartBar
          label={L('Tático', 'Tactical')}
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
          {L('Elenco', 'Squad')}
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
          {L('Status Adversário', 'Opponent Status')}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${adversary.color}22`,
          borderLeft: `3px solid ${adversary.color}`,
        }}>
          <div style={{
            fontFamily: 'var(--font-serif-hero)', fontWeight: 700,
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
