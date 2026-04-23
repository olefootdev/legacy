import { createPlayerVisualsManager } from './babylonPlayerVisuals';

// Optional integration helpers. This module does not require Babylon at import time.

export function tryAutoAttachFromWindow(truthProvider: () => any) {
  try {
    const scene = (window as any).__BABYLON_SCENE__;
    const simIdToMesh = (window as any).__SIMID_TO_MESH_MAP__ as Map<string, any> | undefined;
    if (!scene || !simIdToMesh) return null;
    return attachToScene(scene, simIdToMesh, truthProvider);
  } catch (err) {
    return null;
  }
}

export function attachToScene(scene: any, simIdToMesh: Map<string, any>, truthProvider: () => any) {
  // create cheap prototypes if not present on scene
  let arrowProto = (scene as any)._of_arrowProto;
  let haloProto = (scene as any)._of_haloProto;
  try {
    if (!arrowProto) {
      // try to create a thin cone/cylinder; lazy import
      const MeshBuilder = (window as any).BABYLON?.MeshBuilder;
      if (MeshBuilder) {
        arrowProto = MeshBuilder.CreateCylinder('of_arrow_proto', { height: 0.8, diameterTop: 0, diameterBottom: 0.08 }, scene);
        arrowProto.rotation = { x: Math.PI / 2, y: 0, z: 0 };
        arrowProto.isPickable = false;
        arrowProto.setEnabled(false);
        (scene as any)._of_arrowProto = arrowProto;
      }
    }
    if (!haloProto) {
      const MeshBuilder = (window as any).BABYLON?.MeshBuilder;
      if (MeshBuilder) {
        haloProto = MeshBuilder.CreateTorus('of_halo_proto', { diameter: 1.6, thickness: 0.06 }, scene);
        haloProto.isPickable = false;
        haloProto.setEnabled(false);
        (scene as any)._of_haloProto = haloProto;
      }
    }
  } catch (err) {
    // ignore proto creation failures
  }

  const mgr = createPlayerVisualsManager({
    arrowProto,
    haloProto,
    simIdToMesh,
    onCameraCue: (c) => {
      // forward to scene-level handler if present
      if (scene && typeof scene.onOfCameraCue === 'function') scene.onOfCameraCue(c);
    },
    updateHz: 24,
  });

  // subscribe to truth provider change loop (caller provides function to get latest snap)
  let raf = 0;
  let alive = true;
  function step() {
    if (!alive) return;
    try {
      const snap = truthProvider();
      if (snap) mgr.updateFromSnapshot(snap);
    } catch (err) {
      // swallow
    }
    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);

  return {
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      mgr.dispose();
    },
    manager: mgr,
  };
}
