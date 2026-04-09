import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

const RUNOFF = 4;
const STAND_ROWS = 4;
const ROW_H = 2.4;
const ROW_D = 3.0;

/**
 * Stadium shell: stepped stands on 4 sides, ad boards, floodlight towers
 * with glow, and tech area strips. Kept lightweight for mobile WebView.
 */
export function buildStadiumShell(scene: Scene): TransformNode {
  const root = new TransformNode('stadiumShell', scene);
  const L = FIELD_LENGTH;
  const W = FIELD_WIDTH;

  // -- Materials ----------------------------------------------------------

  const standMat = new StandardMaterial('stadiumStand', scene);
  standMat.diffuseColor = new Color3(0.14, 0.15, 0.20);
  standMat.specularColor = new Color3(0.03, 0.03, 0.03);

  const crowdMat = new StandardMaterial('stadiumCrowd', scene);
  crowdMat.diffuseColor = new Color3(0.25, 0.14, 0.12);
  crowdMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const boardMat = new StandardMaterial('stadiumBoard', scene);
  boardMat.diffuseColor = new Color3(0.55, 0.58, 0.62);
  boardMat.emissiveColor = new Color3(0.06, 0.07, 0.10);
  boardMat.specularColor = new Color3(0.10, 0.10, 0.10);
  boardMat.specularPower = 28;

  const techMat = new StandardMaterial('techArea', scene);
  techMat.diffuseColor = new Color3(0.08, 0.18, 0.10);
  techMat.specularColor = new Color3(0.04, 0.06, 0.04);
  techMat.specularPower = 10;
  techMat.alpha = 0.90;

  const surroundMat = new StandardMaterial('surroundMat', scene);
  surroundMat.diffuseColor = new Color3(0.12, 0.13, 0.11);
  surroundMat.specularColor = new Color3(0.03, 0.03, 0.03);

  // -- Ground surround (tarmac between pitch and stands) ------------------

  const standTotalDepth = RUNOFF + STAND_ROWS * ROW_D;
  const totalW = L + standTotalDepth * 2;
  const totalD = W + standTotalDepth * 2;
  const surround = MeshBuilder.CreateGround('surround', { width: totalW, height: totalD }, scene);
  surround.position.set(L / 2, -0.03, W / 2);
  surround.material = surroundMat;
  surround.receiveShadows = true;
  surround.parent = root;

  // -- Stepped stands (explicit per side) ---------------------------------

  // South side (z < 0): runs along X, steps go toward -Z
  for (let r = 0; r < STAND_ROWS; r++) {
    const slab = MeshBuilder.CreateBox(`stand_s_${r}`, {
      width: L + 8,
      height: ROW_H,
      depth: ROW_D,
    }, scene);
    slab.position.set(L / 2, r * ROW_H + ROW_H / 2, -(RUNOFF + r * ROW_D + ROW_D / 2));
    slab.material = r % 2 === 0 ? standMat : crowdMat;
    slab.parent = root;
  }

  // North side (z > W): runs along X, steps go toward +Z
  for (let r = 0; r < STAND_ROWS; r++) {
    const slab = MeshBuilder.CreateBox(`stand_n_${r}`, {
      width: L + 8,
      height: ROW_H,
      depth: ROW_D,
    }, scene);
    slab.position.set(L / 2, r * ROW_H + ROW_H / 2, W + RUNOFF + r * ROW_D + ROW_D / 2);
    slab.material = r % 2 === 0 ? standMat : crowdMat;
    slab.parent = root;
  }

  // West side (x < 0): runs along Z, steps go toward -X
  for (let r = 0; r < STAND_ROWS; r++) {
    const slab = MeshBuilder.CreateBox(`stand_w_${r}`, {
      width: ROW_D,
      height: ROW_H,
      depth: W + 8,
    }, scene);
    slab.position.set(-(RUNOFF + r * ROW_D + ROW_D / 2), r * ROW_H + ROW_H / 2, W / 2);
    slab.material = r % 2 === 0 ? standMat : crowdMat;
    slab.parent = root;
  }

  // East side (x > L): runs along Z, steps go toward +X
  for (let r = 0; r < STAND_ROWS; r++) {
    const slab = MeshBuilder.CreateBox(`stand_e_${r}`, {
      width: ROW_D,
      height: ROW_H,
      depth: W + 8,
    }, scene);
    slab.position.set(L + RUNOFF + r * ROW_D + ROW_D / 2, r * ROW_H + ROW_H / 2, W / 2);
    slab.material = r % 2 === 0 ? standMat : crowdMat;
    slab.parent = root;
  }

  // -- Advertising boards along sidelines ---------------------------------

  const boardH = 1.1;
  const boardT = 0.15;

  const bSouth = MeshBuilder.CreateBox('boardS', { width: L * 0.92, height: boardH, depth: boardT }, scene);
  bSouth.material = boardMat; bSouth.parent = root;
  bSouth.position.set(L / 2, boardH / 2, -(RUNOFF * 0.4));

  const bNorth = MeshBuilder.CreateBox('boardN', { width: L * 0.92, height: boardH, depth: boardT }, scene);
  bNorth.material = boardMat; bNorth.parent = root;
  bNorth.position.set(L / 2, boardH / 2, W + RUNOFF * 0.4);

  const bWest = MeshBuilder.CreateBox('boardW', { width: boardT, height: boardH, depth: W * 0.85 }, scene);
  bWest.material = boardMat; bWest.parent = root;
  bWest.position.set(-(RUNOFF * 0.4), boardH / 2, W / 2);

  const bEast = MeshBuilder.CreateBox('boardE', { width: boardT, height: boardH, depth: W * 0.85 }, scene);
  bEast.material = boardMat; bEast.parent = root;
  bEast.position.set(L + RUNOFF * 0.4, boardH / 2, W / 2);

  // -- Tech areas ---------------------------------------------------------

  const techAreaW = 3.0;
  const techAreaL = L * 0.85;

  const techS = MeshBuilder.CreateGround('techS', { width: techAreaL, height: techAreaW }, scene);
  techS.position.set(L / 2, 0.015, 2.0);
  techS.material = techMat; techS.parent = root;

  const techN = MeshBuilder.CreateGround('techN', { width: techAreaL, height: techAreaW }, scene);
  techN.position.set(L / 2, 0.015, W - 2.0);
  techN.material = techMat; techN.parent = root;

  // -- Floodlight towers --------------------------------------------------

  buildFloodlights(scene, root);

  // -- Glow layer for floodlight halos ------------------------------------

  const glow = new GlowLayer('glow', scene, { blurKernelSize: 32 });
  glow.intensity = 0.3;

  return root;
}

