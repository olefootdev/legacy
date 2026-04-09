import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from '../simulation/field';

const WHITE = Color3.FromHexString('#ffffff');

function lineMesh(scene: Scene, name: string, points: Vector3[], color: Color3): Mesh {
  const m = MeshBuilder.CreateLines(name, { points }, scene);
  m.color = color;
  return m;
}

function grassNoise(nx: number, ny: number): number {
  const v = Math.sin(nx * 127.1 + ny * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

/**
 * Pitch grass with visible mower stripes (34 rows ≈ 3.1 m each on 105 m),
 * multi-octave noise for fiber variation, subtle radial vignette for TV depth,
 * and a bump map for surface relief under directional light.
 */
export function createGrassPitchMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('grassPitch', scene);
  const size = 1024;
  const tex = new DynamicTexture('grassDiff', { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rows = 34;

  for (let y = 0; y < size; y++) {
    const ny = y / size;
    const stripe = Math.floor(ny * rows);
    const stripePos = (ny * rows) - stripe;
    const stripeFade = 0.5 + 0.5 * Math.sin(stripePos * Math.PI);
    const stripeMix = stripe % 2 === 0
      ? 0.90 + stripeFade * 0.04
      : 1.06 + stripeFade * 0.04;

    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const n1 = grassNoise(nx * 10, ny * 10);
      const n2 = grassNoise(nx * 28 + 1.3, ny * 28 + 0.7);
      const n3 = grassNoise(nx * 56, ny * 56);
      const blend = n1 * 0.40 + n2 * 0.35 + n3 * 0.25;

      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radial = 1.0 + (1.0 - Math.min(1.0, dist * 1.25)) * 0.08;

      let g = (0.22 + blend * 0.12) * stripeMix * radial;
      g = Math.min(0.95, Math.max(0.10, g));
      const r = Math.min(1, g * 0.48 + blend * 0.035);
      const gb = Math.min(1, g * 1.24);
      const b = Math.min(1, g * 0.28 + blend * 0.02);

      const i = (y * size + x) * 4;
      d[i]     = Math.floor(r * 255);
      d[i + 1] = Math.floor(gb * 255);
      d[i + 2] = Math.floor(b * 255);
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.07;
  for (let k = 0; k < 12000; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#e8f0e0' : '#0e2410';
    ctx.fillRect(px, py, 1.2, 0.9);
  }
  ctx.globalAlpha = 1;
  tex.update();

  const bSize = 512;
  const bump = new DynamicTexture('grassBump', { width: bSize, height: bSize }, scene, false);
  const bctx = bump.getContext() as CanvasRenderingContext2D;
  const bimg = bctx.createImageData(bSize, bSize);
  const bd = bimg.data;
  for (let y = 0; y < bSize; y++) {
    for (let x = 0; x < bSize; x++) {
      const nx = x / bSize;
      const ny = y / bSize;
      const v =
        grassNoise(nx * 36, ny * 36) * 0.45 +
        grassNoise(nx * 72 + 2, ny * 72) * 0.35 +
        grassNoise(nx * 128, ny * 128) * 0.20;
      const lit = Math.floor(v * 255);
      const j = (y * bSize + x) * 4;
      bd[j]     = lit;
      bd[j + 1] = lit;
      bd[j + 2] = lit;
      bd[j + 3] = 255;
    }
  }
  bctx.putImageData(bimg, 0, 0);
  bump.update();

  mat.diffuseTexture = tex;
  mat.bumpTexture = bump;
  mat.specularColor = new Color3(0.10, 0.16, 0.08);
  mat.specularPower = 28;
  const tile = 11;
  tex.uScale = FIELD_LENGTH / tile;
  tex.vScale = FIELD_WIDTH / tile;
  bump.uScale = FIELD_LENGTH / tile;
  bump.vScale = FIELD_WIDTH / tile;
  return mat;
}

/** Marcações FIFA (linhas). */
export function buildPitchLineMeshes(scene: Scene): Mesh[] {
  const y = 0.02;
  const L = FIELD_LENGTH;
  const Wd = FIELD_WIDTH;
  const mid = L / 2;
  const penDepth = 16.5;
  const penW = 40.32;
  const goalDepth = 5.5;
  const goalW = 18.32;
  const circR = 9.15;
  const meshes: Mesh[] = [];

  const border = [
    new Vector3(0, y, 0),
    new Vector3(L, y, 0),
    new Vector3(L, y, Wd),
    new Vector3(0, y, Wd),
    new Vector3(0, y, 0),
  ];
  meshes.push(lineMesh(scene, 'touch', border, WHITE));
  meshes.push(lineMesh(scene, 'half', [new Vector3(mid, y, 0), new Vector3(mid, y, Wd)], WHITE));

  const cx = mid;
  const cz = Wd / 2;
  const segs = 64;
  const circPts: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    circPts.push(new Vector3(cx + Math.cos(a) * circR, y, cz + Math.sin(a) * circR));
  }
  meshes.push(lineMesh(scene, 'circle', circPts, WHITE));
  meshes.push(
    lineMesh(scene, 'spot', [new Vector3(cx, y, cz - 0.15), new Vector3(cx, y, cz + 0.15)], WHITE),
  );

  function penaltyBox(left: boolean) {
    const x0 = left ? 0 : L - penDepth;
    const x1 = left ? penDepth : L;
    const z0 = (Wd - penW) / 2;
    const z1 = z0 + penW;
    return [
      new Vector3(x0, y, z0),
      new Vector3(x1, y, z0),
      new Vector3(x1, y, z1),
      new Vector3(x0, y, z1),
      new Vector3(x0, y, z0),
    ];
  }
  meshes.push(lineMesh(scene, 'penL', penaltyBox(true), WHITE));
  meshes.push(lineMesh(scene, 'penR', penaltyBox(false), WHITE));

  function goalArea(left: boolean) {
    const x0 = left ? 0 : L - goalDepth;
    const x1 = left ? goalDepth : L;
    const z0 = (Wd - goalW) / 2;
    const z1 = z0 + goalW;
    return [
      new Vector3(x0, y, z0),
      new Vector3(x1, y, z0),
      new Vector3(x1, y, z1),
      new Vector3(x0, y, z1),
      new Vector3(x0, y, z0),
    ];
  }
  meshes.push(lineMesh(scene, 'gaL', goalArea(true), WHITE));
  meshes.push(lineMesh(scene, 'gaR', goalArea(false), WHITE));

  return meshes;
}

export function buildThirdsMeshes(scene: Scene): Mesh[] {
  const y = 0.025;
  const col = Color3.FromHexString('#E4FF00');
  const x1 = FIELD_LENGTH / 3;
  const x2 = (FIELD_LENGTH * 2) / 3;
  return [
    lineMesh(scene, 't1', [new Vector3(x1, y, 0), new Vector3(x1, y, FIELD_WIDTH)], col),
    lineMesh(scene, 't2', [new Vector3(x2, y, 0), new Vector3(x2, y, FIELD_WIDTH)], col),
  ];
}

export function buildGridMeshes(scene: Scene): Mesh[] {
  const y = 0.024;
  const col = Color3.FromHexString('#88aacc');
  const meshes: Mesh[] = [];
  for (let i = 1; i < 8; i++) {
    const x = (i / 8) * FIELD_LENGTH;
    meshes.push(
      lineMesh(scene, `gx${i}`, [new Vector3(x, y, 0), new Vector3(x, y, FIELD_WIDTH)], col),
    );
  }
  for (let j = 1; j < 5; j++) {
    const z = (j / 5) * FIELD_WIDTH;
    meshes.push(
      lineMesh(scene, `gz${j}`, [new Vector3(0, y, z), new Vector3(FIELD_LENGTH, y, z)], col),
    );
  }
  return meshes;
}

export function buildGoalMeshes(scene: Scene, atLeft: boolean): Mesh[] {
  const postH = 2.44;
  const postW = 7.32;
  const zc = FIELD_WIDTH / 2;
  const x = atLeft ? 0 : FIELD_LENGTH;
  const z0 = zc - postW / 2;
  const z1 = zc + postW / 2;
  const mat = new StandardMaterial(`gf_${atLeft}`, scene);
  mat.diffuseColor = Color3.FromHexString('#f5f5f5');
  mat.emissiveColor = new Color3(0.12, 0.12, 0.12);
  mat.specularColor = new Color3(0.2, 0.2, 0.22);
  const out: Mesh[] = [];

  const p1 = MeshBuilder.CreateBox('post', { width: 0.12, height: postH, depth: 0.12 }, scene);
  p1.position.set(x + (atLeft ? -0.06 : 0.06), postH / 2, z0);
  p1.material = mat;
  out.push(p1);

  const p2 = p1.clone('post2');
  p2.position.z = z1;
  out.push(p2);

  const cross = MeshBuilder.CreateBox('cross', { width: 0.1, height: 0.1, depth: postW + 0.12 }, scene);
  cross.position.set(x + (atLeft ? -0.06 : 0.06), postH, zc);
  cross.material = mat;
  out.push(cross);

  const net = MeshBuilder.CreateBox('net', { width: 1.8, height: postH * 0.9, depth: postW * 0.98 }, scene);
  net.position.set(x + (atLeft ? -0.9 : 0.9), postH * 0.45, zc);
  const nm = new StandardMaterial('netm', scene);
  nm.diffuseColor = new Color3(0.9, 0.9, 0.95);
  nm.alpha = 0.35;
  nm.backFaceCulling = false;
  net.material = nm;
  out.push(net);

  return out;
}

export function buildBothGoals(scene: Scene): Mesh[] {
  return [...buildGoalMeshes(scene, true), ...buildGoalMeshes(scene, false)];
}

export type PitchLightingSetup = {
  hemi: HemisphericLight;
  sun: DirectionalLight;
  shadowGenerator: ShadowGenerator;
};

/** Hemi + sol direcional + sombras no solo (mapa 2K, blur exponencial). */
export function setupPitchLightingAndShadows(scene: Scene, ground: Mesh): PitchLightingSetup {
  const hemi = new HemisphericLight('hemiFill', new Vector3(0.25, 1, 0.18), scene);
  hemi.intensity = 0.58;
  hemi.groundColor = new Color3(0.22, 0.28, 0.2);

  const sun = new DirectionalLight('sunDir', new Vector3(-0.42, -1, -0.32), scene);
  sun.position = new Vector3(FIELD_LENGTH * 0.52 + 62, 135, FIELD_WIDTH * 0.48 + 48);
  sun.intensity = 0.92;

  ground.receiveShadows = true;

  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.blurScale = 2;
  shadowGenerator.darkness = 0.38;
  shadowGenerator.bias = 0.0008;

  return { hemi, sun, shadowGenerator };
}
