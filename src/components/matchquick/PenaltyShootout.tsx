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
import { L, emIngles } from '@/i18n/L';
import { posLabel } from './posLabel';

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
  f <= 35 ? L('inteiro', 'fresh') : f <= 65 ? L('no ritmo', 'in rhythm') : f <= 85 ? L('no limite', 'at the limit') : L('apagando', 'fading');

const pick = (pool: string[], salt: number): string => pool[salt % pool.length]!;

/** Frase de TENSÃO antes da batida (sobe pra bola). */
function tensionLine(kick: ShootoutKick, decider: boolean, salt: number): string {
  if (decider) {
    return pick([
      L(`É ESSA. ${kick.kickerName} pra decidir tudo.`, `THIS IS IT. ${kick.kickerName} to decide it all.`),
      L(`Tudo nessa bola. ${kick.kickerName} no ponto da cal.`, `Everything on this kick. ${kick.kickerName} on the spot.`),
      L(`${kick.kickerName} carrega o jogo nos pés agora.`, `${kick.kickerName} carries the match on his boots now.`),
    ], salt);
  }
  if (kick.suddenDeath) {
    return pick([
      L(`Morte súbita. ${kick.kickerName} não pode falhar.`, `Sudden death. ${kick.kickerName} can't miss.`),
      L(`Sem rede. ${kick.kickerName} ajeita a bola e respira.`, `No safety net. ${kick.kickerName} sets the ball and breathes.`),
      L(`${kick.kickerName} encara o goleiro. Coração na boca.`, `${kick.kickerName} stares down the keeper. Hearts in mouths.`),
    ], salt);
  }
  return pick([
    L(`${kick.kickerName} na bola. Frieza agora.`, `${kick.kickerName} on the ball. Ice in the veins.`),
    L(`${kick.kickerName} ajeita a marca. Silêncio total.`, `${kick.kickerName} sets the spot. Total silence.`),
    L(`É a vez de ${kick.kickerName}. Pressão pura.`, `${kick.kickerName} steps up. Pure pressure.`),
    L(`${kick.kickerName} olha pro canto e respira fundo.`, `${kick.kickerName} eyes the corner and breathes deep.`),
  ], salt);
}

/** Reação narrada ao desfecho. */
function reactionLine(kick: ShootoutKick, decider: boolean, winnerName: string, salt: number): string {
  if (kick.scored) {
    const base = pick([
      L('No canto, sem chance pro goleiro!', 'In the corner, no chance for the keeper!'),
      L('Pé firme — bateu com categoria!', 'Firm strike — taken with class!'),
      L('Bola no fundo das redes!', 'Into the back of the net!'),
      L('Frieza absoluta. Marcou!', 'Ice cold. Scored!'),
    ], salt);
    return decider ? L(`${base} ACABOU — ${winnerName} é o campeão!`, `${base} IT'S OVER — ${winnerName} are the champions!`) : base;
  }
  if (kick.outcome === 'save') {
    const base = pick([
      L('DEFENDEU! Que paredão!', 'SAVED! What a wall!'),
      L('O goleiro voou e pegou!', 'The keeper flies and saves!'),
      L('PEGOU! Herói da disputa!', 'SAVED! Shootout hero!'),
      L('Travou embaixo do travessão!', 'Stopped right under the bar!'),
    ], salt);
    return decider ? L(`${base} ${winnerName} segura e leva!`, `${base} ${winnerName} hold on and win it!`) : base;
  }
  const base = pick([
    L('PERDEU! Mandou pra fora!', 'MISSED! Sent it wide!'),
    L('Isolou! Que peso nessa bola...', 'Skied it! The weight of that kick...'),
    L('Na trave! Inacreditável!', 'Off the post! Unbelievable!'),
    L('Jogou pra fora — vai pesar!', 'Wide — that will hurt!'),
  ], salt);
  return decider ? L(`${base} ${winnerName} se aproveita e vence!`, `${base} ${winnerName} take advantage and win!`) : base;
}

