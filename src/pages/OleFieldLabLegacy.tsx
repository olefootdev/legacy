/**
 * Olé Field Lab — LEGACY /dev/field-lab/legacy
 *
 * UI de teste e visualização. Toda lógica de geometria e zonas
 * vive em @/tactical — reutilizável pelo motor real.
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw, ChevronLeft, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  FV_SVG_W, FV_SVG_H, FV_TOP_Y, FV_BOTTOM_Y,
  FV_CX, FV_TOP_HALF_W, FV_BOTTOM_HALF_W,
  FIELD_POLYGON,
  normalizedToFirstViewSvg,
  zoneBoundsToPolygonPoints,
  FIELD_ZONES,
  ZONE_SECTOR_COLOR,
  type FieldZone,
} from '@/tactical';

// ── Helpers locais ────────────────────────────────────────────────────────────
// Assinatura (x, y) para uso interno — delega para @/tactical
function p(x: number, y: number) { return normalizedToFirstViewSvg({ x, y }); }
function poly(xMin: number, xMax: number, yMin: number, yMax: number) {
  return zoneBoundsToPolygonPoints(xMin, xMax, yMin, yMax);
}
function zoneColor(z: FieldZone) { return ZONE_SECTOR_COLOR[z.sector]; }

// ── Design tokens ─────────────────────────────────────────────────────────────
const NEON = '#FDE100';
const LINE_COLOR = 'rgba(255,255,255,0.18)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// Medidas reais em coordenadas normalizadas
const PCT_BOX_DEPTH   = (16.5  / 105) * 100;
const PCT_BOX_HALF_X  = (40.3  / 68)  * 50;
const PCT_SIX_DEPTH   = (5.5   / 105) * 100;
const PCT_SIX_HALF_X  = (18.32 / 68)  * 50;
const PCT_GOAL_HALF_X = (7.32  / 68)  * 50;
const PCT_PEN_SPOT    = (11    / 105) * 100;
const GOAL_DEPTH_SVG  = 28;

// ── Formações ─────────────────────────────────────────────────────────────────
const FORMATIONS: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'];

const LINE_COLORS: Record<string, string> = {
  def: '#3b82f6',
  mid: '#f59e0b',
  att: '#22c55e',
};

function slotToNormalized(nx: number, nz: number) {
  return { x: nz * 100, y: nx * 100 };
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
  showPositions: boolean;
  formation: FormationSchemeId;
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
  showPositions: true,
  formation: '4-3-3',
  zoneOpacity: 0.18,
};

// ── Gramado ───────────────────────────────────────────────────────────────────
function FieldGrass() {
  const { BL, BR, TR, TL } = FIELD_POLYGON;
  const fieldPoints = `${BL.sx},${BL.sy} ${BR.sx},${BR.sy} ${TR.sx},${TR.sy} ${TL.sx},${TL.sy}`;
  return (
    <>
      <polygon points={fieldPoints} fill={GRASS_A} />
      {Array.from({ length: 10 }, (_, i) => {
        if (i % 2 === 0) return null;
        return (
          <polygon key={i}
            points={poly(0, 100, i * 10, (i + 1) * 10)}
            fill={GRASS_B} opacity={0.75}
          />
        );
      })}
    </>
  );
}

// ── 12 Zonas táticas ──────────────────────────────────────────────────────────
function FieldZones({ cfg }: { cfg: Cfg }) {
  if (!cfg.showZones) return null;
  return (
    <>
      {FIELD_ZONES.map((z) => {
        const { xMin, xMax, yMin, yMax } = z.boundsNormalized;
        const color = zoneColor(z);
        const center = p((xMin + xMax) / 2, (yMin + yMax) / 2);
        const depthT = (yMin + yMax) / 200;
        const fontSize = Math.round(16 - depthT * 7);
        return (
          <g key={z.id}>
            <polygon
              points={poly(xMin, xMax, yMin, yMax)}
              fill={color} opacity={cfg.zoneOpacity}
              stroke={color} strokeWidth={1} strokeOpacity={0.6}
            />
            {cfg.showZoneLabels && (
              <text x={center.sx} y={center.sy}
                textAnchor="middle" dominantBaseline="middle"
                fill={color} fontSize={fontSize}
                fontFamily="'Oswald', sans-serif" fontWeight={700}
                letterSpacing={1} opacity={0.95}>
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
  const steps = Array.from({ length: 11 }, (_, i) => i * 10);
  return (
    <>
      {steps.map((v) => {
        const yL = p(0,   v);
        const yR = p(100, v);
        const xT = p(v, 100);
        const xB = p(v, 0);
        const lbl = p(v, -6);
        return (
          <g key={v}>
            {cfg.showGrid && (
              <>
                <line x1={yL.sx} y1={yL.sy} x2={yR.sx} y2={yR.sy}
                  stroke="rgba(255,255,255,0.22)" strokeWidth={v === 50 ? 1 : 0.6}
                  strokeDasharray={v === 50 ? '6 4' : '3 5'} />
                <line x1={xT.sx} y1={xT.sy} x2={xB.sx} y2={xB.sy}
                  stroke="rgba(255,255,255,0.22)" strokeWidth={0.6}
                  strokeDasharray="3 5" />
              </>
            )}
            {cfg.showCoords && (
              <>
                <text x={yR.sx + 8} y={yR.sy} dominantBaseline="middle"
                  fill={NEON} fontSize={9} fontFamily="monospace" fontWeight={700} opacity={0.8}>
                  y={v}
                </text>
                <text x={lbl.sx} y={lbl.sy} textAnchor="middle"
                  fill={NEON} fontSize={9} fontFamily="monospace" fontWeight={700} opacity={0.8}>
                  x={v}
                </text>
              </>
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
  const { BL, BR, TR, TL } = FIELD_POLYGON;
  const perimeter = `${BL.sx},${BL.sy} ${BR.sx},${BR.sy} ${TR.sx},${TR.sy} ${TL.sx},${TL.sy}`;

  const midL   = p(0,   50);
  const midR   = p(100, 50);
  const center = p(50,  50);
  const ccL    = p(50 - 8.7, 50);
  const ccR    = p(50 + 8.7, 50);
  const ccT    = p(50, 50 + 8.7);
  const ccB    = p(50, 50 - 8.7);
  const ccRx   = (ccR.sx - ccL.sx) / 2;
  const ccRy   = Math.abs((ccB.sy - ccT.sy) / 2);

  const nearPen = p(50, PCT_PEN_SPOT);
  const farPen  = p(50, 100 - PCT_PEN_SPOT);

  const nearGoalL = p(50 - PCT_GOAL_HALF_X, 0);
  const nearGoalR = p(50 + PCT_GOAL_HALF_X, 0);
  const farGoalL  = p(50 - PCT_GOAL_HALF_X, 100);
  const farGoalR  = p(50 + PCT_GOAL_HALF_X, 100);
  const nearGoalH = GOAL_DEPTH_SVG;
  const farGoalH  = GOAL_DEPTH_SVG * 0.45;

  const nearBox = poly(50 - PCT_BOX_HALF_X, 50 + PCT_BOX_HALF_X, 0, PCT_BOX_DEPTH);
  const nearSix = poly(50 - PCT_SIX_HALF_X, 50 + PCT_SIX_HALF_X, 0, PCT_SIX_DEPTH);
  const farBox  = poly(50 - PCT_BOX_HALF_X, 50 + PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH, 100);
  const farSix  = poly(50 - PCT_SIX_HALF_X, 50 + PCT_SIX_HALF_X, 100 - PCT_SIX_DEPTH, 100);

  const nearBoxTL = p(50 - PCT_BOX_HALF_X, PCT_BOX_DEPTH);
  const nearBoxTR = p(50 + PCT_BOX_HALF_X, PCT_BOX_DEPTH);
  const nearBoxBL = p(50 - PCT_BOX_HALF_X, 0);
  const nearBoxBR = p(50 + PCT_BOX_HALF_X, 0);
  const farBoxBL  = p(50 - PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH);
  const farBoxBR  = p(50 + PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH);
  const farBoxTL  = p(50 - PCT_BOX_HALF_X, 100);
  const farBoxTR  = p(50 + PCT_BOX_HALF_X, 100);

  return (
    <g stroke={lc} fill="none" strokeWidth={lw}>
      <polygon points={perimeter} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
      <line x1={midL.sx} y1={midL.sy} x2={midR.sx} y2={midR.sy} />
      <ellipse cx={center.sx} cy={center.sy} rx={ccRx} ry={ccRy} />
      <circle cx={center.sx} cy={center.sy} r={3} fill={lc} stroke="none" />
      <polygon points={nearBox} />
      <polygon points={nearSix} opacity={0.7} />
      <polygon points={farBox} />
      <polygon points={farSix} opacity={0.7} />
      <circle cx={nearPen.sx} cy={nearPen.sy} r={3.5} fill={lc} stroke="none" />
      <circle cx={farPen.sx}  cy={farPen.sy}  r={2.5} fill={lc} stroke="none" />
      {cfg.showCorners && [p(0,0), p(100,0), p(0,100), p(100,100)].map((c, i) => (
        <circle key={i} cx={c.sx} cy={c.sy} r={4} stroke={lc} strokeWidth={lw} fill="none" />
      ))}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.85)" strokeWidth={2.5}>
          <polygon fill="rgba(255,255,255,0.05)"
            points={`${nearGoalL.sx},${nearGoalL.sy} ${nearGoalR.sx},${nearGoalR.sy} ${nearGoalR.sx},${nearGoalR.sy + nearGoalH} ${nearGoalL.sx},${nearGoalL.sy + nearGoalH}`} />
        </g>
      )}
      {cfg.showGoals && (
        <g stroke="rgba(255,255,255,0.65)" strokeWidth={1.8}>
          <polygon fill="rgba(255,255,255,0.04)"
            points={`${farGoalL.sx},${farGoalL.sy} ${farGoalR.sx},${farGoalR.sy} ${farGoalR.sx},${farGoalR.sy - farGoalH} ${farGoalL.sx},${farGoalL.sy - farGoalH}`} />
        </g>
      )}
      {cfg.showPenaltyArcs && (
        <>
          <defs>
            {/* Near: mostra só a parte FORA da grande área (acima da linha nearBoxTL→nearBoxTR) */}
            <clipPath id="fv-arc-near">
              <polygon points={`${nearBoxTL.sx},${nearBoxTL.sy} ${nearBoxTR.sx},${nearBoxTR.sy} ${FV_CX + FV_BOTTOM_HALF_W + 50},${nearBoxTL.sy - 200} ${FV_CX - FV_BOTTOM_HALF_W - 50},${nearBoxTL.sy - 200}`} />
            </clipPath>
            {/* Far: mostra só a parte FORA da grande área (abaixo da linha farBoxBL→farBoxBR) */}
            <clipPath id="fv-arc-far">
              <polygon points={`${farBoxBL.sx},${farBoxBL.sy} ${farBoxBR.sx},${farBoxBR.sy} ${FV_CX + FV_TOP_HALF_W + 50},${farBoxBL.sy + 200} ${FV_CX - FV_TOP_HALF_W - 50},${farBoxBL.sy + 200}`} />
            </clipPath>
          </defs>
          {/* Arco Home — raio maior para estética */}
          <ellipse cx={nearPen.sx} cy={nearPen.sy}
            rx={ccRx * 1.1} ry={ccRy * 1.1}
            clipPath="url(#fv-arc-near)"
            stroke={LINE_COLOR} fill="none" strokeWidth={lw} />
          {/* Arco Away — proporcional à perspectiva */}
          <ellipse cx={farPen.sx} cy={farPen.sy}
            rx={ccRx * 0.75} ry={ccRy * 0.75}
            clipPath="url(#fv-arc-far)"
            stroke={LINE_COLOR} fill="none" strokeWidth={lw} />
        </>
      )}
    </g>
  );
}

