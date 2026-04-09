import { useEffect, useRef, useCallback } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { MatchTruthSnapshot } from './matchTruthTypes';
import { TV_BROADCAST, updateStadiumCamera } from './CameraRig';
import { createOlefootDemoGrassMaterial } from './demoGrassMaterial';
import { FIELD_LENGTH, FIELD_WIDTH, demoPositions433 } from './formation433';
import {
  buildBothGoals,
  buildGridMeshes,
  buildPitchLineMeshes,
  buildThirdsMeshes,
  setupPitchLightingAndShadows,
} from '../../../src/render-babylon/footballPitchBuild';
import { buildStadiumEnvironment } from './stadiumEnvironment';
import { createPlayerFigure, type TeamColors } from './playerFigure';
import {
  computeRestartPositions,
  demoBallOrbit,
  lerpMeshToTarget,
  type MatchVisualState,
} from './matchVisualState';

export type CameraMode = 'tv' | 'drone' | 'motion' | 'cabine';

interface PitchViewerProps {
  cameraMode: CameraMode;
  cameraZoom?: number;
  showThirds: boolean;
  showGrid8x5: boolean;
  matchState?: MatchVisualState;
  onSnapshotApplied?: () => void;
}

const HOME_COLORS: TeamColors = { primary: '#1a5fb4', secondary: '#f5f5f5' };
const AWAY_COLORS: TeamColors = { primary: '#c01c28', secondary: '#2d2d2d' };

interface PlayerEntry {
  root: Mesh;
  setTeamColors: (c: TeamColors) => void;
  setShirtNumber: (n: number) => void;
  targetX: number;
  targetZ: number;
}

