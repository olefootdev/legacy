import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  type ShadowGenerator,
} from '@babylonjs/core';

/**
 * Height reference: a real player ≈ 1.80 m.
 * The compound mesh is composed of:
 *   - Torso (capsule / cylinder with rounded top) — shirt color
 *   - Shorts (short cylinder below torso) — secondary color
 *   - Head (sphere with skin tone)
 *   - Socks / legs (thin cylinders)
 *   - Optional shirt number label (dynamic texture)
 *
 * All parts are parented to a root TransformNode so rotation/position
 * only need to be applied to the root.
 */

const PLAYER_H = 1.80;
const TORSO_H = 0.62;
const TORSO_R = 0.30;
const SHORTS_H = 0.22;
const SHORTS_R = 0.28;
const HEAD_R = 0.16;
const LEG_H = 0.55;
const LEG_R = 0.08;
const SHOULDER_W = 0.12;

const SKIN_TONES = ['#C68642', '#8D5524', '#E0AC69', '#F1C27D', '#FFDBAC', '#6B4226'];

export interface TeamColors {
  primary: string;   // shirt
  secondary: string; // shorts / accent
}

interface PlayerFigureResult {
  root: Mesh;
  setTeamColors: (colors: TeamColors) => void;
  setShirtNumber: (n: number) => void;
}

const materialCache = new Map<string, StandardMaterial>();

function getCachedMat(scene: Scene, key: string, color: Color3): StandardMaterial {
  const existing = materialCache.get(key);
  if (existing) return existing;
  const mat = new StandardMaterial(key, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.specularPower = 16;
  materialCache.set(key, mat);
  return mat;
}

/**
 * Create a humanoid player figure.
 * Returns the root mesh + helpers to update team colors and shirt number.
 */
export function createPlayerFigure(
  scene: Scene,
  id: string,
  teamColors: TeamColors,
  shadowGen: ShadowGenerator | null,
): PlayerFigureResult {
  // Root empty mesh as parent
  const root = new Mesh(`player_${id}`, scene);

  // Skin tone (deterministic per id)
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const skinHex = SKIN_TONES[Math.abs(hash) % SKIN_TONES.length]!;
  const skinMat = getCachedMat(scene, `skin_${skinHex}`, Color3.FromHexString(skinHex));

  // -- Legs (two thin cylinders)
  const legL = MeshBuilder.CreateCylinder(`${id}_legL`, { diameter: LEG_R * 2, height: LEG_H, tessellation: 8 }, scene);
  legL.position.set(-0.09, LEG_H / 2, 0);
  legL.parent = root;
  legL.material = getCachedMat(scene, 'sock_dark', new Color3(0.12, 0.12, 0.14));

  const legR = legL.clone(`${id}_legR`);
  legR.position.set(0.09, LEG_H / 2, 0);
  legR.parent = root;

  // -- Shorts
  const shortsMat = new StandardMaterial(`shorts_${id}`, scene);
  shortsMat.diffuseColor = Color3.FromHexString(teamColors.secondary);
  shortsMat.specularColor = new Color3(0.06, 0.06, 0.06);

  const shorts = MeshBuilder.CreateCylinder(`${id}_shorts`, {
    diameter: SHORTS_R * 2,
    height: SHORTS_H,
    tessellation: 10,
  }, scene);
  shorts.position.y = LEG_H + SHORTS_H / 2;
  shorts.parent = root;
  shorts.material = shortsMat;

  // -- Torso (shirt)
  const shirtMat = new StandardMaterial(`shirt_${id}`, scene);
  shirtMat.diffuseColor = Color3.FromHexString(teamColors.primary);
  shirtMat.specularColor = new Color3(0.1, 0.1, 0.1);
  shirtMat.specularPower = 20;

  const torso = MeshBuilder.CreateCylinder(`${id}_torso`, {
    diameterTop: TORSO_R * 1.6,
    diameterBottom: TORSO_R * 2,
    height: TORSO_H,
    tessellation: 10,
  }, scene);
  torso.position.y = LEG_H + SHORTS_H + TORSO_H / 2;
  torso.parent = root;
  torso.material = shirtMat;

  // -- Shoulders (small horizontal box)
  const shoulder = MeshBuilder.CreateBox(`${id}_shld`, {
    width: TORSO_R * 2 + SHOULDER_W * 2,
    height: 0.08,
    depth: TORSO_R * 1.4,
  }, scene);
  shoulder.position.y = LEG_H + SHORTS_H + TORSO_H - 0.02;
  shoulder.parent = root;
  shoulder.material = shirtMat;

  // -- Head
  const head = MeshBuilder.CreateSphere(`${id}_head`, { diameter: HEAD_R * 2, segments: 10 }, scene);
  head.position.y = LEG_H + SHORTS_H + TORSO_H + HEAD_R * 0.85;
  head.parent = root;
  head.material = skinMat;

  // Shadow casting
  if (shadowGen) {
    shadowGen.addShadowCaster(root, true);
  }

  // -- Shirt number label (back of torso — dynamic texture on a small plane)
  let numberPlane: Mesh | null = null;
  let numberTex: DynamicTexture | null = null;

  function setShirtNumber(n: number) {
    if (!numberPlane) {
      numberPlane = MeshBuilder.CreatePlane(`${id}_num`, { width: 0.22, height: 0.18 }, scene);
      numberPlane.position.set(0, LEG_H + SHORTS_H + TORSO_H * 0.55, -TORSO_R - 0.01);
      numberPlane.parent = root;
      numberTex = new DynamicTexture(`${id}_numTex`, { width: 64, height: 64 }, scene, false);
      const numMat = new StandardMaterial(`${id}_numMat`, scene);
      numMat.diffuseTexture = numberTex;
      numMat.emissiveColor = new Color3(0.8, 0.8, 0.8);
      numMat.backFaceCulling = false;
      numberPlane.material = numMat;
    }
    if (numberTex) {
      const c = numberTex.getContext() as CanvasRenderingContext2D;
      c.clearRect(0, 0, 64, 64);
      c.fillStyle = '#ffffff';
      c.font = 'bold 38px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(n), 32, 34);
      numberTex.update();
    }
  }

  function setTeamColors(colors: TeamColors) {
    shirtMat.diffuseColor = Color3.FromHexString(colors.primary);
    shortsMat.diffuseColor = Color3.FromHexString(colors.secondary);
  }

  return { root, setTeamColors, setShirtNumber };
}
