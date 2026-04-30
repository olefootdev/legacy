/**
 * FieldView — campo ao vivo Legacy Tech Design System.
 *
 * Design: preto absoluto + neon-yellow (#FDE100), Oswald uppercase, Playfair itálico.
 * Campo: listras de grama escuras, marcações mínimas (sem detalhes), nada de verde brilhante.
 * Jogadores: cards posicionados no campo (não sprites).
 * Câmeras: aerial (drone top-down) | broadcast (ângulo TV) | firstperson (1ª pessoa).
 */
import { memo, useMemo } from 'react';
import type { PitchPlayerState } from '@/engine/types';

export type FieldCameraMode = 'aerial' | 'broadcast' | 'firstperson';

// ── SVG layout constants ────────────────────────────────────────────────────
const VW = 1136;
const VH = 674;

// Campo jogável (105m × 68m → proporção 1.544)
const FL = 84;   // left edge
const FT = 27;   // top edge
const FW = 968;  // width  (FL + FW = 1052)
const FH = 620;  // height (FT + FH = 647)  → 968/620 ≈ 1.561 ≈ 105/68

const FCX = FL + FW / 2; // center x = 568
const FCY = FT + FH / 2; // center y = 337

// Gol: profundidade visual 28px, boca 7.32m/68m * FH ≈ 66.7px
const GOAL_D = 28;
const GOAL_H = Math.round((7.32 / 68) * FH); // ≈ 67

// Penalti: 11m / 105m = 10.48% do FW ≈ 101.4px
const PEN_X_PCT = 11 / 105;

// Área grande: 16.5m × 40.3m
const BOX_W = Math.round((16.5 / 105) * FW); // ≈ 152
const BOX_H = Math.round((40.3 / 68) * FH);  // ≈ 367
const BOX_T = FCY - BOX_H / 2;

// Círculo central: r = 9.15m / 105m * FW / 2 ≈ 42.2
const CC_R = Math.round((9.15 / 52.5) * (FW / 2));

// ── Player field coordinate → SVG coordinate ───────────────────────────────
function toSvgX(fieldPct: number) {
  return FL + (fieldPct / 100) * FW;
}
function toSvgY(fieldPct: number) {
  return FT + (fieldPct / 100) * FH;
}

// ── Card dimensions ─────────────────────────────────────────────────────────
const CARD_W = 56;
const CARD_H = 68;

// ── Colours ─────────────────────────────────────────────────────────────────
const NEON = '#FDE100';
const DEEP = '#050505';
const LINE_COLOR = 'rgba(255,255,255,0.13)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// ── Real-world field dimensions (FIFA/smartfield) ──────────────────────────
const FIELD_LENGTH_M = 105;
const FIELD_WIDTH_M = 68;
const GOAL_WIDTH_M = 7.32;
const GOAL_HEIGHT_M = 2.44;
const BOX_DEPTH_M = 16.5;
const BOX_WIDTH_M = 40.3;
const SIX_DEPTH_M = 5.5;
const SIX_WIDTH_M = 18.32;
const PENALTY_SPOT_M = 11;

// Convert to field percentages (fieldX 0-100 = length; fieldY 0-100 = width)
const PCT_GOAL_HALF_Y = (GOAL_WIDTH_M / FIELD_WIDTH_M) * 50;       // ≈ 5.38
const PCT_BOX_DEPTH = (BOX_DEPTH_M / FIELD_LENGTH_M) * 100;        // ≈ 15.71
const PCT_BOX_HALF_Y = (BOX_WIDTH_M / FIELD_WIDTH_M) * 50;         // ≈ 29.63
const PCT_SIX_DEPTH = (SIX_DEPTH_M / FIELD_LENGTH_M) * 100;        // ≈ 5.24
const PCT_SIX_HALF_Y = (SIX_WIDTH_M / FIELD_WIDTH_M) * 50;         // ≈ 13.47
const PCT_PEN_SPOT = (PENALTY_SPOT_M / FIELD_LENGTH_M) * 100;      // ≈ 10.48
const GOAL_ASPECT = GOAL_HEIGHT_M / GOAL_WIDTH_M;                   // ≈ 0.333

// ── Inclined (tactical) perspective constants ──────────────────────────────
// Vertical viewBox: top = far end (away goal), bottom = near camera (home goal)
const IV_VW = 720;
const IV_VH = 1100;
const IV_CX = IV_VW / 2; // 360

// Trapezoid: top narrower (far), bottom wider (near camera)
const IV_TOP_Y = 110;
const IV_BOTTOM_Y = 990;
const IV_TOP_HALF_W = 290;    // near goal area at top, narrower
const IV_BOTTOM_HALF_W = 430; // wider near camera

function ivWidthAtDepth(t: number): number {
  // t: 0 = near (bottom), 1 = far (top)
  return IV_BOTTOM_HALF_W + t * (IV_TOP_HALF_W - IV_BOTTOM_HALF_W);
}

function ivProject(fieldX: number, fieldY: number) {
  // home defends fieldX=0 (bottom/near); away goal at fieldX=100 (top/far)
  const t = Math.max(0, Math.min(1, fieldX / 100));
  // non-linear foreshortening so near players feel bigger
  const tEased = Math.pow(t, 0.78);
  const sy = IV_BOTTOM_Y - tEased * (IV_BOTTOM_Y - IV_TOP_Y);
  const halfW = ivWidthAtDepth(tEased);
  const lat = (fieldY - 50) / 50; // -1..+1
  const sx = IV_CX + lat * halfW;
  const scale = 1.05 - tEased * 0.55; // near=1.05, far=0.50
  return { sx, sy, scale, depth: tEased };
}

// ── Perspective first-person helpers ───────────────────────────────────────
// FP shares the inclined viewBox (IV_VW×IV_VH) so it matches aerial dimensions —
// designed to be triggered as a transient highlight zoom on key moments
// (shots on goal), not a persistent camera mode.
const FP_VPY = 220;
const FP_GROUND_Y = IV_VH;
const FP_NEAR_SPREAD = IV_VW * 0.78;
const FP_FOCAL = 0.42;

interface FPCam {
  vpx: number;
  vpy: number;
  zoom: number;
}

