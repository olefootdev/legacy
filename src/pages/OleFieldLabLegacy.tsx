/**
 * Olé Field Lab — LEGACY /dev/field-lab/legacy
 *
 * GEOMETRIA CORRETA:
 * O campo é um trapézio com 4 cantos reais no SVG 720×1100.
 * Toda conversão nasce de normalizedToFirstViewSvg(x, y) — interpolação bilinear pura.
 *
 * Cantos do trapézio (do FieldView.tsx original):
 *   BL = (-70, 990)  home-esquerda  (x=0,  y=0)
 *   BR = (790, 990)  home-direita   (x=100, y=0)
 *   TR = (650, 110)  away-direita   (x=100, y=100)
 *   TL = (70,  110)  away-esquerda  (x=0,  y=100)
 *
 * Coordenadas normalizadas:
 *   x: 0=esquerda, 100=direita  (largura)
 *   y: 0=home/baixo, 100=away/cima  (profundidade)
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw, ChevronLeft, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_ZONES, ZONE_SECTOR_COLOR, type FieldZone } from '@/match/fieldZones12';

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD POLYGON — 4 cantos reais do trapézio
// ═══════════════════════════════════════════════════════════════════════════════
const SVG_W = 720;
const SVG_H = 1100;

// Cantos em pixels SVG, mapeados para coordenadas normalizadas:
// norm(0,0)   = BL (home-esquerda, baixo)
// norm(100,0) = BR (home-direita,  baixo)
// norm(0,100) = TL (away-esquerda, cima)
// norm(100,100)= TR (away-direita,  cima)
const FIELD_POLYGON = {
  BL: { sx: -70, sy: 990 },   // x=0,   y=0
  BR: { sx: 790, sy: 990 },   // x=100, y=0
  TR: { sx: 650, sy: 110 },   // x=100, y=100
  TL: { sx:  70, sy: 110 },   // x=0,   y=100
} as const;

/**
 * Interpolação bilinear pura nos 4 cantos do trapézio.
 * Sem easing, sem distorção — cada ponto nasce da geometria real do campo.
 *
 * x: 0=esquerda → 100=direita
 * y: 0=home(baixo) → 100=away(cima)
 */
