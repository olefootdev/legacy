/**
 * PressureZoneOverlay — zonas de tensão visual no campo.
 * Glow amarelo na zona da bola + linhas de pressão vermelhas quando adversário pressiona.
 */
import { useEffect, useState } from 'react';

interface PressureZoneOverlayProps {
  ballX: number;
  possession: 'home' | 'away';
  phase: 'playing' | 'halftime' | 'fulltime';
}

export function PressureZoneOverlay({ ballX, possession, phase }: PressureZoneOverlayProps) {
  const [smoothX, setSmoothX] = useState(ballX);

  useEffect(() => {
    setSmoothX(prev => prev + (ballX - prev) * 0.08);
  }, [ballX]);

  if (phase !== 'playing') return null;

  // Intensidade do glow baseada em posse + posição
  const homeAttacking = possession === 'home' && smoothX > 55;
  const awayAttacking = possession === 'away' && smoothX < 45;
  const homePressured = possession === 'away' && smoothX < 30;
  const awayPressured = possession === 'home' && smoothX > 70;

  const glowIntensity = homeAttacking
    ? Math.min(0.22, (smoothX - 55) / 45 * 0.22)
    : awayAttacking
    ? Math.min(0.18, (45 - smoothX) / 45 * 0.18)
    : 0;

  const pressureIntensity = homePressured
    ? Math.min(0.15, (30 - smoothX) / 30 * 0.15)
    : awayPressured
    ? Math.min(0.12, (smoothX - 70) / 30 * 0.12)
    : 0;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 145 }}>
      {/* Glow da zona da bola */}
      {glowIntensity > 0.02 && (
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: homeAttacking ? `${Math.max(0, smoothX - 25)}%` : 0,
          right: awayAttacking ? `${Math.max(0, 100 - smoothX - 25)}%` : 0,
          width: '50%',
          background: homeAttacking
            ? `radial-gradient(ellipse at ${smoothX}% 50%, rgba(253,225,0,${glowIntensity}) 0%, transparent 70%)`
            : `radial-gradient(ellipse at ${smoothX}% 50%, rgba(255,255,255,${glowIntensity}) 0%, transparent 70%)`,
          transition: 'opacity 800ms ease',
        }} />
      )}

      {/* Linhas de pressão — adversário pressionando nosso gol */}
      {homePressured && pressureIntensity > 0.02 && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ opacity: pressureIntensity * 6 }}
          preserveAspectRatio="none"
        >
          {[20, 35, 50, 65, 80].map((y, i) => (
            <line
              key={i}
              x1="0%" y1={`${y}%`}
              x2={`${smoothX + 10}%`} y2={`${50 + (y - 50) * 0.3}%`}
              stroke="rgba(239,68,68,0.6)"
              strokeWidth="0.5"
              strokeDasharray="4 8"
            />
          ))}
        </svg>
      )}

      {/* Linhas de pressão — nós pressionando o gol adversário */}
      {awayPressured && pressureIntensity > 0.02 && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ opacity: pressureIntensity * 6 }}
          preserveAspectRatio="none"
        >
          {[20, 35, 50, 65, 80].map((y, i) => (
            <line
              key={i}
              x1="100%" y1={`${y}%`}
              x2={`${smoothX - 10}%`} y2={`${50 + (y - 50) * 0.3}%`}
              stroke="rgba(253,225,0,0.5)"
              strokeWidth="0.5"
              strokeDasharray="4 8"
            />
          ))}
        </svg>
      )}

      {/* Pulso na zona da bola */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${smoothX}%`,
        transform: 'translate(-50%, -50%)',
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: `1px solid ${possession === 'home' ? 'rgba(253,225,0,0.15)' : 'rgba(255,255,255,0.1)'}`,
        animation: 'pressurePulse 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