function fpProject(
  fieldX: number,
  fieldY: number,
  cam: FPCam = { vpx: IV_VW / 2, vpy: FP_VPY, zoom: 1 },
): { sx: number; sy: number; scale: number } {
  const depth = Math.max(0.01, fieldX / 100);
  const t = Math.pow(depth, FP_FOCAL);

  const latOffset = (fieldY - 50) / 50;
  const sy = FP_GROUND_Y - t * (FP_GROUND_Y - cam.vpy);
  const spread = (1 - t) * FP_NEAR_SPREAD;
  const sx = cam.vpx + latOffset * spread * cam.zoom;
  const scale = (0.18 + (1 - t) * 0.82) * cam.zoom;
  return { sx, sy, scale };
}

// ── Aerial/broadcast grass stripes (SVG defs pattern) ────────────────────────
function GrassStripes() {
  const stripeW = FW / 14; // 14 alternating stripes
  const stripes: JSX.Element[] = [];
  for (let i = 0; i < 14; i++) {
    if (i % 2 === 1) continue;
    stripes.push(
      <rect
        key={i}
        x={FL + i * stripeW}
        y={FT}
        width={stripeW}
        height={FH}
        fill={GRASS_B}
      />,
    );
  }
  return <>{stripes}</>;
}

// ── Field markings ──────────────────────────────────────────────────────────
function FieldMarkings() {
  const lw = 1.5;
  const lc = LINE_COLOR;

  return (
    <g stroke={lc} fill="none" strokeWidth={lw}>
      {/* Perimeter */}
      <rect x={FL} y={FT} width={FW} height={FH} />

      {/* Center line */}
      <line x1={FCX} y1={FT} x2={FCX} y2={FT + FH} />

      {/* Center circle */}
      <circle cx={FCX} cy={FCY} r={CC_R} />
      <circle cx={FCX} cy={FCY} r={4} fill={lc} stroke="none" />

      {/* Left penalty box */}
      <rect x={FL} y={BOX_T} width={BOX_W} height={BOX_H} />
      {/* Left goal */}
      <rect x={FL - GOAL_D} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} />

      {/* Right penalty box */}
      <rect x={FL + FW - BOX_W} y={BOX_T} width={BOX_W} height={BOX_H} />
      {/* Right goal */}
      <rect x={FL + FW} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} />

      {/* Penalty spots */}
      <circle cx={FL + PEN_X_PCT * FW} cy={FCY} r={3} fill={lc} stroke="none" />
      <circle cx={FL + (1 - PEN_X_PCT) * FW} cy={FCY} r={3} fill={lc} stroke="none" />
    </g>
  );
}

// ── Player card (aerial / broadcast) ──────────────────────────────────────
interface PlayerCardProps {
  p: PitchPlayerState;
  isHome: boolean;
  isOnBall: boolean;
  onClick?: (p: PitchPlayerState) => void;
}

const PlayerCard = memo(function PlayerCard({ p, isHome, isOnBall, onClick }: PlayerCardProps) {
  const sx = toSvgX(p.x) - CARD_W / 2;
  const sy = toSvgY(p.y) - CARD_H / 2;
  const borderColor = isHome ? NEON : '#ffffff';
  const textColor = isHome ? NEON : '#ffffff';
  const glowRadius = isOnBall ? 14 : 0;
  const fatigue = Math.max(0, Math.min(100, p.fatigue ?? 0));
  const energy = 100 - fatigue;

  return (
    <g
      transform={`translate(${sx},${sy})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(p)}
    >
      {/* Glow ring on-ball */}
      {isOnBall && (
        <circle
          cx={CARD_W / 2}
          cy={CARD_H / 2}
          r={glowRadius + CARD_W / 2}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
          opacity={0.4}
        />
      )}

      {/* Card background */}
      <rect
        x={0}
        y={0}
        width={CARD_W}
        height={CARD_H}
        rx={3}
        fill={DEEP}
        stroke={borderColor}
        strokeWidth={isOnBall ? 2 : 1}
        opacity={isOnBall ? 1 : 0.88}
      />

      {/* POS label */}
      <text
        x={CARD_W / 2}
        y={15}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={9}
        fontFamily="'Oswald', 'Agency FB', 'Arial Narrow', sans-serif"
        fontWeight={700}
        letterSpacing={1.5}
        opacity={0.7}
      >
        {p.pos.toUpperCase()}
      </text>

      {/* Number (large italic) */}
      <text
        x={CARD_W / 2}
        y={38}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isOnBall ? borderColor : '#ffffff'}
        fontSize={22}
        fontFamily="'Playfair Display', 'Georgia', serif"
        fontStyle="italic"
        fontWeight={900}
      >
        {p.num}
      </text>

      {/* Short name */}
      <text
        x={CARD_W / 2}
        y={57}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={7}
        fontFamily="'Oswald', 'Agency FB', 'Arial Narrow', sans-serif"
        fontWeight={600}
        letterSpacing={0.8}
        opacity={0.85}
      >
        {shortName(p.name)}
      </text>

      {/* Energy bar */}
      <rect x={4} y={CARD_H - 6} width={CARD_W - 8} height={3} rx={1.5} fill="rgba(255,255,255,0.1)" />
      <rect
        x={4}
        y={CARD_H - 6}
        width={((CARD_W - 8) * energy) / 100}
        height={3}
        rx={1.5}
        fill={energy < 30 ? '#ef4444' : energy < 60 ? '#f97316' : borderColor}
        opacity={0.75}
      />
    </g>
  );
});

// ── First-person player card ──────────────────────────────────────────────
interface FPCardProps {
  p: PitchPlayerState;
  isHome: boolean;
  isOnBall: boolean;
  onClick?: (p: PitchPlayerState) => void;
}

const FPCard = memo(function FPCard({ p, isHome, isOnBall, onClick, cam }: FPCardProps & { cam: FPCam }) {
  const { sx, sy, scale } = fpProject(p.x, p.y, cam);
  if (scale < 0.14) return null; // too far, don't render

  const cw = CARD_W * scale;
  const ch = CARD_H * scale;
  const borderColor = isHome ? NEON : '#ffffff';
  const textColor = isHome ? NEON : '#ffffff';

  return (
    <g
      transform={`translate(${sx - cw / 2},${sy - ch})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(p)}
    >
      <rect
        x={0}
        y={0}
        width={cw}
        height={ch}
        rx={2 * scale}
        fill={DEEP}
        stroke={borderColor}
        strokeWidth={isOnBall ? 2 * scale : 1 * scale}
        opacity={0.9}
      />
      <text
        x={cw / 2}
        y={ch * 0.22}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={9 * scale}
        fontFamily="'Oswald', 'Agency FB', sans-serif"
        fontWeight={700}
        letterSpacing={1}
        opacity={0.7}
      >
        {p.pos.toUpperCase()}
      </text>
      <text
        x={cw / 2}
        y={ch * 0.55}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isOnBall ? borderColor : '#fff'}
        fontSize={22 * scale}
        fontFamily="'Playfair Display', serif"
        fontStyle="italic"
        fontWeight={900}
      >
        {p.num}
      </text>
      <text
        x={cw / 2}
        y={ch * 0.82}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={7 * scale}
        fontFamily="'Oswald', 'Agency FB', sans-serif"
        fontWeight={600}
        opacity={0.8}
      >
        {shortName(p.name)}
      </text>
    </g>
  );
});

