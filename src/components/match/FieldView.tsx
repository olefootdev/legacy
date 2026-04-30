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

// ── Perspective first-person helpers ───────────────────────────────────────
// VP = vanishing point (center-top of the first-person view)
const FP_VPX = VW / 2;       // 568
const FP_VPY = VH * 0.18;    // 121
const FP_GROUND_Y = VH;      // bottom edge (camera position row)

function fpProject(fieldX: number, fieldY: number): { sx: number; sy: number; scale: number } {
  // fieldX: 0-100 (left goal=0, right goal=100)
  // fieldY: 0-100 (top touchline=0, bottom touchline=100)
  //
  // Camera looking toward right goal (x=100 side).
  // Depth factor: how far the player is from the camera in field-X (0 = same row, 100 = far end)
  const depth = Math.max(0.01, fieldX / 100); // 0–1, 1 = far goal
  const t = Math.pow(depth, 0.55);            // non-linear foreshortening

  // Horizontal: player lateral offset relative to center (fieldY=50 is center)
  const latOffset = (fieldY - 50) / 50;      // -1 to +1

  // Screen Y: interpolate from bottom (camera) to VP
  const sy = FP_GROUND_Y - t * (FP_GROUND_Y - FP_VPY);

  // Screen X: lateral spread shrinks with depth
  const spread = (1 - t) * (VW * 0.48);
  const sx = FP_VPX + latOffset * spread;

  const scale = 0.25 + (1 - t) * 0.75; // near=1.0, far=0.25
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

const FPCard = memo(function FPCard({ p, isHome, isOnBall, onClick }: FPCardProps) {
  const { sx, sy, scale } = fpProject(p.x, p.y);
  if (scale < 0.18) return null; // too far, don't render

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
function FPBall({ bx, by }: { bx: number; by: number }) {
  const { sx, sy, scale } = fpProject(bx, by);
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
  // Sort all players by depth (far first, near last) for proper z-ordering
  const allCards = useMemo(() => {
    const home = homePlayers.map((p) => ({ p, isHome: true }));
    const away = awayPlayers.map((p) => ({ p, isHome: false }));
    return [...home, ...away].sort((a, b) => b.p.x - a.p.x); // far (high x) rendered first
  }, [homePlayers, awayPlayers]);

  // Ground perspective lines — left/right sidelines + center line converging to VP
  const groundLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // Left sideline (fieldY=0)
    const l0 = fpProject(0, 0);
    const l1 = fpProject(100, 0);
    lines.push({ x1: l0.sx, y1: l0.sy, x2: l1.sx, y2: l1.sy });
    // Right sideline (fieldY=100)
    const r0 = fpProject(0, 100);
    const r1 = fpProject(100, 100);
    lines.push({ x1: r0.sx, y1: r0.sy, x2: r1.sx, y2: r1.sy });
    // Center line (fieldY=50)
    const c0 = fpProject(0, 50);
    const c1 = fpProject(100, 50);
    lines.push({ x1: c0.sx, y1: c0.sy, x2: c1.sx, y2: c1.sy });
    // Mid-field line (fieldX=50)
    const m0 = fpProject(50, 0);
    const m1 = fpProject(50, 100);
    lines.push({ x1: m0.sx, y1: m0.sy, x2: m1.sx, y2: m1.sy });
    // Away goal line (fieldX=100)
    const g0 = fpProject(100, 0);
    const g1 = fpProject(100, 100);
    lines.push({ x1: g0.sx, y1: g0.sy, x2: g1.sx, y2: g1.sy });
    return lines;
  }, []);

  // Goal frame in perspective
  const goalTop = fpProject(100, 38.5);    // left post (38.5% = (50 - 3.66/68*100))
  const goalBottom = fpProject(100, 61.5); // right post

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
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
        <radialGradient id="fp-vp-glow" cx="50%" cy={`${(FP_VPY / VH) * 100}%`} r="30%">
          <stop offset="0%" stopColor={NEON} stopOpacity="0.08" />
          <stop offset="100%" stopColor={NEON} stopOpacity="0" />
        </radialGradient>
        <filter id="fp-card-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Sky / atmosphere */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#fp-sky)" />
      <rect x={0} y={0} width={VW} height={VH} fill="url(#fp-vp-glow)" />

      {/* Floodlights (4 corners + top center) */}
      {[80, VW - 80, VW / 2].map((lx, i) => (
        <g key={i}>
          <circle cx={lx} cy={VH * 0.06} r={3} fill="#fffbe6" />
          <radialGradient id={`fp-light-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fffbe6" stopOpacity="0" />
          </radialGradient>
          <ellipse cx={lx} cy={VH * 0.12} rx={80} ry={50} fill={`url(#fp-light-${i})`} />
        </g>
      ))}

      {/* Stadium crowd silhouettes */}
      <rect x={0} y={FP_VPY - 30} width={VW} height={40}
        fill="rgba(0,0,0,0.6)" />
      {/* Simple crowd bumps */}
      {Array.from({ length: 56 }).map((_, i) => {
        const x = i * 21 + 5;
        const h = 10 + (Math.sin(i * 2.3) * 4);
        return (
          <ellipse key={i} cx={x} cy={FP_VPY - 10} rx={9} ry={h}
            fill={`rgba(${20 + (i % 5) * 4},${20 + (i % 3) * 4},${20 + (i % 7) * 3},0.85)`} />
        );
      })}

      {/* Ground fill */}
      <polygon
        points={`0,${VH} ${VW},${VH} ${fpProject(100, 100).sx},${fpProject(100, 100).sy} ${fpProject(100, 0).sx},${fpProject(100, 0).sy}`}
        fill={GRASS_A}
      />

      {/* Grass stripes in perspective */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x0 = i * 10;
        const x1 = x0 + 10;
        const p0 = fpProject(x0, 0);
        const p1 = fpProject(x1, 0);
        const p2 = fpProject(x1, 100);
        const p3 = fpProject(x0, 100);
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

      {/* Goal frame in perspective */}
      <g stroke="rgba(255,255,255,0.5)" fill="none" strokeWidth={2}>
        {/* Posts */}
        <line
          x1={goalTop.sx} y1={goalTop.sy}
          x2={FP_VPX + (goalTop.sx - FP_VPX) * 0.85}
          y2={goalTop.sy - 38 * goalTop.scale}
        />
        <line
          x1={goalBottom.sx} y1={goalBottom.sy}
          x2={FP_VPX + (goalBottom.sx - FP_VPX) * 0.85}
          y2={goalBottom.sy - 38 * goalBottom.scale}
        />
        {/* Crossbar */}
        <line
          x1={FP_VPX + (goalTop.sx - FP_VPX) * 0.85}
          y1={goalTop.sy - 38 * goalTop.scale}
          x2={FP_VPX + (goalBottom.sx - FP_VPX) * 0.85}
          y2={goalBottom.sy - 38 * goalBottom.scale}
        />
      </g>

      {/* Players (sorted by depth, far first) */}
      {allCards.map(({ p, isHome }) => (
        <FPCard
          key={p.playerId}
          p={p}
          isHome={isHome}
          isOnBall={p.playerId === onBallId}
          onClick={onPlayerClick}
        />
      ))}

      {/* Ball */}
      <FPBall bx={ballX} by={ballY} />
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
  aerial: 'DRONE',
  broadcast: 'TV',
  firstperson: '1ª PESSOA',
};

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
              {(Object.keys(CAMERA_LABELS) as FieldCameraMode[]).map((mode) => (
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
          aspectRatio: `${VW}/${VH}`,
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
