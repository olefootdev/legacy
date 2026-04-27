import { resolveReception } from './Reception';
import type { DecisionContext } from './types';

function makeCtx(controlDifficulty = 0) {
  const ctx: any = {
    self: { id: 'p', x: 40, z: 30, role: 'mid', drible: 70 },
    teammates: [],
    opponents: [],
    ballX: 40,
    ballZ: 30,
    isCarrier: false,
    isReceiver: true,
    ballFlightProgress: 0.9,
    possession: 'home',
    attackDir: 1,
    slotX: 40,
    slotZ: 30,
    scoreDiff: 0,
    minute: 10,
    mentality: 50,
    profile: { firstTouchPlay: 0.5, dribbleTendency: 0.5, composure: 0.6, verticality: 0.4, possessionBias: 0.5, riskAppetite: 0.4, vision:0.5, workRate:0.5 },
    prethinking: null,
    ballControlDifficulty: controlDifficulty,
  } as DecisionContext;
  return ctx;
}

function run() {
  const c1 = makeCtx(0);
  const r1 = resolveReception(c1);
  const c2 = makeCtx(0.6);
  const r2 = resolveReception(c2);
  console.log('Reception success normal ball:', r1.success, 'hard ball:', r2.success);
}

if (require.main === module) run();
export { run };
