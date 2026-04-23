import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { cn } from '@/lib/utils';
import type { PlayerEntity } from '@/entities/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_KICKS  = 5;
const PRE_KICK_MS  = 2000;
const BLACK_MS     = 1800;
const RESULT_MS    = 3200;
const SLOT_TIMEOUT = 5;

const RNG_SAVED = 0.55; // same slot → save (rng 0.55 > 0.5)
const RNG_GOAL  = 0.13; // diff slot → goal (rng 0.13 < 0.5)

// Slot numbering matches PenaltyKickModal: 1-9, column-major
// Col 0=Esq, Col 1=Cnt, Col 2=Dir | Row 0=Alto, Row 1=Meio, Row 2=Baixo
const SLOT_LABELS: Record<number, string> = {
  1: 'Esq Alto', 2: 'Esq Meio', 3: 'Esq Baixo',
  4: 'Cnt Alto', 5: 'Centro',   6: 'Cnt Baixo',
  7: 'Dir Alto', 8: 'Dir Meio', 9: 'Dir Baixo',
};

// Probability keeper saves each slot (biased toward center/corners)
const KEEPER_SAVE_PROB: Record<number, number> = {
  1: 0.08, 2: 0.14, 3: 0.20,
  4: 0.05, 5: 0.32, 6: 0.10,
  7: 0.08, 8: 0.14, 9: 0.22,
};

// Probability AI shooter picks each slot
const SHOOTER_PICK_PROB: Record<number, number> = {
  1: 0.14, 2: 0.10, 3: 0.18,
  4: 0.04, 5: 0.08, 6: 0.06,
  7: 0.14, 8: 0.10, 9: 0.16,
};

const GOAL_NARRATIVES = [
  'A torcida explode! O estádio inteiro em êxtase!',
  'Converteu com frieza total — sangue frio absoluto!',
  'O treinador agradece de joelhos na beira do campo!',
  'Bateu sem pestanejar — golo de alto nível!',
  'A bola entrou e o banco de reservas invadiu o campo!',
  'Fez história nesse pênalti — a torcida não para!',
];

const SAVE_NARRATIVES = [
  'Grande defesa! O goleiro leu o canto perfeito!',
  'O estádio explode — defesa épica entre os postes!',
  'Mergulhou na hora certa e tirou o que parecia gol!',
  'Impossível — o goleiro voou e salvou o time!',
  'O goleiro vira herói — defesa que vale um título!',
  'Paralisou o adversário com um milagre entre as traves!',
];

// ─── Helper functions ────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function keeperPickSlot(takerSlot: number, keeperQuality: number): number {
  const baseChance = KEEPER_SAVE_PROB[takerSlot] ?? 0.15;
  const adjusted = Math.min(0.75, baseChance * (0.7 + keeperQuality * 0.006));
  if (Math.random() < adjusted) return takerSlot;
  const others = Object.entries(KEEPER_SAVE_PROB)
    .map(([s, w]) => ({ slot: Number(s), w }))
    .filter(({ slot }) => slot !== takerSlot);
  const total = others.reduce((sum, e) => sum + e.w, 0);
  let r = Math.random() * total;
  for (const { slot, w } of others) { r -= w; if (r <= 0) return slot; }
  return others[0]?.slot ?? 5;
}

