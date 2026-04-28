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

// Câmera mais perto da bola — gol maior, ocupa mais da viewBox
const VIEW_W = 800;
const VIEW_H = 560;
const GOAL = {
  x: 50,
  y: 60,
  w: 700,
  h: 280,
  cornerRadius: 22,
  frameWidth: 10,
};

const SLOT_COLS = 3;
const SLOT_ROWS = 3;
const SLOT_W = GOAL.w / SLOT_COLS;
const SLOT_H = GOAL.h / SLOT_ROWS;

// Bola gigante na marca (foreground bem próximo)
const BALL_SIZE_MARCA = 110;
const BALL_SIZE_FLY_END = 60;
const BALL_SIZE_RESULT = 60;

// Penalty spot bem para frente (sensação de proximidade)
const SPOT = { x: VIEW_W / 2, y: 510 };

const PICK_TIME_SECONDS = 7;
const POWER_RAMP_MS = 950; // tempo pra encher 0→1
const POWER_SWEET_LOW = 0.32;
const POWER_SWEET_HIGH = 0.88;
const SHOOTOUT_ROUNDS = 5;

type ShotResult = 'goal' | 'save' | 'pending';
type Phase = 'pick' | 'charging' | 'reveal' | 'result';
type Outcome = 'goal' | 'save' | 'over-bar' | 'post' | 'wide';

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

