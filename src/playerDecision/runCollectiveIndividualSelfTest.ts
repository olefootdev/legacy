import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import {
  mapRole,
  chooseAction,
  extractAttributes,
  buildPlayerState,
  buildTeamTacticalContext,
  getCollectiveTarget,
} from '@/playerDecision/collectiveIndividualDecision';
import { buildProfile } from '@/playerDecision/PlayerProfile';
import type { DecisionContext } from '@/playerDecision/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function mkSnap(id: string, slotId: string, role: AgentSnapshot['role'], x: number, z: number): AgentSnapshot {
  const passe = 70;
  return {
    id,
    slotId,
    role,
    side: 'home',
    x,
    z,
    speed: 5,
    passe,
    passeCurto: passe,
    passeLongo: Math.round(passe * 0.92 + 4),
    cruzamento: 66,
    marcacao: 70,
    drible: 70,
    finalizacao: 70,
    velocidade: 70,
    fisico: 70,
    fairPlay: 75,
    tatico: 70,
    mentalidade: 70,
    confianca: 70,
    confidenceRuntime: 1,
    stamina: 90,
  };
}

function mkCtx(self: AgentSnapshot): DecisionContext {
  return {
    self,
    teammates: [],
    opponents: [],
    ballX: 52,
    ballZ: 34,
    isCarrier: true,
    isReceiver: false,
    ballFlightProgress: 0,
    possession: 'home',
    attackDir: 1,
    slotX: self.x,
    slotZ: self.z,
    scoreDiff: 0,
    minute: 40,
    mentality: 62,
    tacticalDefensiveLine: 55,
    tacticalPressing: 60,
    tacticalWidth: 55,
    tacticalTempo: 58,
    profile: buildProfile('box_to_box'),
    teamPhase: 'progression',
    carrierId: self.id,
    carrierJustChanged: false,
    ballSector: 'center',
    threatLevel: 0.42,
    threatTrend: 'rising',
  };
}

function main() {
  const meia = mkSnap('m1', 'mc1', 'mid', 52, 34);
  const zagueiro = mkSnap('z1', 'zag1', 'def', 36, 28);
  const meiaCtx = mkCtx(meia);
  const zCtx = mkCtx(zagueiro);

  const meiaAttrs = extractAttributes(meia, buildProfile('playmaker'));
  const execAttrs = extractAttributes(meia, buildProfile('conservative'));
  const zAttrs = extractAttributes(zagueiro, buildProfile('conservative'));

  const tctx = buildTeamTacticalContext(meiaCtx);
  const pstate = buildPlayerState(meiaCtx, 0.2);

  const options = [
    { id: 'pass_safe' as const },
    { id: 'pass_progressive' as const },
    { id: 'shoot' as const },
    { id: 'carry' as const },
  ];

  const creator = chooseAction('meia', meiaAttrs, 'criador', tctx, pstate, options);
  const executor = chooseAction('meia', execAttrs, 'executor', tctx, pstate, options);
  assert(
    creator.action.id !== executor.action.id || creator.top3[0]?.score !== executor.top3[0]?.score,
    'archetypes should produce different decision tendencies',
  );

  const defState = buildPlayerState({ ...zCtx, isCarrier: false, teamPhase: 'transition_def' }, 0.35);
  const midState = buildPlayerState({ ...meiaCtx, isCarrier: false, teamPhase: 'transition_def' }, 0.35);
  const defPick = chooseAction('zagueiro', zAttrs, 'executor', tctx, defState, [
    { id: 'press' },
    { id: 'cover' },
    { id: 'hold_position' },
  ]);
  const midPick = chooseAction('meia', meiaAttrs, 'criador', tctx, midState, [
    { id: 'press' },
    { id: 'cover' },
    { id: 'hold_position' },
  ]);
  assert(
    (defPick.top3.find((x) => x.id === 'cover')?.score ?? 0) >= (midPick.top3.find((x) => x.id === 'cover')?.score ?? 0),
    'zagueiro should have equal/higher defensive cover score than meia',
  );

  const zTarget = getCollectiveTarget(zagueiro, zCtx);
  const mTarget = getCollectiveTarget(meia, meiaCtx);
  assert(zTarget.prioritySet.includes('proteger_gol'), 'zagueiro collective priorities should protect goal');
  assert(mTarget.prioritySet.includes('linha_de_passe'), 'meia should prioritize passing lines');

  assert(mapRole(zagueiro) === 'zagueiro', 'slot zag1 should map to zagueiro');
  assert(mapRole(meia) === 'meia', 'slot mc1 should map to meia');

  console.log('collective-individual self-test: ok');
}

main();