// ── Ball ────────────────────────────────────────────────────────────────────
function Ball({ bx, by }: { bx: number; by: number }) {
  const sx = toSvgX(bx);
  const sy = toSvgY(by);
  return (
    <g>
      <circle cx={sx} cy={sy} r={10} fill="none" stroke={NEON} strokeWidth={2} opacity={0.3} />
      <circle cx={sx} cy={sy} r={5} fill="#ffffff" />
      <circle cx={sx} cy={sy} r={3} fill={NEON} />
    </g>
  );
}

// ── First-person ball ────────────────────────────────────────────────────────
function FPBall({ bx, by, cam }: { bx: number; by: number; cam: FPCam }) {
  const { sx, sy, scale } = fpProject(bx, by, cam);
  const r = 8 * scale;
  return (
    <g>
      <circle cx={sx} cy={sy - r} r={r * 1.8} fill="none" stroke={NEON} strokeWidth={2} opacity={0.25} />
      <circle cx={sx} cy={sy - r} r={r} fill="#ffffff" />
      <circle cx={sx} cy={sy - r} r={r * 0.55} fill={NEON} />
    </g>
  );
}

// ── First-person field (perspective SVG) ────────────────────────────────────
function FirstPersonField({
  homePlayers,
  awayPlayers,
  ballX,
  ballY,
  onBallId,
  onPlayerClick,
}: {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallId: string | null;
  onPlayerClick?: (p: PitchPlayerState) => void;
}) {
  // ── Cinematic camera tracking ──
  // Pan VPX based on ball's lateral position; tilt up slightly when ball is deep.
  const cam: FPCam = useMemo(() => {
    const lat = (ballY - 50) / 50;
    const depth = ballX / 100;
    return {
      vpx: IV_VW / 2 + lat * IV_VW * 0.18,
      vpy: FP_VPY - depth * 30,
      zoom: 1 + depth * 0.08,
    };
  }, [ballX, ballY]);

  // Sort all players by depth (far first, near last) for proper z-ordering
  const allCards = useMemo(() => {
    const home = homePlayers.map((p) => ({ p, isHome: true }));
    const away = awayPlayers.map((p) => ({ p, isHome: false }));
    return [...home, ...away].sort((a, b) => b.p.x - a.p.x); // far (high x) rendered first
  }, [homePlayers, awayPlayers]);

  // Ground perspective lines — left/right sidelines + center line converging to VP
  const groundLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const l0 = fpProject(0, 0, cam);
    const l1 = fpProject(100, 0, cam);
    lines.push({ x1: l0.sx, y1: l0.sy, x2: l1.sx, y2: l1.sy });
    const r0 = fpProject(0, 100, cam);
    const r1 = fpProject(100, 100, cam);
    lines.push({ x1: r0.sx, y1: r0.sy, x2: r1.sx, y2: r1.sy });
    const c0 = fpProject(0, 50, cam);
    const c1 = fpProject(100, 50, cam);
    lines.push({ x1: c0.sx, y1: c0.sy, x2: c1.sx, y2: c1.sy });
    const m0 = fpProject(50, 0, cam);
    const m1 = fpProject(50, 100, cam);
    lines.push({ x1: m0.sx, y1: m0.sy, x2: m1.sx, y2: m1.sy });
    const g0 = fpProject(100, 0, cam);
    const g1 = fpProject(100, 100, cam);
    lines.push({ x1: g0.sx, y1: g0.sy, x2: g1.sx, y2: g1.sy });
    return lines;
  }, [cam]);

  // Goal posts using real measurements
  const fpGoalL = fpProject(100, 50 - PCT_GOAL_HALF_Y, cam);
  const fpGoalR = fpProject(100, 50 + PCT_GOAL_HALF_Y, cam);
  const fpGoalPostHeight = (fpGoalR.sx - fpGoalL.sx) * GOAL_ASPECT;

  // Far box / six-yard
  const fpBoxNL = fpProject(100 - PCT_BOX_DEPTH, 50 - PCT_BOX_HALF_Y, cam);
  const fpBoxNR = fpProject(100 - PCT_BOX_DEPTH, 50 + PCT_BOX_HALF_Y, cam);
  const fpBoxFL = fpProject(100, 50 - PCT_BOX_HALF_Y, cam);
  const fpBoxFR = fpProject(100, 50 + PCT_BOX_HALF_Y, cam);

  return (
    <svg
      viewBox={`0 0 ${IV_VW} ${IV_VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      {/* ── Background sky gradient ── */}
      <defs>
        <linearGradient id="fp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050507" />
          <stop offset="60%" stopColor="#0a0d0b" />
          <stop offset="100%" stopColor={GRASS_A} />
        </linearGradient>
        <radialGradient id="fp-vp-glow" cx="50%" cy={`${(FP_VPY / IV_VH) * 100}%`} r="30%">
          <stop offset="0%" stopColor={NEON} stopOpacity="0.08" />
          <stop offset="100%" stopColor={NEON} stopOpacity="0" />
        </radialGradient>
        <filter id="fp-card-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Sky / atmosphere */}
      <rect x={0} y={0} width={IV_VW} height={IV_VH} fill="url(#fp-sky)" />
      <rect x={0} y={0} width={IV_VW} height={IV_VH} fill="url(#fp-vp-glow)" />

      {/* Floodlights */}
      {[80, IV_VW - 80, IV_VW / 2].map((lx, i) => (
        <g key={i}>
          <circle cx={lx} cy={IV_VH * 0.04} r={3} fill="#fffbe6" />
          <radialGradient id={`fp-light-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fffbe6" stopOpacity="0" />
          </radialGradient>
          <ellipse cx={lx} cy={IV_VH * 0.08} rx={80} ry={50} fill={`url(#fp-light-${i})`} />
        </g>
      ))}

      {/* Stadium crowd silhouettes near horizon */}
      <rect x={0} y={cam.vpy - 30} width={IV_VW} height={40}
        fill="rgba(0,0,0,0.6)" />
      {Array.from({ length: 36 }).map((_, i) => {
        const x = i * 21 + 5;
        const h = 10 + (Math.sin(i * 2.3) * 4);
        return (
          <ellipse key={i} cx={x} cy={cam.vpy - 10} rx={9} ry={h}
            fill={`rgba(${20 + (i % 5) * 4},${20 + (i % 3) * 4},${20 + (i % 7) * 3},0.85)`} />
        );
      })}

      {/* Ground fill */}
      <polygon
        points={`${fpProject(0, 0, cam).sx},${fpProject(0, 0, cam).sy} ${fpProject(0, 100, cam).sx},${fpProject(0, 100, cam).sy} ${fpProject(100, 100, cam).sx},${fpProject(100, 100, cam).sy} ${fpProject(100, 0, cam).sx},${fpProject(100, 0, cam).sy}`}
        fill={GRASS_A}
      />

      {/* Grass stripes in perspective */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x0 = i * 10;
        const x1 = x0 + 10;
        const p0 = fpProject(x0, 0, cam);
        const p1 = fpProject(x1, 0, cam);
        const p2 = fpProject(x1, 100, cam);
        const p3 = fpProject(x0, 100, cam);
        if (i % 2 === 1) return null;
        return (
          <polygon
            key={i}
            points={`${p0.sx},${p0.sy} ${p1.sx},${p1.sy} ${p2.sx},${p2.sy} ${p3.sx},${p3.sy}`}
            fill={GRASS_B}
            opacity={0.7}
          />
        );
      })}

      {/* Ground lines */}
      {groundLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={LINE_COLOR} strokeWidth={1.5} />
      ))}

      {/* Far penalty box (perspective, real dims) */}
      <g stroke={LINE_COLOR} fill="none" strokeWidth={1.4}>
        <polygon
          points={`${fpBoxNL.sx},${fpBoxNL.sy} ${fpBoxNR.sx},${fpBoxNR.sy} ${fpBoxFR.sx},${fpBoxFR.sy} ${fpBoxFL.sx},${fpBoxFL.sy}`}
        />
        <circle cx={fpProject(100 - PCT_PEN_SPOT, 50, cam).sx}
          cy={fpProject(100 - PCT_PEN_SPOT, 50, cam).sy} r={2.5}
          fill={LINE_COLOR} stroke="none" />
      </g>

      {/* Goal frame — STRAIGHT vertical posts + net */}
      <g stroke="rgba(255,255,255,0.7)" fill="none" strokeWidth={2}>
        {/* Net background */}
        <polygon
          points={`${fpGoalL.sx},${fpGoalL.sy} ${fpGoalR.sx},${fpGoalR.sy} ${fpGoalR.sx},${fpGoalR.sy - fpGoalPostHeight} ${fpGoalL.sx},${fpGoalL.sy - fpGoalPostHeight}`}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
        />
        {/* Net mesh */}
        {[0.25, 0.5, 0.75].map((t) => {
          const x = fpGoalL.sx + (fpGoalR.sx - fpGoalL.sx) * t;
          return (
            <line key={`fpv-${t}`} x1={x} y1={fpGoalL.sy}
              x2={x} y2={fpGoalL.sy - fpGoalPostHeight}
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.7} />
          );
        })}
        {[0.33, 0.66].map((t) => {
          const y = fpGoalL.sy - fpGoalPostHeight * t;
          return (
            <line key={`fph-${t}`} x1={fpGoalL.sx} y1={y}
              x2={fpGoalR.sx} y2={y}
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.7} />
          );
        })}
        {/* STRAIGHT vertical posts */}
        <line x1={fpGoalL.sx} y1={fpGoalL.sy}
          x2={fpGoalL.sx} y2={fpGoalL.sy - fpGoalPostHeight} />
        <line x1={fpGoalR.sx} y1={fpGoalR.sy}
          x2={fpGoalR.sx} y2={fpGoalR.sy - fpGoalPostHeight} />
        {/* Crossbar */}
        <line x1={fpGoalL.sx} y1={fpGoalL.sy - fpGoalPostHeight}
          x2={fpGoalR.sx} y2={fpGoalR.sy - fpGoalPostHeight} />
      </g>

      {/* Players (sorted by depth, far first) */}
      {allCards.map(({ p, isHome }) => (
        <FPCard
          key={p.playerId}
          p={p}
          isHome={isHome}
          isOnBall={p.playerId === onBallId}
          onClick={onPlayerClick}
          cam={cam}
        />
      ))}

      {/* Ball */}
      <FPBall bx={ballX} by={ballY} cam={cam} />
    </svg>
  );
}