export function PenaltyPreview() {
  const [phase, setPhase] = useState<Phase>('pick');
  const [hoveredSlot, setHoveredSlot] = useState<SlotIndex | null>(null);
  const [pickedSlot, setPickedSlot] = useState<SlotIndex | null>(null);
  const [keeperSlot, setKeeperSlot] = useState<SlotIndex | null>(null);
  const [timeLeft, setTimeLeft] = useState(PICK_TIME_SECONDS);

  // Power bar
  const [power, setPower] = useState(0);
  const [shotPower, setShotPower] = useState(0);
  const powerRafRef = useRef<number | null>(null);
  const powerStartRef = useRef<number | null>(null);

  // Outcome após reveal
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [landing, setLanding] = useState<{ x: number; y: number } | null>(null);

  // Placar simulado da disputa
  const [homeShots, setHomeShots] = useState<ShotResult[]>([
    'goal',
    'goal',
    'pending',
    'pending',
    'pending',
  ]);
  const [awayShots, setAwayShots] = useState<ShotResult[]>([
    'goal',
    'save',
    'pending',
    'pending',
    'pending',
  ]);
  const [currentShooter, setCurrentShooter] = useState(2);

  const finishingRating = 78;
  const uncertaintyRadius = useMemo(() => {
    const base = 100 - finishingRating;
    return Math.max(8, base * 0.8);
  }, [finishingRating]);

  // Timer countdown
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
          // Tempo zerado: chuta no centro com força fraca
          if (pickedSlot == null) {
            const auto: SlotIndex = 4;
            setPickedSlot(auto);
            window.setTimeout(() => fireShotWith(auto, 0.4), 120);
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

  // Pointer up global pra disparar o chute quando solta o botão
  useEffect(() => {
    function handleUp() {
      if (phase === 'charging' && pickedSlot != null) {
        fireShotWith(pickedSlot, power);
      }
    }
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickedSlot, power]);

  function startCharge(idx: SlotIndex) {
    if (phase !== 'pick') return;
    setPickedSlot(idx);
    setPhase('charging');
    setPower(0);
    powerStartRef.current = performance.now();

    function tick(now: number) {
      if (powerStartRef.current == null) return;
      const elapsed = now - powerStartRef.current;
      const p = Math.min(1, elapsed / POWER_RAMP_MS);
      setPower(p);
      if (p < 1) {
        powerRafRef.current = requestAnimationFrame(tick);
      } else {
        // Auto-fire ao chegar em 100% (super-power)
        fireShotWith(idx, 1);
      }
    }
    powerRafRef.current = requestAnimationFrame(tick);
  }

  function fireShotWith(slot: SlotIndex, finalPower: number) {
    if (powerRafRef.current) cancelAnimationFrame(powerRafRef.current);
    powerStartRef.current = null;
    setShotPower(finalPower);
    setPickedSlot(slot);
    setPhase('reveal');

    const guess = Math.floor(Math.random() * 9) as SlotIndex;
    setKeeperSlot(guess);

    // ── Resolução com posição final coerente ──
    const target = slotRect(slot);

    // Drift baseado em finalização + força fora da zona doce
    // Quanto pior o atributo, maior o desvio. Força extrema também desvia.
    const finishingFactor = 1 - finishingRating / 100; // 0..1
    const powerWobble =
      finalPower < POWER_SWEET_LOW
        ? 0.6 // chute fraco oscila
        : finalPower > POWER_SWEET_HIGH
          ? 0.9 // chute forte demais é instável
          : 0.25; // zona doce, drift mínimo
    const driftMag = (finishingFactor + powerWobble) * 28;
    const driftX = (Math.random() - 0.5) * 2 * driftMag;
    const driftY = (Math.random() - 0.5) * 2 * driftMag;

    let finalX = target.cx + driftX;
    let finalY = target.cy + driftY;
    let result: Outcome;

    // 1. Por cima do travessão (força > 88%)
    if (finalPower > POWER_SWEET_HIGH) {
      result = 'over-bar';
      finalX = target.cx + driftX * 0.4;
      finalY = GOAL.y - 50 - Math.random() * 30;
      setOutcome(result);
      setLanding({ x: finalX, y: finalY });
      window.setTimeout(() => setPhase('result'), 950);
      return;
    }

    // 2. Detecção de trave — se a posição final estiver dentro da margem do frame
    const POST_TOLERANCE = GOAL.frameWidth + 6; // ~16px
    const distLeft = Math.abs(finalX - GOAL.x);
    const distRight = Math.abs(finalX - (GOAL.x + GOAL.w));
    const distTop = Math.abs(finalY - GOAL.y);
    const insideVerticalRange = finalY >= GOAL.y - 4 && finalY <= GOAL.y + GOAL.h + 4;
    const insideHorizontalRange = finalX >= GOAL.x - 4 && finalX <= GOAL.x + GOAL.w + 4;

    const onLeftPost = distLeft < POST_TOLERANCE && insideVerticalRange;
    const onRightPost = distRight < POST_TOLERANCE && insideVerticalRange;
    const onCrossbar = distTop < POST_TOLERANCE && insideHorizontalRange;

    if (onLeftPost || onRightPost || onCrossbar) {
      // Snap visual à trave (bola encosta no frame)
      if (onLeftPost) finalX = GOAL.x;
      else if (onRightPost) finalX = GOAL.x + GOAL.w;
      if (onCrossbar) finalY = GOAL.y;
      result = 'post';
      setOutcome(result);
      setLanding({ x: finalX, y: finalY });
      window.setTimeout(() => setPhase('result'), 950);
      return;
    }

    // 3. Para fora — drift mandou pra além do gol
    const insideGoal =
      finalX > GOAL.x + 2 &&
      finalX < GOAL.x + GOAL.w - 2 &&
      finalY > GOAL.y + 2 &&
      finalY < GOAL.y + GOAL.h - 2;
    if (!insideGoal) {
      result = 'wide';
      setOutcome(result);
      setLanding({ x: finalX, y: finalY });
      window.setTimeout(() => setPhase('result'), 950);
      return;
    }

    // 4. Dentro do gol — força fraca sempre vai no goleiro
    if (finalPower < POWER_SWEET_LOW) {
      result = 'save';
      // Bola lenta, posição final no slot escolhido (goleiro pega ali)
      setOutcome(result);
      setLanding({ x: target.cx, y: target.cy });
      window.setTimeout(() => setPhase('result'), 950);
      return;
    }

    // 5. Goleiro acertou o slot? Defesa.
    if (slot === guess) {
      result = 'save';
    } else {
      result = 'goal';
    }
    setOutcome(result);
    setLanding({ x: finalX, y: finalY });
    window.setTimeout(() => setPhase('result'), 950);
  }

  function nextShooter() {
    const isGoal = outcome === 'goal';
    const result: ShotResult = isGoal ? 'goal' : 'save';
    const nextHome = [...homeShots];
    nextHome[currentShooter] = result;
    setHomeShots(nextHome);

    if (currentShooter < SHOOTOUT_ROUNDS - 1) {
      const nextAway = [...awayShots];
      nextAway[currentShooter + 1] = Math.random() > 0.3 ? 'goal' : 'save';
      setAwayShots(nextAway);
    }

    setCurrentShooter((c) => Math.min(c + 1, SHOOTOUT_ROUNDS - 1));
    softReset();
  }

  function softReset() {
    setPhase('pick');
    setPickedSlot(null);
    setKeeperSlot(null);
    setHoveredSlot(null);
    setPower(0);
    setShotPower(0);
    setOutcome(null);
    setLanding(null);
  }

  function fullReset() {
    softReset();
    setHomeShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setAwayShots(['pending', 'pending', 'pending', 'pending', 'pending']);
    setCurrentShooter(0);
  }

  const pickRect = pickedSlot != null ? slotRect(pickedSlot) : null;
  const homeGoals = homeShots.filter((s) => s === 'goal').length;
  const awayGoals = awayShots.filter((s) => s === 'goal').length;

  // Tom da power bar
  const powerTone =
    power > POWER_SWEET_HIGH ? '#ef4444' : power > POWER_SWEET_LOW ? '#FDE100' : '#999';
  const powerLabel =
    power > POWER_SWEET_HIGH
      ? 'DEMAIS!'
      : power > POWER_SWEET_LOW
        ? power > 0.6
          ? 'PURA PANCADA'
          : 'BOM'
        : 'FRACO';

  // Headline contextual
  const headline = (() => {
    if (phase === 'pick') return pickedSlot == null ? 'Onde mandamos ele bater?' : 'Confirma a mira?';
    if (phase === 'charging') return 'SEGURA… CARREGA…';
    if (phase === 'reveal') return 'CHUTA!';
    // result
    if (outcome === 'goal') return 'GOOOL!';
    if (outcome === 'over-bar') return 'POR CIMA!';
    if (outcome === 'post') return 'NA TRAVE!';
    if (outcome === 'wide') return 'PRA FORA!';
    return 'DEFENDIDA';
  })();

  return (
    <div
      className="min-h-screen bg-neon-yellow flex flex-col items-center pt-6 pb-12 px-6 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Header editorial */}
      <div className="w-full max-w-[920px] flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          Olefoot · Disputa de Pênaltis
        </div>
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          Batedor {currentShooter + 1} de {SHOOTOUT_ROUNDS}
        </div>
      </div>

      {/* Timer (sem rótulo "seg restantes") */}
      <div className="w-full max-w-[920px] flex flex-col items-center mb-1">
        <div
          className={`font-display italic font-black leading-none tabular-nums transition-colors duration-200 ${
            timeLeft <= 3 && phase === 'pick' ? 'text-black animate-pulse' : 'text-black/85'
          }`}
          style={{ fontSize: 'clamp(56px, 9vw, 96px)' }}
        >
          {phase === 'pick' ? timeLeft.toString().padStart(2, '0') : '00'}
        </div>

        {/* Headline editorial */}
        <h1
          className="ole-headline-italic text-black text-center mt-2"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.05 }}
        >
          {headline}
        </h1>
      </div>

      {/* Sub-info */}
      <div className="flex items-center gap-3 mb-3 text-black/80 text-[11px] uppercase tracking-[0.18em] flex-wrap justify-center">
        <span className="border border-black/40 px-2 py-1 bg-black text-neon-yellow">
          Adrien Ayo · #9
        </span>
        <span>Finalização {finishingRating}</span>
        <span className="text-black/50">|</span>
        <span>Goleiro lê bem o lado direito</span>
      </div>

      {/* SVG Goal */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full max-w-[920px] h-auto"
        style={{ filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.08))' }}
      >
        <defs>
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

        {/* Rede dentro do gol */}
        <g clipPath="url(#goalInside)">
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPattern)" />
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="url(#netPatternVert)" />
          <rect x={GOAL.x} y={GOAL.y} width={GOAL.w} height={GOAL.h} fill="black" opacity="0.04" />
        </g>

        {/* Slots clicáveis (com pointerdown pra começar a carregar força) */}
        {([0, 1, 2, 3, 4, 5, 6, 7, 8] as SlotIndex[]).map((idx) => {
          const r = slotRect(idx);
          const isHover = hoveredSlot === idx && phase === 'pick';
          const isPicked = pickedSlot === idx;
          const isKeeper = keeperSlot === idx && (phase === 'reveal' || phase === 'result');

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
                onPointerDown={(e) => {
                  if (phase === 'pick') {
                    e.preventDefault();
                    startCharge(idx);
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

        {/* Cone de incerteza */}
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

        {/* Bola */}
        {(phase === 'pick' || phase === 'charging') && (
          <LegacyBall cx={SPOT.x} cy={SPOT.y} size={BALL_SIZE_MARCA} jitter={phase === 'charging'} />
        )}
        {phase === 'reveal' && landing && (
          <LegacyBallFlying
            from={SPOT}
            to={landing}
            startSize={BALL_SIZE_MARCA}
            endSize={BALL_SIZE_FLY_END}
            durationMs={shotPower > POWER_SWEET_HIGH ? 320 : shotPower > POWER_SWEET_LOW ? 380 : 520}
            power={shotPower}
          />
        )}
        {phase === 'result' && landing && (
          <LegacyBall cx={landing.x} cy={landing.y} size={BALL_SIZE_RESULT} />
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
            (outcome === 'goal'
              ? '— REDE —'
              : outcome === 'over-bar'
                ? '— POR CIMA —'
                : outcome === 'post'
                  ? '— TRAVE —'
                  : outcome === 'wide'
                    ? '— PRA FORA —'
                    : '— DEFESA —')}
        </text>
      </svg>

      {/* POWER BAR (durante charge) */}
      {phase === 'charging' && (
        <div className="w-full max-w-[920px] mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[11px] uppercase tracking-[0.35em] font-bold text-black">
              Força · {Math.round(power * 100)}%
            </div>
            <div
              className="text-[11px] uppercase tracking-[0.3em] font-black"
              style={{ color: powerTone === '#FDE100' ? '#000' : powerTone }}
            >
              {powerLabel}
            </div>
          </div>
          <div className="relative h-7 bg-black border-[3px] border-black overflow-hidden">
            {/* Fill */}
            <div
              className="h-full transition-none"
              style={{
                width: `${power * 100}%`,
                background: powerTone,
                boxShadow: power > POWER_SWEET_HIGH ? '0 0 16px rgba(239,68,68,0.8)' : undefined,
              }}
            />
            {/* Sweet zone markers */}
            <div
              className="absolute top-0 h-full border-l-2 border-neon-yellow/80"
              style={{ left: `${POWER_SWEET_LOW * 100}%` }}
            />
            <div
              className="absolute top-0 h-full border-l-2 border-red-500"
              style={{ left: `${POWER_SWEET_HIGH * 100}%` }}
            />
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-black/60 mt-1">
            Solte o botão pra chutar · Zona dourada = pancada na medida
          </div>
        </div>
      )}

      {/* PLACAR DA DISPUTA */}
      <div className="w-full max-w-[920px] mt-4 mb-6 border-t-2 border-black/80 pt-4">
        <div className="grid grid-cols-3 items-center gap-4">
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

      {/* Controles (só após result) */}
      {phase === 'result' && (
        <div className="flex gap-3">
          <button
            onClick={nextShooter}
            className="bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all"
          >
            Próximo batedor
          </button>
          <button
            onClick={fullReset}
            className="bg-transparent border-2 border-black text-black px-6 py-3 font-display font-bold uppercase tracking-wider hover:bg-black hover:text-neon-yellow transition-all"
          >
            Reiniciar
          </button>
        </div>
      )}

      {/* Debug */}
      <div className="mt-6 text-[10px] uppercase tracking-[0.25em] text-black/50 max-w-[920px] text-center leading-relaxed">
        Pressione e segure um slot pra carregar a força · Solte pra chutar · {PICK_TIME_SECONDS}s pra
        decidir
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bola estática (na marca / no slot final)
function LegacyBall({
  cx,
  cy,
  size,
  jitter = false,
}: {
  cx: number;
  cy: number;
  size: number;
  jitter?: boolean;
}) {
  const half = size / 2;
  return (
    <g>
      <ellipse
        cx={cx}
        cy={cy + half * 0.85}
        rx={half * 0.85}
        ry={half * 0.18}
        fill="#000"
        opacity="0.3"
      />
      <image
        href="/assets/legacy-ball.png"
        x={cx - half}
        y={cy - half}
        width={size}
        height={size}
        style={{
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
          animation: jitter ? 'penalty-ball-jitter 0.12s infinite' : undefined,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bola voando — trajetória RETA, ease-in cubic (acelera = pancada violenta)
function LegacyBallFlying({
  from,
  to,
  startSize,
  endSize,
  durationMs,
  power,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startSize: number;
  endSize: number;
  durationMs: number;
  power: number;
}) {
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    function tick(now: number) {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / durationMs);
      setT(next);
      if (next < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [durationMs, from.x, from.y, to.x, to.y]);

  // Ease-in cubic — devagar no início, ACELERA na chegada (pancada)
  const eased = t * t * t;

  // Trajetória LINEAR — bola voa reta, sem curva
  const x = from.x + (to.x - from.x) * eased;
  const y = from.y + (to.y - from.y) * eased;

  // Tamanho encolhe (perspectiva — vai pro fundo do gol)
  const size = startSize + (endSize - startSize) * eased;
  const half = size / 2;

  // Rotação dramática conforme força
  const totalRotation = 540 + power * 540; // até 1080° em chute forte
  const rotation = eased * totalRotation;

  // Sombra projetada no chão (cai pra trás, encolhe)
  const heightAboveGround = from.y - y;
  const shadowOpacity = Math.max(0.05, 0.3 - heightAboveGround / 700);
  const shadowScale = Math.max(0.3, 1 - heightAboveGround / 500);

  // Trail de movimento (linhas atrás da bola pra reforçar a velocidade)
  const trailIntensity = Math.min(1, eased * 1.5);

  return (
    <g>
      {/* Sombra dinâmica no solo */}
      <ellipse
        cx={x}
        cy={from.y + half * 0.5}
        rx={half * 0.85 * shadowScale}
        ry={half * 0.18 * shadowScale}
        fill="#000"
        opacity={shadowOpacity}
      />

      {/* Speed lines (motion blur) */}
      {power > POWER_SWEET_LOW && eased > 0.1 && eased < 0.95 && (
        <g opacity={trailIntensity * 0.6}>
          <line
            x1={from.x}
            y1={from.y - 6}
            x2={x}
            y2={y - 4}
            stroke="#000"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.3}
          />
          <line
            x1={from.x - 4}
            y1={from.y}
            x2={x - 3}
            y2={y}
            stroke="#000"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
          <line
            x1={from.x + 4}
            y1={from.y}
            x2={x + 3}
            y2={y}
            stroke="#000"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.3}
          />
        </g>
      )}

      {/* Bola */}
      <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        <image
          href="/assets/legacy-ball.png"
          x={-half}
          y={-half}
          width={size}
          height={size}
          style={{
            filter: `drop-shadow(0 ${4 + heightAboveGround / 25}px ${6 + heightAboveGround / 15}px rgba(0,0,0,0.5))`,
          }}
        />
      </g>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────
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
