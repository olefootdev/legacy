import { Color3, DynamicTexture, Scene, StandardMaterial } from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from './formation433';

function grassNoise(nx: number, ny: number): number {
  const v = Math.sin(nx * 127.1 + ny * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

/**
 * Pitch grass with visible mower stripes (34 rows ≈ 3.1 m each on 105 m),
 * multi-octave noise for fiber variation, subtle radial vignette for TV depth,
 * and a separate bump map for surface relief under directional light.
 *
 * Stripe scale: 105 m / 34 rows ≈ 3.09 m per stripe — close to the 3 m
 * passes common on professional pitches.
 */
export function createOlefootDemoGrassMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('olefootDemoGrass', scene);
  const size = 1024;
  const tex = new DynamicTexture('olefootGrassDiff', { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rows = 34;

  for (let y = 0; y < size; y++) {
    const ny = y / size;
    const stripe = Math.floor(ny * rows);
    const stripePos = (ny * rows) - stripe;
    // Smooth stripe transition with sine falloff at edges
    const stripeFade = 0.5 + 0.5 * Math.sin(stripePos * Math.PI);
    const stripeMix = stripe % 2 === 0
      ? 0.92 + stripeFade * 0.04
      : 1.04 + stripeFade * 0.04;

    for (let x = 0; x < size; x++) {
      const nx = x / size;

      // Multi-octave noise for fiber variation
      const n1 = grassNoise(nx * 10, ny * 10);
      const n2 = grassNoise(nx * 28 + 1.3, ny * 28 + 0.7);
      const n3 = grassNoise(nx * 56, ny * 56);
      const blend = n1 * 0.40 + n2 * 0.35 + n3 * 0.25;

      // Subtle radial vignette for TV depth
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radial = 1.0 + (1.0 - Math.min(1.0, dist * 1.25)) * 0.08;

      // Rich green base — lush but not neon
      let g = (0.20 + blend * 0.12) * stripeMix * radial;
      g = Math.min(0.95, Math.max(0.10, g));
      const r = Math.min(1, g * 0.52 + blend * 0.04);
      const gb = Math.min(1, g * 1.22);
      const b = Math.min(1, g * 0.32 + blend * 0.025);

      const i = (y * size + x) * 4;
      d[i]     = Math.floor(r * 255);
      d[i + 1] = Math.floor(gb * 255);
      d[i + 2] = Math.floor(b * 255);
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  // Fiber-level noise dots
  ctx.globalAlpha = 0.07;
  for (let k = 0; k < 12000; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#e8f0e0' : '#0e2410';
    ctx.fillRect(px, py, 1.2, 0.9);
  }
  ctx.globalAlpha = 1;
  tex.update();

  // Bump map for surface relief
  const bSize = 512;
  const bump = new DynamicTexture('olefootGrassBump', { width: bSize, height: bSize }, scene, false);
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

  // Tile the texture across the real field dimensions
  const tile = 11; // ~11 m per texture repeat
  tex.uScale = FIELD_LENGTH / tile;
  tex.vScale = FIELD_WIDTH / tile;
  bump.uScale = FIELD_LENGTH / tile;
  bump.vScale = FIELD_WIDTH / tile;

  return mat;
}
