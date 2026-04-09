# Match Pitch (Babylon viewer)

Viewer Web isolado para o gramado 3D (marcações FIFA-style, traves, bola esférica, 4-3-3 demo, câmeras TV / Drone / Motion, terços e grade 8×5).

**Demo TV:** o modo inicial é **TV** (HUD já destaca o botão). O enquadramento vem de `CameraRig.ts` (`TV_BROADCAST`) — transmissão estável, **sem** micro-handheld (`TV_CAMERA_USE_SUBTLE_HANDHELD = false`); ative no ficheiro se quiser oscilação leve. **Grama:** textura procedural + bump em `demoGrassMaterial.ts` (sem assets externos), com tons mais claros para contraste com as linhas.

**Verdade da cena:** o viewer **não** anima a bola com órbitas de demo; só desenha `MatchTruthSnapshot` (`postMessage` / `__RN_MATCH_PITCH`). Ver `docs/MATCH_SIMULATION_PIPELINE.md` no repo principal.

## Dev

```bash
npm install
npm run dev
```

Abre em `http://localhost:5174` (host `0.0.0.0` para acessar na LAN).

## Build

```bash
npm run build
```

Saída em `dist/` — hospedar como site estático **HTTPS** em produção.

## Ponte

- `window.__RN_MATCH_PITCH(payload)` — JSON `MatchTruthSnapshot` (objeto ou string parseável).
- `window.addEventListener('message', …)` — mesmo payload (útil para debug).

Tipos: `src/matchTruthTypes.ts` (espelha `src/bridge/matchTruthSchema.ts` no app Vite principal).
