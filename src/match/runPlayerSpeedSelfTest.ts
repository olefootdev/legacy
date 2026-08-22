/**
 * Locomotion tuning: attribute scaling, jog/sprint tiers, arrival time gap.
 * Run: npx tsx src/match/runPlayerSpeedSelfTest.ts
 */
import {
  SPEED_JOG_MAX_MULT,
  SPEED_SPRINT_MAX_MULT,
  SPEED_WALK_MAX_MULT,
  V_MAX_ABSOLUTE,
  blendThreeLocomotionCaps,
  clampVehicleMaxSpeed,
  fatigueSpeedMultiplier,
  locomotionJogSpeed,
  locomotionSprintSpeed,
  locomotionWalkSpeed,
  normalizeSpeedAttr01,
} from './playerSpeedTuning';
import { TIME_SCALE, simToFootballMs } from '@/tactical';

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

  const vSprintLow = locomotionSprintSpeed(normalizeSpeedAttr01(12), fatigue);
  const vSprintHigh = locomotionSprintSpeed(normalizeSpeedAttr01(96), fatigue);
  assert(
    vSprintHigh / vSprintLow <= SPEED_SPRINT_MAX_MULT + 1e-9,
    'sprint speed ratio should not exceed SPEED_SPRINT_MAX_MULT',
  );

  const baseSprint = locomotionSprintSpeed(0, 1);
  const maxSprint = locomotionSprintSpeed(1, 1);
  assert(
    Math.abs(maxSprint / baseSprint - SPEED_SPRINT_MAX_MULT) < 1e-9,
    `max attr sprint should be exactly ${SPEED_SPRINT_MAX_MULT}× base sprint`,
  );

  const walkLow = locomotionWalkSpeed(0, fatigue);
  const walkHigh = locomotionWalkSpeed(1, fatigue);
  assert(walkHigh / walkLow <= SPEED_WALK_MAX_MULT + 1e-9, 'walk mult cap matches SPEED_WALK_MAX_MULT');

  const jogLow = locomotionJogSpeed(0, fatigue);
  const jogHigh = locomotionJogSpeed(1, fatigue);
  assert(jogHigh / jogLow <= SPEED_JOG_MAX_MULT + 1e-9, 'jog mult cap matches SPEED_JOG_MAX_MULT');

  const blendedSlow = blendThreeLocomotionCaps(
    locomotionWalkSpeed(normalizeSpeedAttr01(8), fatigue),
    locomotionJogSpeed(normalizeSpeedAttr01(8), fatigue),
    locomotionSprintSpeed(normalizeSpeedAttr01(8), fatigue),
    1,
  );
  const blendedFast = blendThreeLocomotionCaps(
    locomotionWalkSpeed(normalizeSpeedAttr01(99), fatigue),
    locomotionJogSpeed(normalizeSpeedAttr01(99), fatigue),
    locomotionSprintSpeed(normalizeSpeedAttr01(99), fatigue),
    1,
  );
  assert(blendedFast > blendedSlow, 'full sprint effort: faster player should have higher cap');
  assert(
    blendedFast / blendedSlow >= 1.35,
    'sprint cap gap between min/max pace should be visible in races',
  );

  const tSlow = timeToCover(distance, blendedSlow, dt);
  const tFast = timeToCover(distance, blendedFast, dt);
  // A diferença tem que ser cobrada em segundos de FUTEBOL, não de simulação.
  // O limiar antigo (0.35s de simulação) foi escrito quando as velocidades
  // viviam em unidades fictícias e uma corrida de 28m levava ~1.6s de sim.
  // Com as velocidades derivadas de m/s reais a mesma corrida leva ~0.2s de
  // sim — o que continua sendo uma vantagem clara de mais de 1 segundo de
  // futebol para o jogador mais rápido.
  const gapFootballSec = (tSlow - tFast) * TIME_SCALE;
  assert(
    gapFootballSec >= 1.0,
    `faster attribute should reach same distance sooner (gap=${gapFootballSec.toFixed(2)}s de futebol)`,
  );

  const rawMaxSprint = locomotionSprintSpeed(1, 1);
  assert(
    clampVehicleMaxSpeed(rawMaxSprint) <= V_MAX_ABSOLUTE + 1e-9,
    'clamped sprint cap must respect V_MAX_ABSOLUTE',
  );

  console.info(
    `[player-speed-selftest] OK ${distance}m: lento ${(tSlow * TIME_SCALE).toFixed(2)}s vs rápido ` +
      `${(tFast * TIME_SCALE).toFixed(2)}s de futebol (vantagem ${gapFootballSec.toFixed(2)}s) · ` +
      `sprint ${simToFootballMs(vSprintLow).toFixed(2)}–${simToFootballMs(vSprintHigh).toFixed(2)} m/s · ` +
      `teto ${simToFootballMs(V_MAX_ABSOLUTE).toFixed(1)} m/s`,
  );
}

main();
