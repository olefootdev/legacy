/**
 * FieldView — campo ao vivo Legacy Tech Design System.
 *
 * Design: preto absoluto + neon-yellow (#FDE100), Oswald uppercase, Playfair itálico.
 * Campo: listras de grama escuras, marcações mínimas (sem detalhes), nada de verde brilhante.
 * Jogadores: cards posicionados no campo (não sprites).
 * Câmeras: aerial (visão tática inclinada) | broadcast (ângulo TV).
 * Destaque: zoom-in no jogador ativo via prop `highlightPlayerId` —
 * mesmo modo aerial, só com escala + tradução suave pra dar imersão.
 */
import { memo, useMemo } from 'react';
import type { JSX } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import { computePitchTokenSeparation } from '@/engine/test2d/antiChaosEngine';
import { sfRoleFromSlot, sfGetAnchor } from '@/smartfield/smartfieldBridge';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { LegacyMatchHUD } from './LegacyMatchHUD';

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
  transition?: boolean;
}

const PlayerCard = memo(function PlayerCard({ p, isHome, isOnBall, onClick, transition = false }: PlayerCardProps) {
  const sx = toSvgX(p.x) - CARD_W / 2;
  const sy = toSvgY(p.y) - CARD_H / 2;
  const borderColor = isHome ? NEON : '#ffffff';
  const textColor = isHome ? NEON : '#ffffff';
  const glowRadius = isOnBall ? 14 : 0;
  const fatigue = Math.max(0, Math.min(100, p.fatigue ?? 0));
  const energy = 100 - fatigue;
  const isPulsing = (p as any)._pulsing === true;

  return (
    <g
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transform: `translate(${sx}px,${sy}px)`,
        transition: transition ? 'transform 1.2s cubic-bezier(0.4,0,0.2,1)' : undefined,
      }}
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

      {/* Pulse ring — receptor do passe prestes a receber a bola */}
      {isPulsing && (
        <circle
          cx={CARD_W / 2}
          cy={CARD_H / 2}
          r={CARD_W * 0.85}
          fill="none"
          stroke={borderColor}
          strokeWidth={2.5}
          opacity={0.85}
          style={{ animation: 'expertPulse 0.5s ease-out forwards' }}
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

// ── Inclined player card (tactical perspective) ────────────────────────────
interface IVCardProps {
  p: PitchPlayerState;
  isHome: boolean;
  isOnBall: boolean;
  onClick?: (p: PitchPlayerState) => void;
  /** Cinematic shrink for our keeper during opposing attack (real-life proportions). */
  shrink?: number;
}

const IV_CARD_W = 70;
const IV_CARD_H = 86;

const InclinedCard = memo(function InclinedCard({ p, isHome, isOnBall, onClick, shrink = 1 }: IVCardProps) {
  const { sx, sy, scale: baseScale } = ivProject(p.x, p.y);
  const scale = baseScale * shrink;
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

// ── Aerial ball (horizontal field) — smooth CSS transition ─────────────────
function AerialBall({ bx, by }: { bx: number; by: number }) {
  const sx = toSvgX(bx);
  const sy = toSvgY(by);
  const r = 10;
  return (
    <g style={{ transform: `translate(${sx}px,${sy}px)`, transition: 'transform 0.18s linear' }}>
      <ellipse cx={0} cy={r * 0.4} rx={r * 0.9} ry={r * 0.28} fill="#000" opacity={0.45} />
      <circle cx={0} cy={0} r={r * 1.8} fill="none" stroke={NEON} strokeWidth={1.5} opacity={0.22} />
      <circle cx={0} cy={0} r={r} fill="#ffffff" />
      <circle cx={0} cy={0} r={r * 0.52} fill={NEON} />
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
  defensiveAction = false,
  cropDeadZones = false,
  anchorBottom = false,
}: {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallId: string | null;
  onPlayerClick?: (p: PitchPlayerState) => void;
  defensiveAction?: boolean;
  cropDeadZones?: boolean;
  anchorBottom?: boolean;
}) {
  // Defensive cinematic mode: shrink home GK and enlarge near goal so the
  // proportions match real life (keeper ≈ 1.9m vs goal ≈ 2.44m tall).
  const gkShrink = defensiveAction ? 0.55 : 1;
  // FASE 3.5: anti-chaos visual — offsets per-token pra evitar sobreposição
  // sem alterar posições da simulação (aditivo, cosmético only).
  // Restrições por role: GK ancorado (maxOffset 0.6%), DEF limitado (1.8%), MID/ATK livre (3.2%).
  const allCards = useMemo(() => {
    const allPlayers = [
      ...homePlayers.map((p) => ({ p, isHome: true })),
      ...awayPlayers.map((p) => ({ p, isHome: false })),
    ];

    // Separação base para todos (evita sobreposição visual)
    // anchor SmartField por jogador direciona a repulsão de volta à posição tática
    const allAgents = allPlayers.map(({ p, isHome }) => {
      const side = isHome ? 'home' : 'away';
      const sfRole = sfRoleFromSlot(p.slotId);
      const sfAnchor = sfGetAnchor(sfRole, side);
      const anchor = sfAnchor
        ? { x: (sfAnchor.base_anchor.x / FIELD_LENGTH) * 100, y: (sfAnchor.base_anchor.z / FIELD_WIDTH) * 100 }
        : undefined;
      return { id: p.playerId, x: p.x, y: p.y, anchor };
    });
    const offsets = computePitchTokenSeparation(allAgents, {
      ball: { x: ballX, y: ballY },
      minSeparation: 2.4,
      iterations: 6,
      maxOffset: 3.2,
      minFromBall: 1.6,
    });

    const applyOffset = (p: PitchPlayerState): PitchPlayerState => {
      const o = offsets.get(p.playerId);
      if (!o) return p;

      // Restrição por role: GK quase imóvel, DEF pouco, MID/ATK livre
      const role = p.role ?? 'mid';
      const maxByRole =
        role === 'gk'     ? 0.6   // ~18% — quase fixo
        : role === 'def'  ? 0.8   // ~25% — linha defensiva firme
        : role === 'mid'  ? 0.8   // ~25% — bloco médio compacto
        :                   0.8;  // ~25% — atacantes disciplinados

      const len = Math.hypot(o.dx, o.dy);
      const scale = len > maxByRole && len > 1e-9 ? maxByRole / len : 1;
      return { ...p, x: p.x + o.dx * scale, y: p.y + o.dy * scale };
    };

    return allPlayers
      .map(({ p, isHome }) => ({ p: applyOffset(p), isHome }))
      .sort((a, b) => b.p.x - a.p.x);
  }, [homePlayers, awayPlayers, ballX, ballY]);

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

  // Far goal posts (real width 7.32m → ±5.38% of fieldY around 50)
  const farGoalL = ivProject(100, goalYL);
  const farGoalR = ivProject(100, goalYR);
  const farGoalPostHeight =
    (farGoalR.sx - farGoalL.sx) * GOAL_ASPECT * 1.0; // proper aspect

  // Defensive mode: zoom the entire near-end region outward from the goal-line
  // center so the goal, six-yard and penalty boxes all grow together — like the
  // camera moved closer instead of just the goal getting bigger.
  // Limited to ~1.5 so the penalty box stays within the SVG viewBox; the
  // remaining magnification comes from the outer CSS highlight zoom.
  const nearScaleX = defensiveAction ? 1.5 : 1;
  const nearScaleY = defensiveAction ? 1.35 : 1;
  const nearAnchorY = IV_BOTTOM_Y;
  const nearAnchorRaw = ivProject(0, 50);
  const nearAnchorX = nearAnchorRaw.sx;
  const expandNear = (p: { sx: number; sy: number }) => ({
    sx: nearAnchorX + (p.sx - nearAnchorX) * nearScaleX,
    sy: nearAnchorY + (p.sy - nearAnchorY) * nearScaleY,
  });

  // Near penalty box (expanded in defensive mode)
  const nearBoxFL = expandNear(ivProject(nearBoxX, boxYL));
  const nearBoxFR = expandNear(ivProject(nearBoxX, boxYR));
  const nearBoxNL = expandNear(ivProject(0, boxYL));
  const nearBoxNR = expandNear(ivProject(0, boxYR));
  // Near six-yard
  const nearSixFL = expandNear(ivProject(PCT_SIX_DEPTH, sixYL));
  const nearSixFR = expandNear(ivProject(PCT_SIX_DEPTH, sixYR));
  const nearSixNL = expandNear(ivProject(0, sixYL));
  const nearSixNR = expandNear(ivProject(0, sixYR));

  // Near goal posts (aspect-locked rectangle, expanded with the rest)
  const nearGoalL = expandNear(ivProject(0, goalYL));
  const nearGoalR = expandNear(ivProject(0, goalYR));
  const nearGoalPostHeight =
    (nearGoalR.sx - nearGoalL.sx) * GOAL_ASPECT;

  return (
    <svg
      viewBox={cropDeadZones
        ? `0 ${IV_TOP_Y - 20} ${IV_VW} ${IV_BOTTOM_Y - IV_TOP_Y + 40}`
        : `0 0 ${IV_VW} ${IV_VH}`}
      preserveAspectRatio={anchorBottom ? 'xMidYMax meet' : 'xMidYMid meet'}
      className="w-full h-full"
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
        <circle cx={expandNear(ivProject(PCT_PEN_SPOT, 50)).sx} cy={expandNear(ivProject(PCT_PEN_SPOT, 50)).sy} r={3.5 * (defensiveAction ? nearScaleX : 1)} fill={LINE_COLOR} stroke="none" />
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
          shrink={isHome && p.role === 'gk' ? gkShrink : 1}
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
  playerTransition = false,
  passLine = null,
}: {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallId: string | null;
  onPlayerClick?: (p: PitchPlayerState) => void;
  playerTransition?: boolean;
  passLine?: { fromX: number; fromY: number; toX: number; toY: number } | null;
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
          transition={playerTransition}
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
          transition={playerTransition}
        />
      ))}

      {/* Pass line — dotted line between passer and receiver during ball flight */}
      {passLine && (
        <line
          x1={toSvgX(passLine.fromX)}
          y1={toSvgY(passLine.fromY)}
          x2={toSvgX(passLine.toX)}
          y2={toSvgY(passLine.toY)}
          stroke={NEON}
          strokeWidth={1.2}
          strokeDasharray="4 5"
          opacity={0.45}
          strokeLinecap="round"
        />
      )}

      {/* Ball */}
      <AerialBall bx={ballX} by={ballY} />
    </svg>
  );
}

// ── Camera mode labels ───────────────────────────────────────────────────────
const CAMERA_LABELS: Record<FieldCameraMode, string> = {
  aerial: 'TÁTICA',
  broadcast: 'TV',
  firstperson: 'CINEMA',
};
const SWITCHER_MODES: FieldCameraMode[] = ['aerial', 'firstperson', 'broadcast'];

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
  homeName?: string;
  awayName?: string;
  homeCrestUrl?: string | null;
  awayClub?: { name: string; logo: string } | null;
  onAwayClubChange?: (club: { name: string; logo: string }) => void;
  homeScore?: number;
  awayScore?: number;
  matchMinute?: number;
  possession?: 'home' | 'away';
  phase?: 'playing' | 'halftime' | 'fulltime';
  /** Show camera mode switcher UI. */
  showCameraSwitch?: boolean;
  /** Hide the built-in LegacyMatchHUD scoreboard (Legacy Mode uses external header). */
  hideHud?: boolean;
  onCameraChange?: (mode: FieldCameraMode) => void;
  onPlayerClick?: (p: PitchPlayerState) => void;
  /**
   * When set, zooms in on this player during aerial mode (highlight effect).
   * Set to null/undefined to return to the wide tactical view.
   */
  highlightPlayerId?: string | null;
  /**
   * Cinematic mode for opposing-team attack on our goal: shrinks our keeper
   * and enlarges the near goal so the proportions feel real.
   */
  defensiveAction?: boolean;
  /**
   * When true, player cards animate smoothly to their positions (CSS transition).
   * Used in Legacy Mode when players move from kickoff to formation positions.
   */
  playerTransition?: boolean;
  /**
   * Pass line: dotted line between passer and receiver during ball flight.
   * Coordinates in field percent (0-100).
   */
  passLine?: { fromX: number; fromY: number; toX: number; toY: number } | null;
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
  homeName,
  awayName,
  homeCrestUrl,
  awayClub,
  onAwayClubChange,
  homeScore = 0,
  awayScore = 0,
  matchMinute,
  possession = 'home',
  phase = 'playing',
  showCameraSwitch = true,
  hideHud = false,
  onCameraChange,
  onPlayerClick,
  highlightPlayerId = null,
  defensiveAction = false,
  playerTransition = false,
  passLine = null,
  className = '',
}: FieldViewProps) {
  const broadcastStyle =
    cameraMode === 'broadcast'
      ? {
          transform: 'perspective(900px) rotateX(22deg) translateY(-4%) scale(1.06)',
          transformOrigin: '50% 45%',
        }
      : undefined;

  const aspectRatio =
    cameraMode === 'broadcast'
      ? `${VW}/${VH}`
      : `${IV_VW}/${IV_VH}`;

  // ── Highlight zoom: scale + translate to keep active player centred ──
  // Resolves the active player's screen position in the inclined viewBox,
  // then applies CSS transform so the same SVG zooms in. Smooth via transition.
  const highlight = useMemo(() => {
    if (!highlightPlayerId || cameraMode !== 'aerial') return null;
    const all = [...homePlayers, ...awayPlayers];
    const p = all.find((pp) => pp.playerId === highlightPlayerId);
    if (!p) return null;
    // Project player to inclined SVG coords
    const t = Math.pow(Math.max(0, Math.min(1, p.x / 100)), 0.78);
    const sy = IV_BOTTOM_Y - t * (IV_BOTTOM_Y - IV_TOP_Y);
    const halfW = IV_BOTTOM_HALF_W + t * (IV_TOP_HALF_W - IV_BOTTOM_HALF_W);
    const sx = IV_CX + ((p.y - 50) / 50) * halfW;
    // Convert to viewBox % — used as transform-origin for scale
    const ox = (sx / IV_VW) * 100;
    const oy = (sy / IV_VH) * 100;
    return { ox, oy };
  }, [highlightPlayerId, cameraMode, homePlayers, awayPlayers]);

  const zoomActive = highlight != null;
  const fieldTransform = zoomActive
    ? `scale(2.4) translate(${(50 - highlight!.ox) * 0.42}%, ${(50 - highlight!.oy) * 0.42}%)`
    : 'none';

  return (
    <div
      className={`relative flex flex-col bg-[#050505] select-none overflow-hidden h-full max-h-full min-h-0 ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* ── Scoreboard header ── */}
      {!hideHud && <LegacyMatchHUD
        homeShort={homeShort}
        awayShort={awayShort}
        homeName={homeName}
        awayName={awayName}
        homeCrestUrl={homeCrestUrl}
        awayClub={awayClub}
        onAwayClubChange={onAwayClubChange}
        homeScore={homeScore}
        awayScore={awayScore}
        matchMinute={matchMinute ?? 0}
        possession={possession}
        ballX={ballX}
        phase={phase}
        cameraMode={cameraMode}
        onCameraChange={showCameraSwitch ? onCameraChange : undefined}
      />}

      {/* ── Field area — aspect-locked, fit pelo menor lado do container.
           Container externo: flex centraliza vertical+horizontal e clipa overflow.
           Inner aspect-locked: width 100% + height auto + maxHeight 100% — quando
           altura derivada > parent, browser reduz mantendo aspect. Resultado:
           campo SEMPRE inteiro visível, sem zoom artificial. ── */}
      <div className={`flex-1 min-h-0 min-w-0 flex ${hideHud ? 'items-stretch' : 'items-center'} justify-center overflow-hidden`}>
      <div
        className="relative overflow-hidden"
        style={{
          ...(hideHud
            ? { width: '100%', height: '100%' }
            : { aspectRatio, width: '100%', height: 'auto', maxHeight: '100%' }),
          background: 'radial-gradient(ellipse 80% 50% at 50% 40%, #131e14 0%, #090d09 55%, #050805 100%)',
          ...broadcastStyle,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: fieldTransform,
            transformOrigin: zoomActive ? `${highlight!.ox}% ${highlight!.oy}%` : '50% 50%',
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
          }}
        >
        {cameraMode === 'firstperson' || cameraMode === 'aerial' ? (
          <InclinedField
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ballX={ballX}
            ballY={ballY}
            onBallId={onBallPlayerId}
            onPlayerClick={onPlayerClick}
            defensiveAction={defensiveAction}
            cropDeadZones={hideHud}
            anchorBottom={hideHud}
          />
        ) : (
          <AerialField
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ballX={ballX}
            ballY={ballY}
            onBallId={onBallPlayerId}
            onPlayerClick={onPlayerClick}
            playerTransition={playerTransition}
            passLine={passLine}
          />
        )}
        </div>

        {/* Vignette during zoom highlight */}
        {zoomActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)',
              mixBlendMode: 'multiply',
              opacity: 1,
              transition: 'opacity 700ms ease',
            }}
          />
        )}
      </div>
      </div>

      {/* ── Camera mode label (bottom-right watermark) ── */}
      {!hideHud && (
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
      )}
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
