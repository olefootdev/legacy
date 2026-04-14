/**
 * Partida ao vivo MVP: modo `test2d` — `TacticalSimLoop` + `SIM_SYNC`, campo 2D a partir do truth.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, LogOut, Map, RotateCcw, Trophy } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { evaluateOfficialSquad, isOfficialSquadGateRelaxedForTests } from '@/match/squadEligibility';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { MatchInterruptOverlay } from '@/match/MatchInterruptOverlay';
import { MatchdayResultScores, MatchdayVersusWithClock } from '@/components/matchday/MatchdayVersusTitle';
import { LiveMatchManagerPanel } from '@/components/matchday/LiveMatchManagerPanel';
import type { LiveMatchSnapshot, PitchPlayerState } from '@/engine/types';
import { SECONDS_PER_TICK } from '@/engine/types';
import { interpolateBallPosition, type BallTrajectoryState } from '@/engine/test2d/ballTrajectory';
import { computePitchTokenSeparation } from '@/engine/test2d/antiChaosEngine';
import { truthSnapshotToTest2dPitch, carrierIdToStoreOnBallId } from '@/engine/test2d/truthToTest2dPitch';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import { useLive2dTacticalSim } from '@/pages/useLive2dTacticalSim';
import { cn } from '@/lib/utils';
import {
  TacticalPitchDevLayer,
  loadTacticalLayerPref,
  loadZoneView18Pref,
  saveTacticalLayerPref,
  saveZoneView18Pref,
} from '@/components/matchday/TacticalPitchDevLayer';
import '@/styles/field2d.css';

const LIVE_MATCH_ENGINE_MODE = 'test2d' as const;

export interface Live2dShellConfig {
  productLabel: string;
  productSub: string;
}

const FIRST_HALF_MS = 60_000;
const HALFTIME_MS = 10_000;
const MINUTES_PER_HALF = 45;
const MS_PER_MINUTE = Math.round(FIRST_HALF_MS / MINUTES_PER_HALF);
const HALFTIME_TICK_START = Math.round(HALFTIME_MS / 1_000);
const GOAL_FREEZE_MS = 2_000;
/** Contagem regressiva antes do apito (1 s por número). */
const TEST2D_KICKOFF_COUNTDOWN_SEC = 5;
const TEST2D_KICKOFF_STEP_MS = 1_000;
const TEST2D_KICKOFF_MESSAGE_MS = 1_200;

/** `runMatchMinute` / `pitchFromLineup` usam coordenadas ~0–100 no plano do campo (não 0–1). */
function pitchPlanePercent(v: number): number {
  if (!Number.isFinite(v)) return 50;
  if (v >= 0 && v <= 1) return Math.min(100, Math.max(0, v * 100));
  return Math.min(100, Math.max(0, v));
}

