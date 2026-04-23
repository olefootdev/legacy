import { useId } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { LiveMatchClockPeriod } from '@/engine/types';
import {
  getThird,
  getLane,
  getDefendingGoalX,
  getSideAttackDir,
  type MatchHalf,
  type TeamSide,
  PENALTY_AREA_DEPTH_M,
  PENALTY_AREA_HALF_WIDTH_M,
} from '@/match/fieldZones';
import { FIELD_LENGTH, FIELD_WIDTH, GOAL_INNER_WIDTH_M, uiPercentToWorld } from '@/simulation/field';
import {
  buildGrid12OverlayCells,
  worldPositionToGrid12CodeForTeam,
} from '@/match/tacticalGrid12';
import {
  buildTactical18OverlayCells,
  worldPositionToTactical18ShortLabel,
} from '@/match/tacticalField18';
import { sfSnapshot, sfGetAllAnchors, sfRoleFromSlot, type SfAnchor } from '@/smartfield/smartfieldBridge';
import {
  tacticalPointingQuality01,
  tacticalVisionArrowEndPercent,
} from '@/match/tacticalPointingDisplay';
import { tacticalRadiiFor } from '@/simulation/tacticalAnchorBlend';

const GOAL_AREA_DEPTH_M = 5.5;
const CZ = FIELD_WIDTH / 2;
const Z_PA_LO = CZ - PENALTY_AREA_HALF_WIDTH_M;
const Z_PA_HI = CZ + PENALTY_AREA_HALF_WIDTH_M;

function clockToHalf(period: LiveMatchClockPeriod | undefined): MatchHalf {
  if (period === 'second_half') return 2;
  return 1;
}

function uxFromXm(xm: number): number {
  return (xm / FIELD_LENGTH) * 100;
}

function uyFromZm(zm: number): number {
  return (zm / FIELD_WIDTH) * 100;
}

const THIRD_LABEL: Record<string, string> = {
  defensive: 'Def.',
  middle: 'Meio',
  attacking: 'Ataq.',
};

const LANE_LABEL: Record<string, string> = {
  left: 'Esq.',
  half_left: '1/2E',
  center: 'Cent.',
  half_right: '1/2D',
  right: 'Dir.',
};

function pitchPercentToWorld(px: number, py: number): { x: number; z: number } {
  const ux = px >= 0 && px <= 1 ? px * 100 : px;
  const uy = py >= 0 && py <= 1 ? py * 100 : py;
  return uiPercentToWorld(ux, uy);
}

function teamContext(team: TeamSide, half: MatchHalf) {
  return { team, half };
}

export interface TacticalPitchDevLayerProps {
  homeShort: string;
  awayShort: string;
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  clockPeriod: LiveMatchClockPeriod | undefined;
  /** Posse atual — realça seta de “quem ataca” na legenda. */
  possession: 'home' | 'away';
  /** Grelha 18 zonas (3×6) no referencial da equipa indicada — alinhada ao motor tático. */
  showZoneView?: boolean;
  /** Para qual equipa desenhar as 18 células (vista tática IFAB). */
  zonePerspectiveTeam?: TeamSide;
  /**
   * Deslocamento visual por jogador (`h:${playerId}` / `a:${playerId}`), p.ex. anti-chaos dos tokens.
   */
  pitchTokenNudges?: Map<string, { dx: number; dy: number }>;
  /** Bola em % do campo (íman) — olhar em fallback e reforço “bola → golo”. */
  ballPercent?: { x: number; y: number };
  showOperationalRadii?: boolean;
}

/**
 * Overlay de desenvolvimento: terços IFAB por equipa, corredores, grandes/pequenas áreas,
 * gols e etiquetas por jogador (papel, slot, terço e corredor — mesma lógica que `fieldZones`).
 */