// ── Inclined player card (tactical perspective) ────────────────────────────
interface IVCardProps {
  p: PitchPlayerState;
  isHome: boolean;
  isOnBall: boolean;
  onClick?: (p: PitchPlayerState) => void;
}

const IV_CARD_W = 70;
const IV_CARD_H = 86;

const InclinedCard = memo(function InclinedCard({ p, isHome, isOnBall, onClick }: IVCardProps) {
  const { sx, sy, scale } = ivProject(p.x, p.y);
  const cw = IV_CARD_W * scale;
  const ch = IV_CARD_H * scale;
  const x = sx - cw / 2;
  const y = sy - ch; // anchor at feet (bottom)
  const borderColor = isHome ? NEON : '#ffffff';
  const textColor = isHome ? NEON : '#ffffff';
  const fatigue = Math.max(0, Math.min(100, p.fatigue ?? 0));
  const energy = 100 - fatigue;
  const ovr = Math.round(((p as any).attributes?.overall ?? 75 + ((p.num * 7) % 18)));

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(p)}
      filter="url(#iv-card-shadow)"
    >
      {/* Shadow on ground (ellipse) */}
      <ellipse
        cx={cw / 2}
        cy={ch + 3 * scale}
        rx={cw * 0.42}
        ry={cw * 0.12}
        fill="#000"
        opacity={0.55}
      />

      {/* Selected ring */}
      {isOnBall && (
        <rect
          x={-3}
          y={-3}
          width={cw + 6}
          height={ch + 6}
          rx={4 * scale}
          fill="none"
          stroke={borderColor}
          strokeWidth={2.5}
          opacity={0.55}
        />
      )}

      {/* Card body */}
      <rect
        x={0}
        y={0}
        width={cw}
        height={ch}
        rx={3 * scale}
        fill={DEEP}
        stroke={borderColor}
        strokeWidth={isOnBall ? 2 * scale : 1.2 * scale}
        opacity={0.94}
      />

      {/* Top accent bar */}
      <rect x={0} y={0} width={cw} height={3 * scale} fill={borderColor} opacity={isHome ? 0.95 : 0.6} />

      {/* POS · OVR */}
      <text
        x={cw / 2}
        y={ch * 0.18}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={11 * scale}
        fontFamily="'Oswald', 'Agency FB', sans-serif"
        fontWeight={700}
        letterSpacing={1.2}
        opacity={0.85}
      >
        {p.pos.toUpperCase()} · {ovr}
      </text>

      {/* Number (Playfair italic) */}
      <text
        x={cw / 2}
        y={ch * 0.49}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isOnBall ? borderColor : '#ffffff'}
        fontSize={28 * scale}
        fontFamily="'Playfair Display', 'Georgia', serif"
        fontStyle="italic"
        fontWeight={900}
      >
        {p.num}
      </text>

      {/* Name */}
      <text
        x={cw / 2}
        y={ch * 0.76}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={9 * scale}
        fontFamily="'Oswald', sans-serif"
        fontWeight={600}
        letterSpacing={0.7}
        opacity={0.88}
      >
        {shortName(p.name)}
      </text>

      {/* Energy bar */}
      <rect
        x={4 * scale}
        y={ch - 7 * scale}
        width={cw - 8 * scale}
        height={3 * scale}
        rx={1.5 * scale}
        fill="rgba(255,255,255,0.12)"
      />
      <rect
        x={4 * scale}
        y={ch - 7 * scale}
        width={((cw - 8 * scale) * energy) / 100}
        height={3 * scale}
        rx={1.5 * scale}
        fill={energy < 30 ? '#ef4444' : energy < 60 ? '#f97316' : borderColor}
        opacity={0.85}
      />
    </g>
  );
});

