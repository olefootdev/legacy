import {
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { MatchTruthSnapshot, TeamKit } from '@/bridge/matchTruthSchema';
import { computePackFocusNearBall } from '@/matchDirector/MatchDirector';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { CameraDirector } from './CameraDirector';
import {
  buildBothGoals,
  buildPitchLineMeshes,
  createGrassPitchMaterial,
  setupPitchLightingAndShadows,
} from './footballPitchBuild';
import type { MatchCameraMode } from './matchCameraTypes';
import {
  createPlayerRig,
  ensureJerseyLabel,
  updatePlayerKit,
  updatePlayerRig,
  type PlayerRig,
} from './playerFigure';
import { buildStadiumShell } from './stadiumShell';

/**
 * Camada 3 — Babylon: estádio, campo, jogadores, bola, luz, sombra, câmera.
 * A verdade da partida vem só do snapshot; não inventa posições.
 */
export class MatchBabylonRenderer {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  private director = new CameraDirector();
  private playerRigs = new Map<string, PlayerRig>();
  private ballMesh: Mesh;
  private ballMat: StandardMaterial;
  private prevTruth: MatchTruthSnapshot | null = null;
  private shadowGenerator: ShadowGenerator;
  private currentKits: { home?: TeamKit; away?: TeamKit } = {};

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.06, 0.10, 1);
    this.scene.ambientColor = new Color3(0.12, 0.13, 0.16);
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.00028;
    this.scene.fogColor = new Color3(0.06, 0.07, 0.12);

    const ground = MeshBuilder.CreateGround('pitch', { width: FIELD_LENGTH, height: FIELD_WIDTH }, this.scene);
    ground.position.x = FIELD_LENGTH / 2;
    ground.position.z = FIELD_WIDTH / 2;
    ground.material = createGrassPitchMaterial(this.scene);

    const { shadowGenerator } = setupPitchLightingAndShadows(this.scene, ground);
    this.shadowGenerator = shadowGenerator;

    buildStadiumShell(this.scene);

    for (const L of this.scene.lights) {
      if (L.name === 'hemiFill' && L instanceof HemisphericLight) {
        L.intensity = 0.72;
        L.groundColor = new Color3(0.27, 0.32, 0.24);
      }
    }

    buildPitchLineMeshes(this.scene);
    for (const m of buildBothGoals(this.scene)) {
      this.shadowGenerator.addShadowCaster(m, true);
    }

    this.camera = new FreeCamera('free', new Vector3(FIELD_LENGTH * 0.35, 88, -8), this.scene);
    this.camera.setTarget(new Vector3(FIELD_LENGTH * 0.5, 0, FIELD_WIDTH * 0.5));

    this.ballMesh = MeshBuilder.CreateSphere('ball', { diameter: 0.85, segments: 24 }, this.scene);
    this.ballMat = new StandardMaterial('bm', this.scene);
    this.ballMat.diffuseColor = new Color3(0.94, 0.94, 0.92);
    this.ballMat.emissiveColor = new Color3(0.06, 0.06, 0.04);
    this.ballMat.specularColor = new Color3(0.5, 0.5, 0.45);
    this.ballMat.specularPower = 64;

    const ballTex = new DynamicTexture('ballTex', { width: 256, height: 256 }, this.scene, false);
    const btx = ballTex.getContext() as CanvasRenderingContext2D;
    btx.fillStyle = '#f0f0ee';
    btx.fillRect(0, 0, 256, 256);
    btx.fillStyle = '#1a1a1a';
    const pentR = 26;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if ((row + col) % 2 === 0) {
          const cx = 26 + col * 52;
          const cy = 26 + row * 52;
          btx.beginPath();
          for (let s = 0; s < 5; s++) {
            const a = (s / 5) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * pentR;
            const py = cy + Math.sin(a) * pentR;
            s === 0 ? btx.moveTo(px, py) : btx.lineTo(px, py);
          }
          btx.closePath();
          btx.fill();
        }
      }
    }
    ballTex.update();
    this.ballMat.diffuseTexture = ballTex;

    this.ballMesh.material = this.ballMat;
    this.shadowGenerator.addShadowCaster(this.ballMesh, true);

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  setCameraMode(mode: MatchCameraMode) {
    this.director.setMode(mode);
  }

  getCameraMode(): MatchCameraMode {
    return this.director.getMode();
  }

  setCameraUserZoom(z01: number) {
    this.director.setUserZoom(z01);
  }

  getCameraUserZoom(): number {
    return this.director.getUserZoom();
  }

  syncFromTruth(truth: MatchTruthSnapshot, dt: number, alpha = 0.35) {
    const cues = truth.cameraCues;
    if (cues) {
      for (const c of cues) this.director.applyCue(c);
    }

    if (truth.kits) {
      this.currentKits.home = truth.kits.home;
      this.currentKits.away = truth.kits.away;
    }

    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const prev = this.prevTruth;

    let bx = truth.ball.x;
    let bz = truth.ball.z;
    if (prev) {
      bx = lerp(prev.ball.x, truth.ball.x);
      bz = lerp(prev.ball.z, truth.ball.z);
    }

    this.ballMesh.position.set(bx, truth.ball.y, bz);
    const bvx = truth.ball.vx ?? 0;
    const bvz = truth.ball.vz ?? 0;
    const bspeed = Math.sqrt(bvx * bvx + bvz * bvz);
    const pulse = Math.min(0.12, bspeed * 0.009);
    this.ballMat.emissiveColor = new Color3(0.04 + pulse, 0.04 + pulse, 0.015 + pulse * 0.5);

    const pack = computePackFocusNearBall(truth, 19);
    const packBlend = pack.weight > 0 ? 0.16 + pack.weight * 0.26 : 0;

    const seen = new Set<string>();
    for (const p of truth.players) {
      seen.add(p.id);
      const kit = p.side === 'home' ? this.currentKits.home : this.currentKits.away;
      let rig = this.playerRigs.get(p.id);
      if (!rig) {
        rig = createPlayerRig(this.scene, p.id, p.side, this.shadowGenerator, kit, p.shirtNumber);
        this.playerRigs.set(p.id, rig);
      } else {
        if (kit) updatePlayerKit(rig, kit);
        if (p.shirtNumber && !rig.labelMesh) {
          ensureJerseyLabel(rig, this.scene, p.shirtNumber, kit?.primaryColor ?? '#E6DC23');
        }
      }

      let px = p.x;
      let pz = p.z;
      if (prev) {
        const op = prev.players.find((x) => x.id === p.id);
        if (op) {
          px = lerp(op.x, p.x);
          pz = lerp(op.z, p.z);
        }
      }
      updatePlayerRig(rig, px, pz, dt, {
        headingTruth: p.heading,
        speedTruth: p.speed,
      });
    }

    for (const [id, rig] of this.playerRigs) {
      if (!seen.has(id)) {
        rig.root.dispose();
        this.playerRigs.delete(id);
      }
    }

    this.prevTruth = truth;

    this.director.update(this.camera, bx, bz, dt, {
      packX: pack.x,
      packZ: pack.z,
      packBlend,
    });
  }

  resize() {
    this.engine.resize();
  }

  dispose() {
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