function shooterPickSlot(): number {
  const weights = Object.entries(SHOOTER_PICK_PROB).map(([s, w]) => ({ slot: Number(s), w }));
  const total = weights.reduce((sum, e) => sum + e.w, 0);
  let r = Math.random() * total;
  for (const { slot, w } of weights) { r -= w; if (r <= 0) return slot; }
  return 3;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'pre_kick' | 'kicking' | 'defending' | 'black' | 'kick_result' | 'final';

interface Outcome {
  isGoal: boolean;
  isHomeKick: boolean; // snapshot — não depende do estado kickPhase
  takerSlot: number;
  keeperSlot: number;
  narrative: string;
}

// ─── Scoreboard dot ───────────────────────────────────────────────────────────

function KickDot({ result }: { key?: string | number | null; result: boolean | null }) {
  if (result === null)
    return <div className="w-7 h-7 rounded-full border-2 border-zinc-600 bg-zinc-800/60" />;
  if (result)
    return (
      <motion.img
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        src="/test-pitch/olefoot-Ball.png"
        alt="Gol"
        className="w-7 h-7 rounded-full object-cover drop-shadow-[0_0_8px_rgba(255,220,0,0.7)]"
      />
    );
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-7 h-7 rounded-full bg-red-900/70 border-2 border-red-600 flex items-center justify-center"
    >
      <span className="text-red-400 font-black text-xs leading-none">✕</span>
    </motion.div>
  );
}

// ─── Player Setup Card ────────────────────────────────────────────────────────

function PlayerPickCard({
  player,
  orderIndex,
  onClick,
}: {
  key?: string | number | null;
  player: PlayerEntity;
  orderIndex: number | null;
  onClick: () => void;
}) {
  const a = player.attrs;
  const chute = Math.round((a.finalizacao + a.fisico) / 2);
  const isSelected = orderIndex !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all',
        isSelected ? 'border-neon-yellow/70 bg-neon-yellow/5' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600',
      )}
    >
      <div className="flex items-center gap-2">
        {isSelected
          ? <span className="w-6 h-6 rounded-full bg-neon-yellow text-black text-xs font-black flex items-center justify-center shrink-0">{orderIndex! + 1}</span>
          : <span className="w-6 h-6 rounded-full border-2 border-zinc-600 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{player.name}</p>
          <p className="text-[10px] text-zinc-500 uppercase">{player.pos}</p>
        </div>
        <div className="flex gap-3 text-[10px] shrink-0">
          <div className="text-center"><p className="text-white font-bold">{chute}</p><p className="text-zinc-500">Chute</p></div>
          <div className="text-center"><p className="text-white font-bold">{a.finalizacao}</p><p className="text-zinc-500">Final.</p></div>
          <div className="text-center">
            <p className={cn('font-bold', player.fatigue >= 70 ? 'text-orange-400' : 'text-white')}>{Math.round(player.fatigue)}%</p>
            <p className="text-zinc-500">Fadiga</p>
          </div>
          <div className="text-center"><p className="text-white font-bold">{a.confianca}</p><p className="text-zinc-500">Conf.</p></div>
        </div>
      </div>
    </button>
  );
}

// ─── Goal-image slot grid (same visual as PenaltyKickModal) ──────────────────

