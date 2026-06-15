/**
 * PenaltyShootout — disputa de pênaltis da Partida Rápida 2.0 (Legacy Tech).
 *
 * Coração puro: cada cobrança é um ATO. O batedor sobe pra bola (tensão), e só
 * então vem o desfecho (GOL/DEFENDEU/PERDEU) com reação narrada. Embaixo de cada
 * time, a lista de batedores vai marcando quem fez e quem perdeu — placar humano.
 *
 * Fluxo:
 *   setup   — manager escala 5 de 7 EM ORDEM, vendo técnica/físico/cansaço.
 *   playing — cobranças alternadas, cada uma em 2 tempos (sobe → bate), pacing
 *             dramático, narração que cresce na morte súbita e na decisão.
 *   result  — vencedor (nunca empata).
 *
 * A simulação é determinística (penaltyShootout.ts); a UI só REVELA, com alma.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Crosshair, Hand, Flame } from 'lucide-react';
import {
  simulateShootout,
  rankKickers,
  type ShootoutKicker,
  type ShootoutKeeper,
  type ShootoutResult,
  type ShootoutKick,
} from '@/match/quickEngaged/penaltyShootout';

export interface ShootoutSetup {
  homeKickers: ShootoutKicker[];
  awayKickers: ShootoutKicker[];
  homeKeeper: ShootoutKeeper;
  awayKeeper: ShootoutKeeper;
}

interface Props {
  setup: ShootoutSetup;
  seed: string;
  homeName: string;
  awayName: string;
  onDone: (result: ShootoutResult) => void;
}

const STEPUP_MS = 1750; // batedor sobe pra bola (tensão)
const RESULT_MS = 2400; // desfecho + reação (deixa respirar)
const DECIDER_STEPUP_MS = 3100; // o decisivo respira mais (coração na boca)
const DECIDER_RESULT_MS = 3300; // clímax aguenta na tela

// Batida de coração: zoom-out e dois "thumps" de zoom-in (foco no detalhe).
const HEARTBEAT_SCALE = [0.9, 1.0, 0.96, 1.1, 0.98, 1.06, 1.0];
const HEARTBEAT_TIMES = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 1];

const fatigueWord = (f: number): string =>
  f <= 35 ? 'inteiro' : f <= 65 ? 'no ritmo' : f <= 85 ? 'no limite' : 'apagando';

const pick = (pool: string[], salt: number): string => pool[salt % pool.length]!;

/** Frase de TENSÃO antes da batida (sobe pra bola). */
function tensionLine(kick: ShootoutKick, decider: boolean, salt: number): string {
  if (decider) {
    return pick([
      `É ESSA. ${kick.kickerName} pra decidir tudo.`,
      `Tudo nessa bola. ${kick.kickerName} no ponto da cal.`,
      `${kick.kickerName} carrega o jogo nos pés agora.`,
    ], salt);
  }
  if (kick.suddenDeath) {
    return pick([
      `Morte súbita. ${kick.kickerName} não pode falhar.`,
      `Sem rede. ${kick.kickerName} ajeita a bola e respira.`,
      `${kick.kickerName} encara o goleiro. Coração na boca.`,
    ], salt);
  }
  return pick([
    `${kick.kickerName} na bola. Frieza agora.`,
    `${kick.kickerName} ajeita a marca. Silêncio total.`,
    `É a vez de ${kick.kickerName}. Pressão pura.`,
    `${kick.kickerName} olha pro canto e respira fundo.`,
  ], salt);
}

/** Reação narrada ao desfecho. */
function reactionLine(kick: ShootoutKick, decider: boolean, winnerName: string, salt: number): string {
  if (kick.scored) {
    const base = pick([
      'No canto, sem chance pro goleiro!',
      'Pé firme — bateu com categoria!',
      'Bola no fundo das redes!',
      'Frieza absoluta. Marcou!',
    ], salt);
    return decider ? `${base} ACABOU — ${winnerName} é o campeão!` : base;
  }
  if (kick.outcome === 'save') {
    const base = pick([
      'DEFENDEU! Que paredão!',
      'O goleiro voou e pegou!',
      'PEGOU! Herói da disputa!',
      'Travou embaixo do travessão!',
    ], salt);
    return decider ? `${base} ${winnerName} segura e leva!` : base;
  }
  const base = pick([
    'PERDEU! Mandou pra fora!',
    'Isolou! Que peso nessa bola...',
    'Na trave! Inacreditável!',
    'Jogou pra fora — vai pesar!',
  ], salt);
  return decider ? `${base} ${winnerName} se aproveita e vence!` : base;
}