export function normalizedToFirstViewSvg(x: number, y: number): { sx: number; sy: number } {
  const nx = x / 100; // 0..1
  const ny = y / 100; // 0..1 (0=baixo/home, 1=cima/away)

  // Interpola na borda inferior (y=0): BL → BR
  const bottomX = FIELD_POLYGON.BL.sx + nx * (FIELD_POLYGON.BR.sx - FIELD_POLYGON.BL.sx);
  const bottomY = FIELD_POLYGON.BL.sy + nx * (FIELD_POLYGON.BR.sy - FIELD_POLYGON.BL.sy);

  // Interpola na borda superior (y=100): TL → TR
  const topX = FIELD_POLYGON.TL.sx + nx * (FIELD_POLYGON.TR.sx - FIELD_POLYGON.TL.sx);
  const topY = FIELD_POLYGON.TL.sy + nx * (FIELD_POLYGON.TR.sy - FIELD_POLYGON.TL.sy);

  // Interpola verticalmente entre bottom e top
  return {
    sx: bottomX + ny * (topX - bottomX),
    sy: bottomY + ny * (topY - bottomY),
  };
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NEON = '#FDE100';
const LINE_COLOR = 'rgba(255,255,255,0.18)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// Medidas reais do campo em coordenadas normalizadas
const PCT_BOX_DEPTH   = (16.5  / 105) * 100;
const PCT_BOX_HALF_X  = (40.3  / 68)  * 50;
const PCT_SIX_DEPTH   = (5.5   / 105) * 100;
const PCT_SIX_HALF_X  = (18.32 / 68)  * 50;
const PCT_GOAL_HALF_X = (7.32  / 68)  * 50;
const PCT_PEN_SPOT    = (11    / 105) * 100;
const GOAL_DEPTH_SVG  = 28; // profundidade visual do gol em px SVG

function zoneColor(z: FieldZone) { return ZONE_SECTOR_COLOR[z.sector]; }

// Converte 4 cantos de uma zona normalizada em polygon points SVG
function zoneToPolygon(xMin: number, xMax: number, yMin: number, yMax: number): string {
  const bl = normalizedToFirstViewSvg(xMin, yMin);
  const br = normalizedToFirstViewSvg(xMax, yMin);
  const tr = normalizedToFirstViewSvg(xMax, yMax);
  const tl = normalizedToFirstViewSvg(xMin, yMax);
  return `${bl.sx},${bl.sy} ${br.sx},${br.sy} ${tr.sx},${tr.sy} ${tl.sx},${tl.sy}`;
}

// ── Config ────────────────────────────────────────────────────────────────────
interface Cfg {
  showZones: boolean;
  showZoneLabels: boolean;
  showGrid: boolean;
  showCoords: boolean;
  showGoals: boolean;
  showCorners: boolean;
  showPenaltyArcs: boolean;
  zoneOpacity: number;
}

const DEFAULT: Cfg = {
  showZones: true,
  showZoneLabels: true,
  showGrid: true,
  showCoords: true,
  showGoals: true,
  showCorners: true,
  showPenaltyArcs: true,
  zoneOpacity: 0.18,
};

// ── Gramado com listras de profundidade ───────────────────────────────────────
function FieldGrass() {
  const { BL, BR, TR, TL } = FIELD_POLYGON;
  const fieldPoints = `${BL.sx},${BL.sy} ${BR.sx},${BR.sy} ${TR.sx},${TR.sy} ${TL.sx},${TL.sy}`;

  // 10 faixas de profundidade alternadas
  const stripes = Array.from({ length: 10 }, (_, i) => {
    if (i % 2 === 0) return null;
    const y0 = i * 10;
    const y1 = (i + 1) * 10;
    return (
      <polygon key={i}
        points={zoneToPolygon(0, 100, y0, y1)}
        fill={GRASS_B} opacity={0.75}
      />
    );
  });

  return (
    <>
      <polygon points={fieldPoints} fill={GRASS_A} />
      {stripes}
    </>
  );
}

// ── 12 Zonas táticas ──────────────────────────────────────────────────────────
function FieldZones({ cfg }: { cfg: Cfg }) {
  if (!cfg.showZones) return null;
  return (
    <>
      {FIELD_ZONES.map((z) => {
        const { xMin, xMax, yMin, yMax } = z.bounds;
        const color = zoneColor(z);
        const center = normalizedToFirstViewSvg(
          (xMin + xMax) / 2,
          (yMin + yMax) / 2,
        );
        // Escala do label proporcional à profundidade (y=0 maior, y=100 menor)
        const depthT = (yMin + yMax) / 200; // 0=baixo, 1=cima
        const fontSize = Math.round(16 - depthT * 7); // 16px embaixo → 9px em cima

        return (
          <g key={z.id}>
            <polygon
              points={zoneToPolygon(xMin, xMax, yMin, yMax)}
              fill={color}
              opacity={cfg.zoneOpacity}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            {cfg.showZoneLabels && (
              <text
                x={center.sx}
                y={center.sy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontSize={fontSize}
                fontFamily="'Oswald', sans-serif"
                fontWeight={700}
                letterSpacing={1}
                opacity={0.95}
              >
                {z.id}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── Grid de coordenadas ───────────────────────────────────────────────────────
function FieldGrid({ cfg }: { cfg: Cfg }) {
  if (!cfg.showGrid && !cfg.showCoords) return null;

  // 11 linhas em cada eixo: 0, 10, 20 ... 100 — idêntico ao modo aérea
  const yLines = Array.from({ length: 11 }, (_, i) => i * 10);
  const xLines = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <>
      {/* Linhas horizontais de profundidade */}
      {yLines.map((y) => {
        const l = normalizedToFirstViewSvg(0,   y);
        const r = normalizedToFirstViewSvg(100, y);
        const mid = normalizedToFirstViewSvg(103, y); // label fora do campo
        return (
          <g key={`y${y}`}>
            {cfg.showGrid && (
              <line
                x1={l.sx} y1={l.sy} x2={r.sx} y2={r.sy}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={y === 0 || y === 100 ? 0 : 0.8}
                strokeDasharray={y === 50 ? '6 4' : '3 5'}
              />
            )}
            {cfg.showCoords && (
              <text
                x={r.sx + 10} y={r.sy}
                dominantBaseline="middle"
                fill={NEON}
                fontSize={y === 0 ? 10 : y === 100 ? 9 : 9}
                fontFamily="monospace"
                fontWeight={700}
                opacity={0.85}
              >
                y={y}
              </text>
            )}
          </g>
        );
      })}

      {/* Linhas verticais de corredor */}
      {xLines.map((x) => {
        const top = normalizedToFirstViewSvg(x, 100);
        const bot = normalizedToFirstViewSvg(x, 0);
        const lbl = normalizedToFirstViewSvg(x, -6); // label abaixo do campo
        return (
          <g key={`x${x}`}>
            {cfg.showGrid && (
              <line
                x1={top.sx} y1={top.sy} x2={bot.sx} y2={bot.sy}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={x === 0 || x === 100 ? 0 : 0.8}
                strokeDasharray="3 5"
              />
            )}
            {cfg.showCoords && (
              <text
                x={lbl.sx} y={lbl.sy}
                textAnchor="middle"
                fill={NEON}
                fontSize={9}
                fontFamily="monospace"
                fontWeight={700}
                opacity={0.85}
              >
                x={Math.round(x)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── Marcações do campo ────────────────────────────────────────────────────────
function FieldMarkings({ cfg }: { cfg: Cfg }) {
  const lc = LINE_COLOR;
  const lw = 1.5;

  // Perímetro
  const { BL, BR, TR, TL } = FIELD_POLYGON;
  const perimeter = `${BL.sx},${BL.sy} ${BR.sx},${BR.sy} ${TR.sx},${TR.sy} ${TL.sx},${TL.sy}`;

  // Linha de meio-campo (y=50)
  const midL = normalizedToFirstViewSvg(0,   50);
  const midR = normalizedToFirstViewSvg(100, 50);

  // Centro do campo
  const center = normalizedToFirstViewSvg(50, 50);

  // Círculo central — aproximado como elipse no trapézio
  const ccL = normalizedToFirstViewSvg(50 - 8.7, 50);
  const ccR = normalizedToFirstViewSvg(50 + 8.7, 50);
  const ccT = normalizedToFirstViewSvg(50, 50 + 8.7);
  const ccB = normalizedToFirstViewSvg(50, 50 - 8.7);
  const ccRx = (ccR.sx - ccL.sx) / 2;
  const ccRy = (ccB.sy - ccT.sy) / 2;

  // Grande área Home (y=0..PCT_BOX_DEPTH)
  const nearBox = zoneToPolygon(50 - PCT_BOX_HALF_X, 50 + PCT_BOX_HALF_X, 0, PCT_BOX_DEPTH);
  // Pequena área Home
  const nearSix = zoneToPolygon(50 - PCT_SIX_HALF_X, 50 + PCT_SIX_HALF_X, 0, PCT_SIX_DEPTH);
  // Grande área Away (y=100-PCT_BOX_DEPTH..100)
  const farBox = zoneToPolygon(50 - PCT_BOX_HALF_X, 50 + PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH, 100);
  // Pequena área Away
  const farSix = zoneToPolygon(50 - PCT_SIX_HALF_X, 50 + PCT_SIX_HALF_X, 100 - PCT_SIX_DEPTH, 100);

  // Marcas de pênalti
  const nearPen = normalizedToFirstViewSvg(50, PCT_PEN_SPOT);
  const farPen  = normalizedToFirstViewSvg(50, 100 - PCT_PEN_SPOT);

  // Gols
  const nearGoalL = normalizedToFirstViewSvg(50 - PCT_GOAL_HALF_X, 0);
  const nearGoalR = normalizedToFirstViewSvg(50 + PCT_GOAL_HALF_X, 0);
  const farGoalL  = normalizedToFirstViewSvg(50 - PCT_GOAL_HALF_X, 100);
  const farGoalR  = normalizedToFirstViewSvg(50 + PCT_GOAL_HALF_X, 100);

  // Profundidade visual do gol: empurra para baixo (home) ou cima (away)
  const nearGoalDepth = GOAL_DEPTH_SVG;
  const farGoalDepth  = GOAL_DEPTH_SVG * 0.45; // menor porque está longe

  return (
    <g stroke={lc} fill="none" strokeWidth={lw}>
      {/* Perímetro */}
      <polygon points={perimeter} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />

      {/* Linha de meio-campo */}
      <line x1={midL.sx} y1={midL.sy} x2={midR.sx} y2={midR.sy} />

      {/* Círculo central */}
      <ellipse cx={center.sx} cy={center.sy} rx={ccRx} ry={Math.abs(ccRy)} />
      <circle cx={center.sx} cy={center.sy} r={3} fill={lc} stroke="none" />

      {/* Grandes áreas */}
      <polygon points={nearBox} />
      <polygon points={farBox} />

      {/* Pequenas áreas */}
      <polygon points={nearSix} opacity={0.7} />
      <polygon points={farSix} opacity={0.7} />

      {/* Marcas de pênalti */}
      <circle cx={nearPen.sx} cy={nearPen.sy} r={3.5} fill={lc} stroke="none" />
      <circle cx={farPen.sx}  cy={farPen.sy}  r={2.5} fill={lc} stroke="none" />

      {/* Escanteios */}
      {cfg.showCorners && [
        normalizedToFirstViewSvg(0,   0),
        normalizedToFirstViewSvg(100, 0),
        normalizedToFirstViewSvg(0,   100),
        normalizedToFirstViewSvg(100, 100),
      ].map((c, i) => (
        <circle key={i} cx={c.sx} cy={c.sy} r={4} stroke={lc} strokeWidth={lw} fill="none" />
      ))}

      {/* Gol Home (baixo) */}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.85)" strokeWidth={2.5}>
          <polygon
            points={`${nearGoalL.sx},${nearGoalL.sy} ${nearGoalR.sx},${nearGoalR.sy} ${nearGoalR.sx},${nearGoalR.sy + nearGoalDepth} ${nearGoalL.sx},${nearGoalL.sy + nearGoalDepth}`}
            fill="rgba(255,255,255,0.05)"
          />
        </g>
      )}

      {/* Gol Away (cima) */}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.65)" strokeWidth={1.8}>
          <polygon
            points={`${farGoalL.sx},${farGoalL.sy} ${farGoalR.sx},${farGoalR.sy} ${farGoalR.sx},${farGoalR.sy - farGoalDepth} ${farGoalL.sx},${farGoalL.sy - farGoalDepth}`}
            fill="rgba(255,255,255,0.04)"
          />
        </g>
      )}
    </g>
  );
}

// ── Labels HOME / AWAY ────────────────────────────────────────────────────────
function FieldLabels({ cfg }: { cfg: Cfg }) {
  const homeCenter = normalizedToFirstViewSvg(50, -5);
  const awayCenter = normalizedToFirstViewSvg(50, 105);
  return (
    <>
      <text x={homeCenter.sx} y={homeCenter.sy} textAnchor="middle"
        fill={NEON} fontSize={11} fontFamily="'Oswald', sans-serif"
        fontWeight={700} letterSpacing={3} opacity={0.7}>
        HOME · y=0
      </text>
      <text x={awayCenter.sx} y={awayCenter.sy} textAnchor="middle"
        fill="rgba(255,255,255,0.4)" fontSize={9}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={3}>
        AWAY · y=100
      </text>
    </>
  );
}

// ── Campo SVG completo ────────────────────────────────────────────────────────
function FVField({ cfg }: { cfg: Cfg }) {
  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-full"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Olé Field Lab — Legacy First View"
    >
      <defs>
        <linearGradient id="fv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050505" />
          <stop offset="50%" stopColor="#080a08" />
          <stop offset="100%" stopColor="#0a0d0a" />
        </linearGradient>
        <radialGradient id="fv-vignette" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>

      {/* Fundo */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#fv-bg)" />

      {/* Gramado */}
      <FieldGrass />

      {/* Vinheta */}
      <polygon
        points={`${FIELD_POLYGON.BL.sx},${FIELD_POLYGON.BL.sy} ${FIELD_POLYGON.BR.sx},${FIELD_POLYGON.BR.sy} ${FIELD_POLYGON.TR.sx},${FIELD_POLYGON.TR.sy} ${FIELD_POLYGON.TL.sx},${FIELD_POLYGON.TL.sy}`}
        fill="url(#fv-vignette)"
      />

      {/* Zonas (abaixo das linhas) */}
      <FieldZones cfg={cfg} />

      {/* Grid + coordenadas */}
      <FieldGrid cfg={cfg} />

      {/* Marcações */}
      <FieldMarkings cfg={cfg} />

      {/* Labels */}
      <FieldLabels cfg={cfg} />
    </svg>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={cn(
      'flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs font-medium transition-colors',
      active ? 'bg-[#FDE100]/15 text-[#FDE100] border border-[#FDE100]/30'
             : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70',
    )}>
      {active ? <Eye className="w-3 h-3 shrink-0" /> : <EyeOff className="w-3 h-3 shrink-0" />}
      {label}
    </button>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export function OleFieldLabLegacy() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const toggle = useCallback((key: keyof Cfg) => setCfg((p) => ({ ...p, [key]: !p[key] })), []);

  return (
    <div className="h-screen bg-[#050608] text-white flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-black/40 shrink-0">
        <Link to="/dev/field-lab" className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          Lab
        </Link>
        <div className="w-px h-4 bg-white/10" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FDE100] animate-pulse" />
        <span className="font-display text-sm font-bold tracking-widest uppercase text-[#FDE100]">
          Field Lab · LEGACY
        </span>
        <span className="text-white/20 text-xs font-mono">interpolação bilinear · trapézio real</span>
        <div className="ml-auto text-white/25 text-[10px] font-mono">
          x=largura · y=profundidade · home y=0 · away y=100
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 shrink-0 border-r border-white/8 bg-black/30 flex flex-col gap-1 p-3 overflow-y-auto">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Overlays</p>
          <Toggle label="12 Zonas" active={cfg.showZones} onToggle={() => toggle('showZones')} />
          <Toggle label="Labels" active={cfg.showZoneLabels} onToggle={() => toggle('showZoneLabels')} />
          <Toggle label="Grid" active={cfg.showGrid} onToggle={() => toggle('showGrid')} />
          <Toggle label="Coordenadas" active={cfg.showCoords} onToggle={() => toggle('showCoords')} />
          <Toggle label="Gols" active={cfg.showGoals} onToggle={() => toggle('showGoals')} />
          <Toggle label="Escanteios" active={cfg.showCorners} onToggle={() => toggle('showCorners')} />
          <Toggle label="Arcos pênalti" active={cfg.showPenaltyArcs} onToggle={() => toggle('showPenaltyArcs')} />

          <div className="mt-3 border-t border-white/8 pt-3">
            <label className="text-[10px] text-white/40 block mb-1">Opacidade: {Math.round(cfg.zoneOpacity * 100)}%</label>
            <input type="range" min={5} max={50} value={Math.round(cfg.zoneOpacity * 100)}
              onChange={(e) => setCfg((p) => ({ ...p, zoneOpacity: Number(e.target.value) / 100 }))}
              className="w-full accent-[#FDE100] h-1" />
          </div>

          <div className="mt-3 border-t border-white/8 pt-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Setores</p>
            {Object.entries(ZONE_SECTOR_COLOR).map(([s, c]) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c as string }} />
                <span className="text-[10px] text-white/50 font-mono">
                  {s === 'D' ? 'D Defensivo' : s === 'MD' ? 'MD Méd.Def.' : s === 'MO' ? 'MO Méd.Of.' : 'O Ofensivo'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-3 border-t border-white/8">
            <button onClick={() => setCfg(DEFAULT)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <RotateCcw className="w-3 h-3" />
              Resetar
            </button>
            <Link to="/dev/field-lab/aerea"
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors mt-1">
              <LayoutGrid className="w-3 h-3" />
              Ver modo Aérea
            </Link>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center bg-[#050608] p-3 overflow-hidden">
          <div className="h-full" style={{ aspectRatio: `${SVG_W} / ${SVG_H}`, maxHeight: '100%' }}>
            <FVField cfg={cfg} />
          </div>
        </main>
      </div>
    </div>
  );
}
