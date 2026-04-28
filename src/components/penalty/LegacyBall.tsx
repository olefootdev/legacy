import { useEffect, useRef, useState } from 'react';
import { POWER_SWEET_HIGH, POWER_SWEET_LOW } from './constants';

/**
 * Bola estática (na marca / no slot final). Aceita rotation pra preservar pose pós-voo.
 */
export function LegacyBall({
  cx,
  cy,
  size,
  jitter = false,
  rotation = 0,
  showShadow = true,
}: {
  cx: number;
  cy: number;
  size: number;
  jitter?: boolean;
  rotation?: number;
  showShadow?: boolean;
}) {
  const half = size / 2;
  return (
    <g>
      {showShadow && (
        <ellipse
          cx={cx}
          cy={cy + half * 0.85}
          rx={half * 0.85}
          ry={half * 0.18}
          fill="#000"
          opacity="0.3"
        />
      )}
      <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
        <image
          href="/assets/legacy-ball.png"
          x={-half}
          y={-half}
          width={size}
          height={size}
          style={{
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
            animation: jitter ? 'penalty-ball-jitter 0.12s infinite' : undefined,
          }}
        />
      </g>
    </g>
  );
}

/**
 * Bola voando — trajetória RETA, ease-in cubic (pancada). Termina exatamente
 * no endRotation pra preservar a pose do impacto sem snap-back.
 */
export function LegacyBallFlying({
  from,
  to,
  startSize,
  endSize,
  durationMs,
  power,
  endRotation,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startSize: number;
  endSize: number;
  durationMs: number;
  power: number;
  endRotation: number;
}) {
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    function tick(now: number) {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / durationMs);
      setT(next);
      if (next < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [durationMs, from.x, from.y, to.x, to.y]);

  // Ease-in cubic — devagar no início, ACELERA na chegada (pancada)
  const eased = t * t * t;

  // Trajetória LINEAR (reta, sem arco)
  const x = from.x + (to.x - from.x) * eased;
  const y = from.y + (to.y - from.y) * eased;

  // Encolhe (perspectiva)
  const size = startSize + (endSize - startSize) * eased;
  const half = size / 2;

  // Rotação termina exatamente em endRotation pra preservar pose
  const totalSpin = 540 + power * 540 + endRotation;
  const rotation = eased * totalSpin;

  // Sombra dinâmica no chão
  const heightAboveGround = from.y - y;
  const shadowOpacity = Math.max(0.05, 0.3 - heightAboveGround / 700);
  const shadowScale = Math.max(0.3, 1 - heightAboveGround / 500);

  return (
    <g>
      <ellipse
        cx={x}
        cy={from.y + half * 0.5}
        rx={half * 0.85 * shadowScale}
        ry={half * 0.18 * shadowScale}
        fill="#000"
        opacity={shadowOpacity}
      />
      <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        <image
          href="/assets/legacy-ball.png"
          x={-half}
          y={-half}
          width={size}
          height={size}
          style={{
            filter: `drop-shadow(0 ${4 + heightAboveGround / 25}px ${6 + heightAboveGround / 15}px rgba(0,0,0,0.5))`,
          }}
        />
      </g>
    </g>
  );
}

/**
 * Espessura do rastro técnico em função da força. Exposto pra render no SVG parent.
 */
export function trailStrokeWidth(power: number): number {
  if (power > POWER_SWEET_HIGH) return 4.5;
  if (power > POWER_SWEET_LOW) return 3.5;
  return 2.5;
}