/** Mini-barra de atributo (rótulo Agency + barra dourada). */
function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-display uppercase tracking-[0.14em] text-[8px] text-white/45 w-12 shrink-0">{label}</span>
      <span className="flex-1 h-1 rounded-full bg-deep-black/70 overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: 'var(--color-neon-yellow)' }} />
      </span>
      <span className="font-display tabular-nums text-[10px] font-bold text-white/80 w-6 text-right">{Math.round(value)}</span>
    </div>
  );
}

export function PenaltyShootout({ setup, seed, homeName, awayName, onDone }: Props) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>('setup');
  const candidates = useMemo(() => rankKickers(setup.homeKickers).slice(0, 7), [setup.homeKickers]);
  const [order, setOrder] = useState<string[]>([]);

  const toggle = (id: string) => {
    setOrder((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 5 ? prev : [...prev, id]);
  };

  const [result, setResult] = useState<ShootoutResult | null>(null);
  // Revelação em 2 tempos por cobrança: 'stepup' (sobe pra bola) → 'result'.
  const [kickIdx, setKickIdx] = useState(0);
  const [stage, setStage] = useState<'stepup' | 'result'>('stepup');
  const timerRef = useRef<number | null>(null);

  const start = () => {
    if (order.length !== 5) return;
    const byId = new Map(setup.homeKickers.map((k) => [k.id, k]));
    const chosen = order.map((id) => byId.get(id)!).filter(Boolean);
    const rest = rankKickers(setup.homeKickers.filter((k) => !order.includes(k.id)));
    const homeOrder = [...chosen, ...rest];
    const awayOrder = rankKickers(setup.awayKickers);
    const res = simulateShootout({
      homeOrder, awayOrder, homeKeeper: setup.homeKeeper, awayKeeper: setup.awayKeeper, seed,
    });
    setResult(res);
    setKickIdx(0);
    setStage('stepup');
    setPhase('playing');
  };

  // Motor de revelação: stepup → result → próxima cobrança.
  useEffect(() => {
    if (phase !== 'playing' || !result) return undefined;
    if (kickIdx >= result.kicks.length) {
      timerRef.current = window.setTimeout(() => setPhase('result'), 900);
      return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    }
    const decider = kickIdx === result.kicks.length - 1;
    const ms = stage === 'stepup'
      ? (decider ? DECIDER_STEPUP_MS : STEPUP_MS)
      : (decider ? DECIDER_RESULT_MS : RESULT_MS);
    timerRef.current = window.setTimeout(() => {
      if (stage === 'stepup') setStage('result');
      else { setKickIdx((i) => i + 1); setStage('stepup'); }
    }, ms);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [phase, kickIdx, stage, result]);

  useEffect(() => {
    if (phase === 'result' && result) {
      const t = window.setTimeout(() => onDone(result), 3600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, result, onDone]);

  // Estado derivado da revelação.
  const kicks = result?.kicks ?? [];
  const resolvedCount = stage === 'result' ? kickIdx + 1 : kickIdx; // cobranças já resolvidas
  const currentKick = kicks[kickIdx];
  const isDecider = !!result && kickIdx === kicks.length - 1;
  const winnerName = result ? (result.winner === 'home' ? homeName : awayName) : '';

  // Placar ao vivo (após as resolvidas).
  const resolved = kicks.slice(0, resolvedCount);
  const liveHome = resolved.filter((k) => k.side === 'home' && k.scored).length;
  const liveAway = resolved.filter((k) => k.side === 'away' && k.scored).length;

  // Linhas por time (resolvidas + a que está batendo agora).
  const rowsFor = (side: 'home' | 'away') =>
    kicks
      .map((k, gi) => ({ k, gi }))
      .filter(({ k, gi }) => k.side === side && (gi < resolvedCount || gi === kickIdx));

  return (
    <div className="w-full">
      <div className="text-center mb-3">
        <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-neon-yellow">
          Disputa de Pênaltis
        </p>
        <p className="font-serif italic text-white/70 text-[13px]" style={{ fontFamily: 'var(--font-serif-hero)' }}>
          {phase === 'setup' ? 'Empate — quem decide é você. Escale os 5 batedores.' : 'Aqui é coração. Frieza ganha.'}
        </p>
      </div>

      {/* ─── SETUP ──────────────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <div className="flex flex-col gap-1.5">
          {candidates.map((k) => {
            const idx = order.indexOf(k.id);
            const picked = idx >= 0;
            const tired = k.fatigue > 85;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggle(k.id)}
                className="flex items-center gap-3 px-3 py-2 border text-left transition-all active:scale-[0.99]"
                style={{
                  borderRadius: 'var(--radius-md)',
                  borderColor: picked ? 'var(--color-neon-yellow)' : 'var(--color-border)',
                  backgroundColor: picked ? 'color-mix(in srgb, var(--color-neon-yellow) 10%, transparent)' : 'var(--color-dark-gray)',
                }}
              >
                <span
                  className="w-7 h-7 shrink-0 flex items-center justify-center font-serif italic text-[15px] rounded-full"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    backgroundColor: picked ? 'var(--color-neon-yellow)' : 'transparent',
                    color: picked ? '#000' : 'rgba(255,255,255,0.4)',
                    border: picked ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {picked ? idx + 1 : '–'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display uppercase font-black text-white truncate text-[12px] tracking-[0.03em]">{k.name}</span>
                  <span className="block uppercase tracking-[0.12em] text-[9px]" style={{ color: tired ? 'var(--color-warning)' : 'rgba(255,255,255,0.45)' }}>
                    {k.pos} · {fatigueWord(k.fatigue)}
                  </span>
                </span>
                <span className="w-32 shrink-0 flex flex-col gap-0.5">
                  <AttrBar label="Técnica" value={k.finalizacao} />
                  <AttrBar label="Físico" value={k.fisico} />
                  <AttrBar label="Cansaço" value={k.fatigue} />
                </span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={order.length !== 5}
            onClick={start}
            className="mt-2 w-full py-3 font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-neon-yellow)', color: '#000', borderRadius: 'var(--radius-md)' }}
          >
            {order.length === 5 ? 'Bater os pênaltis' : `Escale ${5 - order.length} batedor${5 - order.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      )}

      {/* ─── PLAYING / RESULT ───────────────────────────────────────────────── */}
      {(phase === 'playing' || phase === 'result') && result && (
        <div className="flex flex-col gap-4">
          {/* Placar grande */}
          <div className="flex items-center justify-center gap-5">
            <span className="font-display uppercase tracking-[0.1em] text-[11px] font-black text-neon-yellow text-right w-24 truncate">{homeName}</span>
            <motion.span
              key={`${liveHome}-${liveAway}`}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="font-serif italic tabular-nums text-5xl"
              style={{ fontFamily: 'var(--font-serif-hero)', color: '#fff' }}
            >
              {liveHome}<span className="text-white/40 mx-1">–</span>{liveAway}
            </motion.span>
            <span className="font-display uppercase tracking-[0.1em] text-[11px] font-black text-white/70 text-left w-24 truncate">{awayName}</span>
          </div>

          {/* Palco da cobrança atual (sobe pra bola → desfecho) */}
          <div className="min-h-[78px] flex items-center justify-center px-2">
            <AnimatePresence mode="wait">
              {phase === 'playing' && currentKick && stage === 'stepup' && (
                <motion.div
                  key={`step-${kickIdx}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="relative text-center"
                >
                  {/* Coração na boca: no decisivo o foco PULSA (zoom-out → zoom-in). */}
                  <motion.div
                    animate={isDecider ? { scale: HEARTBEAT_SCALE } : { scale: 1 }}
                    transition={isDecider ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut', times: HEARTBEAT_TIMES } : undefined}
                  >
                    {isDecider && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-full"
                        style={{ background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--color-neon-yellow) 26%, transparent), transparent 70%)' }}
                        animate={{ opacity: [0.2, 0.55, 0.2] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', times: HEARTBEAT_TIMES }}
                      />
                    )}
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/45">
                        {currentKick.side === 'home' ? homeName : awayName}
                      </span>
                      {isDecider && (
                        <span className="font-display uppercase tracking-[0.2em] text-[9px] font-black text-neon-yellow">
                          decisivo
                        </span>
                      )}
                      {currentKick.suddenDeath && (
                        <span className="flex items-center gap-1 font-display uppercase tracking-[0.16em] text-[9px] font-black text-neon-yellow">
                          <Flame className="w-3 h-3" strokeWidth={2.5} aria-hidden /> morte súbita
                        </span>
                      )}
                    </div>
                    {isDecider ? (
                      <p
                        className="font-serif italic text-[22px] leading-tight text-white px-2"
                        style={{ fontFamily: 'var(--font-serif-hero)', textShadow: '0 0 20px color-mix(in srgb, var(--color-neon-yellow) 55%, transparent)' }}
                      >
                        {tensionLine(currentKick, isDecider, kickIdx)}
                      </p>
                    ) : (
                      <motion.p
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                        className="font-serif italic text-[16px] text-white/90"
                        style={{ fontFamily: 'var(--font-serif-hero)' }}
                      >
                        {tensionLine(currentKick, isDecider, kickIdx)}
                      </motion.p>
                    )}
                  </motion.div>
                </motion.div>
              )}
              {phase === 'playing' && currentKick && stage === 'result' && (
                <motion.div
                  key={`res-${kickIdx}`}
                  initial={{ opacity: 0, scale: isDecider ? 1.5 : 0.85, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: isDecider ? 240 : 360, damping: isDecider ? 14 : 18 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-0.5">
                    {currentKick.scored
                      ? <Crosshair className={isDecider ? 'w-7 h-7 text-success' : 'w-5 h-5 text-success'} strokeWidth={2.5} aria-hidden />
                      : <Hand className={isDecider ? 'w-7 h-7 text-danger' : 'w-5 h-5 text-danger'} strokeWidth={2.5} aria-hidden />}
                    <span
                      className={`font-display uppercase font-black ${isDecider ? 'tracking-[0.22em] text-[24px]' : 'tracking-[0.2em] text-[15px]'}`}
                      style={{
                        color: currentKick.scored ? 'var(--color-success)' : 'var(--color-danger)',
                        textShadow: isDecider ? `0 0 24px color-mix(in srgb, ${currentKick.scored ? 'var(--color-success)' : 'var(--color-danger)'} 55%, transparent)` : undefined,
                      }}
                    >
                      {currentKick.scored ? 'GOL!' : currentKick.outcome === 'save' ? 'DEFENDEU!' : 'PERDEU!'}
                    </span>
                  </div>
                  <p className={`font-serif italic text-white/80 ${isDecider ? 'text-[16px] px-2' : 'text-[14px]'}`} style={{ fontFamily: 'var(--font-serif-hero)' }}>
                    {currentKick.kickerName} — {reactionLine(currentKick, isDecider, winnerName, kickIdx)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Placar HUMANO: quem fez e quem perdeu, embaixo de cada time */}
          <div className="grid grid-cols-2 gap-2">
            {(['home', 'away'] as const).map((side) => (
              <div
                key={side}
                className="border p-2 flex flex-col gap-1"
                style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-dark-gray)' }}
              >
                <p className="font-display uppercase tracking-[0.2em] text-[8px] font-black text-center mb-0.5"
                   style={{ color: side === 'home' ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.5)' }}>
                  {side === 'home' ? homeName : awayName}
                </p>
                <AnimatePresence initial={false}>
                  {rowsFor(side).map(({ k, gi }) => {
                    const pending = gi === kickIdx && stage === 'stepup';
                    return (
                      <motion.div
                        key={gi}
                        initial={{ opacity: 0, x: side === 'home' ? -8 : 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        {pending ? (
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                            style={{ border: '1px solid var(--color-neon-yellow)' }}
                          >
                            <motion.span
                              animate={{ scale: [0.5, 1, 0.5], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: 'var(--color-neon-yellow)' }}
                            />
                          </span>
                        ) : (
                          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center leading-none" style={{ fontSize: '12px' }} aria-hidden>
                            {k.scored ? '⚽' : '🚫'}
                          </span>
                        )}
                        <span className={`font-display uppercase tracking-[0.04em] text-[10px] truncate ${pending ? 'text-neon-yellow' : 'text-white/75'}`}>
                          {k.kickerName}
                        </span>
                        {k.suddenDeath && !pending && (
                          <Flame className="w-2.5 h-2.5 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Resultado final */}
          {phase === 'result' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="text-center py-3 border-t border-white/8"
            >
              <Check className="w-7 h-7 mx-auto mb-1" style={{ color: result.winner === 'home' ? 'var(--color-success)' : 'var(--color-danger)' }} strokeWidth={3} aria-hidden />
              <p className="font-serif italic text-2xl" style={{ fontFamily: 'var(--font-serif-hero)', color: result.winner === 'home' ? 'var(--color-neon-yellow)' : '#fff' }}>
                {winnerName}
              </p>
              <p className="font-display uppercase tracking-[0.22em] text-[10px] font-black text-white/60 mt-0.5">
                venceu nos pênaltis · {result.homeTally}–{result.awayTally}
                {result.suddenDeath ? ' · morte súbita' : ''}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
