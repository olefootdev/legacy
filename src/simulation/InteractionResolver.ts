import { FIELD_LENGTH, FIELD_WIDTH } from './field';
import { FAIRPLAY_FOUL_BIAS } from '@/match/matchSimulationTuning';
import type { MatchCognitiveArchetype } from '@/match/playerInMatch';
import type { RngDraw } from '@/match/rngDraw';
import { rngFromMathRandom } from '@/match/rngDraw';
import { ACTION_SOFT_CAP_PASS } from '@/match/actionResolutionTuning';

export interface AgentSnapshot {
  id: string;
  slotId?: string;
  side: 'home' | 'away';
  x: number;
  z: number;
  speed: number;
  role: string;
  /** Média ponderada curto/longo — compatível com fórmulas legadas */
  passe: number;
  passeCurto: number;
  passeLongo: number;
  cruzamento: number;
  marcacao: number;
  drible: number;
  finalizacao: number;
  velocidade: number;
  fisico: number;
  fairPlay: number;
  tatico: number;
  mentalidade: number;
  confianca: number;
  cognitiveArchetype?: MatchCognitiveArchetype;
  /** 0.55–1.2 multiplicador de execução em runtime */
  confidenceRuntime?: number;
  stamina?: number;
}

export interface PassOption {
  targetId: string;
  targetX: number;
  targetZ: number;
  distance: number;
  /** Estimated success probability 0-1 */
  successProb: number;
  isForward: boolean;
  isLong: boolean;
  /** 0-1: how much this pass advances toward the opponent's goal */
  progressionGain: number;
  /** Nearest opponent distance to the pass target — higher = more space */
  spaceAtTarget: number;
  /** Approximate number of opponent lines this pass bypasses */
  linesBroken: number;
  /**
   * 0 = na linha do próprio golo (eixo X), 1 = na linha do golo adversário.
   * Usado para priorizar passes que colocam o colega mais perto da finalização.
   */
  threatDepth01: number;
  /** Distância (m) do alvo ao centro da baliza adversária */
  distToOppGoal: number;
  /**
   * 0 = muitos colegas perto do alvo, 1 = setor mais desocupado.
   * Reflete treino de “passe para espaços vazios” (organização ofensiva).
   */
  sectorVacancy01: number;
}

export interface ShotChance {
  distance: number;
  angle: number;
  /** Raw xG 0-1 */
  xG: number;
}

/** Pressão 0–1 a partir da distância ao adversário mais próximo */
export function nearestOpponentPressure01(self: AgentSnapshot, opponents: AgentSnapshot[]): number {
  let minD = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.x - self.x, o.z - self.z);
    if (d < minD) minD = d;
  }
  if (!Number.isFinite(minD)) return 0;
  return Math.max(0, Math.min(1, (4.8 - minD) / 4.8));
}

/** Profundidade no eixo de ataque: 0 na própria linha de fundo, 1 na linha adversária. */
export function passTargetThreatDepth01(targetX: number, attackDir: 1 | -1): number {
  const along = attackDir === 1 ? targetX : FIELD_LENGTH - targetX;
  return Math.max(0, Math.min(1, along / FIELD_LENGTH));
}

/**
 * Prioriza passes que mantêm segurança mínima mas favorecem colegas mais perto do golo adversário.
 * Usado em `findPassOptions` e nas camadas de decisão (progressivo / instinct).
 */
export function passOptionAttackBuildUpScore(o: PassOption): number {
  const safetyPenalty =
    o.successProb < 0.32 ? -0.55
    : o.successProb < 0.4 ? -0.18
      : 0;
  const vacancy = o.sectorVacancy01 ?? 0.5;
  /** Penetração: linha ultrapassada + profundidade — “correr às costas” (E. Barros). */
  const penetrationBonus =
    o.linesBroken >= 1 && o.threatDepth01 > 0.52 ? 0.055 + Math.min(o.linesBroken, 3) * 0.012
    : o.linesBroken >= 1 ? 0.028
      : 0;
  /** Quanto mais perto da baliza adversária está o alvo, mais vale o passe. */
  const nearOppGoal01 = 1 - Math.min(o.distToOppGoal / 54, 1);
  return (
    safetyPenalty
    + o.successProb * 0.33
    + o.threatDepth01 * 0.46
    + nearOppGoal01 * 0.2
    + Math.min(o.spaceAtTarget, 14) / 14 * 0.13
    + o.progressionGain * 0.1
    + (o.isForward ? 0.08 : 0)
    + vacancy * 0.11
    + penetrationBonus
  );
}

