import { useEffect, useRef, useState } from 'react';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { LiveMatchClockPeriod } from '@/engine/types';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import { useGameDispatch } from '@/game/store';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import { LIVE_SIM_SYNC_THROTTLE_MS } from '@/match/matchSimulationTuning';

export interface Live2dTacticalManagerSlice {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  tacticalStyle?: TeamTacticalStyle;
}

/**
 * Motor tático contínuo para partida ao vivo (`test2d`): `TacticalSimLoop` + `SIM_SYNC`
 * (PlayerDecisionEngine / Yuka) — sem `TICK_MATCH_MINUTE` nem cartões de ficção por RNG desalinhado.
 */
export function useLive2dTacticalSim(opts: {
  enabled: boolean;
  /** Reinicia refs de sync quando a sessão de partida muda. */
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

  const [truthSnap, setTruthSnap] = useState<MatchTruthSnapshot | null>(null);
  const [carrierSimId, setCarrierSimId] = useState<string | null>(null);

  /**
   * Nova instância do loop a cada sessão: com o mesmo plantel, `syncLive` não
   * reinicializa (mesmo `homeRosterSig`) — sem isto, após "Jogar novamente" o
   * relógio interno ficava em full time e o primeiro SIM_SYNC fechava a partida.
   */
  useEffect(() => {
    loopRef.current = new TacticalSimLoop();
    setTruthSnap(null);
    setCarrierSimId(null);
  }, [opts.session]);

  useEffect(() => {
    if (!opts.enabled) {
      return;
    }

    const loop = loopRef.current;
    let frame = 0;
    let last = performance.now();
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
      setTruthSnap(loop.getSnapshot());
      setCarrierSimId(loop.getSimState().carrierId);

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

  return { loopRef, truthSnap, carrierSimId };
}