// ── Posições por formação ─────────────────────────────────────────────────────
function FieldPositions({ cfg }: { cfg: Cfg }) {
  if (!cfg.showPositions) return null;
  const slots = FORMATION_BASES[cfg.formation];
  if (!slots) return null;
  return (
    <>
      {Object.entries(slots).map(([slotId, slot]) => {
        const { x, y } = slotToNormalized(slot.nx, slot.nz);
        const pos = p(x, y);
        const color = LINE_COLORS[slot.line] ?? '#ffffff';
        const depthT = y / 100;
        const r = Math.round(14 - depthT * 6);
        const fontSize = Math.round(9 - depthT * 3);
        return (
          <g key={slotId}>
            <ellipse cx={pos.sx} cy={pos.sy + r * 0.3} rx={r * 0.85} ry={r * 0.25} fill="#000" opacity={0.4} />
            <circle cx={pos.sx} cy={pos.sy} r={r} fill="#050505" stroke={color} strokeWidth={2} opacity={0.95} />
            <text x={pos.sx} y={pos.sy} textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize={fontSize}
              fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={0.5}>
              {slotId.toUpperCase()}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ── Labels HOME / AWAY ────────────────────────────────────────────────────────
function FieldLabels() {
  const homeCenter = p(50, -5);
  const awayCenter = p(50, 105);
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

// ── Campo SVG ─────────────────────────────────────────────────────────────────
function FVField({ cfg }: { cfg: Cfg }) {
  return (
    <svg viewBox={`0 0 ${FV_SVG_W} ${FV_SVG_H}`} className="w-full h-full"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Olé Field Lab — Legacy First View">
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
      <rect x={0} y={0} width={FV_SVG_W} height={FV_SVG_H} fill="url(#fv-bg)" />
      <FieldGrass />
      <polygon
        points={`${FIELD_POLYGON.BL.sx},${FIELD_POLYGON.BL.sy} ${FIELD_POLYGON.BR.sx},${FIELD_POLYGON.BR.sy} ${FIELD_POLYGON.TR.sx},${FIELD_POLYGON.TR.sy} ${FIELD_POLYGON.TL.sx},${FIELD_POLYGON.TL.sy}`}
        fill="url(#fv-vignette)" />
      <FieldZones cfg={cfg} />
      <FieldGrid cfg={cfg} />
      <FieldMarkings cfg={cfg} />
      <FieldPositions cfg={cfg} />
      <FieldLabels />
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
        <span className="text-white/20 text-xs font-mono">@/tactical · first view vertical</span>
        <div className="ml-auto text-white/25 text-[10px] font-mono">
          x=largura · y=profundidade · home y=0 · away y=100
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 shrink-0 border-r border-white/8 bg-black/30 flex flex-col gap-1 p-3 overflow-y-auto">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Overlays</p>
          <Toggle label="12 Zonas" active={cfg.showZones} onToggle={() => toggle('showZones')} />
          <Toggle label="Labels" active={cfg.showZoneLabels} onToggle={() => toggle('showZoneLabels')} />
          <Toggle label="Posições" active={cfg.showPositions} onToggle={() => toggle('showPositions')} />
          <Toggle label="Grid" active={cfg.showGrid} onToggle={() => toggle('showGrid')} />
          <Toggle label="Coordenadas" active={cfg.showCoords} onToggle={() => toggle('showCoords')} />
          <Toggle label="Gols" active={cfg.showGoals} onToggle={() => toggle('showGoals')} />
          <Toggle label="Escanteios" active={cfg.showCorners} onToggle={() => toggle('showCorners')} />
          <Toggle label="Arcos pênalti" active={cfg.showPenaltyArcs} onToggle={() => toggle('showPenaltyArcs')} />

          <div className="mt-3 border-t border-white/8 pt-3">
            <label className="text-[10px] text-white/40 block mb-1">Opacidade: {Math.round(cfg.zoneOpacity * 100)}%</label>
            <input type="range" min={5} max={50} value={Math.round(cfg.zoneOpacity * 100)}
              onChange={(e) => setCfg((prev) => ({ ...prev, zoneOpacity: Number(e.target.value) / 100 }))}
              className="w-full accent-[#FDE100] h-1" />
          </div>

          {cfg.showPositions && (
            <div className="mt-3 border-t border-white/8 pt-3">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Formação</p>
              <div className="flex flex-col gap-1">
                {FORMATIONS.map((f) => (
                  <button key={f}
                    onClick={() => setCfg((prev) => ({ ...prev, formation: f }))}
                    className={cn(
                      'px-2 py-1.5 rounded text-xs font-mono font-bold tracking-wider text-left transition-colors',
                      cfg.formation === f
                        ? 'bg-[#FDE100]/15 text-[#FDE100] border border-[#FDE100]/30'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent',
                    )}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {Object.entries(LINE_COLORS).map(([line, color]) => (
                  <div key={line} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[10px] text-white/50 font-mono">
                      {line === 'def' ? 'Defesa' : line === 'mid' ? 'Meio' : 'Ataque'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cfg.showZones && (
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
          )}

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
          <div className="h-full" style={{ aspectRatio: `${FV_SVG_W} / ${FV_SVG_H}`, maxHeight: '100%' }}>
            <FVField cfg={cfg} />
          </div>
        </main>
      </div>
    </div>
  );
}
