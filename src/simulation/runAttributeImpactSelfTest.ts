/**
 * Verifica estatisticamente que atributos alteram resultados (passe sob pressão, desarme).
 * Rodar: npx tsx src/simulation/runAttributeImpactSelfTest.ts
 */
import {
  resolvePassLanding,
  resolveTackle,
  type AgentSnapshot,
  type PassOption,
} from './InteractionResolver';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function snapBase(over: Partial<AgentSnapshot> & Pick<AgentSnapshot, 'id'>): AgentSnapshot {
  const passe = 70;
  const defaults: AgentSnapshot = {
    id: over.id,
    side: 'home',
    x: 50,
    z: 34,
    speed: 5,
    role: 'mid',
    passe,
    passeCurto: passe,
    passeLongo: Math.round(passe * 0.92 + 4),
    cruzamento: 65,
    marcacao: 65,
    drible: 65,
    finalizacao: 65,
    velocidade: 70,
    fisico: 70,
    fairPlay: 75,
    tatico: 70,
    mentalidade: 70,
    confianca: 70,
    confidenceRuntime: 1,
    stamina: 90,
  };
  return { ...defaults, ...over };
}

const shortPassOpt: PassOption = {
  targetId: 't2',
  targetX: 62,
  targetZ: 34,
  distance: 12,
  successProb: 0.78,
  isForward: true,
  isLong: false,
  progressionGain: 0.22,
  spaceAtTarget: 3.2,
  linesBroken: 0,
};

function passCompletionRate(carrier: AgentSnapshot, pressure01: number, trials: number): number {
  let ok = 0;
  for (let i = 0; i < trials; i++) {
    const r = resolvePassLanding(shortPassOpt, carrier, pressure01);
    if (r.completed) ok++;
  }
  return ok / trials;
}

function tackleWinRate(def: AgentSnapshot, carr: AgentSnapshot, trials: number): number {
  let w = 0;
  for (let i = 0; i < trials; i++) {
    if (resolveTackle(def, carr, 2)) w++;
  }
  return w / trials;
}

function main() {
  const trials = 500;

  const skilled = snapBase({
    id: 'sk',
    passeCurto: 90,
    passeLongo: 86,
    mentalidade: 82,
    confianca: 86,
  });
  const poor = snapBase({
    id: 'pw',
    passeCurto: 32,
    passeLongo: 30,
    mentalidade: 44,
    confianca: 38,
  });

  const highPress = 0.88;
  const pGood = passCompletionRate(skilled, highPress, trials);
  const pBad = passCompletionRate(poor, highPress, trials);
  assert(
    pGood > pBad + 0.04,
    `passe sob pressão: esperado jogador forte > fraco (got ${pGood.toFixed(3)} vs ${pBad.toFixed(3)})`,
  );

  const defStrong = snapBase({ id: 'dS', side: 'away', marcacao: 90, fisico: 84 });
  const defWeak = snapBase({ id: 'dW', side: 'away', marcacao: 40, fisico: 52 });
  const carrierClumsy = snapBase({ id: 'cC', drible: 35, velocidade: 55 });
  const carrierDribbler = snapBase({ id: 'cD', drible: 88, velocidade: 82 });

  const tStrongVsWeak = tackleWinRate(defStrong, carrierClumsy, trials);
  const tWeakVsStrong = tackleWinRate(defWeak, carrierDribbler, trials);
  assert(
    tStrongVsWeak > tWeakVsStrong + 0.04,
    `desarme: zagueiro forte vs carrinho fraco deve superar zagueiro fraco vs drible forte (got ${tStrongVsWeak.toFixed(3)} vs ${tWeakVsStrong.toFixed(3)})`,
  );

  const lowConf = snapBase({
    id: 'lc',
    passeCurto: 72,
    confidenceRuntime: 0.58,
  });
  const highConf = snapBase({
    id: 'hc',
    passeCurto: 72,
    confidenceRuntime: 1.15,
  });
  const pLow = passCompletionRate(lowConf, highPress, trials);
  const pHigh = passCompletionRate(highConf, highPress, trials);
  assert(
    pHigh > pLow + 0.03,
    `confiança runtime deve ajudar conclusão sob pressão (got ${pHigh.toFixed(3)} vs ${pLow.toFixed(3)})`,
  );

  console.log(
    `attribute-impact self-test: ok (pass skilled/poor ${pGood.toFixed(2)}/${pBad.toFixed(2)}, tackle ${tStrongVsWeak.toFixed(2)}/${tWeakVsStrong.toFixed(2)}, conf ${pHigh.toFixed(2)}/${pLow.toFixed(2)})`,
  );
}

main();
