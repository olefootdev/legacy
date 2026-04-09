/**
 * Locomotion tuning: attribute scaling, run cap vs walk reference, arrival time gap.
 * Run: npx tsx src/match/runPlayerSpeedSelfTest.ts
 */
import {
  SPEED_RUN_BASE,
  SPEED_RUN_MAX_MULT,
  V_MAX_ABSOLUTE,
  blendWalkRunMaxSpeed,
  clampVehicleMaxSpeed,
  fatigueSpeedMultiplier,
  locomotionRunSpeed,
  locomotionWalkSpeed,
  normalizeSpeedAttr01,
} from './playerSpeedTuning';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** 1D constant max speed toward target until within epsilon. */
function timeToCover(distance: number, maxSpeed: number, dt: number, eps = 0.08): number {
  let t = 0;
  let rem = distance;
  const cap = clampVehicleMaxSpeed(maxSpeed);
  while (rem > eps && t < 200) {
    rem -= Math.min(cap * dt, rem);
    t += dt;
  }
  assert(rem <= eps + 1e-6, `did not reach target in time (rem=${rem})`);
  return t;
}

function main() {
  const dt = 1 / 60;
  const distance = 28;
  const fatigue = fatigueSpeedMultiplier(1, 1);

  const vRunLow = locomotionRunSpeed(normalizeSpeedAttr01(12), fatigue);
  const vRunHigh = locomotionRunSpeed(normalizeSpeedAttr01(96), fatigue);
  assert(vRunHigh / vRunLow <= SPEED_RUN_MAX_MULT + 1e-9, 'run speed ratio should not exceed SPEED_RUN_MAX_MULT');

  const baseRun = locomotionRunSpeed(0, 1);
  const maxRun = locomotionRunSpeed(1, 1);
  assert(
    Math.abs(maxRun / baseRun - SPEED_RUN_MAX_MULT) < 1e-9,
    `max attr run should be exactly ${SPEED_RUN_MAX_MULT}× base run`,
  );
  assert(
    Math.abs(baseRun - SPEED_RUN_BASE) < 1e-9,
    'zero-attr run should equal SPEED_RUN_BASE (fatigue 1)',
  );

  const walkLow = locomotionWalkSpeed(0, fatigue);
  const walkHigh = locomotionWalkSpeed(1, fatigue);
  assert(walkHigh / walkLow <= 2 + 1e-9, 'walk mult cap is 2×');

  const blendedSlow = blendWalkRunMaxSpeed(
    locomotionWalkSpeed(normalizeSpeedAttr01(8), fatigue),
    locomotionRunSpeed(normalizeSpeedAttr01(8), fatigue),
    1,
  );
  const blendedFast = blendWalkRunMaxSpeed(
    locomotionWalkSpeed(normalizeSpeedAttr01(99), fatigue),
    locomotionRunSpeed(normalizeSpeedAttr01(99), fatigue),
    1,
  );
  assert(blendedFast > blendedSlow, 'full-run blend: faster player should have higher cap');
  assert(
    blendedFast / blendedSlow <= SPEED_RUN_MAX_MULT + 0.02,
    'full-run blend ratio should not exceed configured run mult (same fatigue)',
  );

  const tSlow = timeToCover(distance, blendedSlow, dt);
  const tFast = timeToCover(distance, blendedFast, dt);
  assert(tFast < tSlow - 0.25, 'faster attribute should reach same distance sooner (repro gap)');

  const rawMaxRun = SPEED_RUN_BASE * SPEED_RUN_MAX_MULT;
  assert(
    clampVehicleMaxSpeed(rawMaxRun) <= V_MAX_ABSOLUTE + 1e-9,
    'clamped run cap must respect V_MAX_ABSOLUTE',
  );

  console.info(
    `[player-speed-selftest] OK distance=${distance}m tSlow=${tSlow.toFixed(3)}s tFast=${tFast.toFixed(3)}s ` +
      `vRun(low/high)=${vRunLow.toFixed(2)}/${vRunHigh.toFixed(2)} cap=${V_MAX_ABSOLUTE}`,
  );
}

main();
