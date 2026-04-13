import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, LogOut, Plus, Trophy, RotateCcw } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import type { PitchPlayerState } from '@/engine/types';
import type { OpponentStub } from '@/entities/types';
import { cn } from '@/lib/utils';
import { hashStringSeed } from '@/match/seededRng';
import { computeAwayImpactsFromVirtualLedger, computeHomeImpactsFromLedger } from '@/match/impactLedger';
import { evaluateOfficialSquad, isOfficialSquadGateRelaxedForTests } from '@/match/squadEligibility';
import { quickFeedLineClass, renderQuickFeedRichText } from '@/match/quickMatchFeed';
import { MatchInterruptOverlay } from '@/match/MatchInterruptOverlay';
import { GoalScorerOverlay } from '@/match/GoalScorerOverlay';
import { pickGoalOverlayStoryline } from '@/match/goalOverlayNarration';
import { GOAL_SCORER_OVERLAY_MS } from '@/gamespirit/spiritStateMachine';
import {
  MatchdayVersusWithClock,
  MatchdayLineupColumnTitle,
  MatchdayResultScores,
} from '@/components/matchday/MatchdayVersusTitle';

import { SECONDS_PER_TICK } from '@/engine/types';

const FIRST_HALF_MS = 25_000;
const HALFTIME_MS = 3_000;
const MINUTES_PER_HALF = 45;
const MS_PER_MINUTE = Math.round(FIRST_HALF_MS / MINUTES_PER_HALF);
const GOAL_FREEZE_MS = 2_000;
const FEED_VISIBLE_COUNT = 3;
const FEED_POOL_MAX = 14;
const FEED_ROTATE_MS = 4_200;

/** Pré-partida: 3–2–1 (1s cada) e mensagem no feed antes do primeiro tick. */
const QUICK_KICKOFF_COUNTDOWN_MS = 1000;
const QUICK_KICKOFF_MESSAGE_MS = 1200;

type QuickPreStartPhase = 'c3' | 'c2' | 'c1' | 'kickoff' | null;

/** Só bloqueia efeitos da partida rápida para jogos 3D / auto explícitos; `mode` ausente = legado (tratar como quick). */
function isBlockingNonQuickMatch(live: { mode?: string }): boolean {
  return live.mode === 'auto';
}

/**
 * Relógio suave MM:SS — interpola entre ticks (cada tick = SECONDS_PER_TICK = 60s de jogo).
 * Congela durante golo / overlay.
 */
function useMatchClock(
  elapsedSec: number,
  frozen: boolean,
  phase: string | undefined,
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
  }, [frozen, phase]);

  return display;
}

/**
 * 0–1 ao longo do eixo campo: ~1 = pressão da casa junto à baliza adversária (direita);
 * ~0 = visitante a ameaçar a baliza da casa.
 */
type QuickEventBadge = 'goal' | 'yellow' | 'red' | 'injury';

function pushBadge(m: Map<string, QuickEventBadge[]>, id: string, b: QuickEventBadge) {
  const cur = m.get(id) ?? [];
  cur.push(b);
  m.set(id, cur);
}

/** Cartão vermelho visível na lista (expulsos). */
function RedCardIcon({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Cartão vermelho"
      title="Expulso"
      className={cn(
        'inline-block shrink-0 rounded-[2px] bg-red-600 ring-1 ring-red-950/50 shadow-[0_0_10px_rgba(220,38,38,0.5)]',
        'w-[11px] h-[14px] sm:w-3 sm:h-4',
        className,
      )}
    />
  );
}

function PlayerEventStrip({ badges }: { badges: QuickEventBadge[] }) {
  if (!badges.length) return null;
  return (
    <span className="flex items-center gap-1 shrink-0 ml-1" aria-hidden>
      {badges.map((b, i) => {
        if (b === 'goal')
          return (
            <span key={`g-${i}`} title="Golo" className="inline-flex text-[11px] leading-none">
              ⚽
            </span>
          );
        if (b === 'yellow')
          return (
            <span
              key={`y-${i}`}
              title="Amarelo"
              className="inline-block w-2 h-2.5 rounded-[1px] bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
            />
          );
        if (b === 'red')
          return (
            <span
              key={`r-${i}`}
              title="Vermelho"
              className="inline-block w-2 h-2.5 rounded-[1px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]"
            />
          );
        return (
          <Plus
            key={`i-${i}`}
            title="Lesão"
            className="w-3 h-3 text-red-400 rotate-45 stroke-[3]"
            aria-label="Lesão"
          />
        );
      })}
    </span>
  );
}

