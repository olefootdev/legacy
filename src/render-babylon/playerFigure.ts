import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { TeamKit } from '@/bridge/matchTruthSchema';

export interface PlayerRig {
  root: TransformNode;
  prevX: number;
  prevZ: number;
  bobPhase: number;
  firstFrame: boolean;
  side: 'home' | 'away';
  shirtMat: StandardMaterial;
  shortsMat: StandardMaterial;
  accentMat: StandardMaterial;
  /** Jersey number label (billboard plane). */
  labelMesh?: Mesh;
  /** Currently applied kit signature to skip redundant updates. */
  kitSig: string;
}

const DEFAULT_KITS: Record<'home' | 'away', TeamKit> = {
  home: { primaryColor: '#E6DC23', secondaryColor: '#235E23', accent: '#F2F2F2' },
  away: { primaryColor: '#3358C7', secondaryColor: '#6B707A', accent: '#F24038' },
};

function resolveKit(side: 'home' | 'away', kit?: TeamKit): TeamKit {
  return kit ?? DEFAULT_KITS[side];
}

function kitSignature(k: TeamKit): string {
  return `${k.primaryColor}|${k.secondaryColor}|${k.accent ?? ''}`;
}

function applyKitToMaterials(rig: PlayerRig, kit: TeamKit) {
  const sig = kitSignature(kit);
  if (rig.kitSig === sig) return;
  rig.kitSig = sig;
  rig.shirtMat.diffuseColor = Color3.FromHexString(kit.primaryColor);
  rig.shortsMat.diffuseColor = Color3.FromHexString(kit.secondaryColor);
  rig.accentMat.diffuseColor = Color3.FromHexString(kit.accent ?? kit.primaryColor);
}

function createNumberLabel(
  scene: Scene,
  id: string,
  num: number,
  parent: TransformNode,
  kitPrimary: string,
): Mesh {
  const size = 64;
  const tex = new DynamicTexture(`lbl_${id}`, { width: size, height: size }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(num), size / 2, size / 2 + 1);
  tex.update();

  const plane = MeshBuilder.CreatePlane(`lp_${id}`, { size: 1.1 }, scene);
  plane.parent = parent;
  plane.position.y = 2.3;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  const mat = new StandardMaterial(`lpm_${id}`, scene);
  mat.diffuseTexture = tex;
  mat.opacityTexture = tex;
  mat.emissiveColor = new Color3(0.85, 0.85, 0.85);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  plane.material = mat;
  return plane;
}

