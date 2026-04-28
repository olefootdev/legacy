import { useEffect, useState } from 'react';
import type {
  CornerType,
  FreeKickType,
  SetPieceChoice,
  SetPieceContext,
  SetPieceTaker,
  SetPieceTarget,
} from './types';

interface Props {
  ctx: SetPieceContext;
  /** Tempo limite pra escolher (multiplayer-safe). 0 = sem limite. */
  pickTimeSeconds?: number;
  /** Auto-pick mais alto se tempo zera. */
  onResolve: (choice: SetPieceChoice) => void;
  /** Cabeçalho contextual (ex: "67' · Falta perigosa"). */
  headerLabel?: string;
}

const CORNER_TYPES: { id: CornerType; label: string; desc: string }[] = [
  { id: 'short', label: 'Curto', desc: 'Toca de cabeça com lateral, mantém posse' },
  { id: 'near_post', label: 'Primeiro pau', desc: 'Cruzamento tenso pra frente da área' },
  { id: 'far_post', label: 'Segundo pau', desc: 'Bola alta pro outro lado da área' },
];

const FREE_KICK_TYPES: { id: FreeKickType; label: string; desc: string }[] = [
  { id: 'direct_shot', label: 'Chuta direto', desc: 'Tenta o gol — exige pernada e mira' },
  { id: 'cross', label: 'Cruza na área', desc: 'Bola alta pro corredor cabeceiar' },
  { id: 'short_pass', label: 'Toca curto', desc: 'Reinicia jogada, segura posse' },
];