function momentumPressure01(possession: 'home' | 'away', ballX: number): number {
  const bx = (Math.min(92, Math.max(8, ballX)) - 50) / 50;
  const base = possession === 'home' ? 0.74 : 0.26;
  return Math.min(0.96, Math.max(0.04, base + bx * 0.26));
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

interface QuickAwayPlayer {
  id: string;
  num: number;
  name: string;
  pos: string;
}

/** 11 titulares visitantes sintéticos (motor só simula o lado casa). */
function buildAwayQuickRoster(opponent: OpponentStub, sessionKey: number): QuickAwayPlayer[] {
  const slots: { pos: string; num: number }[] = [
    { pos: 'GOL', num: 1 },
    { pos: 'ZAG', num: 4 },
    { pos: 'ZAG', num: 5 },
    { pos: 'LE', num: 3 },
    { pos: 'LD', num: 2 },
    { pos: 'VOL', num: 8 },
    { pos: 'MC', num: 6 },
    { pos: 'MC', num: 10 },
    { pos: 'PE', num: 7 },
    { pos: 'PD', num: 11 },
    { pos: 'ATA', num: 9 },
  ];
  const surnames = [
    'RIBEIRO',
    'NUNES',
    'CARVALHO',
    'MENDES',
    'TEIXEIRA',
    'BARBOSA',
    'CARDOSO',
    'REIS',
    'MOREIRA',
    'CASTRO',
    'FREITAS',
  ];
  return slots.map((slot, i) => {
    const h = hashStringSeed(`${opponent.id}|away|${sessionKey}|${i}`);
    const sur = surnames[Math.abs(h) % surnames.length]!;
    const isStar = slot.pos === 'ATA' && opponent.highlightPlayer;
    return {
      id: `away-${opponent.id}-${sessionKey}-${i}`,
      num: slot.num,
      name: isStar ? opponent.highlightPlayer!.name : sur,
      pos: slot.pos,
    };
  });
}

/**
 * Partida rápida: 25s + intervalo 5s + 25s; feed ao vivo; substituição altera `matchLineupBySlot` (mesmo reducer).
 */
export function MatchQuick() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const lineupIds = useGameStore((s) => s.lineup);
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);

  const [session, setSession] = useState(0);
  const [halfTimeUi, setHalfTimeUi] = useState(false);
  const [summary, setSummary] = useState<EndSummary | null>(null);
  const [selected, setSelected] = useState<PitchPlayerState | null>(null);
  const [subPickId, setSubPickId] = useState('');
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [halfTimeTick, setHalfTimeTick] = useState(3);

  const htRef = useRef(0);
  const htTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizedRef = useRef(false);
  const freezeUntilRef = useRef(0);
  const lastSeenGoalEventIdRef = useRef<string | null>(null);
  const [momentumAnimKey, setMomentumAnimKey] = useState<string | null>(null);
  const [feedWindowStart, setFeedWindowStart] = useState(0);
  const lastFeedHeadIdRef = useRef<string | undefined>(undefined);
  const [preGoalActive, setPreGoalActive] = useState(false);
  const [goalScorerRevealDone, setGoalScorerRevealDone] = useState(false);
  const [quickPreStart, setQuickPreStart] = useState<QuickPreStartPhase>('c3');
  const preKickoffTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    finalizedRef.current = false;
    setSummary(null);
    htRef.current = 0;
    setHalfTimeUi(false);
    setHalfTimeTick(3);
    freezeUntilRef.current = 0;
    lastSeenGoalEventIdRef.current = null;
    setMomentumAnimKey(null);
    setFeedWindowStart(0);
    lastFeedHeadIdRef.current = undefined;
    setPreGoalActive(false);
    setGoalScorerRevealDone(false);
    setQuickPreStart('c3');
    preKickoffTimersRef.current.forEach(clearTimeout);
    preKickoffTimersRef.current = [];
    dispatch({ type: 'START_LIVE_MATCH', mode: 'quick' });

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
          setHalfTimeTick(3);
          htTimersRef.current.push(
            window.setTimeout(() => setHalfTimeTick(2), 1000),
            window.setTimeout(() => setHalfTimeTick(1), 2000),
            window.setTimeout(() => {
              setHalfTimeUi(false);
              setHalfTimeTick(3);
              htRef.current = 2;
              loop();
            }, HALFTIME_MS),
          );
          return;
        }

        tick();
      }, MS_PER_MINUTE);
    };

    const t1 = QUICK_KICKOFF_COUNTDOWN_MS;
    const t2 = QUICK_KICKOFF_COUNTDOWN_MS * 2;
    const t3 = QUICK_KICKOFF_COUNTDOWN_MS * 3;
    const tEnd = t3 + QUICK_KICKOFF_MESSAGE_MS;

    preKickoffTimersRef.current.push(
      window.setTimeout(() => setQuickPreStart('c2'), t1),
      window.setTimeout(() => setQuickPreStart('c1'), t2),
      window.setTimeout(() => setQuickPreStart('kickoff'), t3),
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
  }, [session, dispatch]);

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

  /** Após pré-golo: 3s com cartão do marcador, depois painel narrativo (total = autoDismissMs). */
  useEffect(() => {
    if (!live || live.phase !== 'playing') {
      setGoalScorerRevealDone(false);
      return;
    }
    const o = live.spiritOverlay;
    if (!o || o.kind !== 'goal') {
      setGoalScorerRevealDone(false);
      return;
    }
    const hint = live.preGoalHint;
    if (hint && Date.now() < hint.startedAtMs + hint.durationMs) {
      setGoalScorerRevealDone(false);
      return;
    }
    if (preGoalActive) {
      setGoalScorerRevealDone(false);
      return;
    }
    setGoalScorerRevealDone(false);
    const id = o.startedAtMs;
    const t = window.setTimeout(() => {
      const st = getGameState().liveMatch;
      const cur = st?.spiritOverlay;
      if (cur?.kind === 'goal' && cur.startedAtMs === id) {
        setGoalScorerRevealDone(true);
      }
    }, GOAL_SCORER_OVERLAY_MS);
    return () => window.clearTimeout(t);
  }, [
    live?.spiritOverlay?.startedAtMs,
    live?.spiritOverlay?.kind,
    live?.phase,
    preGoalActive,
    live?.preGoalHint?.startedAtMs,
    live?.preGoalHint?.durationMs,
  ]);

  /** GameSpirit: overlay de golo/penálti — congela minutos e encadeia penálti. */
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
    return () => window.clearTimeout(t);
  }, [live?.spiritOverlay?.startedAtMs, live?.spiritOverlay?.kind, live?.phase, live?.mode, dispatch]);

  useEffect(() => {
    const head = live?.events[0]?.id;
    if (head === undefined) return;
    if (lastFeedHeadIdRef.current !== head) {
      lastFeedHeadIdRef.current = head;
      setFeedWindowStart(0);
    }
  }, [live?.events]);

  useEffect(() => {
    if (!live || isBlockingNonQuickMatch(live) || live.phase !== 'playing' || summary !== null) return;
    const id = window.setInterval(() => {
      setFeedWindowStart((s) => {
        const evs = getGameState().liveMatch?.events ?? [];
        const len = Math.min(evs.length, FEED_POOL_MAX);
        const maxStart = Math.max(0, len - FEED_VISIBLE_COUNT);
        if (maxStart <= 0) return 0;
        const clamped = Math.min(s, maxStart);
        return (clamped + 1) % (maxStart + 1);
      });
    }, FEED_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [live?.mode, live?.phase, session, summary]);

  useEffect(() => {
    setSubPickId('');
  }, [selected?.playerId]);

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

  const maxOvr = useMemo(() => {
    const vals = Object.values(playersById);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs)));
  }, [playersById]);

  const onPitchIds = useMemo(() => {
    if (live?.matchLineupBySlot && Object.keys(live.matchLineupBySlot).length > 0) {
      return new Set(Object.values(live.matchLineupBySlot));
    }
    return new Set(Object.values(mergeLineupWithDefaults(lineupIds, playersById)));
  }, [live, lineupIds, playersById]);

  const benchCards = useMemo(() => {
    return Object.values(playersById)
      .filter((p) => !onPitchIds.has(p.id) && p.outForMatches <= 0)
      .slice(0, 8)
      .map((p) => playerToCardView(p, maxOvr));
  }, [playersById, onPitchIds, maxOvr]);

  const homeStats = live?.homeStats ?? {};
  const pitch = live?.homePlayers ?? [];

  const eventsChronological = useMemo(() => [...(live?.events ?? [])].reverse(), [live?.events]);

  const awayRoster = useMemo(
    () => (live?.awayRoster ?? []).length > 0
      ? live!.awayRoster!
      : buildAwayQuickRoster(fixture.opponent, session),
    [live?.awayRoster, fixture.opponent, session],
  );

  const goalScorerOverlayProps = useMemo(() => {
    if (!live) return null;
    const ev = live.events[0];
    if (!ev || (ev.kind !== 'goal_home' && ev.kind !== 'goal_away')) return null;
    const side = ev.kind === 'goal_home' ? 'home' : 'away';
    let scorerName = 'Marcador';
    let scorerNumber: number | undefined;
    if (side === 'home' && ev.playerId) {
      const p = pitch.find((x) => x.playerId === ev.playerId);
      if (p) {
        scorerName = p.name;
        scorerNumber = p.num;
      }
    } else if (side === 'away' && ev.playerId) {
      const p = awayRoster.find((x) => x.id === ev.playerId);
      if (p) {
        scorerName = p.name;
        scorerNumber = p.num;
      }
    }
    const storyline = pickGoalOverlayStoryline({
      scorerName,
      minute: ev.minute,
      goalBuildUp: ev.goalBuildUp,
      side,
      awayShort: live.awayShort,
    });
    return {
      scorerName,
      scorerNumber,
      minute: ev.minute,
      side,
      homeShort: live.homeShort,
      awayShort: live.awayShort,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      goalBuildUp: ev.goalBuildUp,
      storyline,
    };
  }, [live, pitch, awayRoster]);

  const awayRanked = useMemo(() => {
    const hs = live?.homeScore ?? 0;
    const as = live?.awayScore ?? 0;
    const ph = live?.phase ?? 'playing';
    const ranked = computeAwayImpactsFromVirtualLedger(awayRoster, eventsChronological, hs, as, ph);
    return ranked.map((r) => {
      const p = awayRoster.find((x) => x.id === r.id)!;
      return { ...p, impact: r.impact };
    });
  }, [awayRoster, eventsChronological, live?.homeScore, live?.awayScore, live?.phase]);

  const homeRanked = useMemo(() => {
    if (!live) return [] as { player: PitchPlayerState; impact: number }[];
    const rows = computeHomeImpactsFromLedger(
      pitch,
      homeStats,
      live.homeImpactLedger,
      live.phase,
      live.awayScore,
      eventsChronological,
    );
    return rows
      .map((r) => {
        const player = pitch.find((p) => p.playerId === r.playerId);
        return player ? { player, impact: r.impact } : null;
      })
      .filter((x): x is { player: PitchPlayerState; impact: number } => Boolean(x));
  }, [pitch, homeStats, eventsChronological, live?.awayScore, live?.phase, live?.homeImpactLedger, live]);

  /** Expulsos em partida rápida saem do `pitch` — mostrar no fim da lista com cartão vermelho. */
  const homeSentOffRows = useMemo(() => {
    const ids = live?.sentOffPlayerIds ?? [];
    const seen = new Set(homeRanked.map((r) => r.player.playerId));
    const out: { playerId: string; num: number; name: string; pos: string }[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const ent = playersById[id];
      if (!ent) continue;
      seen.add(id);
      out.push({ playerId: id, num: ent.num, name: ent.name, pos: ent.pos });
    }
    return out;
  }, [live?.sentOffPlayerIds, homeRanked, playersById]);

  const fullAwayRosterRef = useMemo(
    () => buildAwayQuickRoster(fixture.opponent, session),
    [fixture.opponent, session],
  );

  const awaySentOffRows = useMemo(() => {
    const currentIds = new Set(awayRoster.map((p) => p.id));
    return fullAwayRosterRef.filter((p) => !currentIds.has(p.id));
  }, [fullAwayRosterRef, awayRoster]);

  const feedHomeNames = useMemo(() => pitch.map((p) => p.name).filter(Boolean), [pitch]);
  const feedAwayNames = useMemo(() => awayRoster.map((p) => p.name).filter(Boolean), [awayRoster]);

  const feedVisibleEvents = useMemo(() => {
    const pool = (live?.events ?? []).slice(0, FEED_POOL_MAX);
    const maxStart = Math.max(0, pool.length - FEED_VISIBLE_COUNT);
    const start = Math.min(feedWindowStart, maxStart);
    return pool.slice(start, start + FEED_VISIBLE_COUNT);
  }, [live?.events, feedWindowStart]);

  const { homeEventBadges, awayEventBadges } = useMemo(() => {
    const home = new Map<string, QuickEventBadge[]>();
    const away = new Map<string, QuickEventBadge[]>();
    const list = [...(live?.events ?? [])].reverse();
    for (const ev of list) {
      if (ev.kind === 'goal_home' && ev.playerId) {
        pushBadge(home, ev.playerId, 'goal');
      }
      if (ev.kind === 'goal_away' && ev.playerId) {
        pushBadge(away, ev.playerId, 'goal');
      }
      if (ev.kind === 'yellow_home' && ev.playerId) pushBadge(home, ev.playerId, 'yellow');
      if (ev.kind === 'red_home' && ev.playerId) pushBadge(home, ev.playerId, 'red');
      if (ev.kind === 'yellow_away' && ev.playerId) pushBadge(away, ev.playerId, 'yellow');
      if (ev.kind === 'red_away' && ev.playerId) pushBadge(away, ev.playerId, 'red');
      if (ev.kind === 'injury_home' && ev.playerId) pushBadge(home, ev.playerId, 'injury');
    }
    return { homeEventBadges: home, awayEventBadges: away };
  }, [live?.events, awayRoster]);

  const minute = live?.minute ?? 0;
  const clockFrozen =
    quickPreStart !== null ||
    halfTimeUi ||
    !!(live?.spiritOverlay) ||
    preGoalActive ||
    Date.now() < freezeUntilRef.current;
  const matchClock = useMatchClock(live?.footballElapsedSec ?? 0, clockFrozen, live?.phase);
  const showBoard = summary === null;

  const momentumPressure = useMemo(() => {
    if (!live || live.phase !== 'playing') return 0.5;
    if (live.spiritMomentumClamp01 != null) {
      return Math.min(0.98, Math.max(0.02, live.spiritMomentumClamp01));
    }
    return momentumPressure01(live.possession, live.ball.x);
  }, [live?.possession, live?.ball.x, live?.phase, live?.spiritMomentumClamp01]);

  const displayHomeScore = preGoalActive && live?.preGoalHint?.side === 'home'
    ? (live?.homeScore ?? 1) - 1
    : live?.homeScore ?? 0;
  const displayAwayScore = preGoalActive && live?.preGoalHint?.side === 'away'
    ? (live?.awayScore ?? 1) - 1
    : live?.awayScore ?? 0;

  const barTransitionMs = preGoalActive ? (live?.preGoalHint?.durationMs ?? 3000) : 500;
  /** Mesmo easing do retorno ao centro pós-golo: desacelera ao aproximar do extremo. */
  const barEasing = 'ease-out';

  const confirmForfeitQuick = () => {
    dispatch({ type: 'FORFEIT_MATCH', mode: 'quick' });
    setForfeitOpen(false);
    setSelected(null);
  };

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col space-y-4 py-6 px-4 pb-24 md:flex-none">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/" className="text-xs font-bold text-gray-500 hover:text-neon-yellow">
          ← Home
        </Link>
        <span className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-600">
          Partida rápida
        </span>
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
            aria-labelledby="forfeit-quick-title"
            onClick={() => setForfeitOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="glass-panel w-full p-6 border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="forfeit-quick-title" className="font-display font-black text-xl text-white text-center uppercase tracking-wide">
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
                  onClick={confirmForfeitQuick}
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
          <Fragment key="match-halftime">
            <MatchInterruptOverlay
              kind="halftime"
              title="Intervalo"
              lines={['2.º tempo a seguir…']}
              countdown={halfTimeTick}
            />
          </Fragment>
        ) : live?.spiritOverlay?.kind === 'goal' &&
          !preGoalActive &&
          goalScorerOverlayProps &&
          !goalScorerRevealDone ? (
          <GoalScorerOverlay
            key={`goal-scorer-${live.spiritOverlay.startedAtMs}`}
            {...goalScorerOverlayProps}
          />
        ) : live?.spiritOverlay && !preGoalActive ? (
          <Fragment key={`spirit-${live.spiritOverlay.startedAtMs}-${live.spiritOverlay.kind}`}>
            <MatchInterruptOverlay
              kind={live.spiritOverlay.kind}
              title={live.spiritOverlay.title}
              lines={live.spiritOverlay.lines}
            />
          </Fragment>
        ) : null}
      </AnimatePresence>

      {showBoard && live && (
        <div className="glass-panel p-5 border border-white/10 space-y-4 relative overflow-hidden">
          {quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1' ? (
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
                className="font-display font-black text-[min(22vw,7rem)] text-neon-yellow tabular-nums drop-shadow-[0_0_24px_rgba(234,255,0,0.35)]"
              >
                {quickPreStart === 'c3' ? 3 : quickPreStart === 'c2' ? 2 : 1}
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
            rowClassName="w-full max-w-[min(100%,44rem)] mx-auto"
          />
          <div
            className={cn(
              'flex justify-center items-center gap-8 font-display font-black text-5xl transition-opacity',
              quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1'
                ? 'opacity-35'
                : 'opacity-100',
            )}
          >
            <span className="text-neon-yellow">{displayHomeScore}</span>
            <span className="text-gray-600 text-3xl">–</span>
            <span className="text-white">{displayAwayScore}</span>
          </div>
          {quickPreStart === null ? (
            <div className="space-y-2 pt-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-center text-gray-500">
                Momento — pressão em direção à baliza adversária
              </p>
              <div
                key={momentumAnimKey ?? 'momentum-idle'}
                className={cn(
                  'relative w-full px-0.5',
                  momentumAnimKey && 'momentum-bar-goal-flash rounded-lg py-1',
                )}
              >
                <div
                  className="relative w-full origin-center"
                  style={{
                    transform: preGoalActive ? 'scaleX(1.06) scaleY(1.45)' : 'scale(1)',
                    transitionProperty: 'transform',
                    transitionDuration: `${barTransitionMs}ms`,
                    transitionTimingFunction: 'ease-out',
                  }}
                >
                  <div className="relative w-full h-9 flex items-center">
                    <div
                      className={cn(
                        'absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full border overflow-hidden pointer-events-none',
                        preGoalActive
                          ? 'h-4 border-neon-yellow/50 bg-black/70 shadow-[0_0_28px_rgba(228,255,0,0.25)]'
                          : 'h-3 border-white/15 bg-black/50',
                      )}
                      style={{
                        transitionProperty: 'height, border-color, box-shadow, background-color',
                        transitionDuration: `${barTransitionMs}ms`,
                        transitionTimingFunction: 'ease-out',
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-yellow/65 via-neon-yellow/25 to-transparent"
                        style={{
                          width: `${momentumPressure * 100}%`,
                          transitionProperty: 'width',
                          transitionDuration: `${barTransitionMs}ms`,
                          transitionTimingFunction: barEasing,
                        }}
                        aria-hidden
                      />
                      <div
                        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-white/18 to-transparent"
                        style={{
                          left: `${momentumPressure * 100}%`,
                          transitionProperty: 'left',
                          transitionDuration: `${barTransitionMs}ms`,
                          transitionTimingFunction: barEasing,
                        }}
                        aria-hidden
                      />
                    </div>
                    <div
                      className={cn(
                        'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white pointer-events-none',
                        preGoalActive
                          ? 'h-7 w-2 ring-2 ring-neon-yellow/60 shadow-[0_0_36px_rgba(228,255,0,0.95)]'
                          : 'h-5 w-1.5 ring-2 ring-white/40 shadow-[0_0_16px_rgba(228,255,0,0.65)]',
                      )}
                      style={{
                        left: `${momentumPressure * 100}%`,
                        transitionProperty: 'left, height, width, box-shadow, ring-color',
                        transitionDuration: `${barTransitionMs}ms`,
                        transitionTimingFunction: barEasing,
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-start gap-2 text-[9px] font-bold uppercase tracking-wide px-0.5">
                <span className={live.possession === 'home' ? 'text-neon-yellow' : 'text-gray-500'}>
                  {live.homeShort}{' '}
                  <span className="font-extrabold">{live.possession === 'home' ? 'ataca →' : 'defende'}</span>
                </span>
                <span className={live.possession === 'away' ? 'text-white' : 'text-gray-500'}>
                  <span className="font-extrabold">{live.possession === 'away' ? '← ataca' : 'defende'}</span>{' '}
                  {live.awayShort}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-h-[5.5rem] pt-1 flex items-center justify-center border border-white/8 rounded-lg bg-black/20">
              <p className="text-[10px] font-medium text-gray-500 text-center px-4">
                {quickPreStart === 'kickoff'
                  ? 'Bola a rolar em instantes…'
                  : 'Prepara-te — o apito soa em segundos.'}
              </p>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 mt-2 space-y-2">
            <div className="min-h-[4.5rem] space-y-1.5 overflow-hidden">
              {quickPreStart === 'kickoff' ? (
                <div className="flex items-center justify-center min-h-[4.5rem] px-3">
                  <p
                    className="font-display font-black text-base sm:text-lg uppercase tracking-wide text-center text-neon-yellow"
                    aria-live="assertive"
                  >
                    COMEÇA A PARTIDA
                  </p>
                </div>
              ) : quickPreStart === 'c3' || quickPreStart === 'c2' || quickPreStart === 'c1' ? (
                <div className="flex items-center justify-center min-h-[4.5rem]">
                  <p className="text-[11px] text-gray-500 text-center font-medium">Feed ao vivo após o apito…</p>
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {feedVisibleEvents.map((e) => (
                    <motion.div
                      key={e.id}
                      layout="position"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className={cn(
                        'text-[11px] text-gray-300 leading-relaxed rounded-md px-2 py-1.5 border border-white/6',
                        quickFeedLineClass(e.kind),
                      )}
                    >
                      {renderQuickFeedRichText(e.text, {
                        homeShort: live.homeShort,
                        awayShort: live.awayShort,
                        homeNames: feedHomeNames,
                        awayNames: feedAwayNames,
                        homeClassName: 'text-neon-yellow',
                        awayClassName: 'text-gray-100',
                      })}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      )}

      {showBoard && live && (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 sm:gap-3 md:gap-4 items-start w-full">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between border-b border-neon-yellow/30 pb-2 gap-2">
                <MatchdayLineupColumnTitle
                  side="home"
                  name={live.homeName ?? club.name}
                  className="text-xs text-neon-yellow"
                />
                <span className="text-[9px] text-gray-500 shrink-0">Casa</span>
              </div>
              <div className="flex flex-col gap-2">
                {homeRanked.map(({ player: p, impact }, idx) => {
                  const top = idx < 3;
                  return (
                    <motion.button
                      key={p.playerId}
                      layout="position"
                      type="button"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      onClick={() => setSelected(p)}
                      className={cn(
                        'w-full text-left glass-panel p-2.5 sm:p-3 border flex items-center justify-between gap-2 rounded-lg',
                        selected?.playerId === p.playerId
                          ? 'border-neon-yellow bg-neon-yellow/10'
                          : top
                            ? 'border-neon-yellow/50 bg-neon-yellow/[0.06] shadow-[0_0_14px_rgba(234,255,0,0.12)]'
                            : 'border-white/10',
                      )}
                    >
                      <span className="text-[10px] font-display font-black text-gray-500 w-5 shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate flex items-center min-w-0">
                          <span className="truncate">
                            {p.num} {p.name}
                          </span>
                          <PlayerEventStrip badges={homeEventBadges.get(p.playerId) ?? []} />
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500">
                          {p.pos} • {Math.round(p.fatigue)}% cond.
                        </div>
                      </div>
                      <div className="text-[10px] sm:text-xs font-display font-bold text-neon-yellow shrink-0 tabular-nums">
                        {impact.toFixed(2)}
                      </div>
                    </motion.button>
                  );
                })}
                {homeSentOffRows.map((row) => (
                  <motion.div
                    key={`sent-off-${row.playerId}`}
                    layout="position"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="w-full glass-panel p-2.5 sm:p-3 border border-red-500/35 bg-red-950/20 flex items-center justify-between gap-2 rounded-lg opacity-90"
                  >
                    <span className="text-[10px] font-display font-black text-red-400/80 w-5 shrink-0 text-center">—</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-red-100/95 truncate flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {row.num} {row.name}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 shrink-0">Expulso</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-red-300/70">{row.pos}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RedCardIcon />
                      <span className="text-[10px] sm:text-xs font-display font-bold text-red-300/90 tabular-nums w-8 text-right">
                        —
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div
              className="flex flex-col items-center justify-center shrink-0 self-stretch w-8 sm:w-11 md:w-14 py-2 sm:py-6 select-none"
              aria-hidden
            >
              <div className="hidden sm:block w-px flex-1 min-h-6 bg-gradient-to-b from-transparent via-neon-yellow/35 to-transparent" />
              <span className="font-display font-black text-[10px] sm:text-sm md:text-lg text-neon-yellow/90 italic tracking-tighter leading-none py-2 flex flex-col items-center sm:hidden">
                <span>V</span>
                <span>S</span>
              </span>
              <span className="hidden sm:inline font-display font-black text-neon-yellow/90 italic tracking-tighter sm:[writing-mode:vertical-rl] sm:rotate-180 sm:text-xl md:text-2xl py-2">
                VS
              </span>
              <div className="hidden sm:block w-px flex-1 min-h-6 bg-gradient-to-b from-neon-yellow/25 via-transparent to-transparent" />
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between border-b border-white/20 pb-2 gap-2">
                <MatchdayLineupColumnTitle
                  side="away"
                  name={live.awayName ?? fixture.opponent.name}
                  className="text-xs text-gray-300"
                />
                <span className="text-[9px] text-gray-500 shrink-0 text-right">Visitante (IA)</span>
              </div>
              <div className="flex flex-col gap-2">
                {awayRanked.map((p, idx) => {
                  const top = idx < 3;
                  return (
                    <motion.div
                      key={p.id}
                      layout="position"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className={cn(
                        'w-full glass-panel p-2.5 sm:p-3 border flex items-center justify-between gap-2 rounded-lg',
                        top
                          ? 'border-white/35 bg-white/[0.04] shadow-[0_0_12px_rgba(255,255,255,0.06)]'
                          : 'border-white/10',
                      )}
                    >
                      <span className="text-[10px] font-display font-black text-gray-500 w-5 shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate flex items-center min-w-0">
                          <span className="truncate">
                            {p.num} {p.name}
                          </span>
                          <PlayerEventStrip badges={awayEventBadges.get(p.id) ?? []} />
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500">{p.pos}</div>
                      </div>
                      <div className="text-[10px] sm:text-xs font-display font-bold text-gray-200 shrink-0 tabular-nums">
                        {p.impact.toFixed(2)}
                      </div>
                    </motion.div>
                  );
                })}
                {awaySentOffRows.map((row) => (
                  <motion.div
                    key={`away-sent-off-${row.id}`}
                    layout="position"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="w-full glass-panel p-2.5 sm:p-3 border border-red-500/35 bg-red-950/20 flex items-center justify-between gap-2 rounded-lg opacity-90"
                  >
                    <span className="text-[10px] font-display font-black text-red-400/80 w-5 shrink-0 text-center">—</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-red-100/95 truncate flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {row.num} {row.name}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 shrink-0">Expulso</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-red-300/70">{row.pos}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RedCardIcon />
                      <span className="text-[10px] sm:text-xs font-display font-bold text-red-300/90 tabular-nums w-8 text-right">
                        —
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBoard && selected && live?.phase === 'playing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sub-quick-title"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-panel w-full max-w-md p-5 border border-neon-yellow/25 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sub-quick-title" className="font-display font-black text-lg text-white uppercase tracking-wide">
              Substituição
            </h2>
            <p className="text-sm text-gray-400 mt-2">Sai: {selected.name}</p>
            <label className="block mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Entra (banco)
            </label>
            <select
              value={subPickId}
              onChange={(e) => setSubPickId(e.target.value)}
              className="mt-1.5 w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
            >
              <option value="">— Escolher jogador —</option>
              {benchCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.num} {c.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={!subPickId}
                className="w-full py-3 rounded-xl bg-neon-yellow text-black font-display font-black uppercase tracking-wider text-sm disabled:opacity-40 disabled:pointer-events-none"
                onClick={() => {
                  if (!subPickId) return;
                  dispatch({
                    type: 'MATCH_SUBSTITUTE',
                    outPlayerId: selected.playerId,
                    inPlayerId: subPickId,
                  });
                  setSelected(null);
                }}
              >
                Confirmar troca
              </button>
              <button
                type="button"
                className="w-full py-3 rounded-xl border border-white/20 text-gray-300 font-bold text-sm"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
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