// ── Inclined ball ──────────────────────────────────────────────────────────
function IVBall({ bx, by }: { bx: number; by: number }) {
  const { sx, sy, scale } = ivProject(bx, by);
  const r = 9 * scale;
  return (
    <g>
      <ellipse cx={sx} cy={sy + 1} rx={r * 0.9} ry={r * 0.3} fill="#000" opacity={0.55} />
      <circle cx={sx} cy={sy - r * 0.2} r={r * 1.9} fill="none" stroke={NEON} strokeWidth={2} opacity={0.3} />
      <circle cx={sx} cy={sy - r * 0.2} r={r} fill="#ffffff" />
      <circle cx={sx} cy={sy - r * 0.2} r={r * 0.55} fill={NEON} />
    </g>
  );
}

// ── Inclined (tactical perspective) field ──────────────────────────────────
function InclinedField({
  homePlayers,
  awayPlayers,
  ballX,
  ballY,
  onBallId,
  onPlayerClick,
}: {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallId: string | null;
  onPlayerClick?: (p: PitchPlayerState) => void;
}) {
  // Sort players by depth: far first (top), near last (bottom) — natural occlusion
  const allCards = useMemo(() => {
    const home = homePlayers.map((p) => ({ p, isHome: true }));
    const away = awayPlayers.map((p) => ({ p, isHome: false }));
    // higher fieldX → further away → render first
    return [...home, ...away].sort((a, b) => b.p.x - a.p.x);
  }, [homePlayers, awayPlayers]);

  // Trapezoid corners
  const tlx = IV_CX - IV_TOP_HALF_W;
  const trx = IV_CX + IV_TOP_HALF_W;
  const brx = IV_CX + IV_BOTTOM_HALF_W;
  const blx = IV_CX - IV_BOTTOM_HALF_W;

  // Center line at midfield (fieldX=50)
  const midL = ivProject(50, 0);
  const midR = ivProject(50, 100);

  // Center circle ellipse (perspective)
  const centerCircle = ivProject(50, 50);
  const ccHalfW = ivWidthAtDepth(centerCircle.depth) * 0.18;

  // Spatial geometry from real measurements
  const farBoxX = 100 - PCT_BOX_DEPTH;
  const nearBoxX = PCT_BOX_DEPTH;
  const boxYL = 50 - PCT_BOX_HALF_Y;
  const boxYR = 50 + PCT_BOX_HALF_Y;
  const sixYL = 50 - PCT_SIX_HALF_Y;
  const sixYR = 50 + PCT_SIX_HALF_Y;
  const goalYL = 50 - PCT_GOAL_HALF_Y;
  const goalYR = 50 + PCT_GOAL_HALF_Y;

  // Far penalty box
  const farBoxNL = ivProject(farBoxX, boxYL);
  const farBoxNR = ivProject(farBoxX, boxYR);
  const farBoxFL = ivProject(100, boxYL);
  const farBoxFR = ivProject(100, boxYR);
  // Far six-yard
  const farSixNL = ivProject(100 - PCT_SIX_DEPTH, sixYL);
  const farSixNR = ivProject(100 - PCT_SIX_DEPTH, sixYR);
  const farSixFL = ivProject(100, sixYL);
  const farSixFR = ivProject(100, sixYR);

  // Near penalty box
  const nearBoxFL = ivProject(nearBoxX, boxYL);
  const nearBoxFR = ivProject(nearBoxX, boxYR);
  const nearBoxNL = ivProject(0, boxYL);
  const nearBoxNR = ivProject(0, boxYR);
  // Near six-yard
  const nearSixFL = ivProject(PCT_SIX_DEPTH, sixYL);
  const nearSixFR = ivProject(PCT_SIX_DEPTH, sixYR);
  const nearSixNL = ivProject(0, sixYL);
  const nearSixNR = ivProject(0, sixYR);

  // Far goal posts (real width 7.32m → ±5.38% of fieldY around 50)
  const farGoalL = ivProject(100, goalYL);
  const farGoalR = ivProject(100, goalYR);
  const farGoalPostHeight =
    (farGoalR.sx - farGoalL.sx) * GOAL_ASPECT * 1.0; // proper aspect

  // Near goal posts (at fieldX=0)
  const nearGoalL = ivProject(0, goalYL);
  const nearGoalR = ivProject(0, goalYR);
  const nearGoalPostHeight =
    (nearGoalR.sx - nearGoalL.sx) * GOAL_ASPECT;

  return (
    <svg
      viewBox={`0 0 ${IV_VW} ${IV_VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="iv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050505" />
          <stop offset="50%" stopColor="#080a08" />
          <stop offset="100%" stopColor="#0a0d0a" />
        </linearGradient>
        <linearGradient id="iv-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GRASS_A} stopOpacity="0.8" />
          <stop offset="100%" stopColor={GRASS_B} />
        </linearGradient>
        <radialGradient id="iv-spot" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#1a2a1c" stopOpacity="0.65" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="iv-card-shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={IV_VW} height={IV_VH} fill="url(#iv-bg)" />

      {/* Crowd silhouette behind far end */}
      <rect x={0} y={0} width={IV_VW} height={IV_TOP_Y - 40} fill="#0a0a0a" />
      {Array.from({ length: 36 }).map((_, i) => {
        const cx = i * 21 + 8;
        const h = 9 + Math.sin(i * 1.7) * 4;
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={IV_TOP_Y - 18}
            rx={9}
            ry={h}
            fill={`rgba(${22 + (i % 4) * 5},${22 + (i % 3) * 5},${24 + (i % 5) * 4},0.85)`}
          />
        );
      })}

      {/* Trapezoid pitch surface */}
      <polygon
        points={`${tlx},${IV_TOP_Y} ${trx},${IV_TOP_Y} ${brx},${IV_BOTTOM_Y} ${blx},${IV_BOTTOM_Y}`}
        fill="url(#iv-grass)"
      />

      {/* Spotlight overlay */}
      <polygon
        points={`${tlx},${IV_TOP_Y} ${trx},${IV_TOP_Y} ${brx},${IV_BOTTOM_Y} ${blx},${IV_BOTTOM_Y}`}
        fill="url(#iv-spot)"
      />

      {/* Grass stripes (perspective bands across width) */}
      {Array.from({ length: 12 }).map((_, i) => {
        if (i % 2 === 1) return null;
        const t0 = i / 12;
        const t1 = (i + 1) / 12;
        const yA = IV_TOP_Y + t0 * (IV_BOTTOM_Y - IV_TOP_Y);
        const yB = IV_TOP_Y + t1 * (IV_BOTTOM_Y - IV_TOP_Y);
        const wA = IV_TOP_HALF_W + t0 * (IV_BOTTOM_HALF_W - IV_TOP_HALF_W);
        const wB = IV_TOP_HALF_W + t1 * (IV_BOTTOM_HALF_W - IV_TOP_HALF_W);
        return (
          <polygon
            key={i}
            points={`${IV_CX - wA},${yA} ${IV_CX + wA},${yA} ${IV_CX + wB},${yB} ${IV_CX - wB},${yB}`}
            fill={GRASS_B}
            opacity={0.55}
          />
        );
      })}

      {/* Pitch outline */}
      <g stroke={LINE_COLOR} fill="none" strokeWidth={1.5}>
        <polygon
          points={`${tlx},${IV_TOP_Y} ${trx},${IV_TOP_Y} ${brx},${IV_BOTTOM_Y} ${blx},${IV_BOTTOM_Y}`}
        />

        {/* Center line */}
        <line x1={midL.sx} y1={midL.sy} x2={midR.sx} y2={midR.sy} />

        {/* Center circle (ellipse perspective) */}
        <ellipse
          cx={centerCircle.sx}
          cy={centerCircle.sy}
          rx={ccHalfW}
          ry={ccHalfW * 0.52}
        />
        <circle cx={centerCircle.sx} cy={centerCircle.sy} r={3} fill={LINE_COLOR} stroke="none" />

        {/* Far penalty box (small, top) */}
        <polygon
          points={`${farBoxNL.sx},${farBoxNL.sy} ${farBoxNR.sx},${farBoxNR.sy} ${farBoxFR.sx},${farBoxFR.sy} ${farBoxFL.sx},${farBoxFL.sy}`}
        />
        {/* Far six-yard */}
        <polygon
          points={`${farSixNL.sx},${farSixNL.sy} ${farSixNR.sx},${farSixNR.sy} ${farSixFR.sx},${farSixFR.sy} ${farSixFL.sx},${farSixFL.sy}`}
          opacity={0.7}
        />

        {/* Near penalty box (large, bottom) */}
        <polygon
          points={`${nearBoxFL.sx},${nearBoxFL.sy} ${nearBoxFR.sx},${nearBoxFR.sy} ${nearBoxNR.sx},${nearBoxNR.sy} ${nearBoxNL.sx},${nearBoxNL.sy}`}
        />
        {/* Near six-yard */}
        <polygon
          points={`${nearSixFL.sx},${nearSixFL.sy} ${nearSixFR.sx},${nearSixFR.sy} ${nearSixNR.sx},${nearSixNR.sy} ${nearSixNL.sx},${nearSixNL.sy}`}
          opacity={0.7}
        />

        {/* Penalty spots */}
        <circle cx={ivProject(100 - PCT_PEN_SPOT, 50).sx} cy={ivProject(100 - PCT_PEN_SPOT, 50).sy} r={2.5} fill={LINE_COLOR} stroke="none" />
        <circle cx={ivProject(PCT_PEN_SPOT, 50).sx} cy={ivProject(PCT_PEN_SPOT, 50).sy} r={3.5} fill={LINE_COLOR} stroke="none" />
      </g>

      {/* Far goal frame — vertical posts + crossbar + net hint */}
      <g stroke="rgba(255,255,255,0.7)" fill="none" strokeWidth={1.8}>
        {/* Net background */}
        <polygon
          points={`${farGoalL.sx},${farGoalL.sy} ${farGoalR.sx},${farGoalR.sy} ${farGoalR.sx},${farGoalR.sy - farGoalPostHeight} ${farGoalL.sx},${farGoalL.sy - farGoalPostHeight}`}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.8}
        />
        {/* Net mesh — vertical strands */}
        {[0.25, 0.5, 0.75].map((t) => {
          const x = farGoalL.sx + (farGoalR.sx - farGoalL.sx) * t;
          return (
            <line key={`fnv-${t}`} x1={x} y1={farGoalL.sy}
              x2={x} y2={farGoalL.sy - farGoalPostHeight}
              stroke="rgba(255,255,255,0.13)" strokeWidth={0.6} />
          );
        })}
        {[0.33, 0.66].map((t) => {
          const y = farGoalL.sy - farGoalPostHeight * t;
          return (
            <line key={`fnh-${t}`} x1={farGoalL.sx} y1={y}
              x2={farGoalR.sx} y2={y}
              stroke="rgba(255,255,255,0.13)" strokeWidth={0.6} />
          );
        })}
        {/* Posts (vertical) */}
        <line x1={farGoalL.sx} y1={farGoalL.sy} x2={farGoalL.sx} y2={farGoalL.sy - farGoalPostHeight} />
        <line x1={farGoalR.sx} y1={farGoalR.sy} x2={farGoalR.sx} y2={farGoalR.sy - farGoalPostHeight} />
        {/* Crossbar */}
        <line
          x1={farGoalL.sx} y1={farGoalL.sy - farGoalPostHeight}
          x2={farGoalR.sx} y2={farGoalR.sy - farGoalPostHeight}
        />
      </g>

      {/* Near goal frame — STRAIGHT vertical posts */}
      <g stroke="rgba(255,255,255,0.85)" fill="none" strokeWidth={2.5}>
        {/* Net background */}
        <polygon
          points={`${nearGoalL.sx},${nearGoalL.sy} ${nearGoalR.sx},${nearGoalR.sy} ${nearGoalR.sx},${nearGoalR.sy - nearGoalPostHeight} ${nearGoalL.sx},${nearGoalL.sy - nearGoalPostHeight}`}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={1}
        />
        {/* Net mesh */}
        {[0.2, 0.4, 0.6, 0.8].map((t) => {
          const x = nearGoalL.sx + (nearGoalR.sx - nearGoalL.sx) * t;
          return (
            <line key={`nnv-${t}`} x1={x} y1={nearGoalL.sy}
              x2={x} y2={nearGoalL.sy - nearGoalPostHeight}
              stroke="rgba(255,255,255,0.22)" strokeWidth={0.8} />
          );
        })}
        {[0.25, 0.5, 0.75].map((t) => {
          const y = nearGoalL.sy - nearGoalPostHeight * t;
          return (
            <line key={`nnh-${t}`} x1={nearGoalL.sx} y1={y}
              x2={nearGoalR.sx} y2={y}
              stroke="rgba(255,255,255,0.22)" strokeWidth={0.8} />
          );
        })}
        {/* Posts (STRAIGHT vertical, not foreshortened) */}
        <line x1={nearGoalL.sx} y1={nearGoalL.sy}
          x2={nearGoalL.sx} y2={nearGoalL.sy - nearGoalPostHeight} />
        <line x1={nearGoalR.sx} y1={nearGoalR.sy}
          x2={nearGoalR.sx} y2={nearGoalR.sy - nearGoalPostHeight} />
        {/* Crossbar */}
        <line x1={nearGoalL.sx} y1={nearGoalL.sy - nearGoalPostHeight}
          x2={nearGoalR.sx} y2={nearGoalR.sy - nearGoalPostHeight} />
      </g>

      {/* Players (depth-sorted) */}
      {allCards.map(({ p, isHome }) => (
        <InclinedCard
          key={p.playerId}
          p={p}
          isHome={isHome}
          isOnBall={p.playerId === onBallId}
          onClick={onPlayerClick}
        />
      ))}

      {/* Ball */}
      <IVBall bx={ballX} by={ballY} />
    </svg>
  );
}

// ── Aerial / Broadcast field ─────────────────────────────────────────────────
function AerialField({
  homePlayers,
  awayPlayers,
  ballX,
  ballY,
  onBallId,
  onPlayerClick,
}: {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallId: string | null;
  onPlayerClick?: (p: PitchPlayerState) => void;
}) {
  // Sort: render home over away for overlap
  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full h-auto"
      style={{ display: 'block' }}
    >
      <defs>
        <filter id="card-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.7" />
        </filter>
        <radialGradient id="field-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      {/* Stadium atmosphere background */}
      <rect x={0} y={0} width={VW} height={VH} fill="#080b08" />

      {/* Crowd/stands silhouettes around field */}
      <rect x={0} y={0} width={VW} height={FT} fill="#0a0a0a" />
      <rect x={0} y={FT + FH} width={VW} height={VH - FT - FH} fill="#0a0a0a" />
      {/* Corner atmosphere */}
      {[
        { cx: 0, cy: 0 }, { cx: VW, cy: 0 },
        { cx: 0, cy: VH }, { cx: VW, cy: VH },
      ].map((pt, i) => (
        <radialGradient key={i} id={`corner-${i}`} cx={`${(pt.cx / VW) * 100}%`} cy={`${(pt.cy / VH) * 100}%`} r="25%">
          <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={0} y={0} width={VW} height={VH} fill={`url(#corner-${i})`} />
      ))}

      {/* Field background */}
      <rect x={FL} y={FT} width={FW} height={FH} fill={GRASS_A} />
      <GrassStripes />

      {/* Vignette */}
      <rect x={FL} y={FT} width={FW} height={FH} fill="url(#field-vignette)" />

      {/* Field markings */}
      <FieldMarkings />

      {/* Away players */}
      {awayPlayers.map((p) => (
        <PlayerCard
          key={p.playerId}
          p={p}
          isHome={false}
          isOnBall={p.playerId === onBallId}
          onClick={onPlayerClick}
        />
      ))}

      {/* Home players (on top) */}
      {homePlayers.map((p) => (
        <PlayerCard
          key={p.playerId}
          p={p}
          isHome={true}
          isOnBall={p.playerId === onBallId}
          onClick={onPlayerClick}
        />
      ))}

      {/* Ball */}
      <Ball bx={ballX} by={ballY} />
    </svg>
  );
}

