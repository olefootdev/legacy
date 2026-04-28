import { useState, useMemo, useEffect, useRef } from 'react';

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
  cornerRadius: 18,
  frameWidth: 8,
};

const SLOT_COLS = 3;
const SLOT_ROWS = 3;
const SLOT_W = GOAL.w / SLOT_COLS;
const SLOT_H = GOAL.h / SLOT_ROWS;

const PICK_TIME_SECONDS = 8;
const SHOOTOUT_ROUNDS = 5;

type ShotResult = 'goal' | 'save' | 'pending';

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
  const [timeLeft, setTimeLeft] = useState(PICK_TIME_SECONDS);

  // Placar simulado da disputa (5 batedores cada lado)
  const [homeShots, setHomeShots] = useState<ShotResult[]>(['goal', 'goal', 'pending', 'pending', 'pending']);
  const [awayShots, setAwayShots] = useState<ShotResult[]>(['goal', 'save', 'pending', 'pending', 'pending']);
  const [currentShooter, setCurrentShooter] = useState(2); // batedor atual (0-indexed)

  const finishingRating = 78;
  const uncertaintyRadius = useMemo(() => {
    const base = 100 - finishingRating;
    return Math.max(8, base * 0.8);
  }, [finishingRating]);

  // Timer countdown durante a fase pick
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'pick') {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    setTimeLeft(PICK_TIME_SECONDS);
    tickRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // tempo zerado: força chute aleatório
          if (pickedSlot == null) {
            const auto = Math.floor(Math.random() * 9) as SlotIndex;
            setPickedSlot(auto);
            window.setTimeout(() => confirmShot(auto), 200);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function pickSlot(idx: SlotIndex) {
    if (phase !== 'pick') return;
    setPickedSlot(idx);
  }

  function confirmShot(slot?: SlotIndex) {
    const finalSlot = slot ?? pickedSlot;
    if (finalSlot == null) return;
    setPickedSlot(finalSlot);
    setPhase('reveal');
    const guess = Math.floor(Math.random() * 9) as SlotIndex;
    setKeeperSlot(guess);
    window.setTimeout(() => setPhase('result'), 1800);
  }

  function nextShooter() {
    const isGoal = pickedSlot != null && keeperSlot != null && pickedSlot !== keeperSlot;
    const result: ShotResult = isGoal ? 'goal' : 'save';
    const nextHome = [...homeShots];
    nextHome[currentShooter] = result;
    setHomeShots(nextHome);

    // Adversário também bate (simulado)
    if (currentShooter < SHOOTOUT_ROUNDS - 1) {
      const nextAway = [...awayShots];
      nextAway[currentShooter + 1] = Math.random() > 0.3 ? 'goal' : 'save';
      setAwayShots(nextAway);
    }

    setCurrentShooter((c) => Math.min(c + 1, SHOOTOUT_ROUNDS - 1));
    setPhase('pick');
    setPickedSlot(null);
    setKeeperSlot(null);
    setHoveredSlot(null);
  }

  function reset() {
    setPhase('pick');
    setPickedSlot(null);
    setKeeperSlot(null);
    setHoveredSlot(null);
    setHomeShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setAwayShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setCurrentShooter(0);
  }

  const isGoal = phase === 'result' && pickedSlot !== null && keeperSlot !== null && pickedSlot !== keeperSlot;
  const isSave = phase === 'result' && pickedSlot !== null && keeperSlot !== null && pickedSlot === keeperSlot;

  const pickRect = pickedSlot != null ? slotRect(pickedSlot) : null;
  const keeperRect = keeperSlot != null ? slotRect(keeperSlot) : null;

  const homeGoals = homeShots.filter((s) => s === 'goal').length;
  const awayGoals = awayShots.filter((s) => s === 'goal').length;

  return (
    <div className="min-h-screen bg-neon-yellow flex flex-col items-center pt-6 pb-12 px-6">
      {/* Header editorial */}
      <div className="w-full max-w-[820px] flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          Olefoot · Disputa de Pênaltis
        </div>
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          Batedor {currentShooter + 1} de {SHOOTOUT_ROUNDS}
        </div>
      </div>

      {/* Timer + Headline integrados */}
      <div className="w-full max-w-[820px] flex flex-col items-center mb-2">
        {/* Countdown timer cinematográfico */}
        <div className="flex items-baseline gap-3 mb-1">
          <div
            className={`font-display italic font-black leading-none tabular-nums transition-colors duration-200 ${
              timeLeft <= 3 && phase === 'pick' ? 'text-black animate-pulse' : 'text-black/85'
            }`}
            style={{ fontSize: 'clamp(48px, 7vw, 80px)' }}
          >
            {phase === 'pick' ? timeLeft.toString().padStart(2, '0') : '00'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-black/60 mb-3">
            seg
            <br />
            restantes
          </div>
        </div>

        {/* Headline editorial */}
        <h1
          className="ole-headline-italic text-black text-center"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.05 }}
        >
          {phase === 'pick' && (pickedSlot == null ? 'Onde mandamos ele bater?' : 'Confirma a mira?')}
          {phase === 'reveal' && 'O goleiro decide…'}
          {phase === 'result' && (isGoal ? 'GOOOL!' : 'DEFENDIDA')}
        </h1>
      </div>

      {/* Sub-info do batedor */}
      <div className="flex items-center gap-3 mb-4 text-black/80 text-[11px] uppercase tracking-[0.18em] flex-wrap justify-center">
        <span className="border border-black/40 px-2 py-1 bg-black text-neon-yellow">Adrien Ayo · #9</span>
        <span>Finalização {finishingRating}</span>
        <span className="text-black/50">|</span>
        <span>Goleiro lê bem o lado direito</span>
      </div>

      {/* SVG Goal */}
      <svg
        viewBox="0 0 800 540"
        className="w-full max-w-[820px] h-auto"
        style={{ filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.08))' }}
      >
        <defs>
          {/* Rede diagonal */}
          <pattern
            id="netPattern"
            x="0"
            y="0"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 22 22 M 22 0 L 0 22" stroke="#000" strokeWidth="0.6" opacity="0.18" />
          </pattern>
          <pattern
            id="netPatternVert"
            x="0"
            y="0"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 0 22 M 22 0 L 22 22" stroke="#000" strokeWidth="0.6" opacity="0.12" />
          </pattern>

          {/* Clip pra rede ficar dentro do gol arredondado */}
          <clipPath id="goalInside">
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
        <line x1="40" y1="400" x2="760" y2="400" stroke="#000" strokeWidth="2" opacity="0.5" />
        {/* Penalty spot */}
        <circle cx="400" cy="475" r="4" fill="#000" />
        <text
          x="400"
          y="498"
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing="3"
          fill="#000"
          opacity="0.55"
        >
          11M
        </text>

        {/* Rede dentro do gol (com clip nas bordas arredondadas) */}
        <g clipPath="url(#goalInside)">
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPattern)" />
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPatternVert)" />
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="black" opacity="0.04" />
        </g>

        {/* Slots clicáveis */}
        {([0, 1, 2, 3, 4, 5, 6, 7, 8] as SlotIndex[]).map((idx) => {
          const r = slotRect(idx);
          const isHover = hoveredSlot === idx && phase === 'pick';
          const isPicked = pickedSlot === idx;
          const isKeeper = keeperSlot === idx && phase !== 'pick';

          return (
            <g key={idx} clipPath="url(#goalInside)">
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
                onMouseEnter={() => phase === 'pick' && setHoveredSlot(idx)}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={() => pickSlot(idx)}
              />

              {isPicked && (
                <g transform={`translate(${r.cx}, ${r.cy})`}>
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#000" strokeWidth="2.5" />
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#000" strokeWidth="2.5" />
                  <circle cx="0" cy="0" r="4" fill="#000" />
                </g>
              )}

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

        {/* Cone de incerteza */}
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

        {/* Trajetória da bola */}
        {pickRect && phase !== 'pick' && (
          <line
            x1="400"
            y1="475"
            x2={pickRect.cx}
            y2={pickRect.cy}
            stroke="#000"
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

        {/* Trave arredondada (path único pra contornar bordas) */}
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

        {/* Bola — placeholder pro asset Legacy Tech do usuário */}
        {phase === 'pick' && (
          <g>
            {/* IMG slot: substituir por <image href="/assets/penalty-ball.svg" .../> quando o asset chegar */}
            <BallPlaceholder cx={400} cy={475} r={11} />
          </g>
        )}

        {phase === 'result' && pickRect && (
          <BallPlaceholder cx={pickRect.cx} cy={pickRect.cy} r={11} />
        )}

        {/* Selo de fase */}
        <text
          x="400"
          y="48"
          textAnchor="middle"
          fontSize="11"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          letterSpacing="6"
          fill="#000"
          opacity="0.55"
        >
          {phase === 'pick' && '— ESCOLHA A MIRA —'}
          {phase === 'reveal' && '— BATE —'}
          {phase === 'result' && (isGoal ? '— REDE —' : '— DEFESA —')}
        </text>
      </svg>

      {/* PLACAR DA DISPUTA */}
      <div className="w-full max-w-[820px] mt-4 mb-6 border-t-2 border-black/80 pt-4">
        <div className="grid grid-cols-3 items-center gap-4">
          {/* Time casa */}
          <div className="flex flex-col items-start gap-2">
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-black/70">
              BSC · Casa
            </div>
            <div className="flex items-center gap-2">
              {homeShots.map((s, i) => (
                <ShotDot key={i} result={s} active={i === currentShooter && phase !== 'result'} />
              ))}
            </div>
          </div>

          {/* Placar central */}
          <div className="flex items-center justify-center gap-3">
            <div
              className="font-display italic font-black text-black tabular-nums leading-none"
              style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}
            >
              {homeGoals}
            </div>
            <div className="text-black/50 text-3xl">—</div>
            <div
              className="font-display italic font-black text-black tabular-nums leading-none"
              style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}
            >
              {awayGoals}
            </div>
          </div>

          {/* Time visitante */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-black/70">
              ADV · Visitante
            </div>
            <div className="flex items-center gap-2">
              {awayShots.map((s, i) => (
                <ShotDot key={i} result={s} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex gap-3">
        {phase === 'pick' && pickedSlot != null && (
          <button
            onClick={() => confirmShot()}
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
          <>
            <button
              onClick={nextShooter}
              className="bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all"
            >
              Próximo batedor
            </button>
            <button
              onClick={reset}
              className="bg-transparent border-2 border-black text-black px-6 py-3 font-display font-bold uppercase tracking-wider hover:bg-black hover:text-neon-yellow transition-all"
            >
              Reiniciar
            </button>
          </>
        )}
      </div>

      {/* Debug */}
      <div className="mt-8 text-[10px] uppercase tracking-[0.25em] text-black/50 max-w-[820px] text-center leading-relaxed">
        Preview · Manager escolhe slot em {PICK_TIME_SECONDS}s · IA do goleiro placeholder (random)
        <br />
        Bola é placeholder — substituir por asset Legacy Tech via &lt;image href="/assets/penalty-ball.svg"/&gt;
      </div>
    </div>
  );
}

// Placeholder visual da bola até o usuário gerar o asset
function BallPlaceholder({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#000" strokeWidth="2" />
      {/* Pentágonos estilizados (placeholder até o asset oficial) */}
      <polygon
        points={`${cx},${cy - r * 0.55} ${cx + r * 0.5},${cy - r * 0.15} ${cx + r * 0.3},${cy + r * 0.45} ${cx - r * 0.3},${cy + r * 0.45} ${cx - r * 0.5},${cy - r * 0.15}`}
        fill="#000"
      />
    </g>
  );
}

// Bolinha do placar — preenchido = gol, X = erro, vazio = pendente
function ShotDot({ result, active = false }: { result: ShotResult; active?: boolean }) {
  if (result === 'goal') {
    return (
      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-neon-yellow" />
      </div>
    );
  }
  if (result === 'save') {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center">
        <svg viewBox="0 0 12 12" className="w-3 h-3">
          <line x1="2" y1="2" x2="10" y2="10" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="10" y1="2" x2="2" y2="10" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={`w-5 h-5 rounded-full border-2 ${active ? 'border-black animate-pulse bg-black/10' : 'border-black/30'}`}
    />
  );
}

export default PenaltyPreview;