export function PitchViewer({
  cameraMode,
  cameraZoom = 0,
  showThirds,
  showGrid8x5,
  matchState = 'BOLA_VIVA',
  onSnapshotApplied,
}: PitchViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const ballRef = useRef<Mesh | null>(null);
  const playerEntriesRef = useRef<Map<string, PlayerEntry>>(new Map());
  const thirdsRef = useRef<Mesh[]>([]);
  const gridRef = useRef<Mesh[]>([]);
  const shadowGenRef = useRef<ShadowGenerator | null>(null);
  const cameraModeRef = useRef(cameraMode);
  const cameraZoomRef = useRef(cameraZoom);
  const matchStateRef = useRef(matchState);
  const hasExternalSnapshotRef = useRef(false);
  const startTimeRef = useRef(0);
  const restartTargetsRef = useRef<Map<string, { x: number; z: number }> | null>(null);
  const restartBallRef = useRef<{ x: number; z: number } | null>(null);

  cameraModeRef.current = cameraMode;
  cameraZoomRef.current = cameraZoom;
  matchStateRef.current = matchState;

  // -----------------------------------------------------------------------
  // Apply external snapshot (from bridge / postMessage)
  // -----------------------------------------------------------------------
  const applySnapshot = useCallback(
    (snap: MatchTruthSnapshot) => {
      hasExternalSnapshotRef.current = true;
      const ball = ballRef.current;
      if (ball) {
        ball.position.set(snap.ball.x, Math.max(0.12, snap.ball.y) + 0.34, snap.ball.z);
      }
      const scene = sceneRef.current;
      if (!scene) return;
      const seen = new Set<string>();

      for (const p of snap.players) {
        seen.add(p.id);
        let entry = playerEntriesRef.current.get(p.id);
        if (!entry) {
          const colors = p.side === 'home' ? HOME_COLORS : AWAY_COLORS;
          const fig = createPlayerFigure(scene, p.id, colors, shadowGenRef.current);
          entry = {
            root: fig.root,
            setTeamColors: fig.setTeamColors,
            setShirtNumber: fig.setShirtNumber,
            targetX: p.x,
            targetZ: p.z,
          };
          if (p.shirtNumber != null) fig.setShirtNumber(p.shirtNumber);
          playerEntriesRef.current.set(p.id, entry);
        }
        entry.targetX = p.x;
        entry.targetZ = p.z;
        entry.root.position.x = p.x;
        entry.root.position.z = p.z;

        // Heading → rotation
        if (p.heading != null) {
          entry.root.rotation.y = -p.heading;
        }
      }

      // Remove players no longer in snapshot
      for (const [id, e] of playerEntriesRef.current) {
        if (!seen.has(id)) {
          e.root.dispose();
          playerEntriesRef.current.delete(id);
        }
      }
      onSnapshotApplied?.();
    },
    [onSnapshotApplied],
  );

  // -----------------------------------------------------------------------
  // Bridge listeners
  // -----------------------------------------------------------------------
  useEffect(() => {
    (window as unknown as { __RN_MATCH_PITCH?: (p: unknown) => void }).__RN_MATCH_PITCH = (payload: unknown) => {
      try {
        const snap = typeof payload === 'string' ? JSON.parse(payload) : payload;
        applySnapshot(snap as MatchTruthSnapshot);
      } catch { /* ignore */ }
    };
    return () => {
      delete (window as unknown as { __RN_MATCH_PITCH?: (p: unknown) => void }).__RN_MATCH_PITCH;
    };
  }, [applySnapshot]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      try {
        const raw = ev.data;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data && typeof data === 'object' && 'schemaVersion' in data && 'ball' in data) {
          applySnapshot(data as MatchTruthSnapshot);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage as EventListener);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message', onMessage as EventListener);
    };
  }, [applySnapshot]);

  // -----------------------------------------------------------------------
  // Match state changes → compute restart positions
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (matchState === 'BOLA_VIVA') {
      restartTargetsRef.current = null;
      restartBallRef.current = null;
      return;
    }

    const ids = Array.from(playerEntriesRef.current.keys());
    if (ids.length === 0) return;

    const restart = computeRestartPositions(matchState, ids);
    restartBallRef.current = restart.ball;

    const targets = new Map<string, { x: number; z: number }>();
    for (const np of restart.nearbyPlayerPositions) {
      targets.set(np.id, { x: np.x, z: np.z });
    }
    restartTargetsRef.current = targets;
  }, [matchState]);

  // -----------------------------------------------------------------------
  // Scene setup
  // -----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    engineRef.current = engine;
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.06, 0.07, 0.12, 1);
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = 0.0003;
    scene.fogColor = new Color3(0.07, 0.08, 0.12);

    // -- Ground
    const ground = MeshBuilder.CreateGround('g', { width: FIELD_LENGTH, height: FIELD_WIDTH }, scene);
    ground.position.x = FIELD_LENGTH / 2;
    ground.position.z = FIELD_WIDTH / 2;
    ground.material = createOlefootDemoGrassMaterial(scene);

    // -- Lighting & shadows
    const { shadowGenerator } = setupPitchLightingAndShadows(scene, ground);
    shadowGenRef.current = shadowGenerator;

    for (const L of scene.lights) {
      if (L.name === 'hemiFill' && L instanceof HemisphericLight) {
        L.intensity = 0.72;
        L.groundColor = new Color3(0.26, 0.32, 0.24);
      }
    }

    // -- Pitch markings
    buildPitchLineMeshes(scene);
    thirdsRef.current = buildThirdsMeshes(scene);
    gridRef.current = buildGridMeshes(scene);

    // -- Goals
    for (const g of buildBothGoals(scene)) {
      shadowGenerator.addShadowCaster(g, true);
    }

    // -- Stadium environment (stands, boards, floodlights)
    buildStadiumEnvironment(scene);

    // -- Ball (improved material)
    const ball = MeshBuilder.CreateSphere('ball', { diameter: 0.68, segments: 24 }, scene);
    ball.position.set(FIELD_LENGTH / 2, 0.34, FIELD_WIDTH / 2);
    const bm = new StandardMaterial('bm', scene);
    bm.diffuseColor = Color3.FromHexString('#f0f0f0');
    bm.specularColor = new Color3(0.45, 0.45, 0.45);
    bm.specularPower = 64;

    // Procedural pentagon pattern via dynamic texture
    const ballTex = new DynamicTexture('ballTex', { width: 256, height: 256 }, scene, false);
    const bCtx = ballTex.getContext() as CanvasRenderingContext2D;
    bCtx.fillStyle = '#f0f0f0';
    bCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#1a1a1a';
    const pentR = 28;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if ((row + col) % 2 === 0) {
          const cx = 26 + col * 52;
          const cy = 26 + row * 52;
          bCtx.beginPath();
          for (let s = 0; s < 5; s++) {
            const a = (s / 5) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * pentR;
            const py = cy + Math.sin(a) * pentR;
            s === 0 ? bCtx.moveTo(px, py) : bCtx.lineTo(px, py);
          }
          bCtx.closePath();
          bCtx.fill();
        }
      }
    }
    ballTex.update();
    bm.diffuseTexture = ballTex;
    ball.material = bm;
    shadowGenerator.addShadowCaster(ball, true);
    ballRef.current = ball;

    // -- Spawn demo players (used when no bridge snapshot is active)
    {
      const { home, away } = demoPositions433();
      const allDemo = [
        ...home.map((p, i) => ({ ...p, side: 'home' as const, num: i + 1 })),
        ...away.map((p, i) => ({ ...p, side: 'away' as const, num: i + 1 })),
      ];
      for (const dp of allDemo) {
        const colors = dp.side === 'home' ? HOME_COLORS : AWAY_COLORS;
        const fig = createPlayerFigure(scene, dp.id, colors, shadowGenerator);
        fig.root.position.set(dp.x, 0, dp.z);
        fig.setShirtNumber(dp.num);
        playerEntriesRef.current.set(dp.id, {
          root: fig.root,
          setTeamColors: fig.setTeamColors,
          setShirtNumber: fig.setShirtNumber,
          targetX: dp.x,
          targetZ: dp.z,
        });
      }
    }

    // -- Camera
    const camera = new ArcRotateCamera(
      'cam',
      TV_BROADCAST.alpha,
      TV_BROADCAST.beta,
      TV_BROADCAST.radius,
      new Vector3(FIELD_LENGTH / 2, 0, FIELD_WIDTH / 2),
      scene,
    );
    camera.lowerRadiusLimit = 22;
    camera.upperRadiusLimit = 180;
    camera.attachControl(canvas, true);
    cameraRef.current = camera;

    startTimeRef.current = performance.now() / 1000;

    // -- Render loop
    engine.runRenderLoop(() => {
      const mode = cameraModeRef.current;
      const b = ballRef.current;
      const cam = cameraRef.current;
      const dtSec = engine.getDeltaTime() / 1000;

      // Demo ball orbit (only when no external snapshot)
      if (!hasExternalSnapshotRef.current && b) {
        const state = matchStateRef.current;
        if (state === 'BOLA_VIVA') {
          const elapsed = performance.now() / 1000 - startTimeRef.current;
          const pos = demoBallOrbit(elapsed);
          b.position.set(pos.x, pos.y, pos.z);
        } else if (restartBallRef.current) {
          lerpMeshToTarget(b, restartBallRef.current.x, restartBallRef.current.z, 0.34, dtSec, 5);
        }
      }

      // Lerp restart targets for players
      if (restartTargetsRef.current) {
        for (const [id, target] of restartTargetsRef.current) {
          const entry = playerEntriesRef.current.get(id);
          if (entry) {
            lerpMeshToTarget(entry.root, target.x, target.z, 0, dtSec, 4);
          }
        }
      }

      if (b && cam) {
        updateStadiumCamera(cam, mode, b.position.x, b.position.z, dtSec, cameraZoomRef.current);
      }
      scene.render();
    });

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      shadowGenRef.current = null;
      engine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      ballRef.current = null;
      playerEntriesRef.current.clear();
    };
  }, []);

  // Thirds toggle
  useEffect(() => {
    thirdsRef.current.forEach((m) => m.setEnabled(showThirds));
  }, [showThirds]);

  // Grid toggle
  useEffect(() => {
    gridRef.current.forEach((m) => m.setEnabled(showGrid8x5));
  }, [showGrid8x5]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />;
}

