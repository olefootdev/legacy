/**
 * Modal interativo de cobrança de penalty para Partida Rápida.
 *
 * Fluxo:
 * 1. pick_taker — seleção do batedor (só casa, 10s)
 * 2. pick_slot  — gol 3×3 clicável (5s)
 * 3. black      — tela preta 2s "Partiu [nome] para a bola e..."
 * 4. result     — imagem jogador-ganhou/perdeu + GoalScorerOverlay
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { PitchPlayerState } from '@/engine/types';
import type { PenaltyState } from '@/gamespirit/spiritSnapshotTypes';
import { GoalScorerOverlay } from '@/match/GoalScorerOverlay';

// Probabilidade do goleiro defender cada slot
const KEEPER_SAVE_PROB: Record<number, number> = {
  1: 0.08, 2: 0.14, 3: 0.20,
  4: 0.05, 5: 0.32, 6: 0.10,
  7: 0.08, 8: 0.14, 9: 0.22,
};

// Probabilidade do batedor adversário escolher slot
const SHOOTER_PICK_PROB: Record<number, number> = {
  1: 0.14, 2: 0.10, 3: 0.18,
  4: 0.04, 5: 0.08, 6: 0.06,
  7: 0.14, 8: 0.10, 9: 0.16,
};

const RNG_SAVED = 0.55;
const RNG_GOAL  = 0.13;

const GOAL_NARRATIVES = [
  'A torcida explode! O estádio inteiro em êxtase!',
  'Aliviou a pressão do grupo — bateu com frieza total!',
  'O treinador agradece de joelhos na beira do campo!',
  'Converteu sem pestanejar — sangue frio absoluto!',
  'A bola entrou e o banco de reservas invadiu o campo!',
  'Fez história nesse penalty — a torcida não para de gritar!',
];

const SAVE_NARRATIVES = [
  'Grande defesa! Foi frio e esperou a batida!',
  'O estádio explode comemorando — defesa épica do goleiro!',
  'Leu o canto perfeito e mergulhou na hora certa!',
  'Paralisou o adversário com um milagre entre os postes!',
  'O goleiro vira herói — defesa que vale um título!',
  'Impossível — o goleiro voou e tirou o que parecia gol!',
];

// Colunas = Esq/Cnt/Dir | Linhas = Alto/Meio/Baixo
const SLOT_LABELS: Record<number, string> = {
  1: 'Esq Alto', 2: 'Esq Meio', 3: 'Esq Baixo',
  4: 'Cnt Alto', 5: 'Centro',   6: 'Cnt Baixo',
  7: 'Dir Alto', 8: 'Dir Meio', 9: 'Dir Baixo',
};

function keeperPickSlot(takerSlot: number, keeperQuality: number): number {
  const baseChance = KEEPER_SAVE_PROB[takerSlot] ?? 0.15;
  const adjustedChance = Math.min(0.75, baseChance * (0.7 + keeperQuality * 0.006));
  if (Math.random() < adjustedChance) return takerSlot;
  const weights = Object.entries(KEEPER_SAVE_PROB)
    .map(([s, w]) => ({ slot: Number(s), w }))
    .filter(({ slot }) => slot !== takerSlot);
  const total = weights.reduce((sum, e) => sum + e.w, 0);
  let r = Math.random() * total;
  for (const { slot, w } of weights) {
    r -= w;
    if (r <= 0) return slot;
  }
  return weights[0]?.slot ?? 5;
}

function shooterPickSlot(): number {
  const weights = Object.entries(SHOOTER_PICK_PROB).map(([s, w]) => ({ slot: Number(s), w }));
  const total = weights.reduce((sum, e) => sum + e.w, 0);
  let r = Math.random() * total;
  for (const { slot, w } of weights) {
    r -= w;
    if (r <= 0) return slot;
  }
  return 3;
}

function slotToRng(takerSlot: number, keeperSlot: number): number {
  if (takerSlot === keeperSlot) return RNG_SAVED;
  return RNG_GOAL;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Props {
  key?: string | number | null;
  penalty: PenaltyState;
  homePlayers: PitchPlayerState[];
  opponentStrength: number;
  onResolve: (rng: number, takerName: string) => void;
  onPickTaker: (playerId: string, name: string) => void;
  takerReady: boolean;
  homeScore: number;
  awayScore: number;
  homeShort: string;
  awayShort: string;
  minute: number;
  takerPortraitUrl?: string;
}

type Phase = 'pick_taker' | 'pick_slot' | 'black' | 'result' | 'done';

interface Outcome {
  isGoal: boolean;
  rng: number;
  takerSlot: number;
  keeperSlot: number;
  narrative: string;
}

const TAKER_TIMEOUT = 10;
const SLOT_TIMEOUT  = 5;
const BLACK_MS      = 2000;
const RESULT_MS     = 3000;

export function PenaltyKickModal({
  penalty, homePlayers, opponentStrength,
  onResolve, onPickTaker, takerReady,
  homeScore, awayScore, homeShort, awayShort, minute, takerPortraitUrl,
}: Props) {
  const isHome  = penalty.side === 'home';
  const phase0: Phase = (!isHome || takerReady) ? 'pick_slot' : 'pick_taker';

  const [phase, setPhase]       = useState<Phase>(phase0);
  const [countdown, setCountdown] = useState(phase0 === 'pick_taker' ? TAKER_TIMEOUT : SLOT_TIMEOUT);
  const [selectedTakerId, setSelectedTakerId] = useState('');
  const [outcome, setOutcome]   = useState<Outcome | null>(null);
  const resolvedRef = useRef(false);

  // Taker selected externally
  useEffect(() => {
    if (takerReady && phase === 'pick_taker') {
      setPhase('pick_slot');
      setCountdown(SLOT_TIMEOUT);
    }
  }, [takerReady, phase]);

  // Countdown
  useEffect(() => {
    if (phase === 'black' || phase === 'result' || phase === 'done') return;
    const limit = phase === 'pick_taker' ? TAKER_TIMEOUT : SLOT_TIMEOUT;
    setCountdown(limit);
    const start = Date.now();
    const id = window.setInterval(() => {
      const remaining = Math.ceil(Math.max(0, limit - (Date.now() - start) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(id);
        if (phase === 'pick_taker') {
          const first = homePlayers[0];
          if (first) onPickTaker(first.playerId, first.name);
        } else if (isHome) {
          handleAutoSave();
        } else {
          handleDefendSlot(5);
        }
      }
    }, 200);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function resolveOutcome(o: Outcome) {
    setOutcome(o);
    setPhase('black');
    window.setTimeout(() => setPhase('result'), BLACK_MS);
    // Após 3s de resultado: esconde modal → placar fica visível 2s → jogo retoma
    window.setTimeout(() => {
      setPhase('done');
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      onResolve(o.rng, penalty.takerName);
    }, BLACK_MS + RESULT_MS);
  }

  function handleAutoSave() {
    if (resolvedRef.current) return;
    resolveOutcome({
      isGoal: false, rng: RNG_SAVED,
      takerSlot: 5, keeperSlot: 5,
      narrative: pickRandom(SAVE_NARRATIVES),
    });
  }

  function handleSlotPick(slot: number) {
    if (resolvedRef.current) return;
    const keeperSlot = keeperPickSlot(slot, opponentStrength);
    const rng = slotToRng(slot, keeperSlot);
    resolveOutcome({
      isGoal: rng < 0.5, rng,
      takerSlot: slot, keeperSlot,
      narrative: pickRandom(rng < 0.5 ? GOAL_NARRATIVES : SAVE_NARRATIVES),
    });
  }

  function handleDefendSlot(keeperSlot: number) {
    if (resolvedRef.current) return;
    const shootSlot = shooterPickSlot();
    const saved = keeperSlot === shootSlot;
    const rng = saved ? RNG_SAVED : RNG_GOAL;
    resolveOutcome({
      isGoal: !saved, rng,
      takerSlot: shootSlot, keeperSlot,
      narrative: pickRandom(saved ? SAVE_NARRATIVES : GOAL_NARRATIVES),
    });
  }

  // Portrait do batedor da casa
  const takerPlayer = penalty.takerId
    ? homePlayers.find(p => p.playerId === penalty.takerId)
    : homePlayers[0];

  if (phase === 'done') return null;

  return (
    <motion.div
      key="penalty-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95"
    >
      <AnimatePresence mode="wait">

        {/* ── Tela Preta ──────────────────────────────────────────────── */}
        {phase === 'black' && (
          <motion.div
            key="black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 px-8 text-center"
          >
            <p className="font-display font-black text-zinc-500 text-sm uppercase tracking-widest">
              {isHome ? 'Cobrança' : 'Adversário bate'}
            </p>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-display font-black text-white text-2xl sm:text-3xl leading-tight"
            >
              Partiu <span className="text-neon-yellow">{penalty.takerName}</span> para a bola e...
            </motion.p>
            <motion.div
              className="flex gap-1.5 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
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

        {/* ── Tela de Resultado ───────────────────────────────────────── */}
        {phase === 'result' && outcome && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative w-full h-full flex flex-col"
          >
            {/* Imagem de fundo */}
            <img
              src={outcome.isGoal
                ? '/test-pitch/jogador-ganhou.png'
                : '/test-pitch/jogador-perdeu.png'}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Gradiente superior para legibilidade */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/60" />

            {/* Conteúdo */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full px-4 py-6">

              {/* Título do resultado */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <p className={`font-display font-black uppercase tracking-widest text-4xl sm:text-5xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] ${
                  outcome.isGoal ? 'text-neon-yellow' : 'text-white'
                }`}>
                  {isHome
                    ? (outcome.isGoal ? 'GOOOOOL!' : 'DEFENDEU!')
                    : (outcome.isGoal ? 'TOMAMOS GOL...' : 'DEFESA!')}
                </p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 text-sm text-white/80 font-medium max-w-xs mx-auto drop-shadow"
                >
                  {outcome.narrative}
                </motion.p>
              </motion.div>

              {/* GoalScorerOverlay */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full max-w-sm"
              >
                <GoalScorerOverlay
                  isGoal={outcome.isGoal}
                  scorerName={outcome.isGoal ? penalty.takerName : 'Goleiro'}
                  scorerNumber={takerPlayer?.num}
                  minute={minute}
                  side={outcome.isGoal ? penalty.side : (penalty.side === 'home' ? 'away' : 'home')}
                  homeShort={homeShort}
                  awayShort={awayShort}
                  homeScore={homeScore}
                  awayScore={awayScore}
                  storyline={outcome.narrative}
                  scorerPortraitUrl={
                    outcome.isGoal && isHome ? takerPortraitUrl : undefined
                  }
                />
              </motion.div>

            </div>
          </motion.div>
        )}

        {/* ── Pick taker / pick slot ──────────────────────────────────── */}
        {(phase === 'pick_taker' || phase === 'pick_slot') && (
          <motion.div
            key="interactive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center w-full"
          >
            {/* Header */}
            <div className="w-full max-w-2xl px-5 mb-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-black uppercase tracking-widest text-sm text-zinc-400">
                  {isHome ? 'Penalty — Casa' : 'Penalty — Adversário'}
                </span>
                {(
                  <span className={`font-display font-black text-2xl tabular-nums ${countdown <= 2 ? 'text-red-400' : 'text-neon-yellow'}`}>
                    {countdown}s
                  </span>
                )}
              </div>
              <p className="font-bold mt-1 text-xl text-white">
                {phase === 'pick_taker' && 'Escolha o batedor'}
                {phase === 'pick_slot' && isHome && `${penalty.takerName} na bola`}
                {phase === 'pick_slot' && !isHome && `${penalty.takerName} vai cobrar`}
              </p>
              {phase === 'pick_slot' && (
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-neon-yellow">
                  {isHome ? '👇 Escolha onde chutar' : '🧤 Escolha onde defender'}
                </p>
              )}
            </div>

            {/* Goal image + slots */}
            <div className="w-full max-w-2xl px-2 relative">
              <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
                <img
                  src="/test-pitch/teste-image-real.jpg"
                  alt="Gol"
                  className="w-full h-full object-cover rounded-xl select-none pointer-events-none"
                  draggable={false}
                />
                {phase === 'pick_slot' && (
                  <div
                    className="absolute grid grid-cols-3 grid-rows-3 gap-1"
                    style={{ left: '2%', right: '2%', top: '7%', bottom: '27%' }}
                  >
                    {[1, 4, 7, 2, 5, 8, 3, 6, 9].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => isHome ? handleSlotPick(slot) : handleDefendSlot(slot)}
                        className={`rounded-lg border-2 active:scale-95 transition-all flex items-center justify-center ${
                          isHome
                            ? 'border-white/40 bg-black/10 hover:bg-neon-yellow/25 hover:border-neon-yellow'
                            : 'border-white/40 bg-black/10 hover:bg-blue-400/25 hover:border-blue-400'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-white/80 font-display uppercase tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {SLOT_LABELS[slot]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Taker picker */}
            {phase === 'pick_taker' && (
              <div className="w-full max-w-2xl px-5 mt-3">
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                  {homePlayers.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      onClick={() => {
                        setSelectedTakerId(p.playerId);
                        onPickTaker(p.playerId, p.name);
                      }}
                      className={`text-left px-3 py-2 rounded-lg border text-sm font-bold transition-all ${
                        selectedTakerId === p.playerId
                          ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                          : 'border-zinc-700 bg-zinc-900 text-white hover:border-zinc-500'
                      }`}
                    >
                      <span className="text-zinc-400 text-xs mr-1">{p.num}</span>
                      {p.name}
                      <span className="block text-[10px] text-zinc-500 font-normal">{p.pos}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dica de timeout */}
            {phase === 'pick_slot' && (
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-display mt-2">
                {isHome ? 'Sem escolha = chute no centro (defesa do goleiro)' : 'Sem escolha = goleiro fica no centro'}
              </p>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}

// ─── SlotHighlight (mantido para uso futuro) ────────────────────────────────

const SLOT_POSITIONS: Record<number, { col: number; row: number }> = {
  1: { col: 0, row: 0 }, 2: { col: 0, row: 1 }, 3: { col: 0, row: 2 },
  4: { col: 1, row: 0 }, 5: { col: 1, row: 1 }, 6: { col: 1, row: 2 },
  7: { col: 2, row: 0 }, 8: { col: 2, row: 1 }, 9: { col: 2, row: 2 },
};

const GRID_LEFT = 2;
const GRID_RIGHT = 2;
const GRID_TOP = 7;
const GRID_BOTTOM = 27;
const GRID_W = 100 - GRID_LEFT - GRID_RIGHT;
const GRID_H = 100 - GRID_TOP - GRID_BOTTOM;
const CELL_W = GRID_W / 3;
const CELL_H = GRID_H / 3;

export function SlotHighlight({ slot, color, label }: { slot: number; color: string; label: string }) {
  const pos = SLOT_POSITIONS[slot];
  if (!pos) return null;
  const left = GRID_LEFT + pos.col * CELL_W;
  const top  = GRID_TOP  + pos.row * CELL_H;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute rounded-md flex items-center justify-center"
      style={{
        left: `${left}%`, top: `${top}%`,
        width: `${CELL_W}%`, height: `${CELL_H}%`,
        background: color,
        border: `2px solid ${color.replace(/[\d.]+\)$/, '1)')}`,
      }}
    >
      <span className="text-white font-display font-black text-xs uppercase tracking-wide drop-shadow">
        {label}
      </span>
    </motion.div>
  );
}