function GoalSlotPicker({
  isHome,
  takerName,
  countdown,
  onPick,
}: {
  isHome: boolean;
  takerName?: string;
  countdown: number | null;
  onPick: (slot: number) => void;
}) {
  return (
    <motion.div
      key={isHome ? 'kicking' : 'defending'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center w-full"
    >
      {/* Header row */}
      <div className="w-full max-w-2xl px-5 mb-2">
        <div className="flex items-center justify-between">
          <span className="font-display font-black uppercase tracking-widest text-sm text-zinc-400">
            {isHome ? 'Cobrança — Casa' : 'Cobrança — Adversário'}
          </span>
          {countdown !== null && (
            <span className={cn('font-display font-black text-2xl tabular-nums', countdown <= 2 ? 'text-red-400' : 'text-neon-yellow')}>
              {countdown}s
            </span>
          )}
        </div>
        <p className="font-bold mt-1 text-xl text-white">
          {isHome ? `${takerName ?? '—'} na bola` : `${takerName ?? 'Adversário'} vai cobrar`}
        </p>
        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-neon-yellow">
          {isHome ? '👇 Escolha onde chutar' : '🧤 Escolha onde defender'}
        </p>
      </div>

      {/* Goal image + slot overlay */}
      <div className="w-full max-w-2xl px-2 relative">
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <img
            src={isHome ? '/test-pitch/teste-image-real.jpg' : '/test-pitch/goleiro-defende-view.jpg'}
            alt="Gol"
            className="w-full h-full object-cover rounded-xl select-none pointer-events-none"
            draggable={false}
          />
          <div
            className="absolute grid grid-cols-3 grid-rows-3"
            style={isHome
              ? { left: '2%', right: '2%', top: '7%', bottom: '27%', gap: '4px' }
              : { left: '10%', right: '10%', top: '12%', bottom: '10%', gap: '10px' }
            }
          >
            {[1, 4, 7, 2, 5, 8, 3, 6, 9].map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onPick(slot)}
                className={cn(
                  'rounded-lg border-2 active:scale-95 transition-all flex items-center justify-center',
                  isHome
                    ? 'border-white/40 bg-black/10 hover:bg-neon-yellow/25 hover:border-neon-yellow'
                    : 'border-white/40 bg-black/10 hover:bg-blue-400/25 hover:border-blue-400',
                )}
              >
                <span className="text-[10px] font-bold text-white/80 font-display uppercase tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {SLOT_LABELS[slot]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-display mt-2">
        {isHome ? 'Sem escolha = chute ao centro (goleiro defende)' : 'Sem escolha = goleiro fica no centro (gol do adversário)'}
      </p>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MatchPenalty() {
  const navigate = useNavigate();
  const players = useGameStore(s => s.players ?? {});
  const fixture = useGameStore(s => (s as any).currentFixture ?? s.liveMatch);

  const opponentName: string = fixture?.opponent?.name ?? fixture?.opponentName ?? 'Rival FC';
  const opponentShort: string = fixture?.opponent?.shortName ?? opponentName.slice(0, 3).toUpperCase();
  const opponentStrength: number = fixture?.opponent?.strength ?? 70;

  const [takerOrder, setTakerOrder] = useState<string[]>([]);

  const [phase, setPhase] = useState<GamePhase>('setup');
  const [round, setRound] = useState(0);
  const [kickPhase, setKickPhase] = useState<'home' | 'away'>('home');
  const [homeResults, setHomeResults] = useState<Array<boolean | null>>(Array(TOTAL_KICKS).fill(null));
  const [awayResults, setAwayResults] = useState<Array<boolean | null>>(Array(TOTAL_KICKS).fill(null));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [winner, setWinner] = useState<'home' | 'away' | null>(null);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);

  const availablePlayers = Object.values(players)
    .filter(p => p.outForMatches <= 0)
    .sort((a, b) => b.attrs.finalizacao - a.attrs.finalizacao);

  const homeGoals = homeResults.filter(r => r === true).length;
  const awayGoals = awayResults.filter(r => r === true).length;
  const currentTakerId = takerOrder[round % TOTAL_KICKS];
  const currentTaker = availablePlayers.find(p => p.id === currentTakerId) ?? null;

  const totalDots = Math.max(TOTAL_KICKS, homeResults.length);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // ── Countdown ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'kicking' && phase !== 'defending') {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setCountdown(null);
      return;
    }
    resolvedRef.current = false;
    const limit = SLOT_TIMEOUT;
    setCountdown(limit);
    const start = Date.now();
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil(Math.max(0, limit - (Date.now() - start) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        if (phase === 'kicking') handleKick(5, true);
        else handleDefend(5, true);
      }
    }, 200);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function toggleTaker(playerId: string) {
    setTakerOrder(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= TOTAL_KICKS) return prev;
      return [...prev, playerId];
    });
  }

  function startMatch() {
    if (takerOrder.length < TOTAL_KICKS) return;
    setPhase('pre_kick');
    timerRef.current = setTimeout(() => setPhase('kicking'), PRE_KICK_MS);
  }

  function handleKick(takerSlot: number, isTimeout = false) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

    let keeperSlot: number;
    let isGoal: boolean;

    if (isTimeout) {
      // Didn't shoot — keeper auto-saves at center
      keeperSlot = 5;
      isGoal = false;
    } else {
      keeperSlot = keeperPickSlot(takerSlot, opponentStrength);
      const rng = takerSlot === keeperSlot ? RNG_SAVED : RNG_GOAL;
      isGoal = rng < 0.5;
    }

    resolveOutcome({ isGoal, isHomeKick: true, takerSlot, keeperSlot, narrative: pickRandom(isGoal ? GOAL_NARRATIVES : SAVE_NARRATIVES) });
  }

  function handleDefend(keeperSlot: number, isTimeout = false) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

    let takerSlot: number;
    let isGoal: boolean;

    if (isTimeout) {
      // Didn't dive — attacker picks a good corner, scores
      takerSlot = shooterPickSlot();
      isGoal = true;
    } else {
      takerSlot = shooterPickSlot();
      const rng = takerSlot === keeperSlot ? RNG_SAVED : RNG_GOAL;
      isGoal = rng < 0.5;
    }

    resolveOutcome({ isGoal, isHomeKick: false, takerSlot, keeperSlot, narrative: pickRandom(isGoal ? GOAL_NARRATIVES : SAVE_NARRATIVES) });
  }

  function resolveOutcome(o: Outcome) {
    setOutcome(o);
    setPhase('black');
    timerRef.current = setTimeout(() => {
      setPhase('kick_result');
      timerRef.current = setTimeout(() => applyResult(o.isGoal, kickPhase, round), RESULT_MS);
    }, BLACK_MS);
  }

  function applyResult(isGoal: boolean, currentKickPhase: 'home' | 'away', currentRound: number) {
    const newHome = [...homeResults];
    const newAway = [...awayResults];
    let nextRound = currentRound;
    let nextKickPhase: 'home' | 'away';

    if (currentKickPhase === 'home') {
      while (newHome.length <= currentRound) newHome.push(null);
      newHome[currentRound] = isGoal;
      nextKickPhase = 'away';
    } else {
      while (newAway.length <= currentRound) newAway.push(null);
      newAway[currentRound] = isGoal;
      nextKickPhase = 'home';
      nextRound = currentRound + 1;
    }

    setHomeResults(newHome);
    setAwayResults(newAway);

    const h = newHome.filter(r => r === true).length;
    const a = newAway.filter(r => r === true).length;
    const hLeft = TOTAL_KICKS - newHome.filter(r => r !== null).length;
    const aLeft = TOTAL_KICKS - newAway.filter(r => r !== null).length;

    if (nextRound < TOTAL_KICKS || currentRound < TOTAL_KICKS) {
      if (h > a + aLeft) { endMatch('home'); return; }
      if (a > h + hLeft) { endMatch('away'); return; }
    }

    if (nextKickPhase === 'home' && nextRound >= TOTAL_KICKS) {
      if (h > a) { endMatch('home'); return; }
      if (a > h) { endMatch('away'); return; }
      setIsSuddenDeath(true);
      setHomeResults(r => [...r, null]);
      setAwayResults(r => [...r, null]);
    }

    setRound(nextRound);
    setKickPhase(nextKickPhase);
    setOutcome(null);
    setPhase('pre_kick');
    timerRef.current = setTimeout(() => {
      setPhase(nextKickPhase === 'home' ? 'kicking' : 'defending');
    }, PRE_KICK_MS);
  }

  function endMatch(w: 'home' | 'away') {
    setWinner(w);
    setPhase('final');
  }

  function resetAll() {
    setPhase('setup');
    setTakerOrder([]);
    setRound(0);
    setKickPhase('home');
    setHomeResults(Array(TOTAL_KICKS).fill(null));
    setAwayResults(Array(TOTAL_KICKS).fill(null));
    setOutcome(null);
    setWinner(null);
    setIsSuddenDeath(false);
  }

  // ─── Setup screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-lg mx-auto px-4 py-4 pb-20">
          <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-neon-yellow tracking-wide">DISPUTA DE PÊNALTIS</h1>
              <p className="text-xs text-zinc-500">Amistoso · vs {opponentName}</p>
            </div>
          </div>

          <div className="glass-panel p-4 mb-4">
            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-3">
              Ordem dos batedores ({takerOrder.length}/{TOTAL_KICKS})
            </p>
            <div className="flex gap-2">
              {Array.from({ length: TOTAL_KICKS }, (_, i) => {
                const pid = takerOrder[i];
                const p = pid ? availablePlayers.find(pl => pl.id === pid) : null;
                return (
                  <div key={i} className={cn(
                    'flex-1 h-14 rounded-xl border-2 flex flex-col items-center justify-center px-1 transition-all',
                    p ? 'border-neon-yellow/60 bg-neon-yellow/5' : 'border-zinc-700 border-dashed',
                  )}>
                    <span className="text-[9px] text-zinc-500 font-bold">{i + 1}º</span>
                    {p
                      ? <span className="text-[10px] font-bold text-white truncate w-full text-center px-0.5">{p.name.split(' ').at(-1)}</span>
                      : <span className="text-zinc-700 text-lg">—</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {availablePlayers.slice(0, 16).map(p => (
              <PlayerPickCard
                key={p.id}
                player={p}
                orderIndex={takerOrder.includes(p.id) ? takerOrder.indexOf(p.id) : null}
                onClick={() => toggleTaker(p.id)}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={takerOrder.length < TOTAL_KICKS}
            onClick={startMatch}
            className="w-full py-4 rounded-2xl bg-neon-yellow text-black font-black text-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            INICIAR DISPUTA
          </button>
        </div>
      </div>
    );
  }

  // ─── Shootout screen ─────────────────────────────────────────────────────────

  const displayRound = Math.min(round, homeResults.length - 1);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* ── Scoreboard ── */}
      <div className="bg-black/90 backdrop-blur-md px-4 pt-3 pb-3 shrink-0 z-10 relative">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-black text-white">CASA</span>
            <div className="text-center">
              <p className="text-3xl font-black text-neon-yellow tabular-nums leading-none">
                {homeGoals} – {awayGoals}
              </p>
              {isSuddenDeath && (
                <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wider mt-0.5">Morte Súbita</p>
              )}
            </div>
            <span className="text-sm font-black text-white text-right">{opponentShort}</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="flex gap-1.5 flex-1 justify-start flex-wrap">
              {Array.from({ length: totalDots }, (_, i) => (
                <KickDot key={`h${i}`} result={homeResults[i] ?? null} />
              ))}
            </div>
            <div className="w-px h-7 bg-zinc-700 mx-1 shrink-0" />
            <div className="flex gap-1.5 flex-1 justify-end flex-wrap">
              {Array.from({ length: totalDots }, (_, i) => (
                <KickDot key={`a${i}`} result={awayResults[i] ?? null} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        <AnimatePresence mode="wait">

          {/* Pre-kick announcement */}
          {phase === 'pre_kick' && (
            <motion.div
              key="pre"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-10 px-6"
            >
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">
                {isSuddenDeath ? 'Morte Súbita' : `${displayRound + 1}ª cobrança`}
              </p>
              {kickPhase === 'home' ? (
                <>
                  <p className="text-3xl font-black text-white">{currentTaker?.name ?? '—'}</p>
                  <p className="text-sm text-zinc-400 mt-2">vai bater o pênalti</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-orange-300">{opponentName}</p>
                  <p className="text-sm text-zinc-400 mt-2">vai cobrar — posicione-se!</p>
                </>
              )}
            </motion.div>
          )}

          {/* Kicking — goal image + yellow slots */}
          {phase === 'kicking' && (
            <GoalSlotPicker
              isHome
              takerName={currentTaker?.name}
              countdown={countdown}
              onPick={handleKick}
            />
          )}

          {/* Defending — goal image + blue slots */}
          {phase === 'defending' && (
            <GoalSlotPicker
              isHome={false}
              takerName={opponentName}
              countdown={countdown}
              onPick={handleDefend}
            />
          )}

          {/* Black transition */}
          {phase === 'black' && outcome && (
            <motion.div
              key="black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-6 px-8 text-center"
            >
              <p className="font-display font-black text-zinc-500 text-sm uppercase tracking-widest">
                {kickPhase === 'home' ? 'Cobrança' : 'Adversário bate'}
              </p>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="font-display font-black text-white text-2xl sm:text-3xl leading-tight"
              >
                Partiu <span className="text-neon-yellow">
                  {kickPhase === 'home' ? (currentTaker?.name ?? '—') : opponentName}
                </span> para a bola e...
              </motion.p>
              <motion.div className="flex gap-1.5 mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-neon-yellow"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Result — full-screen image */}
          {phase === 'kick_result' && outcome && (
            <motion.div
              key="kick_result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex flex-col"
            >
              <img
                src={
                  !outcome.isHomeKick && outcome.isGoal
                    ? '/test-pitch/tomamos-o-gol.jpg'
                    : outcome.isGoal
                      ? '/test-pitch/jogador-ganhou.png'
                      : '/test-pitch/jogador-perdeu.png'
                }
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80" />
              <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-8 gap-6">

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center"
                >
                  <p className={cn(
                    'font-display font-black uppercase tracking-widest text-4xl sm:text-6xl md:text-7xl leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]',
                    outcome.isGoal ? 'text-neon-yellow' : 'text-white',
                  )}>
                    {outcome.isHomeKick
                      ? (outcome.isGoal ? 'GOOOOOL!' : 'DEFENDEU!')
                      : (outcome.isGoal ? 'TOMAMOS GOL...' : 'DEFESA!')}
                  </p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-2 text-sm sm:text-base text-white/90 font-medium max-w-full sm:max-w-md md:max-w-lg mx-auto drop-shadow"
                  >
                    {outcome.narrative}
                  </motion.p>
                </motion.div>

                {/* Transparency */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full max-w-md bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-3 space-y-1.5 mx-auto"
                >
                  <p className="text-[11px] sm:text-sm text-zinc-400">
                    <span className="text-zinc-500">⚽ Atacante chutou em</span>{' '}
                    <span className="text-white font-bold">{SLOT_LABELS[outcome.takerSlot]}</span>
                  </p>
                  <p className="text-[11px] sm:text-sm text-zinc-400">
                    <span className="text-zinc-500">🧤 Goleiro pulou para</span>{' '}
                    <span className="text-white font-bold">{SLOT_LABELS[outcome.keeperSlot]}</span>
                  </p>
                </motion.div>

              </div>
            </motion.div>
          )}

          {/* Final result */}
          {phase === 'final' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 px-6"
            >
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-4">Resultado Final</p>
              <p className="text-6xl font-black text-neon-yellow mb-4 tabular-nums">{homeGoals} – {awayGoals}</p>
              {winner === 'home' && (
                <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="text-3xl font-black text-emerald-400">VITÓRIA!</motion.p>
              )}
              {winner === 'away' && (
                <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="text-3xl font-black text-red-400">DERROTA</motion.p>
              )}
              <div className="flex gap-3 mt-8 justify-center">
                <button type="button" onClick={() => navigate(-1)}
                  className="px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-300 font-bold hover:border-zinc-500 transition-colors">
                  Sair
                </button>
                <button type="button" onClick={resetAll}
                  className="px-6 py-3 rounded-2xl bg-neon-yellow text-black font-black hover:bg-yellow-300 transition-colors">
                  Jogar de Novo
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default MatchPenalty;