/** Mini-barra de atributo (rótulo de prova + barra chapada). */
function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 font-prova text-[8.5px] uppercase tracking-[0.1em] text-mudo">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden bg-linha">
        <span className="block h-full bg-papel" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </span>
      <span className="w-6 text-right font-impact text-[11px] tabular-nums text-papel">{Math.round(value)}</span>
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
      <div className="mb-4 text-center">
        <p className="font-prova text-[11px] font-bold uppercase tracking-[0.24em] text-rua">
          — {L('Disputa de pênaltis', 'Penalty shootout')}
        </p>
        {phase === 'setup' && (
          <p className="mt-1 font-voz text-[26px] leading-none text-papel">{L('Escale os 5 batedores.', 'Pick your 5 takers.')}</p>
        )}
      </div>

      {/* ─── SETUP ──────────────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <div className="flex flex-col gap-2">
          {candidates.map((k) => {
            const idx = order.indexOf(k.id);
            const picked = idx >= 0;
            const tired = k.fatigue > 85;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggle(k.id)}
                aria-pressed={picked}
                className={`flex min-h-[58px] min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors ${
                  picked ? 'border-2 border-rua bg-concreto' : 'border-2 border-linha bg-concreto hover:border-fio'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center font-spray font-black text-[20px] leading-none ${
                    picked ? 'bg-rua text-asfalto-27' : 'border-2 border-dashed border-fio text-fio'
                  }`}
                >
                  {picked ? idx + 1 : '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-voz text-[19px] leading-none text-papel">{k.name}</span>
                  <span className={`mt-1 block font-prova text-[9.5px] font-bold uppercase tracking-[0.1em] ${tired ? 'text-baixa' : 'text-mudo'}`}>
                    {posLabel(k.pos)} · {fatigueWord(k.fatigue)}
                  </span>
                </span>
                <span className="flex w-[7.5rem] shrink-0 flex-col gap-0.5 sm:w-32">
                  <AttrBar label={L('Técnica', 'Technique')} value={k.finalizacao} />
                  <AttrBar label={L('Físico', 'Physical')} value={k.fisico} />
                  <AttrBar label={L('Cansaço', 'Fatigue')} value={k.fatigue} />
                </span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={order.length !== 5}
            onClick={start}
            className="mt-3 inline-flex min-h-[54px] w-full items-center justify-center gap-2 bg-rua font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow,opacity] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:opacity-40 disabled:shadow-none"
          >
            {order.length === 5 ? <>{L('Bater os pênaltis', 'Take the penalties')} <span aria-hidden>→</span></> : emIngles() ? `Pick ${5 - order.length} more taker${5 - order.length === 1 ? '' : 's'}` : `Escale ${5 - order.length} batedor${5 - order.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      )}

      {/* ─── PLAYING / RESULT ───────────────────────────────────────────────── */}
      {(phase === 'playing' || phase === 'result') && result && (
        <div className="flex flex-col gap-4">
          {/* Placar grande, em spray */}
          <div className="flex min-w-0 items-center justify-center gap-3">
            <span className="w-24 truncate text-right font-impact text-[14px] uppercase leading-none text-papel">{homeName}</span>
            <motion.span
              key={`${liveHome}-${liveAway}`}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="font-spray font-black text-[64px] leading-none tabular-nums text-rua"
            >
              {liveHome}<span className="mx-1 text-[0.6em]">×</span>{liveAway}
            </motion.span>
            <span className="w-24 truncate text-left font-impact text-[14px] uppercase leading-none text-mudo">{awayName}</span>
          </div>

          {/* Palco da cobrança atual (sobe pra bola → desfecho) */}
          <div className="flex min-h-[86px] items-center justify-center px-2">
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
                    <div className="mb-1.5 flex flex-wrap items-center justify-center gap-2">
                      <span className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">
                        {currentKick.side === 'home' ? homeName : awayName}
                      </span>
                      {isDecider && (
                        <span className="bg-rua px-1.5 py-0.5 font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-asfalto-27">
                          {L('decisivo', 'decider')}
                        </span>
                      )}
                      {currentKick.suddenDeath && (
                        <span className="flex items-center gap-1 font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-rua">
                          <Flame className="h-3 w-3" strokeWidth={2.5} aria-hidden /> {L('morte súbita', 'sudden death')}
                        </span>
                      )}
                    </div>
                    {isDecider ? (
                      <p className="px-2 font-voz text-[28px] leading-[1.05] text-rua">
                        {tensionLine(currentKick, isDecider, kickIdx)}
                      </p>
                    ) : (
                      <motion.p
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                        className="font-voz text-[23px] leading-[1.05] text-papel"
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
                  <p
                    className={`font-spray font-black uppercase leading-none ${isDecider ? 'text-[56px]' : 'text-[40px]'} ${
                      currentKick.scored ? 'text-rua' : 'text-papel'
                    }`}
                  >
                    {currentKick.scored ? L('GOL!', 'GOAL!') : currentKick.outcome === 'save' ? L('DEFENDEU!', 'SAVED!') : L('PERDEU!', 'MISSED!')}
                  </p>
                  <p className={`mt-1 text-suave ${isDecider ? 'px-2 text-[16px]' : 'text-[14px]'}`}>
                    {currentKick.scored
                      ? <Crosshair className="mr-1 inline h-4 w-4 align-[-2px] text-rua" strokeWidth={2.5} aria-hidden />
                      : <Hand className="mr-1 inline h-4 w-4 align-[-2px] text-papel" strokeWidth={2.5} aria-hidden />}
                    <span className="font-voz text-[19px] leading-none text-papel">{currentKick.kickerName}</span> — {reactionLine(currentKick, isDecider, winnerName, kickIdx)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Placar HUMANO: quem fez e quem perdeu, embaixo de cada time */}
          <div className="grid grid-cols-2 gap-2">
            {(['home', 'away'] as const).map((side) => (
              <div key={side} className="flex min-w-0 flex-col gap-1.5 bg-concreto p-2.5">
                <p className={`mb-0.5 truncate text-center font-prova text-[9.5px] font-bold uppercase tracking-[0.16em] ${side === 'home' ? 'text-rua' : 'text-mudo'}`}>
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
                        className="flex min-w-0 items-center gap-1.5"
                      >
                        {pending ? (
                          <span className="h-3.5 w-3.5 shrink-0 animate-pulse border-2 border-rua" aria-hidden />
                        ) : (
                          <span
                            aria-label={k.scored ? L('Gol', 'Goal') : L('Perdeu', 'Missed')}
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center font-impact text-[10px] leading-none ${
                              k.scored ? 'bg-rua text-asfalto-27' : 'border-2 border-fio text-fio'
                            }`}
                          >
                            {k.scored ? '' : '×'}
                          </span>
                        )}
                        <span className={`truncate font-impact text-[12px] uppercase leading-none ${pending ? 'text-rua' : k.scored ? 'text-papel' : 'text-mudo line-through'}`}>
                          {k.kickerName}
                        </span>
                        {k.suddenDeath && !pending && (
                          <Flame className="h-2.5 w-2.5 shrink-0 text-rua" strokeWidth={2.5} aria-hidden />
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
              className="border-t border-linha py-4 text-center"
            >
              <Check className={`mx-auto mb-1 h-7 w-7 ${result.winner === 'home' ? 'text-rua' : 'text-mudo'}`} strokeWidth={3} aria-hidden />
              <p className={`font-impact text-[30px] uppercase leading-none ${result.winner === 'home' ? 'text-rua' : 'text-papel'}`}>
                {winnerName}
              </p>
              <p className="mt-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                {L('venceu nos pênaltis', 'won on penalties')} · {result.homeTally}–{result.awayTally}
                {result.suddenDeath ? L(' · morte súbita', ' · sudden death') : ''}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