// ── Camera mode labels ───────────────────────────────────────────────────────
const CAMERA_LABELS: Record<FieldCameraMode, string> = {
  aerial: 'TÁTICA',
  broadcast: 'TV',
  firstperson: 'HIGHLIGHT',
};
// Modes available in the user-facing switcher.
// 'firstperson' is intentionally omitted: it's the highlight zoom triggered
// programmatically from key moments (shots on goal), not a persistent camera.
const SWITCHER_MODES: FieldCameraMode[] = ['aerial', 'broadcast'];

// ── Main FieldView component ─────────────────────────────────────────────────
export interface FieldViewProps {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  /** Ball position 0-100 in field percent (defaults to center). */
  ballX?: number;
  ballY?: number;
  /** ID of the player currently on the ball (for card highlight). */
  onBallPlayerId?: string | null;
  cameraMode?: FieldCameraMode;
  homeShort?: string;
  awayShort?: string;
  homeScore?: number;
  awayScore?: number;
  matchMinute?: number;
  /** Show camera mode switcher UI. */
  showCameraSwitch?: boolean;
  onCameraChange?: (mode: FieldCameraMode) => void;
  onPlayerClick?: (p: PitchPlayerState) => void;
  className?: string;
}

export const FieldView = memo(function FieldView({
  homePlayers,
  awayPlayers,
  ballX = 50,
  ballY = 50,
  onBallPlayerId = null,
  cameraMode = 'aerial',
  homeShort = 'HOM',
  awayShort = 'VIS',
  homeScore = 0,
  awayScore = 0,
  matchMinute,
  showCameraSwitch = true,
  onCameraChange,
  onPlayerClick,
  className = '',
}: FieldViewProps) {
  const broadcastStyle =
    cameraMode === 'broadcast'
      ? {
          transform: 'perspective(900px) rotateX(22deg) translateY(-4%) scale(1.06)',
          transformOrigin: '50% 45%',
        }
      : undefined;

  // Aerial (inclined) and FP both use the portrait viewBox so a future
  // aerial→FP highlight transition feels seamless. Broadcast keeps landscape.
  const aspectRatio =
    cameraMode === 'broadcast'
      ? `${VW}/${VH}`
      : `${IV_VW}/${IV_VH}`;

  return (
    <div
      className={`relative flex flex-col bg-[#050505] select-none overflow-hidden ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* ── Scoreboard header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-black uppercase tracking-[0.25em] text-neon-yellow"
            style={{ fontSize: 11 }}
          >
            {homeShort}
          </span>
          <span
            className="font-display font-black tabular-nums"
            style={{
              fontSize: 22,
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              color: '#fff',
              letterSpacing: '-0.02em',
            }}
          >
            {homeScore} – {awayScore}
          </span>
          <span
            className="font-display font-black uppercase tracking-[0.25em] text-white/60"
            style={{ fontSize: 11 }}
          >
            {awayShort}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {matchMinute != null && (
            <span
              className="font-display font-black tabular-nums text-neon-yellow"
              style={{ fontSize: 13, letterSpacing: '0.05em' }}
            >
              {matchMinute}&prime;
            </span>
          )}

          {/* Camera switcher */}
          {showCameraSwitch && onCameraChange && (
            <div className="flex gap-1">
              {SWITCHER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onCameraChange(mode)}
                  className="px-2 py-1 font-display font-black uppercase transition-all"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    background: cameraMode === mode ? NEON : 'rgba(255,255,255,0.06)',
                    color: cameraMode === mode ? '#000' : 'rgba(255,255,255,0.5)',
                    borderRadius: 2,
                    border: `1px solid ${cameraMode === mode ? NEON : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {CAMERA_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Field area — fills width, height determined by SVG aspect ratio ── */}
      <div
        className="relative w-full"
        style={{
          aspectRatio,
          background: 'radial-gradient(ellipse 80% 50% at 50% 40%, #131e14 0%, #090d09 55%, #050805 100%)',
          ...broadcastStyle,
        }}
      >
        {cameraMode === 'firstperson' ? (
          <FirstPersonField
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ballX={ballX}
            ballY={ballY}
            onBallId={onBallPlayerId}
            onPlayerClick={onPlayerClick}
          />
        ) : cameraMode === 'aerial' ? (
          <InclinedField
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ballX={ballX}
            ballY={ballY}
            onBallId={onBallPlayerId}
            onPlayerClick={onPlayerClick}
          />
        ) : (
          <AerialField
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ballX={ballX}
            ballY={ballY}
            onBallId={onBallPlayerId}
            onPlayerClick={onPlayerClick}
          />
        )}
      </div>

      {/* ── Camera mode label (bottom-right watermark) ── */}
      <div
        className="absolute bottom-3 right-4 pointer-events-none"
        style={{
          fontSize: 9,
          letterSpacing: '0.3em',
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          color: 'rgba(255,255,255,0.18)',
          textTransform: 'uppercase',
        }}
      >
        {CAMERA_LABELS[cameraMode]}
      </div>
    </div>
  );
});

// ── Utility ─────────────────────────────────────────────────────────────────
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 8).toUpperCase();
  const last = parts[parts.length - 1]!;
  return last.slice(0, 8).toUpperCase();
}
