import { useMemo } from 'react';
import {
  BALL_SIZE_FLY_END,
  BALL_SIZE_MARCA,
  BALL_SIZE_RESULT,
  GOAL,
  SLOT_H,
  SLOT_LABELS,
  SLOT_W,
  SPOT,
  VIEW_H,
  VIEW_W,
  slotRect,
} from './constants';
import { LegacyBall, LegacyBallFlying, trailStrokeWidth } from './LegacyBall';
import type {
  PenaltyOutcome,
  PenaltyPhase,
  PenaltyShootResult,
  SlotIndex,
} from './types';

interface PenaltyShootSVGProps {
  phase: PenaltyPhase;
  pickedSlot: SlotIndex | null;
  hoveredSlot: SlotIndex | null;
  keeperSlot: SlotIndex | null;
  outcome: PenaltyOutcome | null;
  landing: { x: number; y: number } | null;
  shotPower: number;
  finalRotation: number;
  finishingRating: number; // pra calcular cone de incerteza no preview
  onSlotHoverChange: (idx: SlotIndex | null) => void;
  onSlotPointerDown: (idx: SlotIndex) => void;
}

/**
 * SVG visual completo do pênalti: gol arredondado + rede + 9 slots + bola + rastro.
 * Recebe estado externo (controlled). Não tem lógica própria — só desenha.
 */
