/**
 * SkillEngine self-test (`npm run test:skill-engine`).
 *
 * Valida o engine determinístico de skills:
 *   1. Compatibilidade zonal bloqueia skill incompatível
 *   2. triggerChance escala com atributo (proxy)
 *   3. Pressão alta penaliza skills técnicas
 *   4. Cooldown bloqueia re-disparo no mesmo (player, type)
 *   5. teamSkillMultiplier respeita clamp [0.8, 1.5]
 *   6. Zona de finalização (box) amplifica vs defensiva penaliza
 *
 * Estratégia: força Math.random=0 (sempre dispara) para isolar lógica
 * de chance da lógica de bloqueio/cooldown.
 */

import assert from 'node:assert/strict';
import type { PitchPlayerState } from '@/engine/types';
import type { ZoneInfo } from '@/match/spatialZones';
import type { AwarenessContext } from '@/smartfield/awareness';
import {
  resolveSkills,
  tickSkillCooldowns,
  teamSkillMultiplier,
} from '@/skills/skillEngine';

function makePlayer(overrides: Partial<PitchPlayerState> = {}): PitchPlayerState {
  return {
    playerId: overrides.playerId ?? `pl_${Math.random().toString(36).slice(2, 8)}`,
    slotId: overrides.slotId ?? 'mc1',
    name: overrides.name ?? 'Test Player',
    num: overrides.num ?? 10,
    pos: overrides.pos ?? 'MC',
    x: overrides.x ?? 50,
    y: overrides.y ?? 50,
    heading: overrides.heading ?? 0,
    fatigue: overrides.fatigue ?? 30,
    role: overrides.role ?? 'mid',
    attributes: overrides.attributes ?? {
      finalizacao: 50,
      drible: 50,
      passeCurto: 50,
      passeLongo: 50,
      marcacao: 50,
      desarme: 50,
      fisico: 50,
      velocidade: 50,
      mentalidade: 50,
    },
    ...overrides,
  } as PitchPlayerState;
}

function zone(macro: string, subzone: string | null = null, ux = 90, uy = 50): ZoneInfo {
  return { macro, subzone, ux, uy };
}

const LOW_PRESS: AwarenessContext = {
  pressureLevel: 0.1,
  focal: { teammates: [], opponents: [] },
  peripheral: { teammates: [], opponents: [] },
  availableTeammates: [],
} as unknown as AwarenessContext;

const HIGH_PRESS: AwarenessContext = {
  pressureLevel: 0.85,
  focal: { teammates: [], opponents: [] },
  peripheral: { teammates: [], opponents: [] },
  availableTeammates: [],
} as unknown as AwarenessContext;

let passed = 0;
const total = 6;
const realRandom = Math.random;

// Garante que cada teste arranca sem cooldown residual.
function resetCooldowns() {
  for (let i = 0; i < 10; i++) tickSkillCooldowns();
}

// ── 1. Zona incompatível bloqueia skill ───────────────────────────
{
  resetCooldowns();
  Math.random = () => 0; // sempre dispara se passar
  const shooter = makePlayer({ attributes: { finalizacao: 95 } as any });
  // SHOOT só compatível em final third / box; defensive_center é incompatível
  const r = resolveSkills({
    player: shooter,
    type: 'SHOOT',
    zone: zone('defensive_center'),
  });
  assert.equal(r.fired, false, `SHOOT em defensive_center deveria bloquear, got fired=${r.fired}`);
  assert.match(r.reason, /incompat_zone/, `expected incompat_zone reason, got ${r.reason}`);
  console.log('✓ T1 zona incompatível bloqueia SHOOT (reason=' + r.reason + ')');
  passed++;
}

// ── 2. triggerChance escala com atributo ──────────────────────────
{
  resetCooldowns();
  Math.random = () => 0.99; // não dispara — isolar chance numérica
  const weak = makePlayer({ attributes: { finalizacao: 30 } as any });
  const strong = makePlayer({ attributes: { finalizacao: 95 } as any });
  const rWeak = resolveSkills({ player: weak, type: 'SHOOT', zone: zone('attacking_center', 'box_center') });
  const rStrong = resolveSkills({ player: strong, type: 'SHOOT', zone: zone('attacking_center', 'box_center') });
  assert.ok(
    rStrong.triggerChance > rWeak.triggerChance,
    `strong(${rStrong.triggerChance}) > weak(${rWeak.triggerChance})`,
  );
  console.log(
    `✓ T2 atributo escala chance: weak=${rWeak.triggerChance.toFixed(3)} strong=${rStrong.triggerChance.toFixed(3)}`,
  );
  passed++;
}

