# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (Vite + React)
npm run dev          # dev server on :5173
npm run build        # production build
npm run lint         # TypeScript check (no emit)

# Backend (Hono server)
npm run dev:server   # dev server on :4000

# Deploy
npm run deploy:cloudflare   # build + wrangler deploy

# Self-tests (run with tsx, no test runner)
npm run test:causal
npm run test:spirit-machine
npm run test:structural
npm run test:field-zones
npm run test:shot-resolve
npm run test:shoot-pipeline
npm run test:tactical-live-moments
npm run test:deliberation
# ... see package.json for full list

# SmartField snapshot (Python)
python smartfield/smartfield_debug.py --snapshot
```

## Architecture Overview

### Frontend (React + Zustand)
- **`src/game/`** — central game state: `OlefootGameState` (Zustand store via `GameProvider`). All match/team/economy mutations go through `reducer.ts` dispatched via `useGameStore`.
- **`src/App.tsx`** — route tree. All pages are lazy-loaded. The `RequireRegistration` guard wraps authenticated routes.
- **`src/pages/`** — route-level pages (LiveMatch, MatchLive, MatchAuto, MatchQuick, Postgame, etc.).
- **`src/admin/`** — admin dashboard, panels, GameSpirit teach/reference tools.

### Backend (Hono on Node)
- **`server/src/index.ts`** — Hono server on port 4000 with CORS.
- Routes: `gameSpirit`, `health`, `matches`, `pinataMedia`, `positionCoach`.
- Uses OpenAI for GameSpirit decisions and match context.

### Match Engine — layered architecture

| Layer | Location | Role |
|---|---|---|
| Simulation truth | `src/gamespirit/GameSpirit.ts` | Minute-by-minute shot/goal resolution, narrative |
| Engine types | `src/engine/types.ts` | `PitchPlayerState`, `MatchEventEntry`, `MatchMode` |
| Tactical positioning | `src/engine/test2d/tacticalPositioning.ts` | Formation-anchored, role-aware, spacing-enforced movement |
| Team shape | `src/engine/test2d/teamShape.ts` | Phase/intention → shape modifiers |
| Ball trajectory | `src/engine/test2d/ballTrajectory.ts` | Physical ball movement |
| Anti-chaos | `src/engine/test2d/antiChaosEngine.ts` | Prevents bunching/chaotic movement |
| UltraLive2D | `src/engine/ultralive2d/` | Event choreography, attrs→movement knobs |
| SmartField | `src/smartfield/smartfieldBridge.ts` | Loads Python-generated `smartfield_snapshot.json`; exposes zone anchors, tactical geometry |

### Coordinate Systems (critical to understand)
- **Engine coordinates**: 0–100 (percentage of field). Used in `PitchPlayerState.x/y`.
- **World meters**: X = 0–105m (home goal → away goal), Z = 0–68m (width). Used in physics/math.
- **Conversion**: `uiPercentToWorld()` / `worldToUiPercent()` in `src/simulation/field.ts`.
- Home attacks toward +X. Away attacks toward -X (mirrored).

### Match Modes
- `quick` — instant result, no pitch.
- `auto` — simulated with events, no live pitch.
- `test2d` — full live 2D pitch with Yuka agents, tactical sim loop, choreography. This is the main live mode.

### Key Domain Types
- `PitchPlayerState` (`src/engine/types.ts`) — player on pitch: `x/y` (engine %), `slotId`, `role`, `heading`, `fatigue`, `attributes`, `cognitiveArchetype`.
- `FormationSchemeId` — `'4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '4-5-1' | '5-3-2' | '3-4-3'`.
- `FORMATION_BASES` (`src/match-engine/formations/catalog.ts`) — normalized `nx/nz [0,1]` slot positions per formation.
- `SpiritPhase` / `SpiritOverlay` (`src/gamespirit/spiritSnapshotTypes.ts`) — GameSpirit state machine phases.

### GameSpirit (AI Narrator/Coach)
- `src/gamespirit/GameSpirit.ts` — core: resolves shots, goals, narrative from `SpiritContext`.
- `src/gamespirit/admin/` — admin tools: teach client, create player from prompt, runtime truth.
- `src/gamespirit/gameSpiritDecisionClient.ts` — calls backend OpenAI routes for tactical decisions.
- The `liveStoryEngine.ts` + `storyMotor.ts` produce narrative arcs per match.

### SmartField (Python + TS Bridge)
- `smartfield/smartfield_engine.py` + `smartfield_schema.py` — authoritative Python tactical geometry engine.
- `src/smartfield/smartfield_snapshot.json` — static export consumed at runtime by `smartfieldBridge.ts`.
- Regenerate snapshot: `python smartfield/smartfield_debug.py --snapshot`.

### State Persistence
- `src/game/persistence.ts` — rehydrate/migrate `OlefootGameState` from localStorage + Supabase.
- Supabase (`src/supabase/client.ts`) — auth + online game persistence.

### Economy / Wallet
- Currencies: OLE (in-game), EXP (experience), BRO cents, OLEXP (on-chain token).
- `src/wallet/olexp.ts`, `src/economy/`, `src/systems/economy.ts`.

### Alias paths
TypeScript path aliases (`@/`) map to `src/`. Configured in `tsconfig.json`.
