import { useEffect, useRef, useState } from 'react';
import type { LiveMatchSnapshot } from '@/engine/types';
import { MatchDirector } from '@/matchDirector/MatchDirector';
import { MatchBabylonRenderer } from '@/render-babylon/MatchBabylonRenderer';
import type { MatchCameraMode } from '@/render-babylon/matchCameraTypes';
import { TacticalSimLoop } from '@/simulation/TacticalSimLoop';
import { serializeMatchTruth } from '@/bridge/matchTruthSchema';
import { throttleMs } from '@/bridge/snapshotThrottle';
import { useGameDispatch } from '@/game/store';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';

interface Props {
  live: LiveMatchSnapshot | null;
  manager: { tacticalMentality: number; defensiveLine: number; tempo: number; tacticalStyle?: TeamTacticalStyle };
  /** Log opcional de snapshot (debug / futura ponte) */
  debugBridgeLog?: boolean;
}

export type CameraControlMode = 'auto' | MatchCameraMode;

/**
 * Orquestração da partida ao vivo:
 * - Camada 1: TacticalSimLoop (Yuka + FSM + movimento contínuo) — não decide placar no modo spirit.
 * - GameSpirit (Redux): beats, golos/cartões autoritativos, `SIM_SYNC` funde stats + roteiro na mesma frame.
 * - Camada 2: MatchDirector — câmera.
 * - Camada 3: MatchBabylonRenderer — MatchViewAdapter (sem decisão de golo).
 */
const MANUAL_MODES: { id: MatchCameraMode; label: string }[] = [
  { id: 'tv', label: 'TV' },
  { id: 'cabine', label: 'Cabine' },
  { id: 'drone', label: 'Drone' },
  { id: 'motion', label: 'Motion' },
];

export function MatchBabylonLayer({ live, manager, debugBridgeLog }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MatchBabylonRenderer | null>(null);
  const directorRef = useRef(new MatchDirector());
  const dispatch = useGameDispatch();
  const [cameraControl, setCameraControl] = useState<CameraControlMode>('auto');
  const [cameraZoom, setCameraZoom] = useState(0);
  const cameraControlRef = useRef(cameraControl);
  const cameraZoomRef = useRef(cameraZoom);
  cameraControlRef.current = cameraControl;
  cameraZoomRef.current = cameraZoom;
  const loopRef = useRef(new TacticalSimLoop());
  const lastSyncMinute = useRef(-1);
  const lastSyncClockPeriod = useRef<import('@/engine/types').LiveMatchClockPeriod | null>(null);
  const liveRef = useRef(live);
  const managerRef = useRef(manager);
  liveRef.current = live;
  managerRef.current = manager;
  const throttledLog = useRef(
    throttleMs(() => {
      return true;
    }, 200),
  );

  const resolveCameraMode = (snap: import('@/bridge/matchTruthSchema').MatchTruthSnapshot, dt: number) => {
    const c = cameraControlRef.current;
    return c === 'auto' ? directorRef.current.decide(snap, dt) : c;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new MatchBabylonRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setCameraMode(resolveCameraMode(loopRef.current.getSnapshot(), 0.016));
    renderer.setCameraUserZoom(cameraZoomRef.current);
    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setCameraMode(resolveCameraMode(loopRef.current.getSnapshot(), 0.016));
  }, [cameraControl]);

  useEffect(() => {
    rendererRef.current?.setCameraUserZoom(cameraZoom);
  }, [cameraZoom]);

  useEffect(() => {
    const loop = loopRef.current;
    const renderer = rendererRef.current;
    loop.syncLive(live, manager);
    if (!renderer) return;

    if (!live || live.phase !== 'playing') {
      const snap = loop.getSnapshot();
      renderer.setCameraMode(resolveCameraMode(snap, 0.016));
      renderer.syncFromTruth(snap, 0.016);
      return;
    }

    let frame = 0;
    let last = performance.now();
    const run = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      loop.syncLive(liveRef.current, managerRef.current);
      loop.step(dt, managerRef.current);
      const snap = loop.getSnapshot();
      renderer.setCameraMode(resolveCameraMode(snap, dt));
      renderer.syncFromTruth(snap, dt);

      const simSt = loop.getSimState();
      const periodChanged = simSt.clockPeriod !== lastSyncClockPeriod.current;
      const minuteChanged = simSt.minute !== lastSyncMinute.current;
      if (minuteChanged || periodChanged || simSt.phase === 'fulltime') {
        lastSyncMinute.current = simSt.minute;
        lastSyncClockPeriod.current = simSt.clockPeriod;
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

      if (debugBridgeLog) {
        const ok = throttledLog.current();
        if (ok) {
          void serializeMatchTruth(snap);
        }
      }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [live, manager, live?.phase, debugBridgeLog, cameraControl]);

  const tactical = live?.phase === 'playing';
  const showHud = live != null;

  return (
    <div className="absolute inset-0 min-h-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none bg-black"
      />
      {showHud && (
        <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1 justify-center pointer-events-auto z-30">
          <span className="self-center text-[8px] font-display font-bold uppercase tracking-wider text-white/45 mr-1">
            Câmera
          </span>
          <button
            type="button"
            className={`px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider border ${
              cameraControl === 'auto'
                ? 'bg-neon-yellow/90 border-neon-yellow text-black'
                : 'bg-black/70 border-white/20 text-gray-300 hover:border-neon-yellow hover:text-neon-yellow'
            }`}
            onClick={() => setCameraControl('auto')}
          >
            Auto
          </button>
          {MANUAL_MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider border ${
                cameraControl === id
                  ? 'bg-neon-yellow/90 border-neon-yellow text-black'
                  : 'bg-black/70 border-white/20 text-gray-300 hover:border-neon-yellow hover:text-neon-yellow'
              }`}
              onClick={() => setCameraControl(id)}
            >
              {label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 px-1 py-0.5 rounded border border-white/15 bg-black/60">
            <span className="text-[8px] font-display font-bold uppercase tracking-wider text-white/50 whitespace-nowrap">
              Zoom
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(cameraZoom * 100)}
              onChange={(e) => setCameraZoom(Number(e.target.value) / 100)}
              className="w-20 sm:w-28 h-1 accent-neon-yellow cursor-pointer"
              aria-label="Zoom da câmera"
            />
          </label>
        </div>
      )}
      {tactical && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 justify-center pointer-events-auto z-30">
          <button
            type="button"
            className="px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider bg-black/70 border border-white/20 text-gray-300 hover:border-neon-yellow hover:text-neon-yellow"
            onClick={() => loopRef.current.triggerPreset('throw_in')}
          >
            Lateral
          </button>
          <button
            type="button"
            className="px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider bg-black/70 border border-white/20 text-gray-300 hover:border-neon-yellow hover:text-neon-yellow"
            onClick={() => loopRef.current.triggerPreset('corner_kick')}
          >
            Escanteio
          </button>
          <button
            type="button"
            className="px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider bg-black/70 border border-white/20 text-gray-300 hover:border-neon-yellow hover:text-neon-yellow"
            onClick={() => loopRef.current.triggerPreset('goal_kick')}
          >
            Tiro de meta
          </button>
          <button
            type="button"
            className="px-2 py-1 text-[9px] font-display font-bold uppercase tracking-wider bg-black/70 border border-white/20 text-gray-300 hover:border-white"
            onClick={() => loopRef.current.resumeDynamic()}
          >
            Bola viva
          </button>
        </div>
      )}
    </div>
  );
}
