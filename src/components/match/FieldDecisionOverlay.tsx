/**
 * FieldDecisionOverlay — decision moment cinematográfico.
 *
 * A câmera "entra em campo": fundo escurece com vignette intensa,
 * nome + posição do jogador surgem no centro, e dois círculos com
 * borda amarela flutuam como escolhas do manager.
 */
import { useEffect, useState } from 'react';

const NEON = '#FDE100';

export interface FieldDecisionChoice {
  id: string;
  label: string;
  sublabel?: string;
}

interface FieldDecisionOverlayProps {
  /** Nome do jogador em foco */
  playerName: string;
  playerPos: string;
  playerNum: number;
  /** Título do momento (ex: "CARA A CARA") */
  momentLabel: string;
  /** 2 escolhas — renderizadas como círculos */
  choices: [FieldDecisionChoice, FieldDecisionChoice];
  onChoose: (id: string) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
}

export function FieldDecisionOverlay({
  playerName,
  playerPos,
  playerNum,
  momentLabel,
  choices,
  onChoose,
  onTimeout,
  timeoutMs = 8000,
}: FieldDecisionOverlayProps) {
  const [progress, setProgress] = useState(100);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Entrada cinematográfica com delay
    const t = window.setTimeout(() => setEntered(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / timeoutMs) * 100);
      setProgress(pct);
      if (pct <= 0) { onTimeout?.(); return; }
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeoutMs, onTimeout]);

  const firstName = playerName.split(' ')[0];

  return (
    <div
      className="absolute inset-0 z-[400] flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 100%)',
        opacity: entered ? 1 : 0,
        transition: 'opacity 320ms ease-out',
      }}
    >
      {/* Eyebrow */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
        letterSpacing: '0.38em', color: NEON, textTransform: 'uppercase',
        marginBottom: 8,
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 400ms ease 100ms, transform 400ms ease 100ms',
      }}>
        <span style={{ display: 'inline-block', width: 18, height: 1.5, background: NEON, verticalAlign: 'middle', marginRight: 8 }} />
        {momentLabel}
        <span style={{ display: 'inline-block', width: 18, height: 1.5, background: NEON, verticalAlign: 'middle', marginLeft: 8 }} />
      </div>

      {/* Jogador em foco */}
      <div style={{
        textAlign: 'center', marginBottom: 28,
        opacity: entered ? 1 : 0,
        transform: entered ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 480ms ease 80ms, transform 480ms cubic-bezier(0.22,1.4,0.36,1) 80ms',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>
          {playerPos} · {playerNum}
        </div>
        <div style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.01em' }}>
          {firstName}
        </div>
      </div>

      {/* Dois círculos de escolha */}
      <div style={{
        display: 'flex', gap: 'clamp(24px, 6vw, 48px)', alignItems: 'center',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 400ms ease 200ms, transform 400ms cubic-bezier(0.22,1.4,0.36,1) 200ms',
      }}>
        {choices.map((choice, i) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChoose(choice.id)}
            style={{
              width: 'clamp(80px, 16vw, 110px)',
              height: 'clamp(80px, 16vw, 110px)',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              border: `2px solid ${NEON}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', gap: 4,
              transition: 'transform 150ms ease, background 150ms ease, box-shadow 150ms ease',
              boxShadow: `0 0 0 0 ${NEON}`,
              animationDelay: `${i * 80}ms`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.background = 'rgba(253,225,0,0.12)';
              e.currentTarget.style.boxShadow = `0 0 24px rgba(253,225,0,0.35)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
              e.currentTarget.style.boxShadow = `0 0 0 0 ${NEON}`;
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(9px, 2vw, 12px)', fontWeight: 800, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
              {choice.label}
            </span>
            {choice.sublabel && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                {choice.sublabel}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Timer arc — linha fina embaixo dos círculos */}
      <div style={{ marginTop: 20, width: 'clamp(80px, 16vw, 110px)', height: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress}%`, background: progress > 40 ? NEON : '#ef4444', transition: 'background 300ms' }} />
      </div>
    </div>
  );
}