/** Find all viable pass targets for a carrier. */
export function findPassOptions(
  carrier: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
): PassOption[] {
  const options: PassOption[] = [];
  const pc = carrier.passeCurto / 100;
  const pl = carrier.passeLongo / 100;
  const cr = carrier.cruzamento / 100;
  const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;

  for (const t of teammates) {
    if (t.id === carrier.id) continue;
    const dx = t.x - carrier.x;
    const dz = t.z - carrier.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2 || dist > 55) continue;

    let blockCount = 0;
    let closestOppToTarget = Infinity;
    let linesBroken = 0;
    for (const opp of opponents) {
      const cross = pointToSegmentDist(opp.x, opp.z, carrier.x, carrier.z, t.x, t.z);
      if (cross < 2.5) blockCount++;

      const od = Math.hypot(opp.x - t.x, opp.z - t.z);
      if (od < closestOppToTarget) closestOppToTarget = od;

      const oppBetweenX = attackDir === 1
        ? (opp.x > carrier.x + 2 && opp.x < t.x - 2)
        : (opp.x < carrier.x - 2 && opp.x > t.x + 2);
      if (oppBetweenX && Math.abs(opp.z - (carrier.z + t.z) / 2) < 15) {
        linesBroken++;
      }
    }

    const isForward = (attackDir === 1 && dx > 3) || (attackDir === -1 && dx < -3);
    const isLong = dist > 25;
    const progressionGain = Math.max(0, Math.min(1, (dx * attackDir) / FIELD_LENGTH));
    const spaceAtTarget = Math.min(closestOppToTarget, 20);

    const passeSkill = isLong ? pl * 0.72 + pc * 0.28 : pc * 0.82 + pl * 0.18;
    let prob = 0.64 + passeSkill * 0.3;
    prob -= blockCount * 0.12;
    if (isLong) prob -= 0.08;
    if (dist > 40) prob -= 0.07;
    const wideLane = Math.abs(dz) > 12 && isForward;
    if (wideLane) prob += cr * 0.06;
    prob = Math.max(0.12, Math.min(0.96, prob));

    const threatDepth01 = passTargetThreatDepth01(t.x, attackDir);
    const distToOppGoal = Math.hypot(goalX - t.x, goalZ - t.z);

    let teammatesNearTarget = 0;
    for (const tm of teammates) {
      if (tm.id === t.id) continue;
      if (Math.hypot(tm.x - t.x, tm.z - t.z) < 12) teammatesNearTarget++;
    }
    const sectorVacancy01 = Math.max(0, Math.min(1, 1 - teammatesNearTarget * 0.24));

    options.push({
      targetId: t.id, targetX: t.x, targetZ: t.z, distance: dist,
      successProb: prob, isForward, isLong,
      progressionGain, spaceAtTarget, linesBroken,
      threatDepth01,
      distToOppGoal,
      sectorVacancy01,
    });
  }

  return options.sort((a, b) => passOptionAttackBuildUpScore(b) - passOptionAttackBuildUpScore(a));
}

/** Calculate shot xG for a carrier. */
export function evaluateShot(carrier: AgentSnapshot, attackDir: 1 | -1, opponents: AgentSnapshot[]): ShotChance {
  const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;
  const dist = Math.hypot(goalX - carrier.x, goalZ - carrier.z);
  const angle = Math.abs(Math.atan2(goalZ - carrier.z, goalX - carrier.x));

  const finAttr = carrier.finalizacao / 100;
  const mental = (carrier.mentalidade + carrier.confianca) / 200;
  let xG = 0.05 + finAttr * 0.22 + mental * 0.05;
  if (dist < 8) xG += 0.18;
  else if (dist < 14) xG += 0.12;
  else if (dist < 20) xG += 0.06;
  else if (dist > 30) xG -= 0.04;

  if (angle > Math.PI * 0.35) xG -= 0.06;

  let nearOppCount = 0;
  for (const o of opponents) {
    if (Math.hypot(o.x - carrier.x, o.z - carrier.z) < 4) nearOppCount++;
  }
  const crowdPen = dist < 16 ? 0.021 : 0.026;
  xG -= nearOppCount * crowdPen;

  const press = nearestOpponentPressure01(carrier, opponents);
  const confRun = carrier.confidenceRuntime ?? 1;
  xG *= 0.88 + confRun * 0.14;
  xG *= 1 - press * (0.22 - mental * 0.1);

  const st = carrier.stamina ?? 85;
  if (st < 45) xG *= 0.88 + st / 500;

  xG = Math.max(0.01, Math.min(0.38, xG));
  return { distance: dist, angle, xG };
}

