/**
 * TacticalOverlay — modo tático com o mesmo SVG do Field Lab Legacy
 * Usa normalizedToFirstViewSvg + normalizeForVisual — campo idêntico ao /dev/field-lab/legacy
 */
import { useState, useCallback } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { MatchCognitiveArchetype } from '@/match/playerInMatch';
import { slotToPositionId } from '../../../agents/bridge/slotToPositionId';
import { ROLE_EXPECTATIONS } from '../../../agents/context/PlayerRoleExpectations';
import { getTerritory } from '../../../agents/fieldKnowledge/PositionTerritories';
import {
  FV_SVG_W, FV_SVG_H, FV_CX, FV_TOP_Y, FV_BOTTOM_Y,
  FV_TOP_HALF_W, FV_BOTTOM_HALF_W,
  FIELD_POLYGON,
  normalizedToFirstViewSvg,
  zoneBoundsToPolygonPoints,
  normalizeForVisual,
  defendingY,
  FIELD_ZONES,
  ZONE_SECTOR_COLOR,
} from '@/tactical';

// ── Helpers de projeção (idênticos ao OleFieldLabLegacy) ──────────────────────
function p(x: number, y: number) { return normalizedToFirstViewSvg({ x, y }); }
function pv(x: number, y: number) {
  return normalizedToFirstViewSvg(normalizeForVisual({ x, y }, 1));
}
function poly(xMin: number, xMax: number, yMin: number, yMax: number) {
  return zoneBoundsToPolygonPoints(xMin, xMax, yMin, yMax);
}
function polyv(xMin: number, xMax: number, yMin: number, yMax: number) {
  const bl = normalizedToFirstViewSvg(normalizeForVisual({ x: xMin, y: yMin }, 1));
  const br = normalizedToFirstViewSvg(normalizeForVisual({ x: xMax, y: yMin }, 1));
  const tr = normalizedToFirstViewSvg(normalizeForVisual({ x: xMax, y: yMax }, 1));
  const tl = normalizedToFirstViewSvg(normalizeForVisual({ x: xMin, y: yMax }, 1));
  return `${bl.sx},${bl.sy} ${br.sx},${br.sy} ${tr.sx},${tr.sy} ${tl.sx},${tl.sy}`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NEON = '#FDE100';
const LINE_COLOR = 'rgba(255,255,255,0.18)';
const GRASS_A = '#0d1a0e';
const GRASS_B = '#111f12';

// Medidas normalizadas (idênticas ao Field Lab)
const PCT_BOX_DEPTH   = (16.5  / 105) * 100;
const PCT_BOX_HALF_X  = (40.3  / 68)  * 50;
const PCT_SIX_DEPTH   = (5.5   / 105) * 100;
const PCT_SIX_HALF_X  = (18.32 / 68)  * 50;
const PCT_GOAL_HALF_X = (7.32  / 68)  * 50;
const PCT_PEN_SPOT    = (11    / 105) * 100;
const GOAL_DEPTH_SVG  = 28;

const ARCHETYPES: MatchCognitiveArchetype[] = ['executor','criador','destruidor','construtor','finalizador'];
const ROLES: PitchPlayerState['role'][] = ['gk','def','mid','attack'];

interface Props {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX?: number;
  ballY?: number;
  onUpdatePlayer?: (id: string, patch: Partial<Pick<PitchPlayerState,'cognitiveArchetype'|'role'>>) => void;
}

export function TacticalOverlay({ homePlayers, awayPlayers, ballX = 50, ballY = 50, onUpdatePlayer }: Props) {
  const [selected, setSelected] = useState<PitchPlayerState | null>(null);
  const toggle = useCallback((p: PitchPlayerState) =>
    setSelected(prev => prev?.playerId === p.playerId ? null : p), []);

  const allPlayers = [...homePlayers, ...awayPlayers];
  const sel = selected ? allPlayers.find(p => p.playerId === selected.playerId) ?? selected : null;
  const posId = sel ? slotToPositionId(sel.slotId ?? '') : null;
  const roleExp = posId ? ROLE_EXPECTATIONS[posId] : null;
  const territory = posId ? getTerritory(posId, 'home') : null;

  // Gramado
  const { BL, BR, TR, TL } = FIELD_POLYGON;
  const fieldPoints = `${BL.sx},${BL.sy} ${BR.sx},${BR.sy} ${TR.sx},${TR.sy} ${TL.sx},${TL.sy}`;

  // Marcações
  const midL   = p(0, 50);   const midR   = p(100, 50);
  const center = p(50, 50);
  const ccL    = p(50 - 8.7, 50); const ccR = p(50 + 8.7, 50);
  const ccT    = p(50, 50 + 8.7); const ccB = p(50, 50 - 8.7);
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
  const farBoxBL  = p(50 - PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH);
  const farBoxBR  = p(50 + PCT_BOX_HALF_X, 100 - PCT_BOX_DEPTH);

  // Labels HOME/AWAY
  const homeDefY = defendingY('home', 1);
  const awayDefY = defendingY('away', 1);
  const homeLbl  = p(50, homeDefY === 0 ? -5 : 105);
  const awayLbl  = p(50, awayDefY === 0 ? -5 : 105);

  return (
    <div style={{ position:'absolute', inset:0, background:'#050608', display:'flex', zIndex:50 }}>

      {/* ── SVG do campo (idêntico ao Field Lab Legacy) ── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <svg
          viewBox={`0 0 ${FV_SVG_W} ${FV_SVG_H}`}
          style={{ width:'100%', height:'100%', display:'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Gramado */}
          <polygon points={fieldPoints} fill={GRASS_A} />
          {Array.from({ length: 10 }, (_, i) => {
            if (i % 2 === 0) return null;
            return <polygon key={i} points={poly(0, 100, i * 10, (i + 1) * 10)} fill={GRASS_B} opacity={0.75} />;
          })}

          {/* Zonas 12 */}
          {FIELD_ZONES.map((z) => {
            const { xMin, xMax, yMin, yMax } = z.boundsNormalized;
            const color = ZONE_SECTOR_COLOR[z.sector];
            const cx = (xMin + xMax) / 2;
            const cy = (yMin + yMax) / 2;
            const center2 = pv(cx, cy);
            const visualY = cy;
            const depthT = visualY / 100;
            const fontSize = Math.round(16 - depthT * 7);
            return (
              <g key={z.id}>
                <polygon points={polyv(xMin, xMax, yMin, yMax)}
                  fill={color} opacity={0.18}
                  stroke={color} strokeWidth={1} strokeOpacity={0.6} />
                <text x={center2.sx} y={center2.sy}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={color} fontSize={fontSize}
                  fontFamily="'Oswald', sans-serif" fontWeight={700}
                  letterSpacing={1} opacity={0.9}>
                  {z.id}
                </text>
              </g>
            );
          })}

          {/* Zonas do jogador selecionado */}
          {territory && <>
            {territory.primaryZoneIds.map(id => {
              const z = FIELD_ZONES.find(fz => fz.id === id);
              if (!z) return null;
              const { xMin, xMax, yMin, yMax } = z.boundsNormalized;
              return <polygon key={`pri-${id}`}
                points={polyv(xMin, xMax, yMin, yMax)}
                fill="rgba(253,225,0,0.22)" stroke={NEON} strokeWidth={2.5} />;
            })}
            {territory.supportZoneIds.map(id => {
              const z = FIELD_ZONES.find(fz => fz.id === id);
              if (!z) return null;
              const { xMin, xMax, yMin, yMax } = z.boundsNormalized;
              return <polygon key={`sup-${id}`}
                points={polyv(xMin, xMax, yMin, yMax)}
                fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.8)" strokeWidth={1.5} strokeDasharray="5 3" />;
            })}
            {territory.forbiddenZoneIds.map(id => {
              const z = FIELD_ZONES.find(fz => fz.id === id);
              if (!z) return null;
              const { xMin, xMax, yMin, yMax } = z.boundsNormalized;
              return <polygon key={`for-${id}`}
                points={polyv(xMin, xMax, yMin, yMax)}
                fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.6)" strokeWidth={1.5} strokeDasharray="4 3" />;
            })}
            {/* Recovery point */}
            {(() => {
              const rp = pv(territory.recoveryPoint.x, territory.recoveryPoint.y);
              return <circle cx={rp.sx} cy={rp.sy} r={6} fill={NEON} stroke="#000" strokeWidth={2} />;
            })()}
          </>}

          {/* Marcações do campo */}
          <g stroke={LINE_COLOR} fill="none" strokeWidth={1.5}>
            <polygon points={fieldPoints} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
            <line x1={midL.sx} y1={midL.sy} x2={midR.sx} y2={midR.sy} />
            <ellipse cx={center.sx} cy={center.sy} rx={ccRx} ry={ccRy} />
            <circle cx={center.sx} cy={center.sy} r={3} fill={LINE_COLOR} stroke="none" />
            <polygon points={nearBox} />
            <polygon points={nearSix} opacity={0.7} />
            <polygon points={farBox} />
            <polygon points={farSix} opacity={0.7} />
            <circle cx={nearPen.sx} cy={nearPen.sy} r={3.5} fill={LINE_COLOR} stroke="none" />
            <circle cx={farPen.sx}  cy={farPen.sy}  r={2.5} fill={LINE_COLOR} stroke="none" />
            {[p(0,0), p(100,0), p(0,100), p(100,100)].map((c, i) => (
              <circle key={i} cx={c.sx} cy={c.sy} r={4} stroke={LINE_COLOR} strokeWidth={1.5} fill="none" />
            ))}
            <g stroke="rgba(255,255,255,0.85)" strokeWidth={2.5}>
              <polygon fill="rgba(255,255,255,0.05)"
                points={`${nearGoalL.sx},${nearGoalL.sy} ${nearGoalR.sx},${nearGoalR.sy} ${nearGoalR.sx},${nearGoalR.sy + nearGoalH} ${nearGoalL.sx},${nearGoalL.sy + nearGoalH}`} />
            </g>
            <g stroke="rgba(255,255,255,0.65)" strokeWidth={1.8}>
              <polygon fill="rgba(255,255,255,0.04)"
                points={`${farGoalL.sx},${farGoalL.sy} ${farGoalR.sx},${farGoalR.sy} ${farGoalR.sx},${farGoalR.sy - farGoalH} ${farGoalL.sx},${farGoalL.sy - farGoalH}`} />
            </g>
            <defs>
              <clipPath id="tac-arc-near">
                <polygon points={`${nearBoxTL.sx},${nearBoxTL.sy} ${nearBoxTR.sx},${nearBoxTR.sy} ${FV_CX + FV_BOTTOM_HALF_W + 50},${nearBoxTL.sy - 200} ${FV_CX - FV_BOTTOM_HALF_W - 50},${nearBoxTL.sy - 200}`} />
              </clipPath>
              <clipPath id="tac-arc-far">
                <polygon points={`${farBoxBL.sx},${farBoxBL.sy} ${farBoxBR.sx},${farBoxBR.sy} ${FV_CX + FV_TOP_HALF_W + 50},${farBoxBL.sy + 200} ${FV_CX - FV_TOP_HALF_W - 50},${farBoxBL.sy + 200}`} />
              </clipPath>
            </defs>
            <ellipse cx={nearPen.sx} cy={nearPen.sy} rx={ccRx * 1.1} ry={ccRy * 1.1}
              clipPath="url(#tac-arc-near)" stroke={LINE_COLOR} fill="none" strokeWidth={1.5} />
            <ellipse cx={farPen.sx} cy={farPen.sy} rx={ccRx * 0.75} ry={ccRy * 0.75}
              clipPath="url(#tac-arc-far)" stroke={LINE_COLOR} fill="none" strokeWidth={1.5} />
          </g>

          {/* Grid coordenadas */}
          {Array.from({ length: 11 }, (_, i) => i * 10).map(v => {
            const yL = p(0, v); const yR = p(100, v);
            const xT = p(v, 100); const xB = p(v, 0);
            const lbl = p(v, -6);
            return (
              <g key={v}>
                <line x1={yL.sx} y1={yL.sy} x2={yR.sx} y2={yR.sy}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={v === 50 ? 1 : 0.5} strokeDasharray="3 5" />
                <line x1={xT.sx} y1={xT.sy} x2={xB.sx} y2={xB.sy}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} strokeDasharray="3 5" />
                <text x={yR.sx + 6} y={yR.sy} dominantBaseline="middle"
                  fill={NEON} fontSize={8} fontFamily="monospace" fontWeight={700} opacity={0.7}>y={v}</text>
                <text x={lbl.sx} y={lbl.sy} textAnchor="middle"
                  fill={NEON} fontSize={8} fontFamily="monospace" fontWeight={700} opacity={0.7}>x={v}</text>
              </g>
            );
          })}

          {/* Labels HOME/AWAY */}
          <text x={homeLbl.sx} y={homeLbl.sy + 14} textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize={11}
            fontFamily="'Oswald',sans-serif" fontWeight={700} letterSpacing={3}>HOME</text>
          <text x={awayLbl.sx} y={awayLbl.sy - 6} textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize={11}
            fontFamily="'Oswald',sans-serif" fontWeight={700} letterSpacing={3}>AWAY</text>

          {/* Bola */}
          {(() => {
            const ball = pv(ballX, ballY);
            const visualY = ballY;
            const depthT = visualY / 100;
            const r = Math.round(7 - depthT * 3);
            return (
              <g>
                <ellipse cx={ball.sx} cy={ball.sy + r * 0.4} rx={r * 0.9} ry={r * 0.25} fill="#000" opacity={0.35} />
                <circle cx={ball.sx} cy={ball.sy} r={r} fill="#f5f5f5" stroke="#cccccc" strokeWidth={1} />
              </g>
            );
          })()}

          {/* Jogadores home */}
          {homePlayers.map(pl => {
            const isSel = sel?.playerId === pl.playerId;
            const pid = slotToPositionId(pl.slotId ?? '');
            // PitchPlayerState: x=profundidade(0-100), y=largura(0-100)
            // Field Lab: x=largura, y=profundidade → inverter
            const pos = pv(pl.y, pl.x);
            const depthT = pl.x / 100;
            const r = Math.round(14 - depthT * 6);
            const fs = Math.round(9 - depthT * 3);
            return (
              <g key={pl.playerId} style={{ cursor:'pointer' }} onClick={() => toggle(pl)}>
                <ellipse cx={pos.sx} cy={pos.sy + r * 0.3} rx={r * 0.85} ry={r * 0.25} fill="#000" opacity={0.4} />
                <circle cx={pos.sx} cy={pos.sy} r={r + (isSel ? 3 : 0)}
                  fill={isSel ? NEON : '#050a14'}
                  stroke={isSel ? '#000' : NEON}
                  strokeWidth={isSel ? 3 : 2} opacity={0.95} />
                {isSel && <circle cx={pos.sx} cy={pos.sy} r={r + 8}
                  fill="none" stroke={NEON} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />}
                <text x={pos.sx} y={pos.sy - 1} textAnchor="middle" dominantBaseline="middle"
                  fill={isSel ? '#050505' : NEON} fontSize={fs}
                  fontFamily="'Oswald',sans-serif" fontWeight={700}>
                  {pl.name.split(' ').pop()?.slice(0,6)}
                </text>
                <text x={pos.sx} y={pos.sy + r + 7} textAnchor="middle"
                  fill="rgba(253,225,0,0.6)" fontSize={6} fontFamily="monospace">
                  {pid}·{pl.slotId}
                </text>
                <text x={pos.sx} y={pos.sy + r + 14} textAnchor="middle"
                  fill="rgba(255,255,255,0.35)" fontSize={5} fontFamily="monospace">
                  ({pl.x.toFixed(0)},{pl.y.toFixed(0)})
                </text>
              </g>
            );
          })}

          {/* Jogadores away */}
          {awayPlayers.map(pl => {
            const isSel = sel?.playerId === pl.playerId;
            const pid = slotToPositionId(pl.slotId ?? '');
            const pos = pv(pl.y, pl.x);
            const depthT = pl.x / 100;
            const r = Math.round(14 - depthT * 6);
            const fs = Math.round(9 - depthT * 3);
            return (
              <g key={pl.playerId} style={{ cursor:'pointer' }} onClick={() => toggle(pl)}>
                <ellipse cx={pos.sx} cy={pos.sy + r * 0.3} rx={r * 0.85} ry={r * 0.25} fill="#000" opacity={0.4} />
                <circle cx={pos.sx} cy={pos.sy} r={r + (isSel ? 3 : 0)}
                  fill={isSel ? '#ef4444' : '#0a0a14'}
                  stroke={isSel ? '#000' : 'rgba(239,68,68,0.85)'}
                  strokeWidth={isSel ? 3 : 2} opacity={0.95} />
                <text x={pos.sx} y={pos.sy - 1} textAnchor="middle" dominantBaseline="middle"
                  fill={isSel ? '#fff' : 'rgba(239,68,68,0.9)'} fontSize={fs}
                  fontFamily="'Oswald',sans-serif" fontWeight={700}>
                  {pl.name.split(' ').pop()?.slice(0,6)}
                </text>
                <text x={pos.sx} y={pos.sy + r + 7} textAnchor="middle"
                  fill="rgba(239,68,68,0.55)" fontSize={6} fontFamily="monospace">
                  {pid}·{pl.slotId}
                </text>
                <text x={pos.sx} y={pos.sy + r + 14} textAnchor="middle"
                  fill="rgba(255,255,255,0.3)" fontSize={5} fontFamily="monospace">
                  ({pl.x.toFixed(0)},{pl.y.toFixed(0)})
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Painel lateral ── */}
      <div style={{ width: sel ? 236 : 0, overflow:'hidden', transition:'width 0.18s ease', flexShrink:0 }}>
        {sel && (
          <div style={{ width:236, height:'100%', background:'#0A0A0A', borderLeft:`3px solid ${NEON}`, padding:'12px 14px', overflowY:'auto', boxSizing:'border-box', fontFamily:'monospace' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:7, fontWeight:800, letterSpacing:'0.3em', color:NEON, textTransform:'uppercase', marginBottom:2 }}>TÁTICO</div>
                <div style={{ fontSize:14, fontStyle:'italic', color:'#fff', lineHeight:1.1, fontFamily:'serif' }}>{sel.name}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:18, cursor:'pointer', padding:0 }}>×</button>
            </div>

            <PGrid>
              <PCell label="SLOT" v={sel.slotId??'—'} />
              <PCell label="POSITION" v={posId??'—'} hi />
              <PCell label="COORDS" v={`(${sel.x.toFixed(1)},${sel.y.toFixed(1)})`} />
              <PCell label="ROLE" v={sel.role} />
              <PCell label="ARQUÉTIPO" v={sel.cognitiveArchetype??'—'} />
              <PCell label="ARCHETYPE" v={sel.archetype??'—'} />
            </PGrid>

            {roleExp && <>
              <PSec label="MISSÃO">
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>{roleExp.mission}</div>
              </PSec>

              {roleExp.behavioralLimits && (
                <PSec label="LIMITES">
                  <PGrid>
                    <PCell label="MAX CHASE" v={`${roleExp.behavioralLimits.maxDistToChaseBall}u`} />
                    <PCell label="RECOVERY" v={`${(roleExp.behavioralLimits.recoveryPriority*100).toFixed(0)}%`} />
                    <PCell label="AGGRESSION" v={`${(roleExp.behavioralLimits.aggressionLevel*100).toFixed(0)}%`} />
                  </PGrid>
                </PSec>
              )}

              {roleExp.zoneResponsibility && (
                <PSec label="ZONA BASE">
                  <PGrid>
                    <PCell label="BASE" v={`(${roleExp.zoneResponsibility.baseZone.x},${roleExp.zoneResponsibility.baseZone.y})`} />
                    <PCell label="MAX ROAM" v={`${roleExp.zoneResponsibility.maxRoamDistance}u`} />
                  </PGrid>
                </PSec>
              )}

              {territory && (
                <PSec label="TERRITÓRIOS">
                  <PZList label="Primárias" zones={territory.primaryZoneIds} color={NEON} />
                  <PZList label="Suporte" zones={territory.supportZoneIds} color="#4ade80" />
                  <PZList label="Proibidas" zones={territory.forbiddenZoneIds} color="#ef4444" />
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:4 }}>
                    Recovery: ({territory.recoveryPoint.x},{territory.recoveryPoint.y})
                  </div>
                </PSec>
              )}

              {roleExp.preferredActions && (
                <PSec label="AÇÕES PREFERIDAS">
                  <PGrid>
                    <PCell label="MOVIMENTO" v={roleExp.preferredActions.movementType??'—'} />
                    <PCell label="ATAQUE" v={roleExp.preferredActions.attackingAction??'—'} />
                    <PCell label="DEFESA" v={roleExp.preferredActions.defensiveAction??'—'} />
                  </PGrid>
                </PSec>
              )}
            </>}

            {onUpdatePlayer && (
              <PSec label="EDITAR AO VIVO">
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>ARQUÉTIPO COGNITIVO</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
                  {ARCHETYPES.map(a => (
                    <button key={a} type="button" onClick={() => onUpdatePlayer(sel.playerId, { cognitiveArchetype: a })}
                      style={{ fontSize:7, padding:'2px 5px', background:sel.cognitiveArchetype===a?NEON:'rgba(255,255,255,0.06)', color:sel.cognitiveArchetype===a?'#000':'rgba(255,255,255,0.6)', border:'1px solid rgba(253,225,0,0.2)', cursor:'pointer', borderRadius:2 }}>{a}</button>
                  ))}
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>ROLE</div>
                <div style={{ display:'flex', gap:3 }}>
                  {ROLES.map(r => (
                    <button key={r} type="button" onClick={() => onUpdatePlayer(sel.playerId, { role: r })}
                      style={{ fontSize:7, padding:'2px 5px', background:sel.role===r?NEON:'rgba(255,255,255,0.06)', color:sel.role===r?'#000':'rgba(255,255,255,0.6)', border:'1px solid rgba(253,225,0,0.2)', cursor:'pointer', borderRadius:2 }}>{r}</button>
                  ))}
                </div>
              </PSec>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PSec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:7, fontWeight:800, letterSpacing:'0.28em', color:'rgba(253,225,0,0.55)', textTransform:'uppercase', marginBottom:4, borderBottom:'1px solid rgba(253,225,0,0.1)', paddingBottom:3 }}>{label}</div>
      {children}
    </div>
  );
}
function PGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:6 }}>{children}</div>;
}
function PCell({ label, v, hi }: { label: string; v: string; hi?: boolean }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)', padding:'3px 5px', borderRadius:2 }}>
      <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:9, color: hi ? '#FDE100' : 'rgba(255,255,255,0.85)', fontWeight: hi ? 700 : 400 }}>{v}</div>
    </div>
  );
}
function PZList({ label, zones, color }: { label: string; zones: string[]; color: string }) {
  if (!zones.length) return null;
  return (
    <div style={{ marginBottom:3 }}>
      <span style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{label}: </span>
      {zones.map(z => <span key={z} style={{ fontSize:7, color, marginRight:3 }}>{z.replace(/_/g,' ')}</span>)}
    </div>
  );
}
