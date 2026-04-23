import { BallSystem } from './BallSystem';
import { FIELD_LENGTH, FIELD_WIDTH } from './field';

// src/simulation/BallSystem.test.ts

describe('BallSystem', () => {
  const EPS = 1e-6;

  function centerX() {
    return FIELD_LENGTH / 2;
  }
  function centerZ() {
    return FIELD_WIDTH / 2;
  }

  test('reset restores empty state', () => {
    const s = new BallSystem();
    // mutate state
    s.state.mode = 'held';
    s.state.x = 1.23;
    s.state.z = 4.56;
    s.state.vx = 7.89;
    s.state.vy = 3.21;
    s.state.flight = { fromX: 0, fromZ: 0, toX: 1, toZ: 1, speed: 5, progress: 0.5, kind: 'pass' };
    s.reset();
    expect(s.state.mode).toBe('dead');
    expect(s.state.carrierId).toBeNull();
    expect(s.state.flight).toBeNull();
    expect(s.state.x).toBeCloseTo(centerX(), 6);
    expect(s.state.z).toBeCloseTo(centerZ(), 6);
    expect(s.state.vx).toBeCloseTo(0, 6);
    expect(s.state.vy).toBeCloseTo(0, 6);
    expect(s.state.vz).toBeCloseTo(0, 6);
  });

  test('placeForKickoff sets center and dead', () => {
    const s = new BallSystem();
    s.state.x = 12;
    s.state.z = 34;
    s.state.mode = 'held';
    s.placeForKickoff();
    expect(s.state.mode).toBe('dead');
    expect(s.state.carrierId).toBeNull();
    expect(s.state.flight).toBeNull();
    expect(s.state.x).toBeCloseTo(centerX(), 6);
    expect(s.state.z).toBeCloseTo(centerZ(), 6);
    expect(s.state.vx).toBeCloseTo(0, 6);
  });

  test('giveTo and syncHeldToCarrier keep ball with carrier and follow carrier', () => {
    const s = new BallSystem();
    const px = 5.5;
    const pz = 6.6;
    s.giveTo('player1', px, pz);
    expect(s.state.mode).toBe('held');
    expect(s.state.carrierId).toBe('player1');
    expect(s.state.x).toBeCloseTo(px, 6);
    expect(s.state.z).toBeCloseTo(pz, 6);
    expect(s.state.vx).toBeCloseTo(0, 6);
    // sync to new carrier pos
    s.syncHeldToCarrier({ x: 7.7, z: 8.8 }.x, { x: 7.7, z: 8.8 }.z); // two args expected by method signature
    // the method signature expects (x,z) but we pass via object destructuring; adjust:
    // call proper: s.syncHeldToCarrier(7.7, 8.8);
  });

  test('giveTo and syncHeldToCarrier follow carrier (correct call)', () => {
    const s = new BallSystem();
    s.giveTo('p2', 1, 2);
    s.syncHeldToCarrier(7.7, 8.8);
    expect(s.state.x).toBeCloseTo(7.7, 6);
    expect(s.state.z).toBeCloseTo(8.8, 6);
    expect(s.state.mode).toBe('held');
  });

  test('setLoose sets velocities and height behavior', () => {
    const s = new BallSystem();
    s.state.height = 0;
    s.setLoose(3, 4, 1.1, -0.5, 0.2); // vy > 0
    expect(s.state.mode).toBe('loose');
    expect(s.state.vx).toBeCloseTo(1.1, 6);
    expect(s.state.vz).toBeCloseTo(-0.5, 6);
    expect(s.state.vy).toBeCloseTo(0.2, 6);
    expect(s.state.height).toBeGreaterThanOrEqual(0.05);

    s.setLoose(3, 4, 0, 0, 0);
    expect(s.state.height).toBeCloseTo(0, 6);
  });

  test('startFlight sets flight, velocities, vy>0 and initial height', () => {
    const s = new BallSystem();
    const from = { x: 0, z: 0 };
    const to = { x: 10, z: 0 };
    s.startFlight(from, to, 10, 'pass');
    expect(s.state.mode).toBe('flight');
    expect(s.state.flight).not.toBeNull();
    expect(Math.hypot(s.state.vx, s.state.vz)).toBeGreaterThan(0);
    expect(s.state.vy).toBeGreaterThan(0);
    expect(s.state.height).toBeCloseTo(0.15, 6);
    if (s.state.flight) {
      expect(s.state.flight.progress).toBeCloseTo(0, 6);
    }
  });

  test('startFlight with negligible distance yields zero velocities', () => {
    const s = new BallSystem();
    const p = { x: 1.2345, z: 2.3456 };
    s.startFlight(p, p, 5, 'pass');
    expect(s.state.mode).toBe('flight'); // flight object remains set
    expect(s.state.vx).toBeCloseTo(0, 6);
    expect(s.state.vz).toBeCloseTo(0, 6);
    expect(s.state.vy).toBeCloseTo(0, 6);
  });

  test('tick advances flight and transitions to loose at destination', () => {
    const s = new BallSystem();
    const from = { x: 0, z: 0 };
    const to = { x: 2, z: 0 };
    s.startFlight(from, to, 20, 'pass'); // fairly fast to finish in few steps
    let completed = false;
    for (let i = 0; i < 100; i++) {
      const done = s.tick(0.02);
      if (done) {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    expect(s.state.mode).toBe('loose');
    expect(s.state.flight).toBeNull();
  });

  test('loose ball rolling decelerates and stops', () => {
    const s = new BallSystem();
    s.setLoose(1, 1, 1.0, 0, 0); // vx=1 m/s
    // advance up to 500 steps of dt=0.1s (50s simulated) to allow friction to stop ball
    for (let i = 0; i < 500; i++) {
      s.tick(0.1);
      if (Math.hypot(s.state.vx, s.state.vz) < 0.0001) break;
    }
    expect(Math.hypot(s.state.vx, s.state.vz)).toBeLessThan(0.5); // should have slowed substantially
    // eventually the implementation sets to exact 0 when below threshold and not airborne
    if (s.state.height <= 0) {
      expect(s.state.vx).toBeCloseTo(0, 3);
      expect(s.state.vz).toBeCloseTo(0, 3);
    }
    expect(s.state.mode).toBe('loose');
  });
});