// ── 3. Pressão alta penaliza skills técnicas ──────────────────────
{
  resetCooldowns();
  Math.random = () => 0.99;
  const p = makePlayer({ attributes: { drible: 80 } as any });
  const z = zone('attacking_center', 'box_center');
  const calm = resolveSkills({ player: p, type: 'DRIBBLE', zone: z, awareness: LOW_PRESS });
  const pressed = resolveSkills({ player: p, type: 'DRIBBLE', zone: z, awareness: HIGH_PRESS });
  assert.ok(
    pressed.triggerChance < calm.triggerChance * 0.7,
    `pressão >0.7 deveria reduzir ≥30%; calm=${calm.triggerChance} pressed=${pressed.triggerChance}`,
  );
  console.log(
    `✓ T3 pressão alta penaliza DRIBBLE: calm=${calm.triggerChance.toFixed(3)} pressed=${pressed.triggerChance.toFixed(3)}`,
  );
  passed++;
}

// ── 4. Cooldown bloqueia re-disparo ───────────────────────────────
{
  resetCooldowns();
  Math.random = () => 0; // força disparar
  const p = makePlayer({
    playerId: 'cooldown_player',
    attributes: { finalizacao: 90 } as any,
  });
  const z = zone('attacking_center', 'box_center');
  const r1 = resolveSkills({ player: p, type: 'SHOOT', zone: z });
  assert.equal(r1.fired, true, 'primeira chamada deveria disparar');
  const r2 = resolveSkills({ player: p, type: 'SHOOT', zone: z });
  assert.equal(r2.fired, false, 'segunda chamada deveria estar em cooldown');
  assert.match(r2.reason, /cooldown/, `expected cooldown reason, got ${r2.reason}`);
  // após N ticks cooldown libera
  for (let i = 0; i < 5; i++) tickSkillCooldowns();
  const r3 = resolveSkills({ player: p, type: 'SHOOT', zone: z });
  assert.equal(r3.fired, true, 'após ticks de cooldown deveria liberar');
  console.log('✓ T4 cooldown bloqueia + libera após ticks');
  passed++;
}

// ── 5. teamSkillMultiplier clamp [0.8, 1.5] ───────────────────────
{
  assert.equal(teamSkillMultiplier(undefined), 1.0, 'sem booster → 1.0');
  assert.equal(teamSkillMultiplier({}), 1.0, 'booster vazio → 1.0');
  // sum=20 → 1+20/40=1.5 (top do clamp)
  assert.equal(teamSkillMultiplier({ a: 20 }), 1.5, 'sum=20 → 1.5 cap');
  // sum=40 → 1+1=2.0, clamp para 1.5
  assert.equal(teamSkillMultiplier({ a: 40 }), 1.5, 'sum=40 clamp 1.5');
  // sum=-30 → 1-0.75=0.25, clamp 0.8
  assert.equal(teamSkillMultiplier({ a: -30 }), 0.8, 'negativo clamp 0.8');
  // sum=10 → 1.25 (dentro do range)
  assert.ok(Math.abs(teamSkillMultiplier({ a: 10 }) - 1.25) < 1e-9, 'sum=10 → 1.25');
  console.log('✓ T5 teamSkillMultiplier clamp [0.8, 1.5]');
  passed++;
}

// ── 6. Box (final third) amplifica DRIBBLE vs creation (mult menor) ──
{
  resetCooldowns();
  Math.random = () => 0.99;
  const p = makePlayer({ attributes: { drible: 70 } as any });
  // DRIBBLE compat em creation/halfspace/final_third; box (final third) → mult 1.30 vs creation → 1.10
  const inBox = resolveSkills({
    player: p,
    type: 'DRIBBLE',
    zone: zone('attacking_center', 'box_center'),
  });
  const inCreation = resolveSkills({
    player: p,
    type: 'DRIBBLE',
    zone: zone('creation_center', 'creation_center'),
  });
  assert.ok(inBox.triggerChance > 0, `box DRIBBLE deveria ter chance > 0; got ${inBox.triggerChance}`);
  assert.ok(inCreation.triggerChance > 0, `creation DRIBBLE deveria ter chance > 0; got ${inCreation.triggerChance}`);
  assert.ok(
    inBox.triggerChance > inCreation.triggerChance,
    `box(${inBox.triggerChance}) > creation(${inCreation.triggerChance}) pelo zoneCategoryMult`,
  );
  console.log(
    `✓ T6 zona amplifica chance: box=${inBox.triggerChance.toFixed(3)} creation=${inCreation.triggerChance.toFixed(3)}`,
  );
  passed++;
}

Math.random = realRandom;
console.log(`\nSkillEngine self-test: ${passed}/${total} passed`);
if (passed !== total) process.exit(1);
