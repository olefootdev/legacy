/**
 * Olé Field Lab — AÉREA /dev/field-lab/aerea
 * Campo horizontal top-down. Home à esquerda (y=0), Away à direita (y=100).
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw, ChevronLeft, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_ZONES, ZONE_SECTOR_COLOR, type FieldZone } from '@/match/fieldZones12';

// ── Constantes SVG (idênticas ao FieldView.tsx) ───────────────────────────────
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

const NEON = '#FDE100';
const LINE_COLOR = 'rgba(255,255,255,0.13)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// No aérea: y=profundidade → eixo X do SVG; x=largura → eixo Y do SVG
function toSvgX(y: number) { return FL + (y / 100) * FW; }
function toSvgY(x: number) { return FT + (x / 100) * FH; }
function zoneColor(z: FieldZone) { return ZONE_SECTOR_COLOR[z.sector]; }

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
  showGrid: false,
  showCoords: true,
  showGoals: true,
  showCorners: true,
  showPenaltyArcs: true,
  zoneOpacity: 0.15,
};

// ── Zonas ─────────────────────────────────────────────────────────────────────
function AerialZones({ cfg }: { cfg: Cfg }) {
  if (!cfg.showZones) return null;
  return (
    <>
      {FIELD_ZONES.map((z) => {
        const svgX = toSvgX(z.bounds.yMin);
        const svgY = toSvgY(z.bounds.xMin);
        const svgW = ((z.bounds.yMax - z.bounds.yMin) / 100) * FW;
        const svgH = ((z.bounds.xMax - z.bounds.xMin) / 100) * FH;
        const color = zoneColor(z);
        return (
          <g key={z.id}>
            <rect x={svgX} y={svgY} width={svgW} height={svgH}
              fill={color} opacity={cfg.zoneOpacity}
              stroke={color} strokeWidth={0.8} strokeOpacity={0.5} />
            {cfg.showZoneLabels && (
              <text x={svgX + svgW / 2} y={svgY + svgH / 2}
                textAnchor="middle" dominantBaseline="middle"
                fill={color} fontSize={10}
                fontFamily="'Oswald', sans-serif" fontWeight={700}
                letterSpacing={1} opacity={0.9}>
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
function AerialGrid({ cfg }: { cfg: Cfg }) {
  if (!cfg.showGrid && !cfg.showCoords) return null;
  const yValues = [0, 25, 50, 75, 100];   // profundidade
  const xValues = [0, 33.33, 66.66, 100]; // largura

  return (
    <>
      {/* Linhas verticais de profundidade (y fixo) */}
      {yValues.map((y) => {
        const svgX = toSvgX(y);
        return (
          <g key={`y${y}`}>
            {cfg.showGrid && (
              <line x1={svgX} y1={FT} x2={svgX} y2={FT + FH}
                stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} strokeDasharray="4 6" />
            )}
            {cfg.showCoords && (
              <text x={svgX} y={FT - 9}
                textAnchor="middle"
                fill={NEON} fontSize={9} fontFamily="monospace" fontWeight={700} opacity={0.85}>
                y={y}
              </text>
            )}
          </g>
        );
      })}

      {/* Linhas horizontais de corredor (x fixo) */}
      {xValues.map((x) => {
        const svgY = toSvgY(x);
        return (
          <g key={`x${x}`}>
            {cfg.showGrid && (
              <line x1={FL} y1={svgY} x2={FL + FW} y2={svgY}
                stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} strokeDasharray="4 6" />
            )}
            {cfg.showCoords && (
              <text x={FL - 8} y={svgY}
                textAnchor="end" dominantBaseline="middle"
                fill={NEON} fontSize={9} fontFamily="monospace" fontWeight={700} opacity={0.85}>
                x={Math.round(x)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── Campo SVG ─────────────────────────────────────────────────────────────────
function AerialField({ cfg }: { cfg: Cfg }) {
  const lc = LINE_COLOR;
  const lw = 1.5;
  const stripeW = FW / 14;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="a-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
        <clipPath id="a-arc-l"><rect x={FL + BOX_W} y={FT} width={FW} height={FH} /></clipPath>
        <clipPath id="a-arc-r"><rect x={FL} y={FT} width={FW - BOX_W} height={FH} /></clipPath>
      </defs>

      {/* Fundo */}
      <rect x={0} y={0} width={VW} height={VH} fill="#080b08" />
      <rect x={0} y={0} width={VW} height={FT} fill="#0a0a0a" />
      <rect x={0} y={FT + FH} width={VW} height={VH - FT - FH} fill="#0a0a0a" />

      {/* Gramado */}
      <rect x={FL} y={FT} width={FW} height={FH} fill={GRASS_A} />
      {Array.from({ length: 14 }, (_, i) =>
        i % 2 === 1 ? null : (
          <rect key={i} x={FL + i * stripeW} y={FT} width={stripeW} height={FH} fill={GRASS_B} />
        )
      )}
      <rect x={FL} y={FT} width={FW} height={FH} fill="url(#a-vignette)" />

      {/* Zonas */}
      <AerialZones cfg={cfg} />

      {/* Grid + coords */}
      <AerialGrid cfg={cfg} />

      {/* Marcações */}
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
            <rect x={FL - GOAL_D} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
            <rect x={FL + FW} y={FCY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
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
            <circle cx={FL + PEN_X_PCT * FW} cy={FCY} r={CC_R} clipPath="url(#a-arc-l)" />
            <circle cx={FL + (1 - PEN_X_PCT) * FW} cy={FCY} r={CC_R} clipPath="url(#a-arc-r)" />
          </>
        )}
      </g>

      {/* Labels */}
      <text x={FL + 8} y={FT + FH + 18} fill={NEON} fontSize={10}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={2} opacity={0.6}>
        HOME · y=0 →
      </text>
      <text x={FL + FW - 8} y={FT + FH + 18} textAnchor="end"
        fill="rgba(255,255,255,0.4)" fontSize={10}
        fontFamily="'Oswald', sans-serif" fontWeight={700} letterSpacing={2}>
        ← AWAY · y=100
      </text>
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
export function OleFieldLabAerea() {
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
          Field Lab · AÉREA
        </span>
        <span className="text-white/20 text-xs font-mono">top-down horizontal</span>
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

          {cfg.showZones && (
            <div className="mt-3 border-t border-white/8 pt-3">
              <label className="text-[10px] text-white/40 block mb-1">Opacidade: {Math.round(cfg.zoneOpacity * 100)}%</label>
              <input type="range" min={5} max={50} value={Math.round(cfg.zoneOpacity * 100)}
                onChange={(e) => setCfg((p) => ({ ...p, zoneOpacity: Number(e.target.value) / 100 }))}
                className="w-full accent-[#FDE100] h-1" />
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
            <Link to="/dev/field-lab/legacy"
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors mt-1">
              <Layers className="w-3 h-3" />
              Ver modo Legacy
            </Link>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center bg-[#050608] p-4 overflow-hidden">
          <div className="w-full max-w-5xl">
            <AerialField cfg={cfg} />
          </div>
        </main>
      </div>
    </div>
  );
}
