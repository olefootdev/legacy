import { useEffect, useRef, useState } from 'react';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { LiveMatchClockPeriod } from '@/engine/types';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import { useGameDispatch } from '@/game/store';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import { LIVE_SIM_SYNC_THROTTLE_MS } from '@/match/matchSimulationTuning';
import type { HomeStaffMatchBonuses } from '@/systems/staffBenefits';

export interface Live2dTacticalManagerSlice {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  tacticalStyle?: TeamTacticalStyle;
  isHomeFixture?: boolean;
  homeStaffMatch?: HomeStaffMatchBonuses | null;
}

/** ~40 fps de commit React: movimento dos tokens mais fluido; `SIM_SYNC` continua com throttle próprio. */
export const LIVE2D_RENDER_INTERVAL_MS = 24;
const RENDER_INTERVAL_MS = LIVE2D_RENDER_INTERVAL_MS;

/**
 * Motor tático contínuo para partida ao vivo (`test2d`): `TacticalSimLoop` + `SIM_SYNC`
 * (PlayerDecisionEngine / Yuka) — sem `TICK_MATCH_MINUTE` nem cartões de ficção por RNG desalinhado.
 */
export function useLive2dTacticalSim(opts: {
  enabled: boolean;
  session: number;
  live: LiveMatchSnapshot | null;
  manager: Live2dTacticalManagerSlice;
}) {
  const dispatch = useGameDispatch();
  const loopRef = useRef(new TacticalSimLoop());
  const liveRef = useRef(opts.live);
  const managerRef = useRef(opts.manager);
  liveRef.current = opts.live;
  managerRef.current = opts.manager;

  const truthRef = useRef<MatchTruthSnapshot | null>(null);
  /** Evita fallback para `live.homePlayers` quando `getSnapshot` devolve lista vazia por um instante. */
  const lastGoodTruthRef = useRef<MatchTruthSnapshot | null>(null);
  const carrierRef = useRef<string | null>(null);
  const fatigueRef = useRef<{ ids: string[]; deadBall: boolean }>({ ids: [], deadBall: false });
  const [renderTick, setRenderTick] = useState(0);

  useEffect(() => {
    loopRef.current = new TacticalSimLoop();
    truthRef.current = null;
    lastGoodTruthRef.current = null;
    carrierRef.current = null;
    setRenderTick(0);
  }, [opts.session]);

  useEffect(() => {
    if (!opts.enabled) {
      lastGoodTruthRef.current = null;
      return;
    }

    const loop = loopRef.current;
    let frame = 0;
    let last = performance.now();
    let lastRenderMs = 0;
    let lastSyncMinute = -1;
    let lastSyncClockPeriod: LiveMatchClockPeriod | null = null;
    const feedSync = { fp: '', lastMs: 0 };

    const run = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const live = liveRef.current;
      loop.syncLive(live, managerRef.current);
      if (live?.phase === 'playing') {
        loop.step(dt, managerRef.current);
      }

      const snap = loop.getSnapshot();
      truthRef.current = snap;
      if (snap.players.length > 0) {
        lastGoodTruthRef.current = snap;
      }
      carrierRef.current = loop.getSimState().carrierId;
      fatigueRef.current = {
        ids: loop.getCriticallyFatiguedHomeIds(30),
        deadBall: loop.isDeadBallActive(),
      };

      if (now - lastRenderMs >= RENDER_INTERVAL_MS) {
        lastRenderMs = now;
        setRenderTick((t) => t + 1);
      }

      const simSt = loop.getSimState();
      const periodChanged = simSt.clockPeriod !== lastSyncClockPeriod;
      const minuteChanged = simSt.minute !== lastSyncMinute;
      const urgent = minuteChanged || periodChanged || simSt.phase === 'fulltime';
      const fp = [
        simSt.events[0]?.id ?? '',
        simSt.events.length,
        simSt.homeScore,
        simSt.awayScore,
        simSt.minute,
        simSt.clockPeriod,
        simSt.carrierId ?? '',
      ].join('|');
      const feedChanged = fp !== feedSync.fp;
      const throttleOk = now - feedSync.lastMs >= LIVE_SIM_SYNC_THROTTLE_MS;

      if (urgent || (feedChanged && throttleOk)) {
        if (urgent) {
          lastSyncMinute = simSt.minute;
          lastSyncClockPeriod = simSt.clockPeriod;
        }
        feedSync.fp = fp;
        feedSync.lastMs = now;
        dispatch({
          type: 'SIM_SYNC',
          minute: simSt.minute,
          clockPeriod: simSt.clockPeriod,
          homeScore: simSt.homeScore,
          awayScore: simSt.awayScore,
          possession: simSt.possession,
          events: simSt.events,
          stats: simSt.stats,
          carrierId: simSt.carrierId,
          fullTime: simSt.phase === 'fulltime',
        });
      }

      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [opts.enabled, opts.session, dispatch]);

  void renderTick;

  const currentTruth = truthRef.current;
  const effectiveTruth =
    currentTruth && currentTruth.players.length > 0
      ? currentTruth
      : lastGoodTruthRef.current && lastGoodTruthRef.current.players.length > 0
        ? lastGoodTruthRef.current
        : currentTruth;

  return {
    loopRef,
    truthSnap: effectiveTruth,
    carrierSimId: carrierRef.current,
    fatigue: fatigueRef.current,
  };
}
