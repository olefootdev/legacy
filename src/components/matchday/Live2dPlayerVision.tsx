/**
 * Feixe de visão no campo principal (Partida Ao Vivo) — direção dinâmica + pontaria de exibição.
 * Usa CSS @keyframes em vez de motion.div para animações infinitas (GPU, sem custo JS por frame).
 */
import type React from 'react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { PitchPlayerState } from '@/engine/types';
import type { LiveMatchClockPeriod } from '@/engine/types';
import { getSideAttackDir, type MatchHalf } from '@/match/fieldZones';
import {
  tacticalPointingQuality01,
  tacticalVisionArrowEndPercent,
} from '@/match/tacticalPointingDisplay';

function clockToHalf(period: LiveMatchClockPeriod | undefined): MatchHalf {
  if (period === 'second_half') return 2;
  return 1;
}

export function live2dVisionRotateDeg(args: {
  player: PitchPlayerState;
  px: number;
  py: number;
  ballPercent: { x: number; y: number };
  attackDir: 1 | -1;
}): number {
  const { x2, y2 } = tacticalVisionArrowEndPercent({
    px: args.px,
    py: args.py,
    player: args.player,
    ballPercent: args.ballPercent,
    attackDir: args.attackDir,
    lenWorld: 3.4,
  });
  return (Math.atan2(y2 - args.py, x2 - args.px) * 180) / Math.PI;
}

export interface Live2dPlayerVisionProps {
  player: PitchPlayerState;
  px: number;
  py: number;
  ballPercent: { x: number; y: number };
  clockPeriod: LiveMatchClockPeriod | undefined;
  side: 'home' | 'away';
  onBall: boolean;
  distBallPct: number;
}

export const Live2dPlayerVision = memo(function Live2dPlayerVision({
  player,
  px,
  py,
  ballPercent,
  clockPeriod,
  side,
  onBall,
  distBallPct,
}: Live2dPlayerVisionProps) {
  const half = clockToHalf(clockPeriod);
  const attackDir = getSideAttackDir(side, half);
  const deg = live2dVisionRotateDeg({ player, px, py, ballPercent, attackDir });
  const q = tacticalPointingQuality01(player);
  const nearBall = distBallPct < 14;
  const wMin = 1.08 + q * 0.55;
  const wPref = 4.8 + q * 5.5;
  const wMax = 2.15 + q * 0.75;
  const beamW = `clamp(${wMin}rem, ${wPref}vmin, ${wMax}rem)`;
  const hue = side === 'home' ? '234 255 0' : '251 113 133';

  const opFrom = onBall ? 0.72 : nearBall ? 0.52 : 0.48;
  const opTo = onBall ? 1 : nearBall ? 0.9 : 0.82;
  const sxFrom = onBall ? 0.96 : 1;
  const sxTo = onBall ? 1.06 : 1.03;
  const dur = onBall ? '1.1s' : nearBall ? '1.75s' : '2.45s';
  const glowOpFrom = onBall ? 0.22 : 0.14;
  const glowOpTo = onBall ? 0.48 : 0.3;
  const glowDur = onBall ? '1.25s' : '2.05s';

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2">
      <div style={{ transform: `rotate(${deg}deg)` }}>
        <div
          className="absolute left-0 rounded-full"
          style={{
            top: '50%',
            width: beamW,
            height: onBall ? 3 : 2,
            transform: 'translateY(-50%)',
            transformOrigin: 'left center',
            background: `linear-gradient(90deg,
            rgba(${hue}, ${onBall ? 0.95 : 0.82}) 0%,
            rgba(${hue}, ${0.32 + q * 0.28}) 44%,
            transparent 100%)`,
            boxShadow: nearBall
              ? `0 0 10px rgba(${hue}, 0.45), 0 0 20px rgba(${hue}, 0.18)`
              : `0 0 6px rgba(${hue}, 0.2)`,
            animation: `vision-pulse ${dur} ease-in-out infinite`,
            '--vp-op-from': opFrom,
            '--vp-op-to': opTo,
            '--vp-sx-from': sxFrom,
            '--vp-sx-to': sxTo,
          } as React.CSSProperties}
        />
        <div
          className="absolute left-0 rounded-full blur-[1.5px]"
          style={{
            top: '50%',
            width: beamW,
            height: 5,
            transform: 'translateY(-50%)',
            marginTop: -0.5,
            background: `linear-gradient(90deg, rgba(${hue}, 0.38) 0%, transparent 75%)`,
            animation: `vision-glow ${glowDur} ease-in-out infinite`,
            '--vg-op-from': glowOpFrom,
            '--vg-op-to': glowOpTo,
          } as React.CSSProperties}
        />
        <div
          className={cn(
            'absolute left-0 top-0 size-[0.28rem] -translate-x-[18%] rounded-full opacity-85',
            'ring-1 ring-white/25',
          )}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            background: `rgb(${hue})`,
            boxShadow: `0 0 7px rgba(${hue}, 0.95)`,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
});
