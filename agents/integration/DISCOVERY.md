# Discovery Report — Existing Systems Available for Reuse

## 1. Field Dimensions

| File | Purpose | Reusable exports |
|---|---|---|
| `src/tactical/fieldGeometry.ts` | **FONTE ÚNICA DE VERDADE** — IFAB dimensions, coordinate conversions, SVG First View | `FIELD_LENGTH_M=105`, `FIELD_WIDTH_M=68`, `clampToPitch(x,z,margin)`, `worldToNormalized()`, `normalizedToWorld()`, `uiPercentToWorld()`, `worldToUiPercent()` |
| `src/simulation/field.ts` | Re-export shim for ~90 legacy files | Same as above via `@/tactical` |
| `src/tactical/zones12.ts` | 12 tactical zones (4 sectors × 3 corridors) | `FIELD_ZONES`, `getZoneFromNormalizedPosition()`, `getZoneCenterNormalized()` |

**Coordinate systems:**
- **Normalized (0–100)**: x=width, y=depth (home→away). Used by FieldView, agents.
- **World meters**: x=0–105m (depth), z=0–68m (width). Used by Yuka/physics.
- **Conversion**: `worldToNormalized({x,z})` ↔ `normalizedToWorld({x,y})`

---

## 2. Movement Utilities

| File | Purpose | Reusable |
|---|---|---|
| `src/simulation/FieldLabEngine.ts` | Field Lab motor — `moveToward(px,py,tx,ty,speed)` + locomotion tiers | `moveToward()` (lines 73–78), `WALK_N`, `JOG_N`, `RUN_N`, `SPRINT_N` (normalized speeds per tick) |
| `src/match/playerSpeedTuning.ts` | Speed constants in m/s | `SPEED_WALK_BASE=7.05`, `SPEED_SPRINT_BASE=13.14`, `fatigueSpeedMultiplier(stamina01, fisico01)`, `locomotionWalkSpeed()` |
| `src/agents/yukaAgents.ts` | Yuka Vehicle steering (Arrive, Separation, Pursuit) | `setArriveTarget(binding, x, z, mode)`, `stepVehicle(binding, dt)`, `stepAgentBodyYaw()`, `applySteeringForPhase()` — **world coords (meters)** |

**Key insight**: Yuka operates in **world meters** (x=depth 0–105, z=width 0–68).
Our agents operate in **normalized 0–100**. The bridge must convert.

---

## 3. Spacing / Formation Systems

| File | Purpose | Reusable |
|---|---|---|
| `src/engine/test2d/antiChaosEngine.ts` | Visual token separation — prevents overlap | `computePitchTokenSeparation(agents, options)` — input: `{id,x,y}[]` in 0–100, output: `Map<id, {dx,dy}>` offsets |
| `src/offBallAI/separationForce.ts` | Reynolds separation steering | `computeSeparationForces(agents, radius, maxForce)` — input: `AntiChaosAgent[]`, output: `Map<id, {dx,dz}>` |
| `src/match/tacticalSpacingTuning.ts` | Spacing constants | `TEST2D_MIN_SPACING_ENGINE_UNITS`, `TEST2D_REPULSION_FORCE`, `YUKA_BOUNDING_RADIUS_M` |

---

## 4. Position Update Loop

| File | Purpose | Reusable |
|---|---|---|
| `src/simulation/FieldLabEngine.ts` | `tickFLState(state, dt)` — full tick: move players, apply separation, update ball | Pattern: `moveToward()` → `computePitchTokenSeparation()` → apply offsets |
| `src/simulation/TacticalSimLoop.ts` | Full match engine with Yuka | `step(dt, config)` — too coupled to existing engine, not reusable directly |

---

## 5. Compatibility Mapping

```
PlayerAgent.lastAction.type = 'MOVE'
  → MovementBridge reads: agent.currentPosition (normalized), action.target (normalized)
  → converts target to world: normalizedToWorld(target) → {x, z}
  → calls: moveToward(px, py, tx, ty, walkSpeed) [FieldLabEngine pattern]
  → clamps: clampToPitch(newX, newZ) [fieldGeometry]
  → converts back: worldToNormalized({x, z}) → new currentPosition
  → applies: computeSeparationForces() to prevent overlap

PlayerAgent.lastAction.type = 'RUN'
  → same as MOVE but uses sprintSpeed
  → fatigueSpeedMultiplier(stamina/100, 0.7) scales the speed

PlayerAgent.lastAction.type = 'HOLD'
  → no movement, apply only separation forces if overlapping

PlayerAgent.lastAction.type = 'SHOOT'
  → no position change, handled by TeamSimulator event system
```
