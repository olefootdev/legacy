/**
 * QuickPlanPlayer — renderiza um MatchPlan pré-computado em ~25s por tempo.
 *
 * Fase B (Quick 2.0): scheduler SEQUENCIAL pausável, não mais timeouts
 * absolutos. O jogo roda em dois planos:
 *   • Plano físico — barra de momento + eventos com timing por weight_tier
 *     (epic 3.5s / big 1.8s / normal 0.5s / minor 0.15s)
 *   • Plano mental — analyst beats pausam o relógio, o manager decide, e a
 *     decisão altera deterministicamente os eventos restantes do tempo
 *     (quickBeatDirector). Pesos nunca aparecem na UI.
 *
 * No 45', se `onSecondHalf` for fornecido, o player pausa e pede o replan
 * (Python re-simula 46-90' com o ledger). Sem o hook, segue o plano baseline.
 * Veredito por decisão + Leitura de Jogo aparecem no apito final.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  AnalystBeat,
  AnalystBeatChoice,
  MatchEventTier,
  MatchPlan,
  MatchPlanEvent,
} from './quickPlanTypes';
import { TIER_ANIMATION_MS } from './quickPlanTypes';
import {
  applyDecisionToRemainingEvents,
  computeBeatVerdicts,
  computeReadingScore,
  toDecisionRecord,
  QUICK_PLAN_FEED_MAX,
  type BeatDecisionRecord,
  type BeatVerdict,
  type QuickPlanFeedItem,
} from './quickBeatDirector';
import { AnalystBeatCard } from '@/components/matchquick/AnalystBeatCard';

export interface QuickPlanHalftimeContext {
  ledger: BeatDecisionRecord[];
  homeScore: number;
  awayScore: number;
  momentumEnd: number;
  cardsHome: number;
  cardsAway: number;
  sentOffHome: number;
  sentOffAway: number;
}

export interface QuickPlanPlayResult {
  homeScore: number;
  awayScore: number;
  ledger: BeatDecisionRecord[];
  verdicts: BeatVerdict[];
  reading: { good: number; total: number };
  replanned: boolean;
}

interface Props {
  plan: MatchPlan;
  onComplete?: (plan: MatchPlan, result: QuickPlanPlayResult) => void;
  /** Reduz duração total se o user quiser ainda mais rápido (default 1.0). */
  speedMultiplier?: number;
  /**
   * Seam do intervalo (Fase C pluga a UI real aqui): recebe o estado do 1º
   * tempo + ledger e devolve o plano replanejado do 2º tempo (ou null pra
   * seguir com o baseline).
   */
  onSecondHalf?: (ctx: QuickPlanHalftimeContext) => Promise<MatchPlan | null>;
}

type PlayerPhase = 'playing' | 'beat' | 'halftime' | 'done';

const TIER_STYLE: Record<MatchEventTier, { badge: string; color: string; bg: string }> = {
  epic: { badge: '🔥 MOMENTO ÉPICO', color: 'text-rose-200', bg: 'bg-rose-500/20 border-rose-400/40' },
  big: { badge: 'AÇÃO', color: 'text-amber-200', bg: 'bg-amber-500/20 border-amber-400/40' },
  normal: { badge: '', color: 'text-white/85', bg: 'bg-zinc-800/80 border-zinc-700/60' },
  minor: { badge: '', color: 'text-white/60', bg: 'bg-zinc-900/60 border-zinc-800/50' },
};

const FEED_STYLE: Record<QuickPlanFeedItem['kind'], string> = {
  insight: 'text-white/70 italic',
  decision: 'text-amber-200',
  goal_home: 'text-amber-300 font-bold',
  goal_away: 'text-white/90 font-bold',
  red: 'text-red-400',
  halftime: 'text-white/50 uppercase tracking-[0.2em] text-[10px]',
};

