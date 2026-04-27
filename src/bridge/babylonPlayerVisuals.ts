// Lightweight Babylon-agnostic helper for player intent arrow + sprint halo visuals.
// The module DOES NOT import @babylonjs directly. The renderer must provide
// prototype meshes (arrowProto, haloProto) and a simId->mesh map so this code
// can create instances and update transforms cheaply.

type AnyMesh = any;
type AnyScene = any;

export type CameraCue = { kind: string; intensity?: number; at?: number };

export type PlayerVisualsManagerParams = {
  arrowProto: AnyMesh; // Mesh used as arrow prototype (must support createInstance)
  haloProto: AnyMesh; // Mesh used as halo/torus prototype
  simIdToMesh: Map<string, AnyMesh>; // map from sim player id to the player mesh in the scene
  onCameraCue?: (cue: CameraCue) => void; // optional callback to animate camera/vfx
  updateHz?: number; // throttle frequency (10-20 recommended)
};

function lerp(a: number, b: number, k: number) {
  return a * (1 - k) + b * k;
}

function vec3Lerp(out: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, k: number) {
  out.x = lerp(out.x, target.x, k);
  out.y = lerp(out.y, target.y, k);
  out.z = lerp(out.z, target.z, k);
}

export function createPlayerVisualsManager(params: PlayerVisualsManagerParams) {
  const arrowProto = params.arrowProto;
  const haloProto = params.haloProto;
  const simIdToMesh = params.simIdToMesh;
  const onCameraCue = params.onCameraCue;
  const updateHz = params.updateHz ?? 15;

  const perPlayer = new Map<string, {
    arrowInstance?: AnyMesh;
    haloInstance?: AnyMesh;
    // smoothing state
    arrowScale: { x: number; y: number; z: number };
    haloScale: { x: number; y: number; z: number };
    lastUpdateMs: number;
  }>();

  const minIntervalMs = Math.max(25, Math.floor(1000 / updateHz));

  function ensureFor(simId: string, parentMesh: AnyMesh) {
    let s = perPlayer.get(simId);
    if (s) return s;
    const entry: any = {
      arrowScale: { x: 0.001, y: 0.001, z: 0.001 },
      haloScale: { x: 0.001, y: 0.001, z: 0.001 },
      lastUpdateMs: 0,
    };
    try {
      if (arrowProto && typeof arrowProto.createInstance === 'function') {
        entry.arrowInstance = arrowProto.createInstance(`arrow-${simId}`);
        entry.arrowInstance.parent = parentMesh;
        entry.arrowInstance.position = { x: 0, y: 1.4, z: 0 };
        entry.arrowInstance.rotation = { x: 0, y: 0, z: 0 };
        entry.arrowInstance.scaling = { x: 0.001, y: 0.001, z: 0.001 };
        entry.arrowInstance.setEnabled(false);
      }
      if (haloProto && typeof haloProto.createInstance === 'function') {
        entry.haloInstance = haloProto.createInstance(`halo-${simId}`);
        entry.haloInstance.parent = parentMesh;
        entry.haloInstance.position = { x: 0, y: 0.12, z: 0 };
        entry.haloInstance.scaling = { x: 0.001, y: 0.001, z: 0.001 };
        entry.haloInstance.setEnabled(false);
      }
    } catch (err) {
      // If instancing fails (proto may be a simple mesh clone), try clone fallback
      try {
        if (arrowProto && !entry.arrowInstance) {
          entry.arrowInstance = arrowProto.clone(`arrow-${simId}`);
          entry.arrowInstance.parent = parentMesh;
          entry.arrowInstance.position = { x: 0, y: 1.4, z: 0 };
          entry.arrowInstance.scaling = { x: 0.001, y: 0.001, z: 0.001 };
          entry.arrowInstance.setEnabled && entry.arrowInstance.setEnabled(false);
        }
        if (haloProto && !entry.haloInstance) {
          entry.haloInstance = haloProto.clone(`halo-${simId}`);
          entry.haloInstance.parent = parentMesh;
          entry.haloInstance.position = { x: 0, y: 0.12, z: 0 };
          entry.haloInstance.scaling = { x: 0.001, y: 0.001, z: 0.001 };
          entry.haloInstance.setEnabled && entry.haloInstance.setEnabled(false);
        }
      } catch (err2) {
        // give up creating visuals for this player
      }
    }
    perPlayer.set(simId, entry);
    return entry;
  }

  function updateFromSnapshot(snap: any) {
    const now = performance.now();
    if (!snap || !snap.players) return;
    for (const p of snap.players) {
      const mesh = simIdToMesh.get(p.id);
      if (!mesh) continue;
      const s = ensureFor(p.id, mesh);
      if (!s) continue;
      if (now - s.lastUpdateMs < minIntervalMs) continue;
      s.lastUpdateMs = now;

      // Intent arrow handling
      const intent = p.intent;
      if (intent && intent.targetX != null && intent.targetZ != null) {
        if (s.arrowInstance) {
          s.arrowInstance.setEnabled && s.arrowInstance.setEnabled(true);
          // compute direction vector in world coords
          const dx = intent.targetX - p.x;
          const dz = intent.targetZ - p.z;
          const len2 = dx * dx + dz * dz;
          if (len2 > 1e-5) {
            const yaw = Math.atan2(dx, dz);
            s.arrowInstance.rotation = { x: Math.PI / 2, y: yaw, z: 0 };
          }
          const conf = Math.max(0.12, Math.min(1, intent.confidence ?? 0.6));
          const targetScale = { x: 1, y: 1 * conf * 1.1, z: 1 };
          vec3Lerp(s.arrowScale, targetScale, 0.28);
          s.arrowInstance.scaling = { x: s.arrowScale.x, y: s.arrowScale.y, z: s.arrowScale.z };
        }
      } else {
        if (s.arrowInstance) {
          vec3Lerp(s.arrowScale, { x: 0.001, y: 0.001, z: 0.001 }, 0.28);
          s.arrowInstance.scaling = { x: s.arrowScale.x, y: s.arrowScale.y, z: s.arrowScale.z };
          if (s.arrowScale.x < 0.02) s.arrowInstance.setEnabled && s.arrowInstance.setEnabled(false);
        }
      }

      // Locomotion halo (sprint)
      const loco = p.locomotionState;
      if (loco === 'sprint') {
        if (s.haloInstance) {
          s.haloInstance.setEnabled && s.haloInstance.setEnabled(true);
          vec3Lerp(s.haloScale, { x: 1.0, y: 1.0, z: 1.0 }, 0.2);
          s.haloInstance.scaling = { x: s.haloScale.x, y: s.haloScale.y, z: s.haloScale.z };
        }
      } else {
        if (s.haloInstance) {
          vec3Lerp(s.haloScale, { x: 0.001, y: 0.001, z: 0.001 }, 0.24);
          s.haloInstance.scaling = { x: s.haloScale.x, y: s.haloScale.y, z: s.haloScale.z };
          if (s.haloScale.x < 0.06) s.haloInstance.setEnabled && s.haloInstance.setEnabled(false);
        }
      }

      // optional: stamina tint, the renderer mesh material can be adjusted externally by accessing
      // mesh.material if desired. We avoid touching materials here unless explicitly needed.
    }

    // camera cues (fire callback)
    if (snap.cameraCues && snap.cameraCues.length && typeof onCameraCue === 'function') {
      for (const c of snap.cameraCues) onCameraCue(c);
    }
  }

  function triggerCameraCue(cue: CameraCue) {
    if (onCameraCue) onCameraCue(cue);
  }

  function dispose() {
    for (const [id, s] of perPlayer.entries()) {
      try { s.arrowInstance && s.arrowInstance.dispose && s.arrowInstance.dispose(); } catch {}
      try { s.haloInstance && s.haloInstance.dispose && s.haloInstance.dispose(); } catch {}
    }
    perPlayer.clear();
  }

  return { updateFromSnapshot, triggerCameraCue, dispose };
}
