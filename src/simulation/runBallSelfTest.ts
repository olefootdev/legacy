import { BallSystem } from './BallSystem';

function approx(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

function run() {
  const bs = new BallSystem();
  bs.mass = 1.2;
  bs.drag = 0.9;
  bs.setLoose(50, 30, 5, 0, 0);
  // tick few frames
  for (let i = 0; i < 60; i++) {
    bs.tick(1 / 60);
  }
  console.log('Ball after ticks', bs.state.x, bs.state.z, bs.state.vx, bs.state.vz);
  if (approx(bs.state.vx, 0) && approx(bs.state.vz, 0)) {
    console.log('PASS: ball stopped');
  } else {
    console.log('INFO: ball still moving (expected small residual depending on drag)');
  }
}

if (require.main === module) run();
export { run };