export function QuickPlanPlayer({ plan, onComplete, speedMultiplier = 1.0, onSecondHalf }: Props) {
  const [phase, setPhase] = useState<PlayerPhase>('playing');
  const [cursor, setCursor] = useState(-1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [activeBeat, setActiveBeat] = useState<AnalystBeat | null>(null);
  const [feed, setFeed] = useState<QuickPlanFeedItem[]>([]);
  const [doneInfo, setDoneInfo] = useState<{ verdicts: BeatVerdict[]; reading: { good: number; total: number } } | null>(null);

  const eventsRef = useRef<MatchPlanEvent[]>(plan.events);
  const beatsQueueRef = useRef<AnalystBeat[]>([...(plan.analyst_beats ?? [])]);
  const momentumRef = useRef<number[]>([...plan.momentum_curve]);
  const ledgerRef = useRef<BeatDecisionRecord[]>([]);
  const cursorRef = useRef(-1);
  const scoreRef = useRef({ home: 0, away: 0 });
  const cardsRef = useRef({ cardsHome: 0, cardsAway: 0, sentOffHome: 0, sentOffAway: 0 });
  const offeredRef = useRef(0);
  const htDoneRef = useRef(false);
  const replannedRef = useRef(false);
  const completedRef = useRef(false);
  const nextDelayOverrideRef = useRef<number | null>(null);

  const pushFeed = (item: QuickPlanFeedItem) => {
    setFeed((prev) => [...prev, item].slice(-QUICK_PLAN_FEED_MAX));
  };

  const processEvent = (e: MatchPlanEvent, idx: number) => {
    if (e.kind === 'goal_home') {
      scoreRef.current.home += 1;
      setHomeScore((v) => v + 1);
      pushFeed({ id: `g-${idx}`, minute: e.minute, kind: 'goal_home', text: e.text });
    } else if (e.kind === 'goal_away') {
      scoreRef.current.away += 1;
      setAwayScore((v) => v + 1);
      pushFeed({ id: `g-${idx}`, minute: e.minute, kind: 'goal_away', text: e.text });
    } else if (e.kind === 'yellow_home') {
      cardsRef.current.cardsHome += 1;
    } else if (e.kind === 'yellow_away') {
      cardsRef.current.cardsAway += 1;
    } else if (e.kind === 'red_home') {
      cardsRef.current.sentOffHome += 1;
      pushFeed({ id: `r-${idx}`, minute: e.minute, kind: 'red', text: e.text });
    } else if (e.kind === 'red_away') {
      cardsRef.current.sentOffAway += 1;
      pushFeed({ id: `r-${idx}`, minute: e.minute, kind: 'red', text: e.text });
    }
  };

  const finalize = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const verdicts = computeBeatVerdicts(eventsRef.current, ledgerRef.current);
    const reading = computeReadingScore(ledgerRef.current, offeredRef.current);
    setDoneInfo({ verdicts, reading });
    setPhase('done');
    onComplete?.(plan, {
      homeScore: scoreRef.current.home,
      awayScore: scoreRef.current.away,
      ledger: [...ledgerRef.current],
      verdicts,
      reading,
      replanned: replannedRef.current,
    });
  };

  const runHalftime = async () => {
    htDoneRef.current = true;
    const ctx: QuickPlanHalftimeContext = {
      ledger: [...ledgerRef.current],
      homeScore: scoreRef.current.home,
      awayScore: scoreRef.current.away,
      momentumEnd: momentumRef.current[44] ?? 50,
      ...cardsRef.current,
    };
    pushFeed({
      id: 'ht',
      minute: 45,
      kind: 'halftime',
      text: `Intervalo — ${ctx.homeScore} x ${ctx.awayScore}`,
    });
    try {
      const h2 = await onSecondHalf?.(ctx);
      if (h2 && Array.isArray(h2.events)) {
        replannedRef.current = true;
        const played = eventsRef.current.slice(0, cursorRef.current + 1);
        eventsRef.current = [...played, ...h2.events];
        beatsQueueRef.current = (h2.analyst_beats ?? []).filter((b) => b.minute > 45);
        momentumRef.current = [...momentumRef.current.slice(0, 45), ...h2.momentum_curve];
      }
    } catch {
      // Replan falhou: segue o 2º tempo baseline do plano original
    }
    nextDelayOverrideRef.current = 400;
    setPhase('playing');
  };

  const advance = () => {
    const nextIdx = cursorRef.current + 1;
    const evts = eventsRef.current;
    if (nextIdx >= evts.length) {
      finalize();
      return;
    }
    const next = evts[nextIdx]!;

    // Beat pendente antes do próximo lance? Pausa o jogo e abre a decisão.
    const beat = beatsQueueRef.current[0];
    if (beat && beat.minute <= next.minute) {
      beatsQueueRef.current = beatsQueueRef.current.slice(1);
      offeredRef.current += 1;
      pushFeed({ id: `i-${beat.id}`, minute: beat.minute, kind: 'insight', text: beat.insight.text });
      setActiveBeat(beat);
      setPhase('beat');
      return;
    }

    // Cruzou o 45'? Intervalo (replan) antes de seguir.
    if (!htDoneRef.current && onSecondHalf && next.minute > 45) {
      setPhase('halftime');
      void runHalftime();
      return;
    }

    cursorRef.current = nextIdx;
    processEvent(next, nextIdx);
    setCursor(nextIdx);
  };

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const current = cursor >= 0 ? eventsRef.current[cursor] : undefined;
    const baseDur = current ? TIER_ANIMATION_MS[current.weight_tier] / speedMultiplier : 600;
    const dur = nextDelayOverrideRef.current ?? baseDur;
    nextDelayOverrideRef.current = null;
    const t = window.setTimeout(advance, dur);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, phase]);

  const handleBeatChoice = (choice: AnalystBeatChoice | null) => {
    const beat = activeBeat;
    if (beat && choice) {
      ledgerRef.current.push(toDecisionRecord(beat, choice));
      const res = applyDecisionToRemainingEvents({
        events: eventsRef.current,
        fromIndex: cursorRef.current + 1,
        beat,
        choice,
        seed: plan.seed,
      });
      eventsRef.current = res.events;
      pushFeed({ id: `d-${beat.id}`, minute: beat.minute, kind: 'decision', text: `Você: ${choice.label}` });
    }
    setActiveBeat(null);
    nextDelayOverrideRef.current = 350;
    setPhase('playing');
  };

  const currentEvent = cursor >= 0 ? eventsRef.current[cursor] : undefined;
  const currentMinute = phase === 'beat' && activeBeat
    ? activeBeat.minute
    : currentEvent?.minute ?? 0;
  const progress = Math.min(1, currentMinute / 90);
  const momentumNow = momentumRef.current[Math.max(0, Math.min(89, currentMinute - 1))] ?? 50;

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-deep-black border border-amber-400/30 rounded-sm overflow-hidden">
      {/* Header: placar + minuto */}
      <div className="px-5 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display uppercase tracking-[0.18em] text-[11px] font-black text-white/75">
            {plan.home_short}
          </span>
          <span
            className="font-serif italic text-3xl text-white tabular-nums"
            style={{ fontFamily: 'var(--font-serif-hero)' }}
          >
            {homeScore}
          </span>
          <span className="text-white/30 text-xl">–</span>
          <span
            className="font-serif italic text-3xl text-white tabular-nums"
            style={{ fontFamily: 'var(--font-serif-hero)' }}
          >
            {awayScore}
          </span>
          <span className="font-display uppercase tracking-[0.18em] text-[11px] font-black text-white/75">
            {plan.away_short}
          </span>
        </div>
        <span className="font-display tabular-nums text-amber-300 text-sm font-bold">
          {phase === 'beat' ? '⏸ ' : ''}{currentMinute}&prime;
        </span>
      </div>

      {/* Progress bar do tempo de jogo */}
      <div className="h-0.5 bg-zinc-900">
        <motion.div
          className="h-full bg-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: 'linear', duration: 0.3 }}
        />
      </div>

      {/* Área principal: evento, beat, intervalo ou apito final */}
      <div className="min-h-[200px] sm:min-h-[260px] p-5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'beat' && activeBeat && (
            <AnalystBeatCard key={activeBeat.id} beat={activeBeat} onChoose={handleBeatChoice} />
          )}

          {phase === 'halftime' && (
            <motion.div
              key="halftime"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-amber-300 mb-2">
                Intervalo
              </p>
              <p className="text-[12px] text-white/60">
                Recalculando o jogo com as suas decisões…
              </p>
            </motion.div>
          )}

          {phase === 'playing' && currentEvent && (
            <motion.div
              key={`event-${cursor}`}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`w-full border-l-[3px] px-4 py-4 ${TIER_STYLE[currentEvent.weight_tier].bg}`}
            >
              {TIER_STYLE[currentEvent.weight_tier].badge && (
                <p className={`font-display uppercase tracking-[0.32em] text-[9px] font-black mb-2 ${TIER_STYLE[currentEvent.weight_tier].color}`}>
                  {TIER_STYLE[currentEvent.weight_tier].badge}
                </p>
              )}
              <p
                className={`${TIER_STYLE[currentEvent.weight_tier].color} ${
                  currentEvent.weight_tier === 'epic'
                    ? 'text-xl sm:text-2xl font-bold leading-snug'
                    : currentEvent.weight_tier === 'big'
                    ? 'text-base sm:text-lg font-semibold leading-tight'
                    : 'text-sm leading-snug'
                }`}
              >
                {currentEvent.text}
              </p>
              {currentEvent.reason && (currentEvent.weight_tier === 'epic' || currentEvent.weight_tier === 'big') && (
                <p className="font-display uppercase tracking-[0.16em] text-[9px] mt-2 text-amber-200/70">
                  {currentEvent.reason}
                </p>
              )}
              {currentEvent.xg !== undefined && currentEvent.xg > 0.15 && (
                <p
                  className={`font-display uppercase tracking-[0.18em] text-[9px] mt-1 ${
                    currentEvent.weight_tier === 'epic' ? 'text-rose-200/70' : 'text-amber-200/70'
                  }`}
                >
                  xG {currentEvent.xg.toFixed(2)}
                </p>
              )}
            </motion.div>
          )}

          {phase === 'done' && doneInfo && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center"
            >
              <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-amber-300 mb-2">
                Apito final · {plan.narrative_arc.replace('_', ' ')}
              </p>
              <p
                className="font-serif italic text-3xl sm:text-4xl text-white"
                style={{ fontFamily: 'var(--font-serif-hero)' }}
              >
                {homeScore} – {awayScore}
              </p>
              {plan.mvp_projection && (
                <p className="text-[12px] text-white/70 mt-3">
                  MVP: <span className="text-amber-300 font-bold">{plan.mvp_projection.name}</span> · nota {plan.mvp_projection.rating.toFixed(1)}
                </p>
              )}

              {/* Leitura de Jogo — o placar da inteligência do manager */}
              <div className="mt-5 border-t border-zinc-800 pt-4 text-left">
                <p className="font-display uppercase tracking-[0.26em] text-[10px] font-black text-amber-300 mb-2 text-center">
                  Leitura de Jogo · {doneInfo.reading.good}/{doneInfo.reading.total}
                </p>
                {doneInfo.verdicts.length === 0 && (
                  <p className="text-[11px] text-white/50 text-center">
                    Nenhuma decisão tomada — o Analista falou sozinho.
                  </p>
                )}
                <ul className="flex flex-col gap-1.5">
                  {doneInfo.verdicts.map((v) => (
                    <li key={v.beatId} className="flex items-start gap-2 text-[12px] leading-snug">
                      <span className={
                        v.kind === 'hit' ? 'text-emerald-400' : v.kind === 'neutral' ? 'text-amber-300' : 'text-red-400'
                      }>
                        {v.kind === 'hit' ? '✓' : v.kind === 'neutral' ? '•' : '✗'}
                      </span>
                      <span className="text-white/80">
                        <span className="text-white/45">{v.minute}&prime; {v.choiceLabel} — </span>
                        {v.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feed enxuto: só alto sinal (insights, decisões, gols, vermelhos, HT) */}
      {feed.length > 0 && phase !== 'done' && (
        <div className="px-4 pb-3 flex flex-col gap-1 max-h-32 overflow-hidden">
          {feed.slice(-4).map((item) => (
            <p key={item.id} className={`text-[11px] leading-snug truncate ${FEED_STYLE[item.kind]}`}>
              <span className="text-white/35 tabular-nums">{item.minute}&prime;</span> {item.text}
            </p>
          ))}
        </div>
      )}

      {/* Footer com momentum (perspectiva home) */}
      <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-display uppercase tracking-[0.2em] text-white/40">
            Momento
          </span>
          <div className="flex-1 h-1 bg-zinc-900 relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-amber-400"
              initial={{ width: '50%' }}
              animate={{ width: `${momentumNow}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
