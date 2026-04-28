import { useState, useMemo } from 'react';

type SlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const SLOT_LABELS: Record<SlotIndex, string> = {
  0: 'ALTA ESQ',
  1: 'ALTA MEIO',
  2: 'ALTA DIR',
  3: 'MEIO ESQ',
  4: 'MEIO',
  5: 'MEIO DIR',
  6: 'BAIXA ESQ',
  7: 'BAIXA MEIO',
  8: 'BAIXA DIR',
};

// Geometria da trave (em coords do SVG)
const GOAL = {
  x: 100,
  y: 80,
  w: 600,
  h: 220,
};

const SLOT_COLS = 3;
const SLOT_ROWS = 3;
const SLOT_W = GOAL.w / SLOT_COLS;
const SLOT_H = GOAL.h / SLOT_ROWS;

function slotRect(idx: SlotIndex) {
  const col = idx % SLOT_COLS;
  const row = Math.floor(idx / SLOT_COLS);
  return {
    x: GOAL.x + col * SLOT_W,
    y: GOAL.y + row * SLOT_H,
    cx: GOAL.x + col * SLOT_W + SLOT_W / 2,
    cy: GOAL.y + row * SLOT_H + SLOT_H / 2,
  };
}

type Phase = 'pick' | 'reveal' | 'result';