export function createPlayerRig(
  scene: Scene,
  id: string,
  side: 'home' | 'away',
  shadowGenerator: ShadowGenerator,
  kit?: TeamKit,
  shirtNumber?: number,
): PlayerRig {
  const root = new TransformNode(`pr_${id}`, scene);
  const k = resolveKit(side, kit);
  const skin = new Color3(0.78, 0.58, 0.44);

  const shortsMat = new StandardMaterial(`psm_${id}`, scene);
  shortsMat.diffuseColor = Color3.FromHexString(k.secondaryColor);
  shortsMat.specularColor = new Color3(0.1, 0.1, 0.1);
  shortsMat.specularPower = 14;

  // Legs (thin cylinders for visual grounding)
  const legMat = new StandardMaterial(`plm_${id}`, scene);
  legMat.diffuseColor = new Color3(0.12, 0.12, 0.14);
  legMat.specularColor = new Color3(0.04, 0.04, 0.04);

  const legL = MeshBuilder.CreateCylinder(`pl_${id}_l`, { diameter: 0.16, height: 0.52, tessellation: 8 }, scene);
  legL.parent = root;
  legL.position.set(-0.10, 0.26, 0);
  legL.material = legMat;

  const legR = MeshBuilder.CreateCylinder(`pl_${id}_r`, { diameter: 0.16, height: 0.52, tessellation: 8 }, scene);
  legR.parent = root;
  legR.position.set(0.10, 0.26, 0);
  legR.material = legMat;

  const shorts = MeshBuilder.CreateCylinder(`ps_${id}`, { diameter: 0.68, height: 0.32, tessellation: 12 }, scene);
  shorts.parent = root;
  shorts.position.y = 0.58;
  shorts.material = shortsMat;

  const shirtMat = new StandardMaterial(`ptm_${id}`, scene);
  shirtMat.diffuseColor = Color3.FromHexString(k.primaryColor);
  shirtMat.specularColor = new Color3(0.18, 0.16, 0.08);
  shirtMat.specularPower = 28;

  const torso = MeshBuilder.CreateCylinder(`pt_${id}`, {
    diameterTop: 0.42,
    diameterBottom: 0.56,
    height: 0.72,
    tessellation: 12,
  }, scene);
  torso.parent = root;
  torso.position.y = 1.02;
  torso.material = shirtMat;

  // Shoulders (horizontal bar on top of torso)
  const shoulderMat = shirtMat;
  const shoulder = MeshBuilder.CreateBox(`pshld_${id}`, {
    width: 0.72,
    height: 0.08,
    depth: 0.32,
  }, scene);
  shoulder.parent = root;
  shoulder.position.y = 1.36;
  shoulder.material = shoulderMat;

  const accentMat = new StandardMaterial(`pstm_${id}`, scene);
  accentMat.diffuseColor = Color3.FromHexString(k.accent ?? k.primaryColor);
  accentMat.specularColor = new Color3(0.22, 0.22, 0.22);
  accentMat.specularPower = 20;

  const stripe = MeshBuilder.CreateBox(`pst_${id}`, { width: 0.12, height: 0.54, depth: 0.44 }, scene);
  stripe.parent = root;
  stripe.position.y = 1.02;
  stripe.material = accentMat;

  const head = MeshBuilder.CreateSphere(`ph_${id}`, { diameter: 0.38, segments: 12 }, scene);
  head.parent = root;
  head.position.y = 1.58;
  const hm = new StandardMaterial(`phm_${id}`, scene);
  hm.diffuseColor = skin;
  hm.specularColor = new Color3(0.12, 0.08, 0.08);
  hm.specularPower = 26;
  head.material = hm;

  for (const m of [legL, legR, shorts, torso, shoulder, stripe, head]) {
    shadowGenerator.addShadowCaster(m, false);
  }

  let labelMesh: Mesh | undefined;
  if (shirtNumber !== undefined && shirtNumber > 0) {
    labelMesh = createNumberLabel(scene, id, shirtNumber, root, k.primaryColor);
  }

  return {
    root,
    prevX: 0,
    prevZ: 0,
    bobPhase: Math.random() * Math.PI * 2,
    firstFrame: true,
    side,
    shirtMat,
    shortsMat,
    accentMat,
    labelMesh,
    kitSig: kitSignature(k),
  };
}

/** Re-skin an existing rig if kit colors changed. */
export function updatePlayerKit(rig: PlayerRig, kit: TeamKit) {
  applyKitToMaterials(rig, kit);
}

/** Create or update jersey number billboard. */
export function ensureJerseyLabel(
  rig: PlayerRig,
  scene: Scene,
  num: number,
  kitPrimary: string,
) {
  if (rig.labelMesh) return;
  rig.labelMesh = createNumberLabel(scene, rig.root.name, num, rig.root, kitPrimary);
}

export function updatePlayerRig(
  rig: PlayerRig,
  px: number,
  pz: number,
  dt: number,
  opts?: { headingTruth?: number; speedTruth?: number },
) {
  if (rig.firstFrame) {
    rig.prevX = px;
    rig.prevZ = pz;
    rig.firstFrame = false;
    rig.root.position.x = px;
    rig.root.position.z = pz;
    rig.root.position.y = 0;
    if (opts?.headingTruth !== undefined) {
      rig.root.rotation.y = opts.headingTruth;
    }
    return;
  }

  const safeDt = Math.max(dt, 1e-4);
  const vx = (px - rig.prevX) / safeDt;
  const vz = (pz - rig.prevZ) / safeDt;
  rig.prevX = px;
  rig.prevZ = pz;
  const speed = Math.sqrt(vx * vx + vz * vz);
  const refSpeed = opts?.speedTruth ?? 0;

  rig.root.position.x = px;
  rig.root.position.z = pz;

  let targetYaw: number | null = null;
  if (speed > 0.12) {
    targetYaw = Math.atan2(vx, vz);
  } else if (opts?.headingTruth !== undefined && refSpeed > 0.06) {
    targetYaw = opts.headingTruth;
  }

  if (targetYaw !== null) {
    let cur = rig.root.rotation.y;
    let diff = targetYaw - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const k = speed > 0.12 ? 9 : 5.5;
    rig.root.rotation.y = cur + diff * Math.min(1, safeDt * k);
  }

  rig.root.rotation.x = Math.min(0.32, speed * 0.026);
  rig.root.rotation.z = 0;

  rig.bobPhase += safeDt * (8.5 + speed * 2.2);
  const bobAmp = 0.052 * Math.min(1, speed * 0.65);
  rig.root.position.y = Math.sin(rig.bobPhase) * bobAmp;
}
