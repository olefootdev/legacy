import {
  Color3,
  Color4,
  GlowLayer,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from './formation433';

const FIELD_CX = FIELD_LENGTH / 2;
const FIELD_CZ = FIELD_WIDTH / 2;

const RUNOFF = 6;     // meters beyond touchline
const STAND_H = 12;   // max height of stands
const STAND_DEPTH = 18;
const STAND_ROWS = 6;

/**
 * Build the full stadium environment around the pitch.
 * - Stepped stands on all four sides
 * - Advertising boards along sidelines
 * - Four floodlight towers with glow
 * - Sky / ambient setup
 *
 * All meshes are returned for optional disposal.
 */
export function buildStadiumEnvironment(scene: Scene): Mesh[] {
  const out: Mesh[] = [];

  // -- Ground surround (tarmac/gravel area between pitch and stands)
  const surroundMat = new StandardMaterial('surroundMat', scene);
  surroundMat.diffuseColor = new Color3(0.18, 0.20, 0.17);
  surroundMat.specularPower = 8;
  surroundMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const totalW = FIELD_LENGTH + RUNOFF * 2 + STAND_DEPTH * 2;
  const totalD = FIELD_WIDTH + RUNOFF * 2 + STAND_DEPTH * 2;
  const surround = MeshBuilder.CreateGround('surround', { width: totalW, height: totalD }, scene);
  surround.position.set(FIELD_CX, -0.02, FIELD_CZ);
  surround.material = surroundMat;
  surround.receiveShadows = true;
  out.push(surround);

  // -- Stands (stepped boxes)
  const standMat = new StandardMaterial('standMat', scene);
  standMat.diffuseColor = new Color3(0.30, 0.32, 0.36);
  standMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const crowdMat = new StandardMaterial('crowdMat', scene);
  crowdMat.diffuseColor = new Color3(0.38, 0.22, 0.22);
  crowdMat.specularColor = new Color3(0.02, 0.02, 0.02);

  out.push(...buildSideStand(scene, standMat, crowdMat, 'north', FIELD_CX, -RUNOFF, FIELD_LENGTH + RUNOFF * 0.5, true));
  out.push(...buildSideStand(scene, standMat, crowdMat, 'south', FIELD_CX, FIELD_WIDTH + RUNOFF, FIELD_LENGTH + RUNOFF * 0.5, true));
  out.push(...buildSideStand(scene, standMat, crowdMat, 'west', -RUNOFF, FIELD_CZ, FIELD_WIDTH + RUNOFF * 0.5, false));
  out.push(...buildSideStand(scene, standMat, crowdMat, 'east', FIELD_LENGTH + RUNOFF, FIELD_CZ, FIELD_WIDTH + RUNOFF * 0.5, false));

  // -- Advertising boards (along both sidelines)
  const adMat = new StandardMaterial('adMat', scene);
  adMat.diffuseColor = new Color3(0.85, 0.85, 0.88);
  adMat.emissiveColor = new Color3(0.12, 0.12, 0.12);
  adMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const boardH = 0.9;
  const boardY = boardH / 2;
  const boardSegLen = FIELD_LENGTH * 0.92;

  // North side (z < 0)
  const adN = MeshBuilder.CreateBox('adN', { width: boardSegLen, height: boardH, depth: 0.15 }, scene);
  adN.position.set(FIELD_CX, boardY, -RUNOFF * 0.45);
  adN.material = adMat;
  out.push(adN);

  // South side
  const adS = MeshBuilder.CreateBox('adS', { width: boardSegLen, height: boardH, depth: 0.15 }, scene);
  adS.position.set(FIELD_CX, boardY, FIELD_WIDTH + RUNOFF * 0.45);
  adS.material = adMat;
  out.push(adS);

  // -- Floodlight towers
  out.push(...buildFloodlights(scene));

  // -- Sky color
  scene.clearColor = new Color4(0.06, 0.07, 0.12, 1);
  scene.ambientColor = new Color3(0.12, 0.13, 0.15);

  // -- Glow layer for light halos (lightweight)
  const glow = new GlowLayer('glow', scene, { blurKernelSize: 32 });
  glow.intensity = 0.4;

  return out;
}

// ---------------------------------------------------------------------------
// Stands
// ---------------------------------------------------------------------------

function buildSideStand(
  scene: Scene,
  structMat: StandardMaterial,
  crowdMat: StandardMaterial,
  name: string,
  cx: number,
  edgePos: number,
  length: number,
  isLongSide: boolean,
): Mesh[] {
  const out: Mesh[] = [];
  const rowH = STAND_H / STAND_ROWS;
  const rowD = STAND_DEPTH / STAND_ROWS;

  for (let r = 0; r < STAND_ROWS; r++) {
    const h = rowH * (r + 1);
    const depth = rowD;
    const yBase = r * rowH;

    const step = MeshBuilder.CreateBox(`stand_${name}_${r}`, {
      width: isLongSide ? length : depth,
      height: h,
      depth: isLongSide ? depth : length,
    }, scene);

    let px: number, pz: number;
    if (isLongSide) {
      const sign = edgePos < FIELD_CZ ? -1 : 1;
      px = cx;
      pz = edgePos + sign * (rowD * r + rowD / 2);
    } else {
      const sign = edgePos < FIELD_CX ? -1 : 1;
      px = edgePos + sign * (rowD * r + rowD / 2);
      pz = cx;
    }

    step.position.set(px, yBase + h / 2, pz);
    step.material = r % 2 === 0 ? structMat : crowdMat;
    out.push(step);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Floodlights
// ---------------------------------------------------------------------------

function buildFloodlights(scene: Scene): Mesh[] {
  const out: Mesh[] = [];
  const poleH = 32;
  const positions = [
    { x: -RUNOFF - STAND_DEPTH + 2,                 z: -RUNOFF - STAND_DEPTH + 2 },
    { x: FIELD_LENGTH + RUNOFF + STAND_DEPTH - 2,   z: -RUNOFF - STAND_DEPTH + 2 },
    { x: -RUNOFF - STAND_DEPTH + 2,                 z: FIELD_WIDTH + RUNOFF + STAND_DEPTH - 2 },
    { x: FIELD_LENGTH + RUNOFF + STAND_DEPTH - 2,   z: FIELD_WIDTH + RUNOFF + STAND_DEPTH - 2 },
  ];

  const poleMat = new StandardMaterial('poleMat', scene);
  poleMat.diffuseColor = new Color3(0.5, 0.5, 0.52);
  poleMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const lampMat = new StandardMaterial('lampMat', scene);
  lampMat.diffuseColor = new Color3(1, 0.98, 0.92);
  lampMat.emissiveColor = new Color3(1, 0.96, 0.85);

  for (let i = 0; i < positions.length; i++) {
    const { x, z } = positions[i]!;

    const pole = MeshBuilder.CreateBox(`pole_${i}`, { width: 0.8, height: poleH, depth: 0.8 }, scene);
    pole.position.set(x, poleH / 2, z);
    pole.material = poleMat;
    out.push(pole);

    const lamp = MeshBuilder.CreateBox(`lamp_${i}`, { width: 3, height: 1.2, depth: 2 }, scene);
    lamp.position.set(x, poleH + 0.6, z);
    lamp.material = lampMat;
    out.push(lamp);

    const light = new PointLight(`flood_${i}`, new Vector3(x, poleH + 1, z), scene);
    light.intensity = 0.18;
    light.diffuse = new Color3(1, 0.97, 0.90);
    light.range = 160;
  }

  return out;
}