export function PenaltyPreview() {
  const [phase, setPhase] = useState<Phase>('pick');
  const [hoveredSlot, setHoveredSlot] = useState<SlotIndex | null>(null);
  const [pickedSlot, setPickedSlot] = useState<SlotIndex | null>(null);
  const [keeperSlot, setKeeperSlot] = useState<SlotIndex | null>(null);

  // Atributo simulado do batedor (90 = quase preciso, 60 = drift maior)
  const finishingRating = 78;
  const uncertaintyRadius = useMemo(() => {
    // Quanto pior o atributo, maior o cone
    const base = 100 - finishingRating;
    return Math.max(8, base * 0.8);
  }, [finishingRating]);

  function pickSlot(idx: SlotIndex) {
    if (phase !== 'pick') return;
    setPickedSlot(idx);
  }

  function confirmShot() {
    if (pickedSlot == null) return;
    setPhase('reveal');
    // Goleiro chuta um slot aleatório (poderia usar perfil/atributos)
    const guess = Math.floor(Math.random() * 9) as SlotIndex;
    setKeeperSlot(guess);
    setTimeout(() => setPhase('result'), 1800);
  }

  function reset() {
    setPhase('pick');
    setPickedSlot(null);
    setKeeperSlot(null);
    setHoveredSlot(null);
  }

  const isGoal = phase === 'result' && pickedSlot !== null && pickedSlot !== keeperSlot;
  const isSave = phase === 'result' && pickedSlot !== null && pickedSlot === keeperSlot;

  const pickRect = pickedSlot != null ? slotRect(pickedSlot) : null;
  const keeperRect = keeperSlot != null ? slotRect(keeperSlot) : null;

  return (
    <div className="min-h-screen bg-neon-yellow flex flex-col items-center pt-8 pb-16 px-6">
      {/* Header editorial */}
      <div className="w-full max-w-[820px] flex items-baseline justify-between mb-6">
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          Olefoot · Pênalti · Preview
        </div>
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          90:00 · BSC 0–0 ADV
        </div>
      </div>

      {/* Headline editorial */}
      <h1
        className="ole-headline-italic text-black text-center mb-2"
        style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05 }}
      >
        {phase === 'pick' && (pickedSlot == null ? 'Onde mandamos ele bater?' : 'Confirma a mira?')}
        {phase === 'reveal' && 'O goleiro decide…'}
        {phase === 'result' && (isGoal ? 'GOOOL!' : 'DEFENDIDA')}
      </h1>

      {/* Sub-info do batedor */}
      <div className="flex items-center gap-4 mb-6 text-black/80 text-[11px] uppercase tracking-[0.18em]">
        <span className="border border-black/40 px-2 py-1">Adrien Ayo · #9</span>
        <span>Finalização {finishingRating}</span>
        <span className="text-black/50">|</span>
        <span>Goleiro lê bem o lado direito</span>
      </div>

      {/* SVG Goal */}
      <svg
        viewBox="0 0 800 500"
        className="w-full max-w-[820px] h-auto"
        style={{ filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.08))' }}
      >
        {/* Network pattern (rede) */}
        <defs>
          <pattern
            id="netPattern"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 20 20 M 20 0 L 0 20" stroke="#000" strokeWidth="0.6" opacity="0.18" />
          </pattern>
          <pattern
            id="netPatternVert"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 0 20 M 20 0 L 20 20" stroke="#000" strokeWidth="0.6" opacity="0.12" />
          </pattern>
        </defs>

        {/* Linha do gramado */}
        <line x1="40" y1="380" x2="760" y2="380" stroke="#000" strokeWidth="2" opacity="0.6" />
        {/* Penalty spot (marca de pênalti) */}
        <circle cx="400" cy="450" r="4" fill="#000" />
        {/* Marca tipográfica do penalty */}
        <text
          x="400"
          y="475"
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing="3"
          fill="#000"
          opacity="0.6"
        >
          11M
        </text>

        {/* Rede dentro do gol */}
        <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPattern)" />
        <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPatternVert)" />

        {/* Sombra dentro do gol (profundidade) */}
        <rect
          x={GOAL.x}
          y={GOAL.y}
          width={GOAL.w}
          height={GOAL.h}
          fill="black"
          opacity="0.04"
        />

        {/* Slots (9 áreas clicáveis) */}
        {([0, 1, 2, 3, 4, 5, 6, 7, 8] as SlotIndex[]).map((idx) => {
          const r = slotRect(idx);
          const isHover = hoveredSlot === idx && phase === 'pick';
          const isPicked = pickedSlot === idx;
          const isKeeper = keeperSlot === idx && phase !== 'pick';

          return (
            <g key={idx}>
              <rect
                x={r.x + 2}
                y={r.y + 2}
                width={SLOT_W - 4}
                height={SLOT_H - 4}
                fill={
                  isPicked
                    ? '#FDE100'
                    : isHover
                      ? '#FDE100'
                      : 'transparent'
                }
                fillOpacity={isPicked ? 0.85 : isHover ? 0.18 : 0}
                stroke={isPicked ? '#000' : isHover ? '#000' : 'transparent'}
                strokeWidth={isPicked ? 3 : 1.5}
                strokeDasharray={isHover && !isPicked ? '6 4' : undefined}
                style={{
                  cursor: phase === 'pick' ? 'crosshair' : 'default',
                  transition: 'fill-opacity 120ms, stroke-width 120ms',
                }}
                onMouseEnter={() => phase === 'pick' && setHoveredSlot(idx)}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={() => pickSlot(idx)}
              />

              {/* Cross-hair central no slot escolhido */}
              {isPicked && (
                <g transform={`translate(${r.cx}, ${r.cy})`}>
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#000" strokeWidth="2.5" />
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#000" strokeWidth="2.5" />
                  <circle cx="0" cy="0" r="4" fill="#000" />
                </g>
              )}

              {/* Label do slot no hover */}
              {isHover && !isPicked && (
                <text
                  x={r.cx}
                  y={r.cy + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="ui-sans-serif, system-ui"
                  fontWeight="700"
                  letterSpacing="2"
                  fill="#000"
                  opacity="0.85"
                >
                  {SLOT_LABELS[idx]}
                </text>
              )}

              {/* Goleiro no slot que ele defendeu */}
              {isKeeper && (
                <g transform={`translate(${r.cx}, ${r.cy})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.min(SLOT_W, SLOT_H) * 0.42}
                    fill="#000"
                    opacity="0.85"
                  >
                    <animate
                      attributeName="r"
                      from="6"
                      to={Math.min(SLOT_W, SLOT_H) * 0.42}
                      dur="0.4s"
                      fill="freeze"
                    />
                  </circle>
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fontSize="11"
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

        {/* Cone de incerteza (preview do drift baseado em finalização) */}
        {pickRect && phase === 'pick' && (
          <circle
            cx={pickRect.cx}
            cy={pickRect.cy}
            r={uncertaintyRadius}
            fill="none"
            stroke="#000"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.4"
          />
        )}

        {/* Trajetória da bola (na fase reveal/result) */}
        {pickRect && phase !== 'pick' && (
          <line
            x1="400"
            y1="450"
            x2={pickRect.cx}
            y2={pickRect.cy}
            stroke={isGoal ? '#000' : '#000'}
            strokeWidth="3"
            strokeDasharray="8 4"
            strokeLinecap="round"
            opacity={isSave ? 0.4 : 0.85}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="80"
              to="0"
              dur="0.5s"
              fill="freeze"
            />
          </line>
        )}

        {/* Bola na marca de pênalti (estado pick) */}
        {phase === 'pick' && (
          <g>
            <circle cx="400" cy="450" r="9" fill="white" stroke="#000" strokeWidth="2" />
            <path
              d="M 397 444 L 403 444 L 405 450 L 403 456 L 397 456 L 395 450 Z"
              fill="#000"
              opacity="0.85"
            />
          </g>
        )}

        {/* Bola final (no slot ou defendida) */}
        {pickRect && phase === 'result' && (
          <g transform={`translate(${pickRect.cx}, ${pickRect.cy})`}>
            <circle
              cx={isSave ? 0 : 0}
              cy={isSave ? 0 : 0}
              r="9"
              fill="white"
              stroke="#000"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Trave (frame por cima — z-index visual) */}
        {/* Trave horizontal superior */}
        <line
          x1={GOAL.x - 4}
          y1={GOAL.y}
          x2={GOAL.x + GOAL.w + 4}
          y2={GOAL.y}
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="square"
        />
        {/* Trave vertical esquerda */}
        <line
          x1={GOAL.x}
          y1={GOAL.y}
          x2={GOAL.x}
          y2={GOAL.y + GOAL.h}
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="square"
        />
        {/* Trave vertical direita */}
        <line
          x1={GOAL.x + GOAL.w}
          y1={GOAL.y}
          x2={GOAL.x + GOAL.w}
          y2={GOAL.y + GOAL.h}
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="square"
        />

        {/* Selo de fase */}
        <text
          x="400"
          y="40"
          textAnchor="middle"
          fontSize="11"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          letterSpacing="6"
          fill="#000"
          opacity="0.6"
        >
          {phase === 'pick' && '— ESCOLHA A MIRA —'}
          {phase === 'reveal' && '— BATE —'}
          {phase === 'result' && (isGoal ? '— REDE —' : '— DEFESA —')}
        </text>
      </svg>

      {/* Controles */}
      <div className="mt-8 flex gap-3">
        {phase === 'pick' && pickedSlot != null && (
          <button
            onClick={confirmShot}
            className="bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all"
          >
            Confirmar chute
          </button>
        )}
        {phase === 'pick' && pickedSlot == null && (
          <div className="text-black/60 text-sm uppercase tracking-[0.2em]">
            Clique num dos 9 slots
          </div>
        )}
        {phase === 'result' && (
          <button
            onClick={reset}
            className="bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all"
          >
            Bater de novo
          </button>
        )}
      </div>

      {/* Debug info */}
      <div className="mt-12 text-[10px] uppercase tracking-[0.25em] text-black/50 max-w-[820px] text-center leading-relaxed">
        Preview do conceito · Manager escolhe o slot · IA do goleiro escolhe slot aleatório (placeholder)
        <br />
        Cone tracejado = drift baseado na finalização do batedor · Slot amarelo + cross-hair = mira confirmada
      </div>
    </div>
  );
}

export default PenaltyPreview;
