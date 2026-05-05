/**
 * Olé Field Lab — /dev/field-lab
 * Laboratório tático interno. Dois modos: AÉREA (horizontal) + LEGACY (first view vertical).
 *
 * Sistema de coordenadas canônico (ambos os modos):
 *   x: 0 (esquerda) → 100 (direita)   — largura do campo
 *   y: 0 (gol Home, baixo) → 100 (gol Away, cima) — profundidade
 *
 * No modo LEGACY (first view vertical):
 *   Home fica embaixo (y=0), Away fica em cima (y=100).
 *   A projeção perspectiva mapeia y→profundidade e x→largura.
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw, Info, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_ZONES, ZONE_SECTOR_COLOR, type FieldZone } from '@/match/fieldZones12';

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD VIEW CONFIG — fonte única de verdade para o campo tático
// ═══════════════════════════════════════════════════════════════════════════════
export const FIELD_VIEW_CONFIG = {
  svgWidth: 720,
  svgHeight: 1100,
  orientation: 'vertical-first-view' as const,
  homeSide: 'bottom' as const,
  awaySide: 'top' as const,
  coordinateSystem: {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    xDirection: 'left-to-right' as const,
    yDirection: 'home-bottom-to-away-top' as const,
  },
  tacticalSectors: {
    D:  { yMin: 0,  yMax: 25  },
    MD: { yMin: 25, yMax: 50  },
    MO: { yMin: 50, yMax: 75  },
    O:  { yMin: 75, yMax: 100 },
  },
  corridors: {
    E: { xMin: 0,     xMax: 33.33 },
    C: { xMin: 33.33, xMax: 66.66 },
    D: { xMin: 66.66, xMax: 100   },
  },
} as const;

// ── 12 zonas táticas geradas a partir do config ───────────────────────────────
// Zonas importadas do arquivo canônico — fonte única de verdade
const TACTICAL_ZONES_12 = FIELD_ZONES;
type TacticalZone = FieldZone & { color: string };
function zoneColor(z: FieldZone): string { return ZONE_SECTOR_COLOR[z.sector]; }

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES SVG — MODO AÉREA (idênticas ao FieldView.tsx)
// ═══════════════════════════════════════════════════════════════════════════════
const VW = 1136;
const VH = 674;
const FL = 84;
const FT = 27;
const FW = 968;
const FH = 620;
const FCX = FL + FW / 2;
const FCY = FT + FH / 2;
const GOAL_D = 28;
const GOAL_H = Math.round((7.32 / 68) * FH);
const PEN_X_PCT = 11 / 105;
const BOX_W = Math.round((16.5 / 105) * FW);
const BOX_H = Math.round((40.3 / 68) * FH);
const BOX_T = FCY - BOX_H / 2;
const CC_R = Math.round((9.15 / 52.5) * (FW / 2));
const SIX_W = Math.round((5.5 / 105) * FW);
const SIX_H = Math.round((18.32 / 68) * FH);

// No modo aérea: x=profundidade (home→away = esquerda→direita), y=largura
// Para manter compatibilidade com o motor, mantemos toSvgX/Y do FieldView
function toSvgX(pct: number) { return FL + (pct / 100) * FW; }
function toSvgY(pct: number) { return FT + (pct / 100) * FH; }

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES SVG — MODO LEGACY FIRST VIEW (idênticas ao FieldView.tsx)
// ═══════════════════════════════════════════════════════════════════════════════
const IV_VW = FIELD_VIEW_CONFIG.svgWidth;   // 720
const IV_VH = FIELD_VIEW_CONFIG.svgHeight;  // 1100
const IV_CX = IV_VW / 2;                   // 360
const IV_TOP_Y = 110;     // gol Away (y=100, longe)
const IV_BOTTOM_Y = 990;  // gol Home (y=0, perto)
const IV_TOP_HALF_W = 290;
const IV_BOTTOM_HALF_W = 430;

// Medidas reais em % do campo (para marcações)
const PCT_BOX_DEPTH  = (16.5  / 105) * 100;
const PCT_BOX_HALF_X = (40.3  / 68)  * 50;
const PCT_SIX_DEPTH  = (5.5   / 105) * 100;
const PCT_SIX_HALF_X = (18.32 / 68)  * 50;
const PCT_GOAL_HALF_X = (7.32 / 68)  * 50;
const PCT_PEN_SPOT   = (11    / 105) * 100;
const GOAL_ASPECT    = 2.44 / 7.32;

function ivWidthAtDepth(t: number): number {
  return IV_BOTTOM_HALF_W + t * (IV_TOP_HALF_W - IV_BOTTOM_HALF_W);
}

/**
 * Projeta coordenadas canônicas (x: largura 0-100, y: profundidade 0-100)
 * para o SVG inclinado do Legacy First View.
 *
 * y=0  → Home (baixo, perto da câmera)  → IV_BOTTOM_Y
 * y=100 → Away (cima, longe da câmera) → IV_TOP_Y
 * x=0  → esquerda
 * x=100 → direita
 */