/** Find the player nearest to a point (for away on-ball detection). */
function nearestToPoint(
  players: PitchPlayerState[],
  pt: { x: number; y: number },
): PitchPlayerState | undefined {
  if (!players.length) return undefined;
  let best = players[0]!;
  let bestD = 1e9;
  for (const p of players) {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Softer springs for organic, football-like movement between ticks. */
const MOVE_SPRING = { type: 'spring' as const, stiffness: 280, damping: 32, mass: 0.9 };
const BALL_SPRING = { type: 'spring' as const, stiffness: 400, damping: 34, mass: 0.6 };

type Test2dKickoffPhase = 5 | 4 | 3 | 2 | 1 | 'kickoff' | null;

function isBlockingNonQuickMatch(live: { mode?: string }): boolean {
  return live.mode === 'auto';
}

function useMatchClock(
  elapsedSec: number,
  frozen: boolean,
  phase: string | undefined,
  tacticalLoopRef?: RefObject<TacticalSimLoop | null>,
): string {
  const [display, setDisplay] = useState('00:00');
  const baseRef = useRef({ wallMs: Date.now(), baseSec: 0 });

  useEffect(() => {
    baseRef.current = { wallMs: Date.now(), baseSec: elapsedSec };
  }, [elapsedSec]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let raf: number;
    const step = () => {
      if (frozen) {
        raf = requestAnimationFrame(step);
        return;
      }
      const loop = tacticalLoopRef?.current;
      if (loop) {
        const sec = Math.min(5400, loop.getFootballElapsedSecApprox());
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        setDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        raf = requestAnimationFrame(step);
        return;
      }
      const { wallMs, baseSec } = baseRef.current;
      const realElapsed = Date.now() - wallMs;
      const interpSec = Math.min(
        baseSec + (realElapsed / MS_PER_MINUTE) * SECONDS_PER_TICK,
        5400,
      );
      const m = Math.floor(interpSec / 60);
      const s = Math.floor(interpSec % 60);
      setDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, phase, tacticalLoopRef]);

  return display;
}

interface EndSummary {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  events: { id: string; text: string }[];
}

/**
 * Subtle idle sway — sinusoidal micro-offset at ~60fps so players
 * never appear frozen between engine ticks.
 */
function useIdleSway(seed: number): { dx: number; dy: number } {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    const phaseX = seed * 1.37;
    const phaseY = seed * 2.71;
    const tick = () => {
      const t = Date.now() / 1000;
      setOffset({
        dx: Math.sin(t * 1.1 + phaseX) * 0.25,
        dy: Math.cos(t * 0.9 + phaseY) * 0.20,
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [seed]);

  return offset;
}

function Test2dHomePlayerToken({
  p,
  portraitUrl,
  onBall,
  nudge,
}: {
  p: PitchPlayerState;
  portraitUrl?: string;
  onBall: boolean;
  nudge: { dx: number; dy: number };
}) {
  const sway = useIdleSway(p.num);
  const left = pitchPlanePercent(p.x) + nudge.dx + sway.dx;
  const top = pitchPlanePercent(p.y) + nudge.dy + sway.dy;
  return (
    <motion.div
      className={cn(
        'absolute z-[2] flex h-[1.575rem] w-[1.575rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[1.5px] bg-black/55',
        '[filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.75))]',
        onBall
          ? 'border-neon-yellow ring-[1.5px] ring-neon-yellow/50 shadow-[0_0_12px_rgba(234,255,0,0.35)]'
          : 'border-white/75 shadow-[0_3px_9px_rgba(0,0,0,0.5)]',
      )}
      style={{ position: 'absolute' }}
      initial={false}
      animate={{ left: `${left}%`, top: `${top}%` }}
      transition={MOVE_SPRING}
      title={`${p.num} ${p.name}`}
    >
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt=""
          className="h-full w-full object-cover object-top"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[7px] font-black text-white">{p.num}</span>
      )}
    </motion.div>
  );
}

function Test2dAwayPlayerToken({
  p,
  onBall,
  nudge,
}: {
  p: PitchPlayerState;
  onBall: boolean;
  nudge: { dx: number; dy: number };
}) {
  const sway = useIdleSway(p.num + 100);
  const left = pitchPlanePercent(p.x) + nudge.dx + sway.dx;
  const top = pitchPlanePercent(p.y) + nudge.dy + sway.dy;
  return (
    <motion.div
      className={cn(
        'absolute z-[1] flex h-[1.575rem] w-[1.575rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] text-[7px] font-black tabular-nums shadow-[0_3px_9px_rgba(0,0,0,0.55)] [filter:drop-shadow(0_3px_5px_rgba(0,0,0,0.65))]',
        onBall
          ? 'border-rose-300 bg-gradient-to-b from-rose-700/95 to-rose-950/90 text-white ring-[1.5px] ring-rose-400/40'
          : 'border-rose-400/90 bg-gradient-to-b from-rose-900/95 to-black/80 text-rose-50',
      )}
      style={{ position: 'absolute' }}
      initial={false}
      animate={{ left: `${left}%`, top: `${top}%` }}
      transition={MOVE_SPRING}
      title={`${p.num} ${p.name} (visitante)`}
    >
      {p.num}
    </motion.div>
  );
}

function Test2dBallToken({
  x, y, trajectoryKind,
}: {
  x: number; y: number;
  trajectoryKind?: string;
}) {
  const left = pitchPlanePercent(x);
  const top = pitchPlanePercent(y);
  const spring = trajectoryKind === 'shot'
    ? { ...BALL_SPRING, stiffness: 600, damping: 28 }
    : trajectoryKind === 'pass_long' || trajectoryKind === 'cross'
      ? { ...BALL_SPRING, stiffness: 350, damping: 30 }
      : trajectoryKind === 'carry'
        ? { ...BALL_SPRING, stiffness: 260, damping: 36 }
        : BALL_SPRING;
  return (
    <motion.div
      className="pointer-events-none absolute z-[4] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-gradient-to-br from-white via-white to-zinc-200 shadow-[0_0_12px_rgba(255,255,255,0.9),0_4px_10px_rgba(0,0,0,0.42)]"
      style={{ position: 'absolute' }}
      initial={false}
      animate={{ left: `${left}%`, top: `${top}%` }}
      transition={spring}
      aria-hidden
    />
  );
}

export function Live2dMatchShell({ config }: { config: Live2dShellConfig }) {
  const { productLabel, productSub } = config;
  const usesLive2dTacticalEngine = true;
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const lineupIds = useGameStore((s) => s.lineup);
  const fixture = useGameStore((s) => s.nextFixture);
  const tacticalMentality = useGameStore((s) => s.manager.tacticalMentality);
  const defensiveLine = useGameStore((s) => s.manager.defensiveLine);
  const tempo = useGameStore((s) => s.manager.tempo);
  const tacticalStyle = useGameStore((s) => s.manager.tacticalStyle);
  const manager = useMemo(
    () => ({ tacticalMentality, defensiveLine, tempo, tacticalStyle }),
    [tacticalMentality, defensiveLine, tempo, tacticalStyle],
  );

  const [session, setSession] = useState(0);
  const [halfTimeUi, setHalfTimeUi] = useState(false);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [halfTimeTick, setHalfTimeTick] = useState(HALFTIME_TICK_START);
  const [quickPreStart, setQuickPreStart] = useState<Test2dKickoffPhase>(TEST2D_KICKOFF_COUNTDOWN_SEC);
  const [preGoalActive, setPreGoalActive] = useState(false);
  const [, setMomentumAnimKey] = useState<string | null>(null);
  const [tacticalDevLayer, setTacticalDevLayer] = useState(loadTacticalLayerPref);
  const [zoneView18, setZoneView18] = useState(loadZoneView18Pref);

  const tacticalLive2dEnabled =
    usesLive2dTacticalEngine && live?.phase === 'playing' && quickPreStart === null;
  const { loopRef: tacticalLive2dLoopRef, truthSnap, carrierSimId } = useLive2dTacticalSim({
    enabled: tacticalLive2dEnabled,
    session,
    live,
    manager,
  });

  const htRef = useRef(0);
  const htTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizedRef = useRef(false);
  const freezeUntilRef = useRef(0);
  const lastSeenGoalEventIdRef = useRef<string | null>(null);
  const preKickoffTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    finalizedRef.current = false;
    setSummary(null);
    htRef.current = 0;
    setHalfTimeUi(false);
    setHalfTimeTick(HALFTIME_TICK_START);
    freezeUntilRef.current = 0;
    lastSeenGoalEventIdRef.current = null;
    setMomentumAnimKey(null);
    setPreGoalActive(false);
    setQuickPreStart(TEST2D_KICKOFF_COUNTDOWN_SEC);
    preKickoffTimersRef.current.forEach(clearTimeout);
    preKickoffTimersRef.current = [];
    dispatch({ type: 'START_LIVE_MATCH', mode: LIVE_MATCH_ENGINE_MODE });

    const clearIv = () => {
      if (ivRef.current) {
        clearInterval(ivRef.current);
        ivRef.current = null;
      }
    };

    const tick = () => {
      dispatch({ type: 'TICK_MATCH_MINUTE' });
    };

    const loop = () => {
      clearIv();
      if (usesLive2dTacticalEngine) {
        return;
      }
      ivRef.current = setInterval(() => {
        const lm = getGameState().liveMatch;
        if (!lm || lm.phase !== 'playing') {
          clearIv();
          return;
        }
        if (lm.minute >= 90) {
          clearIv();
          return;
        }
        if (Date.now() < freezeUntilRef.current) {
          return;
        }

        if (lm.minute === 45 && htRef.current === 0) {
          htRef.current = 1;
          clearIv();
          htTimersRef.current.forEach(clearTimeout);
          htTimersRef.current = [];
          setHalfTimeUi(true);
          setHalfTimeTick(HALFTIME_TICK_START);
          for (let s = 1; s < HALFTIME_TICK_START; s++) {
            htTimersRef.current.push(
              window.setTimeout(() => setHalfTimeTick(HALFTIME_TICK_START - s), s * 1000),
            );
          }
          htTimersRef.current.push(
            window.setTimeout(() => {
              setHalfTimeUi(false);
              setHalfTimeTick(HALFTIME_TICK_START);
              htRef.current = 2;
              loop();
            }, HALFTIME_MS),
          );
          return;
        }

        tick();
      }, MS_PER_MINUTE);
    };

    const kickMs = TEST2D_KICKOFF_COUNTDOWN_SEC * TEST2D_KICKOFF_STEP_MS;
    const tEnd = kickMs + TEST2D_KICKOFF_MESSAGE_MS;
    for (let n = TEST2D_KICKOFF_COUNTDOWN_SEC - 1; n >= 1; n--) {
      preKickoffTimersRef.current.push(
        window.setTimeout(
          () => setQuickPreStart(n as Test2dKickoffPhase),
          (TEST2D_KICKOFF_COUNTDOWN_SEC - n) * TEST2D_KICKOFF_STEP_MS,
        ),
      );
    }
    preKickoffTimersRef.current.push(window.setTimeout(() => setQuickPreStart('kickoff'), kickMs));
    preKickoffTimersRef.current.push(
      window.setTimeout(() => {
        setQuickPreStart(null);
        loop();
      }, tEnd),
    );

    return () => {
      clearIv();
      htTimersRef.current.forEach(clearTimeout);
      htTimersRef.current = [];
      preKickoffTimersRef.current.forEach(clearTimeout);
      preKickoffTimersRef.current = [];
    };
  }, [session, dispatch, usesLive2dTacticalEngine]);

  /** Intervalo: guiado pelo `MatchClock` do sim (`SIM_SYNC`), não por `minute === 45` + interval. */
  useEffect(() => {
    if (!usesLive2dTacticalEngine) return;
    if (live?.phase !== 'playing' && live?.phase !== 'postgame') return;
    if (live?.clockPeriod === 'halftime') {
      setHalfTimeUi(true);
    } else {
      setHalfTimeUi(false);
    }
  }, [usesLive2dTacticalEngine, live?.clockPeriod, live?.phase]);

  useEffect(() => {
    const hint = live?.preGoalHint;
    if (!hint || !live || live.phase !== 'playing') {
      if (preGoalActive) setPreGoalActive(false);
      return;
    }
    setPreGoalActive(true);
    const endAt = hint.startedAtMs + hint.durationMs;
    const remaining = Math.max(0, endAt - Date.now());
    const t = window.setTimeout(() => {
      setPreGoalActive(false);
      const topEv = getGameState().liveMatch?.events[0];
      if (topEv) lastSeenGoalEventIdRef.current = topEv.id;
      setMomentumAnimKey(`pre-goal-flash-${hint.startedAtMs}`);
    }, remaining);
    return () => clearTimeout(t);
  }, [live?.preGoalHint?.startedAtMs]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing') return;
    if (preGoalActive) return;
    const top = live.events[0];
    if (!top || (top.kind !== 'goal_home' && top.kind !== 'goal_away')) return;
    if (lastSeenGoalEventIdRef.current === top.id) return;
    lastSeenGoalEventIdRef.current = top.id;
    freezeUntilRef.current = Date.now() + GOAL_FREEZE_MS;
    setMomentumAnimKey(top.id);
  }, [live?.events, live?.phase, live?.mode, preGoalActive]);

  useEffect(() => {
    const o = live?.spiritOverlay;
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing' || !o) return;
    const until = o.startedAtMs + o.autoDismissMs;
    freezeUntilRef.current = Math.max(freezeUntilRef.current, until);
    if (o.kind === 'goal') {
      setMomentumAnimKey(`spirit-goal-${o.startedAtMs}`);
    }
    const t = window.setTimeout(() => {
      const st = getGameState().liveMatch;
      const cur = st?.spiritOverlay;
      if (!cur || cur.startedAtMs !== o.startedAtMs) return;
      if (cur.kind === 'goal') {
        dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        return;
      }
      if (cur.kind === 'penalty') {
        const p = st?.penalty;
        if (p?.stage === 'kick') {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_resolve' } });
        } else if (p?.stage === 'result') {
          dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
        } else {
          dispatch({ type: 'APPLY_SPIRIT_OUTCOME', payload: { kind: 'penalty_advance' } });
        }
        return;
      }
      dispatch({ type: 'DISMISS_SPIRIT_OVERLAY' });
    }, o.autoDismissMs);
    return () => clearTimeout(t);
  }, [live?.spiritOverlay?.startedAtMs, live?.spiritOverlay?.kind, live?.phase, live?.mode, dispatch]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live)) return;
    if (live.phase !== 'postgame' || finalizedRef.current) return;
    finalizedRef.current = true;
    setSummary({
      homeShort: live.homeShort,
      awayShort: live.awayShort,
      homeName: live.homeName,
      awayName: live.awayName,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      events: live.events.map((e) => ({ id: e.id, text: e.text })),
    });
    dispatch({ type: 'FINALIZE_MATCH' });
  }, [live, dispatch]);

  const squadReport = useMemo(
    () => evaluateOfficialSquad(lineupIds, playersById),
    [lineupIds, playersById],
  );
  const squadOkForMatch = squadReport.ok || isOfficialSquadGateRelaxedForTests();

  const tacticalPitchFromTruth = useMemo(() => {
    if (!usesLive2dTacticalEngine || !truthSnap?.players?.length || !live?.homePlayers?.length) {
      return null;
    }
    return truthSnapshotToTest2dPitch({
      snap: truthSnap,
      homePlayers: live.homePlayers,
      awayRoster: live.awayRoster ?? [],
    });
  }, [usesLive2dTacticalEngine, truthSnap, live?.homePlayers, live?.awayRoster]);

  const storeOnBallId = useMemo(() => {
    if (usesLive2dTacticalEngine && tacticalLive2dEnabled) {
      return carrierIdToStoreOnBallId(carrierSimId, live?.awayRoster ?? []);
    }
    return live?.onBallPlayerId;
  }, [usesLive2dTacticalEngine, tacticalLive2dEnabled, carrierSimId, live?.awayRoster, live?.onBallPlayerId]);

  const pitch = tacticalPitchFromTruth?.homePitch ?? live?.homePlayers ?? [];
  const awayPitch = tacticalPitchFromTruth?.awayPitch ?? live?.awayPitchPlayers ?? [];
  const showBoard = summary === null;

  const ballPosBase = useMemo(() => {
    if (tacticalPitchFromTruth) {
      return tacticalPitchFromTruth.ball;
    }
    if (!live) return { x: 50, y: 50 };
    if (live.ballTrajectory) {
      return interpolateBallPosition(live.ballTrajectory as BallTrajectoryState);
    }
    return live.ball;
  }, [tacticalPitchFromTruth, live?.ball, live?.ballTrajectory]);

  const ballPos = ballPosBase;

  const tokenSeparation = useMemo(() => {
    const agents = [
      ...pitch.map((p) => ({ id: `h:${p.playerId}`, x: p.x, y: p.y })),
      ...awayPitch.map((p) => ({ id: `a:${p.playerId}`, x: p.x, y: p.y })),
    ];
    return computePitchTokenSeparation(agents, { ball: ballPos });
  }, [pitch, awayPitch, ballPos]);

  const secondHalfResumeCountdown =
    usesLive2dTacticalEngine && tacticalLive2dEnabled
      ? (truthSnap?.secondHalfResumeCountdownSec ?? 0)
      : 0;
  const scoreboardCountdownSec =
    secondHalfResumeCountdown >= 1 && secondHalfResumeCountdown <= 10
      ? secondHalfResumeCountdown
      : null;

  const clockFrozen =
    quickPreStart !== null ||
    halfTimeUi ||
    !!(live?.spiritOverlay) ||
    preGoalActive ||
    secondHalfResumeCountdown > 0 ||
    Date.now() < freezeUntilRef.current;
  const matchClock = useMatchClock(
    live?.footballElapsedSec ?? 0,
    clockFrozen,
    live?.phase,
    tacticalLive2dEnabled ? tacticalLive2dLoopRef : undefined,
  );

  const displayHomeScore =
    preGoalActive && live?.preGoalHint?.side === 'home' ? (live?.homeScore ?? 1) - 1 : live?.homeScore ?? 0;
  const displayAwayScore =
    preGoalActive && live?.preGoalHint?.side === 'away' ? (live?.awayScore ?? 1) - 1 : live?.awayScore ?? 0;

  const confirmForfeit = () => {
    dispatch({ type: 'FORFEIT_MATCH', mode: LIVE_MATCH_ENGINE_MODE });
    setForfeitOpen(false);
  };

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col space-y-4 py-6 px-4 pb-24 md:flex-none">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/" className="text-xs font-bold text-gray-500 hover:text-neon-yellow">
          ← Home
        </Link>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="text-[10px] font-display font-bold uppercase tracking-widest text-cyan-200/95"
          >
            {productLabel}
          </span>
          <span
            className="text-[9px] font-medium uppercase tracking-wide text-cyan-500/75"
          >
            {productSub}
          </span>
        </div>
        {showBoard && live?.phase === 'playing' && quickPreStart === null && (
          <button
            type="button"
            onClick={() => setForfeitOpen(true)}
            className="text-[10px] font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do jogo
          </button>
        )}
      </div>

      {showBoard && !live && (
        <div className="glass-panel p-6 border border-white/10 space-y-3">
          {!squadOkForMatch ? (
            <>
              <p className="font-display font-black text-sm uppercase tracking-wide text-amber-200">
                Plantel incompleto
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                São necessários 11 titulares disponíveis e pelo menos 5 no banco para entrar em campo.
              </p>
              {squadReport.reason ? (
                <p className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-500">{squadReport.reason}</p>
              ) : null}
              <Link
                to="/team"
                className="inline-flex w-full justify-center rounded-xl bg-neon-yellow px-4 py-3 font-display text-sm font-black uppercase tracking-wide text-black sm:w-auto"
              >
                Ajustar plantel
              </Link>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">A preparar a partida…</p>
          )}
        </div>
      )}

      <AnimatePresence>
        {forfeitOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forfeit-live-match-title"
            onClick={() => setForfeitOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="glass-panel w-full p-6 border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="forfeit-live-match-title"
                className="font-display font-black text-xl text-white text-center uppercase tracking-wide"
              >
                Sair do jogo?
              </h2>
              <p className="text-sm text-gray-400 text-center mt-4 leading-relaxed">
                Você perde por <span className="text-red-400 font-display font-black text-lg">5×0</span>. O resultado
                entra na liga e no histórico.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-black uppercase tracking-wider text-sm transition-colors"
                  onClick={confirmForfeit}
                >
                  Confirmar desistência
                </button>
                <button
                  type="button"
                  className="w-full py-3 rounded-xl border border-white/20 text-gray-300 font-bold text-sm hover:bg-white/5 transition-colors"
                  onClick={() => setForfeitOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {halfTimeUi ? (
          <Fragment key="match-halftime-2d">
            <MatchInterruptOverlay
              kind="halftime"
              title="Intervalo"
              lines={['2.º tempo a seguir…']}
              countdown={usesLive2dTacticalEngine ? undefined : halfTimeTick}
            />
          </Fragment>
        ) : live?.spiritOverlay && !preGoalActive ? (
          <Fragment key={`spirit-2d-${live.spiritOverlay.startedAtMs}-${live.spiritOverlay.kind}`}>
            <MatchInterruptOverlay
              kind={live.spiritOverlay.kind}
              title={live.spiritOverlay.title}
              lines={live.spiritOverlay.lines}
            />
          </Fragment>
        ) : null}
      </AnimatePresence>

      {showBoard && live && (
        <div className="glass-panel p-5 border border-white/10 space-y-4 relative overflow-x-hidden overflow-y-visible">
          {typeof quickPreStart === 'number' || quickPreStart === 'kickoff' ? (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none"
              aria-live="polite"
            >
              <motion.span
                key={quickPreStart}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                className={cn(
                  'font-display font-black text-neon-yellow tabular-nums drop-shadow-[0_0_24px_rgba(234,255,0,0.35)]',
                  quickPreStart === 'kickoff'
                    ? 'text-[min(8vw,2.25rem)] uppercase tracking-widest'
                    : 'text-[min(22vw,7rem)]',
                )}
              >
                {quickPreStart === 'kickoff' ? 'Bola a rolar' : quickPreStart}
              </motion.span>
            </div>
          ) : null}

          <MatchdayVersusWithClock
            homeShort={live.homeShort}
            awayShort={live.awayShort}
            homeName={live.homeName}
            awayName={live.awayName}
            awaySeed={fixture.opponent.id}
            clock={matchClock}
            scoreboardCountdownSec={scoreboardCountdownSec}
            rowClassName="w-full max-w-[min(100%,44rem)] mx-auto"
          />
          <div
            className={cn(
              'flex justify-center items-center gap-8 font-display font-black text-5xl transition-opacity',
              typeof quickPreStart === 'number' || quickPreStart === 'kickoff' || secondHalfResumeCountdown > 0
                ? 'opacity-35'
                : 'opacity-100',
            )}
          >
            <span className="text-neon-yellow">{displayHomeScore}</span>
            <span className="text-gray-600 text-3xl">–</span>
            <span className="text-white">{displayAwayScore}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              aria-pressed={tacticalDevLayer}
              onClick={() => {
                const next = !tacticalDevLayer;
                setTacticalDevLayer(next);
                saveTacticalLayerPref(next);
                if (!next) {
                  setZoneView18(false);
                  saveZoneView18Pref(false);
                }
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider transition-colors',
                tacticalDevLayer
                  ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/15 text-gray-400 hover:border-white/25 hover:text-gray-200',
              )}
              title="Mapa tático: terços, áreas, corredores e direção de ataque (fieldZones)"
            >
              <Map className="h-3.5 w-3.5 opacity-90" aria-hidden />
              Campo tático
            </button>
            {tacticalDevLayer ? (
              <button
                type="button"
                aria-pressed={zoneView18}
                onClick={() => {
                  const next = !zoneView18;
                  setZoneView18(next);
                  saveZoneView18Pref(next);
                }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider transition-colors',
                  zoneView18
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/15 text-gray-400 hover:border-white/25 hover:text-gray-200',
                )}
                title="Grelha 18 zonas (3×6) — mesma lógica do motor; perspetiva = equipa com posse"
              >
                Zone View
              </button>
            ) : null}
          </div>

          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 text-center mb-1">Campo</p>
          <div
            className="mx-auto w-full max-w-3xl py-1 [perspective:min(1400px,110vw)]"
            aria-label="Campo: gol à esquerda é da casa, à direita é do visitante; a equipa da casa ataca para a direita e o visitante ataca para a esquerda."
          >
            <motion.div
              className="origin-[50%_100%] transform-gpu will-change-transform"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: 5.5 }}
              transition={{ type: 'spring', stiffness: 70, damping: 18 }}
            >
              <div
                className={cn(
                  'relative rounded-xl overflow-visible',
                  'shadow-[0_28px_90px_-16px_rgba(0,0,0,0.92),0_0_72px_-20px_rgba(89,133,37,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
                  'ring-1 ring-white/15',
                )}
              >
                <div className="field-container w-full overflow-visible rounded-lg p-2 sm:p-3">
                  <div className={cn('field', tacticalDevLayer && 'show-zones')}>
                    <div className="pitch-overlay">
                      <div className="half-line" />
                      <div className="center-circle" />
                      <div className="center-dot" />
                      <div className="penalty-area left" />
                      <div className="penalty-area right" />
                      <div className="goal-area left" />
                      <div className="goal-area right" />
                      <div className="penalty-arc left" />
                      <div className="penalty-arc right" />
                      <div className="penalty-spot left" />
                      <div className="penalty-spot right" />
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                      <div className="goal left">
                        <div className="goal-net" />
                      </div>
                      <div className="goal right">
                        <div className="goal-net" />
                      </div>
                      <div
                        className="pointer-events-none absolute left-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none"
                        aria-hidden
                      >
                        <span className="block max-w-[4.5rem] font-display text-[clamp(6px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-neon-yellow/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol da casa
                        </span>
                      </div>
                      <div
                        className="pointer-events-none absolute right-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none text-right"
                        aria-hidden
                      >
                        <span className="block max-w-[4.5rem] font-display text-[clamp(6px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-rose-300/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol visitante
                        </span>
                      </div>
                      <div className="zone-attack-left" aria-hidden />
                      <div className="zone-attack-right" aria-hidden />
                      <div className="zone-defense-left" aria-hidden />
                      <div className="zone-defense-right" aria-hidden />
                      <div className="zone-midfield" aria-hidden />
                      <div className="zone-box-left" aria-hidden />
                      <div className="zone-box-right" aria-hidden />
                    </div>
                    {tacticalDevLayer ? (
                      <TacticalPitchDevLayer
                        homeShort={live.homeShort}
                        awayShort={live.awayShort}
                        homePlayers={pitch}
                        awayPlayers={awayPitch}
                        clockPeriod={live.clockPeriod}
                        possession={live.possession}
                        showZoneView={zoneView18}
                        zonePerspectiveTeam={live.possession}
                        pitchTokenNudges={tokenSeparation}
                      />
                    ) : null}
                    <div className="field-tokens-layer">
                      {awayPitch.map((p) => {
                        const awayOnBall =
                          usesLive2dTacticalEngine && tacticalLive2dEnabled && storeOnBallId
                            ? storeOnBallId === p.playerId
                            : live.possession === 'away' &&
                              nearestToPoint(awayPitch, ballPos)?.playerId === p.playerId;
                        return (
                          <Fragment key={p.playerId}>
                            <Test2dAwayPlayerToken
                              p={p}
                              onBall={awayOnBall}
                              nudge={tokenSeparation.get(`a:${p.playerId}`) ?? { dx: 0, dy: 0 }}
                            />
                          </Fragment>
                        );
                      })}
                      {pitch.map((p) => {
                        const ent = playersById[p.playerId];
                        const portraitUrl = ent ? playerPortraitSrc(ent, 72, 72) : undefined;
                        const onBall =
                          usesLive2dTacticalEngine && tacticalLive2dEnabled && storeOnBallId
                            ? storeOnBallId === p.playerId
                            : live.onBallPlayerId === p.playerId;
                        return (
                          <Fragment key={p.playerId}>
                            <Test2dHomePlayerToken
                              p={p}
                              portraitUrl={portraitUrl}
                              onBall={onBall}
                              nudge={tokenSeparation.get(`h:${p.playerId}`) ?? { dx: 0, dy: 0 }}
                            />
                          </Fragment>
                        );
                      })}
                      <Test2dBallToken x={ballPos.x} y={ballPos.y} trajectoryKind={live.ballTrajectory?.kind} />
                    </div>
                    {secondHalfResumeCountdown > 0 ? (
                      <div
                        className="pointer-events-none absolute inset-0 z-[20] flex flex-col items-center justify-center gap-2 rounded-sm bg-black/50 backdrop-blur-[2px]"
                        aria-live="polite"
                        role="status"
                      >
                        <p className="px-3 text-center font-display text-[clamp(9px,2vw,11px)] font-black uppercase tracking-[0.2em] text-white/90">
                          2.º tempo · troca de campo
                        </p>
                        <motion.span
                          key={secondHalfResumeCountdown}
                          initial={{ scale: 0.88, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                          className="font-display font-black tabular-nums text-neon-yellow drop-shadow-[0_0_24px_rgba(234,255,0,0.35)] text-[min(22vw,5.5rem)]"
                        >
                          {secondHalfResumeCountdown}
                        </motion.span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {live.phase === 'playing' && quickPreStart === null ? (
            <p className="rounded-lg border border-cyan-500/25 bg-cyan-950/25 px-3 py-2 text-center text-[10px] font-display font-bold uppercase tracking-widest text-cyan-100/90">
              {live.possession === 'home' ? (
                <>
                  {live.homeShort} — posse · ataca o gol visitante (→)
                </>
              ) : (
                <>
                  {live.awayShort} — posse · ataca o gol da casa (←)
                </>
              )}
            </p>
          ) : null}

          {live.phase === 'playing' && quickPreStart === null && live.events.length > 0 ? (
            <div
              className="rounded-lg border border-white/10 bg-black/35 px-3 py-2.5"
              aria-label="Últimos lances e momentos táticos"
            >
              <p className="text-[9px] font-display font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Relato ao vivo
              </p>
              {usesLive2dTacticalEngine ? (
                <p className="mb-1.5 text-[9px] leading-snug text-gray-500/90">
                  Verde = acerto colectivo · vermelho = erro corrigível · azul = contexto (ex.: remate).
                </p>
              ) : null}
              <ul className="max-h-[7.5rem] space-y-1 overflow-y-auto text-left [scrollbar-width:thin]">
                {live.events.slice(0, 12).map((ev) => (
                  <li
                    key={ev.id}
                    className={cn(
                      'text-[11px] leading-snug border-b border-white/[0.06] pb-1 last:border-0 last:pb-0',
                      usesLive2dTacticalEngine && ev.live2dMoment === 'good'
                        ? 'rounded bg-emerald-500/[0.09] px-1.5 text-emerald-100/95'
                        : usesLive2dTacticalEngine && ev.live2dMoment === 'bad'
                          ? 'rounded bg-rose-500/[0.09] px-1.5 text-rose-100/90'
                          : usesLive2dTacticalEngine && ev.live2dMoment === 'info'
                            ? 'rounded bg-cyan-500/[0.08] px-1.5 text-cyan-100/88'
                            : 'text-gray-200/95',
                    )}
                  >
                    {ev.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {live.phase === 'playing' && quickPreStart === null ? (
            <LiveMatchManagerPanel
              homeShort={live.homeShort}
              awayShort={live.awayShort}
              homePlayers={pitch}
              awayRoster={live.awayRoster ?? []}
              playersById={playersById}
            />
          ) : null}
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass-panel p-6 border border-neon-yellow/20 text-center">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Fim de jogo</p>
            <MatchdayResultScores
              homeShort={summary.homeShort}
              awayShort={summary.awayShort}
              homeName={summary.homeName}
              awayName={summary.awayName}
              homeScore={summary.homeScore}
              awayScore={summary.awayScore}
              awaySeed={fixture.opponent.id}
              className="text-2xl sm:text-3xl"
            />
            <p className="text-xs text-gray-500 mt-2">Liga e elenco atualizados</p>
          </div>
          <div className="glass-panel p-4 border border-white/10 max-h-36 overflow-y-auto">
            {summary.events.slice(0, 15).map((e) => (
              <p key={e.id} className="text-[11px] text-gray-400 py-0.5">
                {e.text}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary w-full flex justify-center"
              onClick={() => setSession((s) => s + 1)}
            >
              <span className="btn-primary-inner flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Jogar novamente
              </span>
            </button>
            <button
              type="button"
              className="w-full py-3 rounded-xl border border-white/20 font-bold text-sm flex items-center justify-center gap-2"
              onClick={() => navigate('/leagues')}
            >
              <Trophy className="w-4 h-4 text-neon-yellow" /> Ir para Liga
            </button>
            <button
              type="button"
              className="w-full py-3 rounded-xl border border-white/20 font-bold text-sm flex items-center justify-center gap-2"
              onClick={() => navigate('/')}
            >
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