export function LiveSetPieceManager({
  ctx,
  pickTimeSeconds = 8,
  onResolve,
  headerLabel,
}: Props) {
  const [takerId, setTakerId] = useState<string | null>(ctx.takers[0]?.id ?? null);
  const [type, setType] = useState<CornerType | FreeKickType | null>(
    ctx.mode === 'corner' ? 'far_post' : 'cross',
  );
  const [targetId, setTargetId] = useState<string | null>(
    ctx.mode === 'corner' ? (ctx.targets[0]?.id ?? null) : null,
  );
  const [timeLeft, setTimeLeft] = useState(pickTimeSeconds);

  // Timer
  useEffect(() => {
    if (!pickTimeSeconds) return;
    setTimeLeft(pickTimeSeconds);
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id);
          // Auto-resolve com defaults (top batedor, far_post / cross)
          if (takerId && type) {
            onResolve({
              mode: ctx.mode,
              takerId,
              type,
              targetId: targetId ?? undefined,
              distance: ctx.distance,
              zone: ctx.zone,
            });
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickTimeSeconds]);

  function handleConfirm() {
    if (!takerId || !type) return;
    onResolve({
      mode: ctx.mode,
      takerId,
      type,
      targetId: targetId ?? undefined,
      distance: ctx.distance,
      zone: ctx.zone,
    });
  }

  const types = ctx.mode === 'corner' ? CORNER_TYPES : FREE_KICK_TYPES;
  const headline = ctx.mode === 'corner' ? 'Escanteio pra nós!' : 'Falta perigosa!';
  const lateralityLabel =
    ctx.mode === 'corner'
      ? `Canto ${ctx.cornerSide === 'left' ? 'esquerdo' : 'direito'}`
      : ctx.distance != null
        ? `${Math.round(ctx.distance)}m do gol · ${ctx.zone === 'center' ? 'centralizada' : ctx.zone === 'left' ? 'lado esquerdo' : 'lado direito'}`
        : '';

  return (
    <div
      className="min-h-screen bg-neon-yellow flex flex-col items-center pt-6 pb-12 px-6 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Header editorial */}
      <div className="w-full max-w-[920px] flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          {headerLabel ?? 'Olefoot · Bola Parada'}
        </div>
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70 tabular-nums">
          {timeLeft}s
        </div>
      </div>

      {/* Headline */}
      <h1
        className="ole-headline-italic text-black text-center mb-1"
        style={{ fontSize: 'clamp(40px, 7vw, 80px)', lineHeight: 1 }}
      >
        {headline}
      </h1>
      <div className="text-[11px] uppercase tracking-[0.2em] text-black/70 mb-6">
        {lateralityLabel}
      </div>

      {/* Mini-pitch SVG mostrando posição da bola parada */}
      <div className="w-full max-w-[920px] mb-6">
        <SetPieceFieldSVG ctx={ctx} />
      </div>

      {/* SELETOR DE BATEDOR */}
      <div className="w-full max-w-[920px] mb-5">
        <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-black/80 mb-2">
          Quem bate?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ctx.takers.slice(0, 3).map((t) => (
            <TakerCard
              key={t.id}
              taker={t}
              selected={takerId === t.id}
              onSelect={() => setTakerId(t.id)}
            />
          ))}
        </div>
      </div>

      {/* SELETOR DE TIPO DE BATIDA */}
      <div className="w-full max-w-[920px] mb-5">
        <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-black/80 mb-2">
          Como bate?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {types.map((t) => (
            <TypeCard
              key={t.id}
              label={t.label}
              desc={t.desc}
              selected={type === t.id}
              onSelect={() => setType(t.id)}
            />
          ))}
        </div>
      </div>

      {/* CORREDOR DESIGNADO (apenas em corner ou cross) */}
      {ctx.mode === 'corner' || (ctx.mode === 'free_kick' && type === 'cross') ? (
        <div className="w-full max-w-[920px] mb-5">
          <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-black/80 mb-2">
            Quem cabeceia?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ctx.targets.slice(0, 4).map((tg) => (
              <TargetCard
                key={tg.id}
                target={tg}
                selected={targetId === tg.id}
                onSelect={() => setTargetId(tg.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* CONFIRMAR */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!takerId || !type}
        className="bg-black text-neon-yellow px-10 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Confirmar batida
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function TakerCard({
  taker,
  selected,
  onSelect,
}: {
  taker: SetPieceTaker;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between px-4 py-3 border-2 transition-all ${
        selected
          ? 'bg-black text-neon-yellow border-black'
          : 'bg-transparent text-black border-black/40 hover:border-black'
      }`}
    >
      <div className="text-left">
        <div className="font-display font-bold uppercase tracking-wider text-sm">
          {taker.displayName}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
          #{taker.shirtNumber}
        </div>
      </div>
      <div className="font-display font-black text-2xl tabular-nums">{taker.skillRating}</div>
    </button>
  );
}

function TypeCard({
  label,
  desc,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start text-left px-4 py-3 border-2 transition-all ${
        selected
          ? 'bg-black text-neon-yellow border-black'
          : 'bg-transparent text-black border-black/40 hover:border-black'
      }`}
    >
      <div className="font-display font-bold uppercase tracking-wider text-sm mb-1">{label}</div>
      <div className="text-[10px] leading-tight opacity-80">{desc}</div>
    </button>
  );
}

function TargetCard({
  target,
  selected,
  onSelect,
}: {
  target: SetPieceTarget;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between px-3 py-2 border-2 transition-all ${
        selected
          ? 'bg-black text-neon-yellow border-black'
          : 'bg-transparent text-black border-black/40 hover:border-black'
      }`}
    >
      <div className="text-left">
        <div className="font-display font-bold uppercase tracking-wider text-xs">
          {target.displayName}
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] opacity-70">
          #{target.shirtNumber} · {target.position}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-70">CAB</div>
      <div className="font-display font-black text-xl tabular-nums">{target.skillRating}</div>
    </button>
  );
}

// Mini-pitch SVG editorial mostrando a posição da bola parada
function SetPieceFieldSVG({ ctx }: { ctx: SetPieceContext }) {
  const W = 600;
  const H = 240;
  // Coordenadas da bola
  let ballX = W / 2;
  let ballY = H * 0.55;

  if (ctx.mode === 'corner') {
    // Bola no canto perto do gol (à esquerda, gol em cima)
    ballX = ctx.cornerSide === 'left' ? 30 : W - 30;
    ballY = 30;
  } else {
    // Free kick: posicionado pela zone + distance
    if (ctx.zone === 'left') ballX = W * 0.3;
    else if (ctx.zone === 'right') ballX = W * 0.7;
    // Distance: até 35m vira até 50% do campo
    const dist = ctx.distance ?? 22;
    ballY = 30 + (Math.min(35, dist) / 35) * (H * 0.5);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Campo grass background com retrô feel */}
      <rect x="0" y="0" width={W} height={H} fill="#FDE100" />
      {/* Linhas brancas / pretas no estilo Legacy */}
      {/* Trave do gol no topo */}
      <rect x={W / 2 - 70} y="20" width="140" height="3" fill="#000" />
      <line x1={W / 2 - 70} y1="20" x2={W / 2 - 70} y2="6" stroke="#000" strokeWidth="3" />
      <line x1={W / 2 + 70} y1="20" x2={W / 2 + 70} y2="6" stroke="#000" strokeWidth="3" />
      {/* Pequena área */}
      <rect
        x={W / 2 - 50}
        y="22"
        width="100"
        height="40"
        fill="none"
        stroke="#000"
        strokeWidth="1.5"
        opacity="0.7"
      />
      {/* Grande área */}
      <rect
        x={W / 2 - 130}
        y="22"
        width="260"
        height="100"
        fill="none"
        stroke="#000"
        strokeWidth="1.5"
        opacity="0.7"
      />
      {/* Linha de meio-campo */}
      <line x1="0" y1={H - 10} x2={W} y2={H - 10} stroke="#000" strokeWidth="1" opacity="0.5" />

      {/* Bola */}
      <circle cx={ballX} cy={ballY} r="9" fill="#000" stroke="#FDE100" strokeWidth="2" />

      {/* Linha pontilhada do trajeto provável */}
      <line
        x1={ballX}
        y1={ballY}
        x2={W / 2}
        y2={50}
        stroke="#000"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.5"
      />

      {/* Label */}
      <text
        x="12"
        y={H - 16}
        fontSize="10"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="700"
        letterSpacing="2"
        fill="#000"
        opacity="0.6"
      >
        {ctx.mode === 'corner'
          ? `ESCANTEIO ${ctx.cornerSide === 'left' ? 'ESQ' : 'DIR'}`
          : `FALTA · ${ctx.distance ?? 22}M`}
      </text>
    </svg>
  );
}