function fvProject(fieldX: number, fieldY: number) {
  // t: 0=perto(home/baixo), 1=longe(away/cima)
  const t = Math.max(0, Math.min(1, fieldY / 100));
  const tEased = Math.pow(t, 0.78); // foreshortening não-linear
  const sy = IV_BOTTOM_Y - tEased * (IV_BOTTOM_Y - IV_TOP_Y);
  const halfW = ivWidthAtDepth(tEased);
  const lat = (fieldX - 50) / 50; // -1..+1 (esquerda..direita)
  const sx = IV_CX + lat * halfW;
  const scale = 1.05 - tEased * 0.55;
  return { sx, sy, scale, depth: tEased };
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NEON = '#FDE100';
const LINE_COLOR = 'rgba(255,255,255,0.13)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG DO PAINEL
// ═══════════════════════════════════════════════════════════════════════════════
export interface FieldLabConfig {
  viewMode: 'aerial' | 'inclined';
  showGrid: boolean;
  showZones: boolean;
  showCoords: boolean;
  showGoals: boolean;
  showCorners: boolean;
  showPenaltyArcs: boolean;
  showZoneLabels: boolean;
  gridOpacity: number;
  zoneOpacity: number;
}

export const DEFAULT_FIELD_LAB_CONFIG: FieldLabConfig = {
  viewMode: 'aerial',
  showGrid: false,
  showZones: false,
  showCoords: false,
  showGoals: true,
  showCorners: true,
  showPenaltyArcs: true,
  showZoneLabels: false,
  gridOpacity: 0.18,
  zoneOpacity: 0.13,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODO AÉREA — componentes
// ═══════════════════════════════════════════════════════════════════════════════

function AerialGrassStripes() {
  const stripeW = FW / 14;
  return (
    <>
      {Array.from({ length: 14 }, (_, i) =>
        i % 2 === 1 ? null : (
          <rect key={i} x={FL + i * stripeW} y={FT} width={stripeW} height={FH} fill={GRASS_B} />
        )
      )}
    </>
  );
}

// No modo aérea o campo é horizontal: home ataca →direita (x=profundidade no motor)
// As 12 zonas são mapeadas: zoneY → eixo X do SVG aérea, zoneX → eixo Y do SVG aérea
function AerialZones({ cfg }: { cfg: FieldLabConfig }) {
  if (!cfg.showZones) return null;
  return (
    <>
      {TACTICAL_ZONES_12.map((z) => {
        // No aérea: profundidade (y da zona) → eixo X do SVG; largura (x da zona) → eixo Y
        const svgX = toSvgX(z.bounds.yMin);
        const svgY = toSvgY(z.bounds.xMin);
        const svgW = (z.bounds.yMax - z.bounds.yMin) / 100 * FW;
        const svgH = (z.bounds.xMax - z.bounds.xMin) / 100 * FH;
        return (
          <g key={z.id}>
            <rect x={svgX} y={svgY} width={svgW} height={svgH}
              fill={zoneColor(z)} opacity={cfg.zoneOpacity}
              stroke={zoneColor(z)} strokeWidth={0.5} strokeOpacity={0.4} />
            {cfg.showZoneLabels && (
              <text x={svgX + svgW / 2} y={svgY + svgH / 2}
                textAnchor="middle" dominantBaseline="middle"
                fill={zoneColor(z)} fontSize={9}
                fontFamily="'Oswald', sans-serif" fontWeight={700}
                letterSpacing={1.5} opacity={0.75}>
                {z.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

function AerialGrid({ cfg }: { cfg: FieldLabConfig }) {
  if (!cfg.showGrid && !cfg.showCoords) return null;
  const steps = 10;
  return (
    <>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const pct = i * 10;
        const x = toSvgX(pct);
        const y = toSvgY(pct);
        return (
          <g key={i}>
            {cfg.showGrid && (
              <>
                <line x1={x} y1={FT} x2={x} y2={FT + FH}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="2 4" />
                <line x1={FL} y1={y} x2={FL + FW} y2={y}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="2 4" />
              </>
            )}
            {cfg.showCoords && i < steps && (
              <>
                <text x={x + (FW / steps) / 2} y={FT - 8}
                  textAnchor="middle" fill={NEON} fontSize={8} fontFamily="monospace" opacity={0.7}>
                  y={pct}
                </text>
                <text x={FL - 6} y={y + (FH / steps) / 2}
                  textAnchor="end" dominantBaseline="middle"
                  fill={NEON} fontSize={8} fontFamily="monospace" opacity={0.7}>
                  x={pct}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function AerialMarkings({ cfg }: { cfg: FieldLabConfig }) {
  const lw = 1.5;
  const lc = LINE_COLOR;
  return (
    <g stroke={lc} fill="none" strokeWidth={lw}>
      <rect x={FL} y={FT} width={FW} height={FH} />
      <line x1={FCX} y1={FT} x2={FCX} y2={FT + FH} />
      <circle cx={FCX} cy={FCY} r={CC_R} />
      <circle cx={FCX} cy={FCY} r={4} fill={lc} stroke="none" />
      <rect x={FL} y={BOX_T} width={BOX_W} height={BOX_H} />
      <rect x={FL} y={FCY - SIX_H / 2} width={SIX_W} height={SIX_H} />
      <rect x={FL + FW - BOX_W} y={BOX_T} width={BOX_W} height={BOX_H} />
      <rect x={FL + FW - SIX_W} y={FCY - SIX_H / 2} width={SIX_W} height={SIX_H} />
      <circle cx={FL + PEN_X_PCT * FW} cy={FCY} r={3} fill={lc} stroke="none" />
      <circle cx={FL + (1 - PEN_X_PCT) * FW} cy={FCY} r={3} fill={lc} stroke="none" />
      {cfg.showGoals && (
        <>
          <rect x={FL - GOAL_D} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H}
            stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
          <rect x={FL + FW} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H}
            stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
        </>
      )}
      {cfg.showCorners && (
        <>
          <path d={`M ${FL} ${FT + 10} A 10 10 0 0 1 ${FL + 10} ${FT}`} />
          <path d={`M ${FL + FW - 10} ${FT} A 10 10 0 0 1 ${FL + FW} ${FT + 10}`} />
          <path d={`M ${FL} ${FT + FH - 10} A 10 10 0 0 0 ${FL + 10} ${FT + FH}`} />
          <path d={`M ${FL + FW - 10} ${FT + FH} A 10 10 0 0 0 ${FL + FW} ${FT + FH - 10}`} />
        </>
      )}
      {cfg.showPenaltyArcs && (
        <>
          <clipPath id="arc-clip-l">
            <rect x={FL + BOX_W} y={FT} width={FW} height={FH} />
          </clipPath>
          <clipPath id="arc-clip-r">
            <rect x={FL} y={FT} width={FW - BOX_W} height={FH} />
          </clipPath>
          <circle cx={FL + PEN_X_PCT * FW} cy={FCY} r={CC_R} clipPath="url(#arc-clip-l)" />
          <circle cx={FL + (1 - PEN_X_PCT) * FW} cy={FCY} r={CC_R} clipPath="url(#arc-clip-r)" />
        </>
      )}
    </g>
  );
}

function AerialField({ cfg }: { cfg: FieldLabConfig }) {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="lab-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
        {[{ cx: 0, cy: 0 }, { cx: VW, cy: 0 }, { cx: 0, cy: VH }, { cx: VW, cy: VH }].map((pt, i) => (
          <radialGradient key={i} id={`lab-corner-${i}`}
            cx={`${(pt.cx / VW) * 100}%`} cy={`${(pt.cy / VH) * 100}%`} r="25%">
            <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.06" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        ))}
      </defs>
      <rect x={0} y={0} width={VW} height={VH} fill="#080b08" />
      <rect x={0} y={0} width={VW} height={FT} fill="#0a0a0a" />
      <rect x={0} y={FT + FH} width={VW} height={VH - FT - FH} fill="#0a0a0a" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={0} y={0} width={VW} height={VH} fill={`url(#lab-corner-${i})`} />
      ))}
      <rect x={FL} y={FT} width={FW} height={FH} fill={GRASS_A} />
      <AerialGrassStripes />
      <rect x={FL} y={FT} width={FW} height={FH} fill="url(#lab-vignette)" />
      <AerialZones cfg={cfg} />
      <AerialGrid cfg={cfg} />
      <AerialMarkings cfg={cfg} />
      <text x={FL + 8} y={FT + FH + 18} fill={NEON} fontSize={9}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={2} opacity={0.5}>
        HOME (y=0) →
      </text>
      <text x={FL + FW - 8} y={FT + FH + 18} textAnchor="end"
        fill="rgba(255,255,255,0.4)" fontSize={9}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={2}>
        ← AWAY (y=100)
      </text>
      <text x={FL + 3} y={FT + 12} fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="monospace">(x=0,y=0)</text>
      <text x={FL + FW - 3} y={FT + 12} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="monospace">(x=100,y=0)</text>
      <text x={FL + 3} y={FT + FH - 4} fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="monospace">(x=0,y=100)</text>
      <text x={FL + FW - 3} y={FT + FH - 4} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="monospace">(x=100,y=100)</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODO LEGACY FIRST VIEW — componentes
// Usa fvProject(x, y): x=largura 0-100, y=profundidade 0-100 (home=0, away=100)
// ═══════════════════════════════════════════════════════════════════════════════

// 12 zonas projetadas na perspectiva inclinada
function FVZones({ cfg }: { cfg: FieldLabConfig }) {
  if (!cfg.showZones) return null;
  return (
    <>
      {TACTICAL_ZONES_12.map((z) => {
        // 4 cantos da zona em coordenadas canônicas → projetados
        const tl = fvProject(z.bounds.xMin, z.bounds.yMax); // topo-esquerda  (y alto = longe = cima)
        const tr = fvProject(z.bounds.xMax, z.bounds.yMax); // topo-direita
        const br = fvProject(z.bounds.xMax, z.bounds.yMin); // baixo-direita  (y baixo = perto = baixo)
        const bl = fvProject(z.bounds.xMin, z.bounds.yMin); // baixo-esquerda
        const cx = fvProject((z.bounds.xMin + z.bounds.xMax) / 2, (z.bounds.yMin + z.bounds.yMax) / 2);
        const points = `${tl.sx},${tl.sy} ${tr.sx},${tr.sy} ${br.sx},${br.sy} ${bl.sx},${bl.sy}`;
        return (
          <g key={z.id}>
            <polygon points={points}
              fill={zoneColor(z)} opacity={cfg.zoneOpacity}
              stroke={zoneColor(z)} strokeWidth={0.8} strokeOpacity={0.5} />
            {cfg.showZoneLabels && (
              <text x={cx.sx} y={cx.sy}
                textAnchor="middle" dominantBaseline="middle"
                fill={zoneColor(z)} fontSize={10 * cx.scale}
                fontFamily="'Oswald', sans-serif" fontWeight={700}
                letterSpacing={1.5} opacity={0.85}>
                {z.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// Grid métrico projetado (linhas de profundidade + laterais)
function FVGrid({ cfg }: { cfg: FieldLabConfig }) {
  if (!cfg.showGrid && !cfg.showCoords) return null;
  const steps = 10;
  return (
    <>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const pct = i * 10;
        // Linhas de largura (x fixo, y varia 0→100) — linhas laterais
        const xLineTop    = fvProject(pct, 100);
        const xLineBottom = fvProject(pct, 0);
        // Linhas de profundidade (y fixo, x varia 0→100) — linhas horizontais
        const yLineLeft  = fvProject(0,   pct);
        const yLineRight = fvProject(100, pct);
        const labelPos   = fvProject(50,  pct);
        return (
          <g key={i}>
            {cfg.showGrid && (
              <>
                <line x1={xLineTop.sx} y1={xLineTop.sy} x2={xLineBottom.sx} y2={xLineBottom.sy}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} strokeDasharray="3 5" />
                <line x1={yLineLeft.sx} y1={yLineLeft.sy} x2={yLineRight.sx} y2={yLineRight.sy}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} strokeDasharray="3 5" />
              </>
            )}
            {cfg.showCoords && i <= steps && (
              <text x={labelPos.sx + 6} y={labelPos.sy}
                dominantBaseline="middle"
                fill={NEON} fontSize={7} fontFamily="monospace" opacity={0.55}>
                y={pct}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// Campo Legacy First View completo
function FVField({ cfg }: { cfg: FieldLabConfig }) {
  const lc = LINE_COLOR;
  const lw = 1.5;

  // Trapézio do campo
  const tlx = IV_CX - IV_TOP_HALF_W;
  const trx = IV_CX + IV_TOP_HALF_W;
  const brx = IV_CX + IV_BOTTOM_HALF_W;
  const blx = IV_CX - IV_BOTTOM_HALF_W;

  // Linha de meio-campo (y=50)
  const midL = fvProject(0,   50);
  const midR = fvProject(100, 50);

  // Círculo central
  const centerPt = fvProject(50, 50);
  const ccHalfW  = ivWidthAtDepth(centerPt.depth) * 0.18;

  // Grandes áreas
  const nearBoxDepth = PCT_BOX_DEPTH;   // y=0..nearBoxDepth (home)
  const farBoxDepth  = 100 - PCT_BOX_DEPTH; // y=farBoxDepth..100 (away)

  const nearBoxBL = fvProject(50 - PCT_BOX_HALF_X, 0);
  const nearBoxBR = fvProject(50 + PCT_BOX_HALF_X, 0);
  const nearBoxTL = fvProject(50 - PCT_BOX_HALF_X, nearBoxDepth);
  const nearBoxTR = fvProject(50 + PCT_BOX_HALF_X, nearBoxDepth);

  const farBoxTL = fvProject(50 - PCT_BOX_HALF_X, 100);
  const farBoxTR = fvProject(50 + PCT_BOX_HALF_X, 100);
  const farBoxBL = fvProject(50 - PCT_BOX_HALF_X, farBoxDepth);
  const farBoxBR = fvProject(50 + PCT_BOX_HALF_X, farBoxDepth);

  // Pequenas áreas
  const nearSixBL = fvProject(50 - PCT_SIX_HALF_X, 0);
  const nearSixBR = fvProject(50 + PCT_SIX_HALF_X, 0);
  const nearSixTL = fvProject(50 - PCT_SIX_HALF_X, PCT_SIX_DEPTH);
  const nearSixTR = fvProject(50 + PCT_SIX_HALF_X, PCT_SIX_DEPTH);

  const farSixTL = fvProject(50 - PCT_SIX_HALF_X, 100);
  const farSixTR = fvProject(50 + PCT_SIX_HALF_X, 100);
  const farSixBL = fvProject(50 - PCT_SIX_HALF_X, 100 - PCT_SIX_DEPTH);
  const farSixBR = fvProject(50 + PCT_SIX_HALF_X, 100 - PCT_SIX_DEPTH);

  // Gols
  const nearGoalL = fvProject(50 - PCT_GOAL_HALF_X, 0);
  const nearGoalR = fvProject(50 + PCT_GOAL_HALF_X, 0);
  const nearGoalH = (nearGoalR.sx - nearGoalL.sx) * GOAL_ASPECT;

  const farGoalL = fvProject(50 - PCT_GOAL_HALF_X, 100);
  const farGoalR = fvProject(50 + PCT_GOAL_HALF_X, 100);
  const farGoalH = (farGoalR.sx - farGoalL.sx) * GOAL_ASPECT;

  // Marcas de pênalti
  const nearPen = fvProject(50, PCT_PEN_SPOT);
  const farPen  = fvProject(50, 100 - PCT_PEN_SPOT);

  // Escanteios
  const corners = [
    fvProject(0,   0),   // home-esquerda
    fvProject(100, 0),   // home-direita
    fvProject(0,   100), // away-esquerda
    fvProject(100, 100), // away-direita
  ];

  return (
    <svg
      viewBox={`0 0 ${IV_VW} ${IV_VH}`}
      className="w-full h-full"
      style={{ display: 'block' }}
      aria-label="Campo Legacy First View — Olé Field Lab"
    >
      <defs>
        <linearGradient id="fv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050505" />
          <stop offset="50%" stopColor="#080a08" />
          <stop offset="100%" stopColor="#0a0d0a" />
        </linearGradient>
        <radialGradient id="fv-spot" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#1a2a1c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Fundo */}
      <rect x={0} y={0} width={IV_VW} height={IV_VH} fill="url(#fv-bg)" />

      {/* Gramado trapezoidal */}
      <polygon
        points={`${tlx},${IV_TOP_Y} ${trx},${IV_TOP_Y} ${brx},${IV_BOTTOM_Y} ${blx},${IV_BOTTOM_Y}`}
        fill={GRASS_A}
      />

      {/* Listras de profundidade (y=0..100 em fatias de 10) */}
      {Array.from({ length: 10 }, (_, i) => {
        if (i % 2 === 0) return null;
        const y0 = i * 10;
        const y1 = (i + 1) * 10;
        const tl2 = fvProject(0,   y1);
        const tr2 = fvProject(100, y1);
        const br2 = fvProject(100, y0);
        const bl2 = fvProject(0,   y0);
        return (
          <polygon key={i}
            points={`${tl2.sx},${tl2.sy} ${tr2.sx},${tr2.sy} ${br2.sx},${br2.sy} ${bl2.sx},${bl2.sy}`}
            fill={GRASS_B} opacity={0.7} />
        );
      })}

      <rect x={0} y={0} width={IV_VW} height={IV_VH} fill="url(#fv-spot)" />

      {/* Zonas táticas (abaixo das linhas) */}
      <FVZones cfg={cfg} />

      {/* Grid */}
      <FVGrid cfg={cfg} />

      {/* Marcações do campo */}
      <g stroke={lc} fill="none" strokeWidth={lw}>
        {/* Perímetro trapezoidal */}
        <polygon points={`${tlx},${IV_TOP_Y} ${trx},${IV_TOP_Y} ${brx},${IV_BOTTOM_Y} ${blx},${IV_BOTTOM_Y}`} />

        {/* Linha de meio-campo */}
        <line x1={midL.sx} y1={midL.sy} x2={midR.sx} y2={midR.sy} />

        {/* Círculo central */}
        <ellipse cx={centerPt.sx} cy={centerPt.sy} rx={ccHalfW} ry={ccHalfW * 0.52} />
        <circle cx={centerPt.sx} cy={centerPt.sy} r={3} fill={lc} stroke="none" />

        {/* Grande área Home (baixo/perto) */}
        <polygon points={`${nearBoxTL.sx},${nearBoxTL.sy} ${nearBoxTR.sx},${nearBoxTR.sy} ${nearBoxBR.sx},${nearBoxBR.sy} ${nearBoxBL.sx},${nearBoxBL.sy}`} />
        {/* Pequena área Home */}
        <polygon points={`${nearSixTL.sx},${nearSixTL.sy} ${nearSixTR.sx},${nearSixTR.sy} ${nearSixBR.sx},${nearSixBR.sy} ${nearSixBL.sx},${nearSixBL.sy}`} opacity={0.7} />

        {/* Grande área Away (cima/longe) */}
        <polygon points={`${farBoxBL.sx},${farBoxBL.sy} ${farBoxBR.sx},${farBoxBR.sy} ${farBoxTR.sx},${farBoxTR.sy} ${farBoxTL.sx},${farBoxTL.sy}`} />
        {/* Pequena área Away */}
        <polygon points={`${farSixBL.sx},${farSixBL.sy} ${farSixBR.sx},${farSixBR.sy} ${farSixTR.sx},${farSixTR.sy} ${farSixTL.sx},${farSixTL.sy}`} opacity={0.7} />

        {/* Marcas de pênalti */}
        <circle cx={nearPen.sx} cy={nearPen.sy} r={3.5} fill={lc} stroke="none" />
        <circle cx={farPen.sx}  cy={farPen.sy}  r={2.5} fill={lc} stroke="none" />

        {/* Escanteios */}
        {cfg.showCorners && corners.map((c, i) => (
          <circle key={i} cx={c.sx} cy={c.sy} r={5 * c.scale}
            stroke={lc} strokeWidth={lw} fill="none" />
        ))}
      </g>

      {/* Arcos de pênalti */}
      {cfg.showPenaltyArcs && (() => {
        // Arco Home: centrado na marca de pênalti, recortado fora da grande área
        const arcR = ccHalfW; // mesmo raio do círculo central (perspectiva)
        return (
          <g stroke={lc} fill="none" strokeWidth={lw}>
            <clipPath id="fv-arc-near">
              <polygon points={`${nearBoxTL.sx},${nearBoxTL.sy} ${nearBoxTR.sx},${nearBoxTR.sy} ${IV_CX + IV_BOTTOM_HALF_W + 50},${IV_BOTTOM_Y + 50} ${IV_CX - IV_BOTTOM_HALF_W - 50},${IV_BOTTOM_Y + 50}`} />
            </clipPath>
            <clipPath id="fv-arc-far">
              <polygon points={`${farBoxBL.sx},${farBoxBL.sy} ${farBoxBR.sx},${farBoxBR.sy} ${IV_CX + IV_TOP_HALF_W + 50},${IV_TOP_Y - 50} ${IV_CX - IV_TOP_HALF_W - 50},${IV_TOP_Y - 50}`} />
            </clipPath>
            <ellipse cx={nearPen.sx} cy={nearPen.sy}
              rx={arcR} ry={arcR * 0.52}
              clipPath="url(#fv-arc-near)" />
            <ellipse cx={farPen.sx} cy={farPen.sy}
              rx={arcR * farPen.scale / nearPen.scale}
              ry={arcR * farPen.scale / nearPen.scale * 0.52}
              clipPath="url(#fv-arc-far)" />
          </g>
        );
      })()}

      {/* Gol Home (baixo/perto) */}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.85)" fill="none" strokeWidth={2.5}>
          <polygon
            points={`${nearGoalL.sx},${nearGoalL.sy} ${nearGoalR.sx},${nearGoalR.sy} ${nearGoalR.sx},${nearGoalR.sy - nearGoalH} ${nearGoalL.sx},${nearGoalL.sy - nearGoalH}`}
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <line x1={nearGoalL.sx} y1={nearGoalL.sy} x2={nearGoalL.sx} y2={nearGoalL.sy - nearGoalH} />
          <line x1={nearGoalR.sx} y1={nearGoalR.sy} x2={nearGoalR.sx} y2={nearGoalR.sy - nearGoalH} />
          <line x1={nearGoalL.sx} y1={nearGoalL.sy - nearGoalH} x2={nearGoalR.sx} y2={nearGoalR.sy - nearGoalH} />
        </g>
      )}

      {/* Gol Away (cima/longe) */}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.7)" fill="none" strokeWidth={1.8}>
          <polygon
            points={`${farGoalL.sx},${farGoalL.sy} ${farGoalR.sx},${farGoalR.sy} ${farGoalR.sx},${farGoalR.sy - farGoalH} ${farGoalL.sx},${farGoalL.sy - farGoalH}`}
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
          <line x1={farGoalL.sx} y1={farGoalL.sy} x2={farGoalL.sx} y2={farGoalL.sy - farGoalH} />
          <line x1={farGoalR.sx} y1={farGoalR.sy} x2={farGoalR.sx} y2={farGoalR.sy - farGoalH} />
          <line x1={farGoalL.sx} y1={farGoalL.sy - farGoalH} x2={farGoalR.sx} y2={farGoalR.sy - farGoalH} />
        </g>
      )}

      {/* Labels HOME / AWAY */}
      <text x={IV_CX} y={IV_BOTTOM_Y + 30} textAnchor="middle"
        fill={NEON} fontSize={10} fontFamily="'Oswald', sans-serif"
        fontWeight={700} letterSpacing={2} opacity={0.55}>
        HOME · y=0
      </text>
      <text x={IV_CX} y={IV_TOP_Y - 16} textAnchor="middle"
        fill="rgba(255,255,255,0.35)" fontSize={9}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={2}>
        AWAY · y=100
      </text>

      {/* Coordenadas de canto */}
      {cfg.showCoords && (
        <>
          <text x={blx + 4} y={IV_BOTTOM_Y + 14} fill="rgba(255,255,255,0.25)" fontSize={7} fontFamily="monospace">(x=0,y=0)</text>
          <text x={brx - 4} y={IV_BOTTOM_Y + 14} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={7} fontFamily="monospace">(x=100,y=0)</text>
          <text x={tlx + 4} y={IV_TOP_Y - 4} fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="monospace">(x=0,y=100)</text>
          <text x={trx - 4} y={IV_TOP_Y - 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="monospace">(x=100,y=100)</text>
        </>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI — Toggle + Página principal
// ═══════════════════════════════════════════════════════════════════════════════

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs font-medium transition-colors',
        active
          ? 'bg-[#FDE100]/15 text-[#FDE100] border border-[#FDE100]/30'
          : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70',
      )}>
      {active ? <Eye className="w-3 h-3 shrink-0" /> : <EyeOff className="w-3 h-3 shrink-0" />}
      {label}
    </button>
  );
}

export function OleFieldLab() {
  const [cfg, setCfg] = useState<FieldLabConfig>(DEFAULT_FIELD_LAB_CONFIG);
  const toggle = useCallback((key: keyof FieldLabConfig) => {
    setCfg((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const reset = useCallback(() => setCfg(DEFAULT_FIELD_LAB_CONFIG), []);

  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-white/8 bg-black/40 backdrop-blur-sm shrink-0">
        <Link to="/" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-xs">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FDE100] animate-pulse" />
          <span className="font-display text-sm font-bold tracking-widest uppercase text-[#FDE100]">
            Olé Field Lab
          </span>
          <span className="text-white/25 text-xs font-mono">v0.2</span>
        </div>

        {/* Switcher AÉREA / LEGACY */}
        <div className="flex items-center gap-1 ml-4 bg-white/5 rounded-lg p-1">
          {(['aerial', 'inclined'] as const).map((mode) => (
            <button key={mode}
              onClick={() => setCfg((p) => ({ ...p, viewMode: mode }))}
              className={cn(
                'px-3 py-1 rounded text-xs font-mono font-bold tracking-wider transition-colors',
                cfg.viewMode === mode ? 'bg-[#FDE100] text-black' : 'text-white/40 hover:text-white/70',
              )}>
              {mode === 'aerial' ? 'AÉREA' : 'LEGACY'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-white/30 text-xs">
          <Info className="w-3.5 h-3.5" />
          <span>x=largura · y=profundidade · home y=0 · away y=100</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel lateral */}
        <aside className="w-52 shrink-0 border-r border-white/8 bg-black/30 flex flex-col gap-1 p-3 overflow-y-auto">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2 px-1">Visualização</p>
          <Toggle label="12 Zonas táticas" active={cfg.showZones} onToggle={() => toggle('showZones')} />
          <Toggle label="Labels de zona" active={cfg.showZoneLabels} onToggle={() => toggle('showZoneLabels')} />
          <Toggle label="Grid métrico" active={cfg.showGrid} onToggle={() => toggle('showGrid')} />
          <Toggle label="Coordenadas" active={cfg.showCoords} onToggle={() => toggle('showCoords')} />
          <Toggle label="Gols" active={cfg.showGoals} onToggle={() => toggle('showGoals')} />
          <Toggle label="Escanteios" active={cfg.showCorners} onToggle={() => toggle('showCorners')} />
          <Toggle label="Arcos de pênalti" active={cfg.showPenaltyArcs} onToggle={() => toggle('showPenaltyArcs')} />

          <div className="mt-3 border-t border-white/8 pt-3">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2 px-1">Opacidade</p>
            <label className="text-[10px] text-white/40 px-1 block mb-1">Zonas: {Math.round(cfg.zoneOpacity * 100)}%</label>
            <input type="range" min={5} max={40} value={Math.round(cfg.zoneOpacity * 100)}
              onChange={(e) => setCfg((p) => ({ ...p, zoneOpacity: Number(e.target.value) / 100 }))}
              className="w-full accent-[#FDE100] h-1" />
          </div>

          {/* Legenda de setores */}
          {cfg.showZones && (
            <div className="mt-3 border-t border-white/8 pt-3 flex flex-col gap-1.5">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1 px-1">Setores</p>
              {Object.entries(ZONE_SECTOR_COLOR).map(([sector, color]) => (
                <div key={sector} className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color as string, opacity: 0.8 }} />
                  <span className="text-[10px] text-white/50 font-mono">
                    {sector === 'D' ? 'D — Defensivo' : sector === 'MD' ? 'MD — Méd. Def.' : sector === 'MO' ? 'MO — Méd. Of.' : 'O — Ofensivo'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-white/8">
            <button onClick={reset}
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <RotateCcw className="w-3 h-3" />
              Resetar config
            </button>
          </div>

          <div className="mt-2 p-2 rounded bg-white/3 border border-white/8">
            <p className="text-[9px] font-mono text-white/25 leading-relaxed">
              {cfg.viewMode === 'aerial'
                ? `SVG ${VW}×${VH}px\nHome → direita (y=0→100)\nx=largura, y=profundidade`
                : `SVG ${IV_VW}×${IV_VH}px\nHome = baixo (y=0)\nAway = cima (y=100)\nx=largura, y=profundidade`}
            </p>
          </div>
        </aside>

        {/* Campo */}
        <main className={cn(
          'flex-1 overflow-auto bg-[#050608]',
          cfg.viewMode === 'inclined'
            ? 'flex flex-row items-start gap-0'
            : 'flex items-center justify-center p-4 lg:p-8',
        )}>
          {cfg.viewMode === 'inclined' ? (
            /* LEGACY: campo vertical ocupa toda a altura, sem padding excessivo */
            <div className="flex flex-col h-full w-full">
              {/* Badge */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2 flex-wrap shrink-0">
                <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">
                  LEGACY · first view vertical · 12 zonas
                </span>
                <div className="flex gap-1.5">
                  {cfg.showZones && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FDE100]/10 text-[#FDE100]/70 font-mono">12 ZONAS</span>}
                  {cfg.showGrid && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-mono">GRID</span>}
                  {cfg.showCoords && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-mono">COORDS</span>}
                </div>
              </div>
              {/* Campo: altura total disponível, largura proporcional */}
              <div className="flex-1 flex items-center justify-center px-4 pb-4 min-h-0">
                <div
                  className="rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.7)] ring-1 ring-white/8"
                  style={{ height: '100%', aspectRatio: `${IV_VW} / ${IV_VH}`, maxHeight: 'calc(100vh - 120px)' }}
                >
                  <FVField cfg={cfg} />
                </div>
              </div>
            </div>
          ) : (
            /* AÉREA: layout horizontal padrão */
            <div className="w-full max-w-5xl">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">
                  AÉREA · horizontal
                </span>
                <div className="flex gap-1.5">
                  {cfg.showZones && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FDE100]/10 text-[#FDE100]/70 font-mono">12 ZONAS</span>}
                  {cfg.showGrid && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-mono">GRID</span>}
                  {cfg.showCoords && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-mono">COORDS</span>}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.7)] ring-1 ring-white/8">
                <AerialField cfg={cfg} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
