/**
 * NarrativeBar — faixa editorial entre HUD e campo.
 * Frase dinâmica do último evento + label de momentum. Pisca em gol.
 */
import { useEffect, useState } from 'react';

const NEON = '#FDE100';

// Momentum label derivado de posse + posição da bola
function deriveMomentumLabel(possession: 'home' | 'away', ballX: number): string {
  const bias = possession === 'home' ? ballX / 100 : 1 - ballX / 100;
  if (bias > 0.72) return 'dominando';
  if (bias > 0.58) return 'em cima';
  if (bias > 0.45) return 'leve pressão';
  if (bias > 0.38) return 'equilíbrio';
  if (bias > 0.28) return 'leve momentum';
  if (bias > 0.18) return 'acuado';
  return 'sufocado';
}

// Classifica pelo kind real do engine, com fallback por texto
function classifyEvent(kind?: string, text?: string): { icon: string; isGoal: boolean } {
  if (kind === 'goal_home' || kind === 'goal_away') return { icon: '⚽', isGoal: true };
  if (kind === 'whistle') return { icon: '🟨', isGoal: false };
  if (kind === 'shot_home' || kind === 'shot_away') return { icon: '🎯', isGoal: false };
  if (kind === 'yellow_home' || kind === 'yellow_away') return { icon: '🟨', isGoal: false };
  if (kind === 'red_home' || kind === 'red_away') return { icon: '🟥', isGoal: false };
  if (kind === 'sub') return { icon: '🔄', isGoal: false };
  // Fallback por texto
  const t = (text ?? '').toLowerCase();
  if (t.includes('gol') || t.includes('goal')) return { icon: '⚽', isGoal: true };
  if (t.includes('escanteio') || t.includes('corner')) return { icon: '🚩', isGoal: false };
  if (t.includes('falta') || t.includes('foul')) return { icon: '🟨', isGoal: false };
  if (t.includes('chut') || t.includes('shot') || t.includes('finaliz')) return { icon: '🎯', isGoal: false };
  if (t.includes('pass') || t.includes('passe')) return { icon: '→', isGoal: false };
  return { icon: '●', isGoal: false };
}

interface NarrativeBarProps {
  lastEventText: string | null;
  lastEventKind?: string;
  possession: 'home' | 'away';
  ballX: number;
  minute: number;
  isGoal: boolean;
}

export function NarrativeBar({ lastEventText, lastEventKind, possession, ballX, minute, isGoal }: NarrativeBarProps) {
  const [flash, setFlash] = useState(false);
  const [displayText, setDisplayText] = useState(lastEventText);

  useEffect(() => {
    if (!lastEventText) return;
    setDisplayText(lastEventText);
    if (isGoal) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1200);
      return () => window.clearTimeout(t);
    }
  }, [lastEventText, isGoal]);

  const momentumLabel = deriveMomentumLabel(possession, ballX);
  const { icon } = classifyEvent(lastEventKind, displayText ?? '');
  const momentumColor = possession === 'home' ? NEON : 'rgba(255,255,255,0.7)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px',
      height: 28,
      background: flash ? 'rgba(253,225,0,0.12)' : 'rgba(5,5,5,0.95)',
      borderBottom: `1px solid ${flash ? 'rgba(253,225,0,0.35)' : 'rgba(255,255,255,0.05)'}`,
      transition: 'background 300ms ease, border-color 300ms ease',
      flexShrink: 0,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Ícone do evento */}
      <span style={{ fontSize: 10, flexShrink: 0, opacity: 0.7 }}>{icon}</span>

      {/* Texto do evento */}
      <span style={{
        fontFamily: 'var(--font-serif-hero)',
        fontStyle: 'italic',
        fontSize: 11,
        color: flash ? NEON : 'rgba(255,255,255,0.65)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color 300ms ease',
      }}>
        {displayText ?? `${minute}' — Partida em andamento`}
      </span>

      {/* Separador */}
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* Label de momentum */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: momentumColor,
          boxShadow: `0 0 6px ${momentumColor}`,
          transition: 'background 600ms ease',
        }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: momentumColor,
          transition: 'color 600ms ease',
        }}>
          {possession === 'home' ? 'OLE' : 'ADV'} {momentumLabel}
        </span>
      </div>
    </div>
  );
}