// -------------------------------------------------------------------------
// Floodlights — four corner towers
// -------------------------------------------------------------------------

function buildFloodlights(scene: Scene, parent: TransformNode) {
  const L = FIELD_LENGTH;
  const W = FIELD_WIDTH;
  const poleH = 28;
  const cornerOff = RUNOFF + STAND_ROWS * ROW_D + 2;

  const positions = [
    { x: -cornerOff, z: -cornerOff },
    { x: L + cornerOff, z: -cornerOff },
    { x: -cornerOff, z: W + cornerOff },
    { x: L + cornerOff, z: W + cornerOff },
  ];

  const poleMat = new StandardMaterial('poleMat', scene);
  poleMat.diffuseColor = new Color3(0.42, 0.42, 0.45);
  poleMat.specularColor = new Color3(0.06, 0.06, 0.06);

  const lampMat = new StandardMaterial('lampMat', scene);
  lampMat.diffuseColor = new Color3(1, 0.97, 0.90);
  lampMat.emissiveColor = new Color3(0.90, 0.85, 0.70);

  for (let i = 0; i < positions.length; i++) {
    const { x, z } = positions[i]!;

    const pole = MeshBuilder.CreateBox(`pole_${i}`, { width: 0.6, height: poleH, depth: 0.6 }, scene);
    pole.position.set(x, poleH / 2, z);
    pole.material = poleMat;
    pole.parent = parent;

    const lamp = MeshBuilder.CreateBox(`lamp_${i}`, { width: 2.2, height: 0.8, depth: 1.5 }, scene);
    lamp.position.set(x, poleH + 0.4, z);
    lamp.material = lampMat;
    lamp.parent = parent;

    const light = new PointLight(`flood_${i}`, lamp.position.clone(), scene);
    light.intensity = 0.12;
    light.diffuse = new Color3(1, 0.96, 0.88);
    light.range = 130;
  }
}