export function TacticalPitchDevLayer({
  homeShort,
  awayShort,
  homePlayers,
  awayPlayers,
  clockPeriod,
  possession,
  showZoneView = false,
  zonePerspectiveTeam = 'home',
  pitchTokenNudges,
  ballPercent,
  showOperationalRadii = false,
}: TacticalPitchDevLayerProps) {
  const arrowId = useId().replace(/:/g, '');
  const half = clockToHalf(clockPeriod);

  const homeAtt = getSideAttackDir('home', half);
  const awayAtt = getSideAttackDir('away', half);

  /** Oeste (x≈0) e Leste (x≈L) no mesmo referencial do SVG / simulação. */
  const midX = FIELD_LENGTH / 2;
  const homeDefendsWest = getDefendingGoalX('home', half) < midX;
  const labelWestGoal = homeDefendsWest ? 'GOL CASA' : 'GOL VISITANTE';
  const labelEastGoal = homeDefendsWest ? 'GOL VISITANTE' : 'GOL CASA';
  const fillHomeGoal = 'rgba(234,255,0,0.92)';
  const fillAwayGoal = 'rgba(251,113,133,0.95)';

  const paUx = (PENALTY_AREA_DEPTH_M / FIELD_LENGTH) * 100;
  const gaUx = (GOAL_AREA_DEPTH_M / FIELD_LENGTH) * 100;
  const uyTop = (Z_PA_LO / FIELD_WIDTH) * 100;
  const uyBot = (Z_PA_HI / FIELD_WIDTH) * 100;

  const laneYs = [0.18, 0.36, 0.64, 0.82].map((u) => u * 100);

  const thirdUx = [
    { lo: 0, hi: (FIELD_LENGTH / 3 / FIELD_LENGTH) * 100, geo: 'Oeste' },
    {
      lo: (FIELD_LENGTH / 3 / FIELD_LENGTH) * 100,
      hi: ((2 * FIELD_LENGTH) / 3 / FIELD_LENGTH) * 100,
      geo: 'Central',
    },
    { lo: ((2 * FIELD_LENGTH) / 3 / FIELD_LENGTH) * 100, hi: 100, geo: 'Leste' },
  ];

  const grid12 = buildGrid12OverlayCells(half);
  const colBandLabels = ['D', 'MD', 'MO', 'O'];
  const grid18 = showZoneView ? buildTactical18OverlayCells(zonePerspectiveTeam, half) : [];

  const sfData = showZoneView ? sfSnapshot() : null;
  const sfSubs = sfData?.subzones ?? [];
  const sfMacroZones = sfData?.macro_zones ?? [];
  const sfGoals = sfData?.goals;
  const sfHomeAnchors = sfData ? sfGetAllAnchors('home') : {};
  const sfAwayAnchors = sfData ? sfGetAllAnchors('away') : {};

  return (
    <svg
      className="tactical-pitch-dev-layer pointer-events-none absolute inset-0 z-[10] h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="4"
          markerHeight="4"
          refX="3.5"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 z" fill="rgba(250,250,250,0.95)" />
        </marker>
      </defs>

      {/* Terços geométricos (campo fixo Oeste–Leste) */}
      {thirdUx.map((t, i) => (
        <g key={t.geo}>
          <rect
            x={t.lo}
            y={0}
            width={t.hi - t.lo}
            height={100}
            fill={i === 1 ? 'rgba(234,255,0,0.04)' : 'rgba(255,255,255,0.02)'}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={0.12}
          />
          <text
            x={(t.lo + t.hi) / 2}
            y={97}
            textAnchor="middle"
            fill="rgba(255,255,255,0.45)"
            fontSize={1.85}
            fontWeight={700}
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {t.geo}
          </text>
        </g>
      ))}

      {/* Corredores laterais (eixo Z / “y” no ecrã) */}
      {laneYs.map((y) => (
        <line
          key={y}
          x1={0}
          y1={y}
          x2={100}
          y2={y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.08}
          strokeDasharray="0.6 0.6"
        />
      ))}

      {/* Meio-campo estreito (corredor central largo) */}
      <rect
        x={0}
        y={36}
        width={100}
        height={28}
        fill="rgba(34,211,238,0.05)"
        stroke="rgba(34,211,238,0.2)"
        strokeWidth={0.1}
      />
      <text
        x={50}
        y={51}
        textAnchor="middle"
        fill="rgba(34,211,238,0.65)"
        fontSize={1.6}
        fontWeight={600}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        Meio-campo (faixa central)
      </text>

      {/* Grande área + pequena área — contorno extra */}
      <rect
        x={0}
        y={uyTop}
        width={paUx}
        height={uyBot - uyTop}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.15}
      />
      <text x={paUx / 2} y={uyTop + 2.8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={1.5} fontWeight={700}>
        Gr. área
      </text>
      <rect
        x={0}
        y={uyTop}
        width={gaUx}
        height={uyBot - uyTop}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.12}
      />
      <text x={gaUx / 2} y={uyTop + 5} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={1.35} fontWeight={700}>
        Pq. área
      </text>

      <rect
        x={100 - paUx}
        y={uyTop}
        width={paUx}
        height={uyBot - uyTop}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.15}
      />
      <text x={100 - paUx / 2} y={uyTop + 2.8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={1.5} fontWeight={700}>
        Gr. área
      </text>
      <rect
        x={100 - gaUx}
        y={uyTop}
        width={gaUx}
        height={uyBot - uyTop}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.12}
      />
      <text x={100 - gaUx / 2} y={uyTop + 5} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={1.35} fontWeight={700}>
        Pq. área
      </text>

      {/* Golos (boca) */}
      <rect x={-1.2} y={uyFromZm(34 - GOAL_INNER_WIDTH_M / 2)} width={1.2} height={(GOAL_INNER_WIDTH_M / FIELD_WIDTH) * 100} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.08} />
      <text
        x={-2.2}
        y={48.2}
        textAnchor="end"
        fill={labelWestGoal === 'GOL CASA' ? fillHomeGoal : fillAwayGoal}
        fontSize={1.35}
        fontWeight={800}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {labelWestGoal}
      </text>
      <text x={-2.2} y={51.2} textAnchor="end" fill="rgba(255,255,255,0.42)" fontSize={1.05} fontWeight={600} style={{ fontFamily: 'system-ui, sans-serif' }}>
        Oeste
      </text>
      <rect x={100} y={uyFromZm(34 - GOAL_INNER_WIDTH_M / 2)} width={1.2} height={(GOAL_INNER_WIDTH_M / FIELD_WIDTH) * 100} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.08} />
      <text
        x={102.2}
        y={48.2}
        textAnchor="start"
        fill={labelEastGoal === 'GOL CASA' ? fillHomeGoal : fillAwayGoal}
        fontSize={1.35}
        fontWeight={800}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {labelEastGoal}
      </text>
      <text x={102.2} y={51.2} textAnchor="start" fill="rgba(255,255,255,0.42)" fontSize={1.05} fontWeight={600} style={{ fontFamily: 'system-ui, sans-serif' }}>
        Leste
      </text>

      {/* Legenda direção de ataque */}
      <rect x={1} y={1} width={46} height={18.5} rx={0.8} fill="rgba(0,0,0,0.62)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.1} />
      <text x={3} y={4.2} fill="rgba(255,255,255,0.85)" fontSize={1.65} fontWeight={800} style={{ fontFamily: 'system-ui, sans-serif' }}>
        Campo tático (dev)
      </text>
      <text
        x={3}
        y={7.2}
        fill={possession === 'home' ? 'rgba(234,255,0,0.95)' : 'rgba(255,255,255,0.55)'}
        fontSize={1.45}
        fontWeight={700}
      >
        {homeShort}: ataca {homeAtt > 0 ? '→' : '←'} · tempo {half}
      </text>
      <text
        x={3}
        y={10.2}
        fill={possession === 'away' ? 'rgba(251,113,133,0.95)' : 'rgba(255,255,255,0.55)'}
        fontSize={1.45}
        fontWeight={700}
      >
        {awayShort}: ataca {awayAtt > 0 ? '→' : '←'}
      </text>
      <text x={3} y={13.2} fill="rgba(255,255,255,0.4)" fontSize={1.05}>
        Gols: Oeste = {labelWestGoal} · Leste = {labelEastGoal} · IFAB · grelha 12 ·
        {showZoneView ? ` SMARTFIELD · zonas · âncoras (${zonePerspectiveTeam === 'home' ? homeShort : awayShort})` : ' Zone View'}
      </text>
      <text x={3} y={16.4} fill="rgba(196,181,253,0.72)" fontSize={1.05} fontWeight={600}>
        SMARTFIELD: ● = âncora · ◯ = raio permitido · subzones coloridas por fase
      </text>

      {/* Grelha 12 setores por cima das faixas — perspetiva CASA nas colunas D→O */}
      <g aria-label="Setores 12 zonas">
        {grid12.map((cell) => (
          <g key={cell.code}>
            <rect
              x={cell.uxLo}
              y={cell.uyLo}
              width={cell.uxHi - cell.uxLo}
              height={cell.uyHi - cell.uyLo}
              fill="rgba(168,85,247,0.06)"
              stroke="rgba(196,181,253,0.5)"
              strokeWidth={0.11}
            />
            <text
              x={(cell.uxLo + cell.uxHi) / 2}
              y={(cell.uyLo + cell.uyHi) / 2 + 0.55}
              textAnchor="middle"
              fill="rgba(233,213,255,0.92)"
              fontSize={1.55}
              fontWeight={800}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {cell.code}
            </text>
          </g>
        ))}
        <text x={0.8} y={16.5} fill="rgba(233,213,255,0.62)" fontSize={1.15} fontWeight={700} style={{ fontFamily: 'system-ui, sans-serif' }}>
          Esq.
        </text>
        <text x={0.8} y={50} fill="rgba(233,213,255,0.62)" fontSize={1.15} fontWeight={700} style={{ fontFamily: 'system-ui, sans-serif' }}>
          Cent.
        </text>
        <text x={0.8} y={83} fill="rgba(233,213,255,0.62)" fontSize={1.15} fontWeight={700} style={{ fontFamily: 'system-ui, sans-serif' }}>
          Dir.
        </text>
        {[0, 1, 2, 3].map((ci) => {
          const c = grid12.filter((g) => g.col === ci && g.row === 1)[0];
          if (!c) return null;
          const cx = (c.uxLo + c.uxHi) / 2;
          return (
            <text
              key={`cb-${ci}`}
              x={cx}
              y={99.2}
              textAnchor="middle"
              fill="rgba(233,213,255,0.58)"
              fontSize={1.1}
              fontWeight={700}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {colBandLabels[ci]}
            </text>
          );
        })}
      </g>

      {/* Grelha 18 zonas (motor `tacticalField18`) — vista da equipa escolhida */}
      {showZoneView ? (
        <g aria-label="18 zonas táticas">
          {grid18.map((cell) => (
            <g key={`z18-${cell.id}`}>
              <rect
                x={cell.uxLo}
                y={cell.uyLo}
                width={cell.uxHi - cell.uxLo}
                height={cell.uyHi - cell.uyLo}
                fill="rgba(16,185,129,0.07)"
                stroke="rgba(52,211,153,0.55)"
                strokeWidth={0.1}
              />
              <text
                x={(cell.uxLo + cell.uxHi) / 2}
                y={(cell.uyLo + cell.uyHi) / 2 + 0.45}
                textAnchor="middle"
                fill="rgba(167,243,208,0.92)"
                fontSize={1.35}
                fontWeight={800}
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {cell.label}
              </text>
            </g>
          ))}
          <text x={99} y={3.5} textAnchor="end" fill="rgba(167,243,208,0.75)" fontSize={1.05} fontWeight={700}>
            Zone View · 3×6 · Z1–Z18
          </text>
        </g>
      ) : null}

      {/* SMARTFIELD macro zones overlay */}
      {showZoneView && sfMacroZones.length > 0 ? (
        <g aria-label="SMARTFIELD macro zones">
          {sfMacroZones.map((zone) => {
            const uxLo = (zone.rect.x_min / FIELD_LENGTH) * 100;
            const uxHi = (zone.rect.x_max / FIELD_LENGTH) * 100;
            const uyLo = (zone.rect.z_min / FIELD_WIDTH) * 100;
            const uyHi = (zone.rect.z_max / FIELD_WIDTH) * 100;
            const thirdColor =
              zone.third === 'defensive'
                ? 'rgba(46,204,113,0.08)'
                : zone.third === 'attacking'
                  ? 'rgba(231,76,60,0.08)'
                  : 'rgba(241,196,15,0.06)';
            const borderColor =
              zone.third === 'defensive'
                ? 'rgba(46,204,113,0.3)'
                : zone.third === 'attacking'
                  ? 'rgba(231,76,60,0.3)'
                  : 'rgba(241,196,15,0.25)';
            return (
              <g key={`sfm-${zone.id}`}>
                <rect
                  x={uxLo}
                  y={uyLo}
                  width={uxHi - uxLo}
                  height={uyHi - uyLo}
                  fill={thirdColor}
                  stroke={borderColor}
                  strokeWidth={0.06}
                />
                <text
                  x={(uxLo + uxHi) / 2}
                  y={(uyLo + uyHi) / 2 + 0.3}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.28)"
                  fontSize={0.7}
                  fontWeight={600}
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {zone.lane.replace('_', ' ')}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {/* SMARTFIELD subzones overlay */}
      {showZoneView && sfSubs.length > 0 ? (
        <g aria-label="SMARTFIELD subzones">
          {sfSubs.map((sub) => {
            const uxLo = (sub.rect.x_min / FIELD_LENGTH) * 100;
            const uxHi = (sub.rect.x_max / FIELD_LENGTH) * 100;
            const uyLo = (sub.rect.z_min / FIELD_WIDTH) * 100;
            const uyHi = (sub.rect.z_max / FIELD_WIDTH) * 100;
            const isAttacking = sub.id.startsWith('box') || sub.id.startsWith('six_yard') || sub.id.startsWith('goalmouth') || sub.id.startsWith('creation');
            const isDefensive = sub.id.startsWith('recovery') || sub.id.startsWith('build_up');
            const fillColor = isAttacking
              ? 'rgba(239,68,68,0.06)'
              : isDefensive
                ? 'rgba(59,130,246,0.06)'
                : 'rgba(251,191,36,0.06)';
            const strokeColor = isAttacking
              ? 'rgba(239,68,68,0.4)'
              : isDefensive
                ? 'rgba(59,130,246,0.4)'
                : 'rgba(251,191,36,0.35)';
            return (
              <g key={`sf-${sub.id}`}>
                <rect
                  x={uxLo}
                  y={uyLo}
                  width={uxHi - uxLo}
                  height={uyHi - uyLo}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={0.08}
                  strokeDasharray="0.4 0.2"
                />
                <text
                  x={(uxLo + uxHi) / 2}
                  y={(uyLo + uyHi) / 2 + 0.35}
                  textAnchor="middle"
                  fill={isAttacking ? 'rgba(239,68,68,0.75)' : isDefensive ? 'rgba(96,165,250,0.75)' : 'rgba(251,191,36,0.7)'}
                  fontSize={0.85}
                  fontWeight={600}
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {sub.id.replace(/_/g, ' ')}
                </text>
              </g>
            );
          })}
          <text x={99} y={5.5} textAnchor="end" fill="rgba(251,191,36,0.65)" fontSize={0.9} fontWeight={700}>
            SMARTFIELD · subzones
          </text>
        </g>
      ) : null}

      {/* SMARTFIELD goal sub-zones (near post, far post, central channel) */}
      {showZoneView && sfGoals ? (
        <g aria-label="SMARTFIELD goal zones">
          {[sfGoals.west, sfGoals.east].map((goal, gi) => {
            const nearUxLo = (goal.near_post_zone.x_min / FIELD_LENGTH) * 100;
            const nearUxHi = (goal.near_post_zone.x_max / FIELD_LENGTH) * 100;
            const nearUyLo = (goal.near_post_zone.z_min / FIELD_WIDTH) * 100;
            const nearUyHi = (goal.near_post_zone.z_max / FIELD_WIDTH) * 100;
            const farUxLo = (goal.far_post_zone.x_min / FIELD_LENGTH) * 100;
            const farUxHi = (goal.far_post_zone.x_max / FIELD_LENGTH) * 100;
            const farUyLo = (goal.far_post_zone.z_min / FIELD_WIDTH) * 100;
            const farUyHi = (goal.far_post_zone.z_max / FIELD_WIDTH) * 100;
            const cenUxLo = (goal.central_channel.x_min / FIELD_LENGTH) * 100;
            const cenUxHi = (goal.central_channel.x_max / FIELD_LENGTH) * 100;
            const cenUyLo = (goal.central_channel.z_min / FIELD_WIDTH) * 100;
            const cenUyHi = (goal.central_channel.z_max / FIELD_WIDTH) * 100;
            const spotUx = (goal.penalty_spot.x / FIELD_LENGTH) * 100;
            const spotUy = (goal.penalty_spot.z / FIELD_WIDTH) * 100;
            return (
              <g key={`sfg-${gi}`}>
                <rect x={nearUxLo} y={nearUyLo} width={nearUxHi - nearUxLo} height={nearUyHi - nearUyLo}
                  fill="rgba(52,152,219,0.45)" stroke="rgba(52,152,219,0.8)" strokeWidth={0.12} />
                <rect x={farUxLo} y={farUyLo} width={farUxHi - farUxLo} height={farUyHi - farUyLo}
                  fill="rgba(230,126,34,0.45)" stroke="rgba(230,126,34,0.8)" strokeWidth={0.12} />
                <rect x={cenUxLo} y={cenUyLo} width={cenUxHi - cenUxLo} height={cenUyHi - cenUyLo}
                  fill="rgba(46,204,113,0.45)" stroke="rgba(46,204,113,0.8)" strokeWidth={0.12} />
                <circle cx={spotUx} cy={spotUy} r={0.5} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={0.12} />
                <line x1={spotUx - 0.35} y1={spotUy} x2={spotUx + 0.35} y2={spotUy} stroke="rgba(255,255,255,0.7)" strokeWidth={0.1} />
                <line x1={spotUx} y1={spotUy - 0.35} x2={spotUx} y2={spotUy + 0.35} stroke="rgba(255,255,255,0.7)" strokeWidth={0.1} />
              </g>
            );
          })}
        </g>
      ) : null}

      {/* SMARTFIELD tactical anchors — home (yellow) */}
      {showZoneView && Object.keys(sfHomeAnchors).length > 0 ? (
        <g aria-label="SMARTFIELD home anchors">
          {Object.entries(sfHomeAnchors).map(([role, anchor]: [string, SfAnchor]) => {
            const cx = (anchor.base_anchor.x / FIELD_LENGTH) * 100;
            const cy = (anchor.base_anchor.z / FIELD_WIDTH) * 100;
            const rxPct = (anchor.allowed_radius / FIELD_LENGTH) * 100;
            const ryPct = (anchor.allowed_radius / FIELD_WIDTH) * 100;
            return (
              <g key={`sfah-${role}`}>
                <ellipse cx={cx} cy={cy} rx={rxPct} ry={ryPct}
                  fill="rgba(234,255,0,0.05)" stroke="rgba(234,255,0,0.3)" strokeWidth={0.08} strokeDasharray="0.3 0.15" />
                <circle cx={cx} cy={cy} r={0.55} fill="rgba(234,255,0,0.75)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.08} />
                <text x={cx} y={cy - 1.2} textAnchor="middle" fill="rgba(234,255,0,0.85)" fontSize={0.9} fontWeight={800}
                  stroke="rgba(0,0,0,0.6)" strokeWidth={0.08} paintOrder="stroke"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
                  {role}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {/* SMARTFIELD tactical anchors — away (pink) */}
      {showZoneView && Object.keys(sfAwayAnchors).length > 0 ? (
        <g aria-label="SMARTFIELD away anchors">
          {Object.entries(sfAwayAnchors).map(([role, anchor]: [string, SfAnchor]) => {
            const cx = (anchor.base_anchor.x / FIELD_LENGTH) * 100;
            const cy = (anchor.base_anchor.z / FIELD_WIDTH) * 100;
            const rxPct = (anchor.allowed_radius / FIELD_LENGTH) * 100;
            const ryPct = (anchor.allowed_radius / FIELD_WIDTH) * 100;
            return (
              <g key={`sfaa-${role}`}>
                <ellipse cx={cx} cy={cy} rx={rxPct} ry={ryPct}
                  fill="rgba(251,113,133,0.04)" stroke="rgba(251,113,133,0.25)" strokeWidth={0.08} strokeDasharray="0.3 0.15" />
                <circle cx={cx} cy={cy} r={0.45} fill="rgba(251,113,133,0.7)" stroke="rgba(0,0,0,0.5)" strokeWidth={0.08} />
                <text x={cx} y={cy + 2} textAnchor="middle" fill="rgba(251,113,133,0.8)" fontSize={0.8} fontWeight={800}
                  stroke="rgba(0,0,0,0.6)" strokeWidth={0.08} paintOrder="stroke"
                  style={{ fontFamily: 'system-ui, sans-serif' }}>
                  {role}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {showOperationalRadii && [...homePlayers, ...awayPlayers].map((p) => {
        const isHome = homePlayers.includes(p);
        const radii = tacticalRadiiFor(p.role, p.slotId);
        const nudge = pitchTokenNudges?.get(`${isHome ? 'h' : 'a'}:${p.playerId}`) ?? { dx: 0, dy: 0 };
        const px = (p.x >= 0 && p.x <= 1 ? p.x * 100 : p.x) + nudge.dx;
        const py = (p.y >= 0 && p.y <= 1 ? p.y * 100 : p.y) + nudge.dy;
        const actionPct = (radii.actionRadius / FIELD_LENGTH) * 100;
        const supportPct = (radii.supportRadius / FIELD_LENGTH) * 100;
        const color = isHome ? 'rgba(234,255,0' : 'rgba(251,113,133';
        return (
          <g key={`rad-${isHome ? 'h' : 'a'}-${p.playerId}`}>
            <circle cx={px} cy={py} r={supportPct} fill="none" stroke={`${color},0.12)`} strokeWidth={0.08} strokeDasharray="0.3 0.2" />
            <circle cx={px} cy={py} r={actionPct} fill={`${color},0.04)`} stroke={`${color},0.22)`} strokeWidth={0.1} />
          </g>
        );
      })}

      {homePlayers.map((p) => {
        const wx = pitchPercentToWorld(p.x, p.y);
        const g12 = worldPositionToGrid12CodeForTeam(wx.x, wx.z, 'home', half);
        const z18 = worldPositionToTactical18ShortLabel(wx.x, wx.z, 'home', half);
        const third = getThird(wx, teamContext('home', half));
        const lane = getLane(wx);
        const dir = getSideAttackDir('home', half);
        const nudge = pitchTokenNudges?.get(`h:${p.playerId}`) ?? { dx: 0, dy: 0 };
        const px = (p.x >= 0 && p.x <= 1 ? p.x * 100 : p.x) + nudge.dx;
        const py = (p.y >= 0 && p.y <= 1 ? p.y * 100 : p.y) + nudge.dy;
        const { x2, y2 } = tacticalVisionArrowEndPercent({
          px,
          py,
          player: p,
          ballPercent,
          attackDir: dir,
        });
        const aimQ = tacticalPointingQuality01(p);
        const sfRole = sfRoleFromSlot(p.slotId);
        const shortLabel = `${p.slotId ?? '?'} · ${sfRole} · ${showZoneView ? z18 : g12}`;
        const detailLabel = `${shortLabel} · ${p.role} · ${THIRD_LABEL[third]} · ${LANE_LABEL[lane]} · pont${Math.round(aimQ * 100)}`;
        return (
          <g key={`h-${p.playerId}`}>
            <title>{detailLabel}</title>
            <line
              x1={px}
              y1={py}
              x2={x2}
              y2={y2}
              stroke="rgba(234,255,0,0.85)"
              strokeWidth={0.22}
              markerEnd={`url(#${arrowId})`}
            />
            <text
              x={px}
              y={py + 3.35}
              textAnchor="middle"
              fill="rgba(255,255,255,0.92)"
              fontSize={1.12}
              fontWeight={700}
              stroke="rgba(0,0,0,0.65)"
              strokeWidth={0.1}
              paintOrder="stroke"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {shortLabel}
            </text>
          </g>
        );
      })}

      {awayPlayers.map((p) => {
        const wx = pitchPercentToWorld(p.x, p.y);
        const g12 = worldPositionToGrid12CodeForTeam(wx.x, wx.z, 'away', half);
        const z18 = worldPositionToTactical18ShortLabel(wx.x, wx.z, 'away', half);
        const third = getThird(wx, teamContext('away', half));
        const lane = getLane(wx);
        const dir = getSideAttackDir('away', half);
        const nudge = pitchTokenNudges?.get(`a:${p.playerId}`) ?? { dx: 0, dy: 0 };
        const px = (p.x >= 0 && p.x <= 1 ? p.x * 100 : p.x) + nudge.dx;
        const py = (p.y >= 0 && p.y <= 1 ? p.y * 100 : p.y) + nudge.dy;
        const { x2, y2 } = tacticalVisionArrowEndPercent({
          px,
          py,
          player: p,
          ballPercent,
          attackDir: dir,
        });
        const aimQ = tacticalPointingQuality01(p);
        const shortLabel = `${p.slotId ?? '?'} · ${showZoneView ? z18 : g12}`;
        const detailLabel = `${shortLabel} · ${p.role} · ${THIRD_LABEL[third]} · ${LANE_LABEL[lane]} · pont${Math.round(aimQ * 100)}`;
        return (
          <g key={`a-${p.playerId}`}>
            <title>{detailLabel}</title>
            <line
              x1={px}
              y1={py}
              x2={x2}
              y2={y2}
              stroke="rgba(251,113,133,0.9)"
              strokeWidth={0.22}
              markerEnd={`url(#${arrowId})`}
            />
            <text
              x={px}
              y={py - 2.85}
              textAnchor="middle"
              fill="rgba(254,226,226,0.95)"
              fontSize={1.12}
              fontWeight={700}
              stroke="rgba(0,0,0,0.65)"
              strokeWidth={0.1}
              paintOrder="stroke"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const STORAGE_KEY = 'olefoot_live_tactical_layer';
const ZONE_VIEW_STORAGE_KEY = 'olefoot_live_zone_view_18';

export function loadTacticalLayerPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTacticalLayerPref(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadZoneView18Pref(): boolean {
  try {
    return localStorage.getItem(ZONE_VIEW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveZoneView18Pref(on: boolean): void {
  try {
    localStorage.setItem(ZONE_VIEW_STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