export function PenaltyShootSVG({
  phase,
  pickedSlot,
  hoveredSlot,
  keeperSlot,
  outcome,
  landing,
  shotPower,
  finalRotation,
  finishingRating,
  onSlotHoverChange,
  onSlotPointerDown,
}: PenaltyShootSVGProps) {
  const pickRect = pickedSlot != null ? slotRect(pickedSlot) : null;

  const uncertaintyRadius = useMemo(() => {
    const base = 100 - finishingRating;
    return Math.max(8, base * 0.8);
  }, [finishingRating]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full max-w-[920px] h-auto"
      style={{
        filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.08))',
        maxHeight: 'min(42dvh, 320px)',
      }}
    >
      <defs>
        <pattern id="penalty-net-diag" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 22 22 M 22 0 L 0 22" stroke="#000" strokeWidth="0.6" opacity="0.18" />
        </pattern>
        <pattern id="penalty-net-vert" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 0 22 M 22 0 L 22 22" stroke="#000" strokeWidth="0.6" opacity="0.12" />
        </pattern>
        <clipPath id="penalty-goal-inside">
          <rect
            x={GOAL.x}
            y={GOAL.y}
            width={GOAL.w}
            height={GOAL.h}
            rx={GOAL.cornerRadius}
            ry={GOAL.cornerRadius}
          />
        </clipPath>
      </defs>

      {/* Linha do gramado */}
      <line
        x1="20"
        y1={GOAL.y + GOAL.h + 60}
        x2={VIEW_W - 20}
        y2={GOAL.y + GOAL.h + 60}
        stroke="#000"
        strokeWidth="2"
        opacity="0.5"
      />

      {/* Penalty spot */}
      <circle cx={SPOT.x} cy={SPOT.y} r="5" fill="#000" />
      <text
        x={SPOT.x + 90}
        y={SPOT.y + 4}
        textAnchor="start"
        fontSize="10"
        fontFamily="monospace"
        fontWeight="700"
        letterSpacing="3"
        fill="#000"
        opacity="0.5"
      >
        11M
      </text>

      {/* Rede */}
      <g clipPath="url(#penalty-goal-inside)">
        <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#penalty-net-diag)" />
        <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#penalty-net-vert)" />
        <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="black" opacity="0.04" />
      </g>

      {/* 9 slots interativos */}
      {([0, 1, 2, 3, 4, 5, 6, 7, 8] as SlotIndex[]).map((idx) => {
        const r = slotRect(idx);
        const isHover = hoveredSlot === idx && phase === 'pick';
        const isPicked = pickedSlot === idx;
        const isKeeper = keeperSlot === idx && (phase === 'reveal' || phase === 'result');

        return (
          <g key={idx} clipPath="url(#penalty-goal-inside)">
            <rect
              x={r.x + 2}
              y={r.y + 2}
              width={SLOT_W - 4}
              height={SLOT_H - 4}
              fill={isPicked ? '#FDE100' : isHover ? '#FDE100' : 'transparent'}
              fillOpacity={isPicked ? 0.85 : isHover ? 0.18 : 0}
              stroke={isPicked ? '#000' : isHover ? '#000' : 'transparent'}
              strokeWidth={isPicked ? 3 : 1.5}
              strokeDasharray={isHover && !isPicked ? '6 4' : undefined}
              style={{
                cursor: phase === 'pick' ? 'crosshair' : 'default',
                transition: 'fill-opacity 120ms, stroke-width 120ms',
              }}
              onMouseEnter={() => phase === 'pick' && onSlotHoverChange(idx)}
              onMouseLeave={() => onSlotHoverChange(null)}
              onPointerDown={(e) => {
                if (phase === 'pick') {
                  e.preventDefault();
                  onSlotPointerDown(idx);
                }
              }}
            />

            {isPicked && (
              <g transform={`translate(${r.cx}, ${r.cy})`}>
                <line x1="-14" y1="0" x2="14" y2="0" stroke="#000" strokeWidth="3" />
                <line x1="0" y1="-14" x2="0" y2="14" stroke="#000" strokeWidth="3" />
                <circle cx="0" cy="0" r="5" fill="#000" />
              </g>
            )}

            {isHover && !isPicked && (
              <text
                x={r.cx}
                y={r.cy + 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="ui-sans-serif, system-ui"
                fontWeight="700"
                letterSpacing="2"
                fill="#000"
                opacity="0.85"
              >
                {SLOT_LABELS[idx]}
              </text>
            )}

            {isKeeper && (
              <g transform={`translate(${r.cx}, ${r.cy})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={Math.min(SLOT_W, SLOT_H) * 0.45}
                  fill="#000"
                  opacity="0.85"
                >
                  <animate
                    attributeName="r"
                    from="6"
                    to={Math.min(SLOT_W, SLOT_H) * 0.45}
                    dur="0.4s"
                    fill="freeze"
                  />
                </circle>
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  fontSize="13"
                  fontFamily="ui-sans-serif, system-ui"
                  fontWeight="800"
                  letterSpacing="2"
                  fill="#FDE100"
                >
                  GK
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Cone de incerteza durante pick */}
      {pickRect && phase === 'pick' && (
        <circle
          cx={pickRect.cx}
          cy={pickRect.cy}
          r={uncertaintyRadius}
          fill="none"
          stroke="#000"
          strokeWidth="1.4"
          strokeDasharray="3 3"
          opacity="0.4"
        />
      )}

      {/* Trave arredondada */}
      <path
        d={`
          M ${GOAL.x},${GOAL.y + GOAL.h}
          L ${GOAL.x},${GOAL.y + GOAL.cornerRadius}
          Q ${GOAL.x},${GOAL.y} ${GOAL.x + GOAL.cornerRadius},${GOAL.y}
          L ${GOAL.x + GOAL.w - GOAL.cornerRadius},${GOAL.y}
          Q ${GOAL.x + GOAL.w},${GOAL.y} ${GOAL.x + GOAL.w},${GOAL.y + GOAL.cornerRadius}
          L ${GOAL.x + GOAL.w},${GOAL.y + GOAL.h}
        `}
        stroke="#000"
        strokeWidth={GOAL.frameWidth}
        strokeLinecap="round"
        fill="none"
      />

      {/* Rastro técnico (uma só linha, contínua de reveal a result) */}
      {(phase === 'reveal' || phase === 'result') && landing && (
        <line
          x1={SPOT.x}
          y1={SPOT.y}
          x2={landing.x}
          y2={landing.y}
          stroke="#000"
          strokeWidth={trailStrokeWidth(shotPower)}
          strokeLinecap="round"
          opacity="0.92"
        />
      )}

      {/* Bola */}
      {(phase === 'pick' || phase === 'charging') && (
        <LegacyBall
          cx={SPOT.x}
          cy={SPOT.y}
          size={BALL_SIZE_MARCA}
          jitter={phase === 'charging'}
        />
      )}
      {phase === 'reveal' && landing && (
        <LegacyBallFlying
          from={SPOT}
          to={landing}
          startSize={BALL_SIZE_MARCA}
          endSize={BALL_SIZE_FLY_END}
          durationMs={shotPower > 0.88 ? 320 : shotPower > 0.32 ? 380 : 520}
          power={shotPower}
          endRotation={finalRotation}
        />
      )}
      {phase === 'result' && landing && (
        <LegacyBall
          cx={landing.x}
          cy={landing.y}
          size={BALL_SIZE_RESULT}
          rotation={finalRotation}
          showShadow={outcome !== 'goal' && outcome !== 'post' && outcome !== 'over-bar'}
        />
      )}

      {/* Selo de fase */}
      <text
        x={VIEW_W / 2}
        y="32"
        textAnchor="middle"
        fontSize="11"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="700"
        letterSpacing="6"
        fill="#000"
        opacity="0.55"
      >
        {phase === 'pick' && '— ESCOLHA A MIRA —'}
        {phase === 'charging' && '— CARREGANDO FORÇA —'}
        {phase === 'reveal' && '— BATE —'}
        {phase === 'result' &&
          (outcome === 'over-bar'
            ? '— POR CIMA —'
            : outcome === 'post'
              ? '— TRAVE —'
              : outcome === 'wide'
                ? '— PRA FORA —'
                : outcome === 'weak-save'
                  ? '— ERRO · FRACO —'
                  : outcome === 'save'
                    ? '— DEFESA —'
                    : '')}
      </text>
    </svg>
  );
}