/** Resolve a tackle attempt: defender near ball carrier. Returns true if tackle succeeds. */
export function resolveTackle(
  defender: AgentSnapshot,
  carrier: AgentSnapshot,
  dist: number,
  rng: RngDraw = rngFromMathRandom(),
): boolean {
  if (dist > 2.5) return false;
  const defPower =
    defender.marcacao / 100
    + defender.fisico / 100 * 0.32
    + defender.velocidade / 100 * 0.16;
  const carrPower = carrier.drible / 100 + carrier.velocidade / 100 * 0.26;
  let base = 0.2 + (defPower - carrPower) * 0.36;
  const fp = defender.fairPlay / 100;
  base += (0.55 - fp) * FAIRPLAY_FOUL_BIAS * 0.5;
  return rng.nextUnit() < Math.max(0.07, Math.min(0.56, base));
}

/**
 * Resolve pass completion: direction/error from passe curto/longo, pressão e confiança.
 * `rng` determinístico quando vindo do ActionResolver / replay.
 */
export function resolvePassLanding(
  option: PassOption,
  carrier: AgentSnapshot,
  pressure01: number,
  rng: RngDraw = rngFromMathRandom(),
): { x: number; z: number; completed: boolean; roll: number; pSuccess: number } {
  const skill = option.isLong
    ? carrier.passeLongo * 0.75 + carrier.passeCurto * 0.25
    : carrier.passeCurto * 0.78 + carrier.passeLongo * 0.22;
  const comp = (carrier.mentalidade * 0.5 + carrier.confianca * 0.5) / 100;
  const confRun = Math.max(0.55, Math.min(1.22, carrier.confidenceRuntime ?? 1));
  const st = (carrier.stamina ?? 90) / 100;

  let pOk = option.successProb * (0.9 + confRun * 0.08) * (0.92 + st * 0.08);
  pOk -= pressure01 * (0.14 - comp * 0.08);
  /** Passe técnico (curto/longo) reduz risco bruto de perda, além de mental/conf sob pressão */
  pOk += (skill / 100 - 0.62) * 0.09;
  pOk = Math.max(0.08, Math.min(ACTION_SOFT_CAP_PASS, pOk));

  const roll = rng.nextUnit();
  const completed = roll < pOk;
  if (completed) {
    const err = (1 - skill / 100) * 2.8 * (1 + pressure01 * (0.85 - comp * 0.35)) * (1.15 - confRun * 0.12);
    return {
      x: option.targetX + (rng.nextUnit() - 0.5) * err,
      z: option.targetZ + (rng.nextUnit() - 0.5) * err,
      completed: true,
      roll,
      pSuccess: pOk,
    };
  }
  const missDir = rng.nextUnit() * Math.PI * 2;
  const missDist = 4 + rng.nextUnit() * 8;
  return {
    x: (carrier.x + option.targetX) / 2 + Math.cos(missDir) * missDist,
    z: (carrier.z + option.targetZ) / 2 + Math.sin(missDir) * missDist,
    completed: false,
    roll,
    pSuccess: pOk,
  };
}

/** Resolve shot outcome (legado: alvo + resultado num único espaço). Preferir ActionResolver.resolveShot.) */
export function resolveShotOutcome(
  xG: number,
  rng: RngDraw = rngFromMathRandom(),
): 'goal' | 'save' | 'miss' | 'block' {
  const roll = rng.nextUnit();
  if (roll < xG) return 'goal';
  if (roll < xG + 0.25) return 'save';
  if (roll < xG + 0.5) return 'block';
  return 'miss';
}

export function pointToSegmentDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  if (abLenSq < 0.001) return Math.hypot(apx, apz);
  let t = (apx * abx + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * abx;
  const projZ = az + t * abz;
  return Math.hypot(px - projX, pz - projZ);
}
