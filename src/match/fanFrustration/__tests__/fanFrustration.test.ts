import assert from 'node:assert';
import FanFrustrationSystem, { FrustrationRulesRegistry } from '../FanFrustrationSystem';

function makeStateWithPlayer(actionKey: string, role: string) {
  const id = 'p1';
  return {
    players: {
      [id]: {
        id,
        name: 'Test',
        pos: role,
        zone: 'meio',
        behavior: 'equilibrado',
        attrs: {
          passe: 60,
          marcacao: 60,
          velocidade: 60,
          drible: 60,
          finalizacao: 60,
          fisico: 60,
          tatico: 60,
          mentalidade: 60,
          confianca: 60,
          fairPlay: 60,
        },
        fatigue: 100,
        _lastAction: actionKey,
      },
    },
  } as any;
}

function runTest(ruleId: string, state: any, expectedPenalty: number) {
  const rules = FrustrationRulesRegistry.filter((r) => r.id === ruleId);
  assert(rules.length === 1, 'rule present');
  const sys = new FanFrustrationSystem(rules);
  const evs = sys.evaluate(state);
  assert(evs.length === 1, 'one event');
  assert(evs[0].penalidade === -Math.abs(expectedPenalty), 'penalty matches');
}

// Top 5 rules: ATACANTE_PASSA..., ATACANTE_RECUA..., PONTA_RECUA_1x1, GOLEIRO_CERA, LATERAL_NAO_AVANCA
(async function tests() {
  // 1
  runTest('ATACANTE_PASSA_EM_POSICAO_GOL', makeStateWithPlayer('PASS_IN_GOOD_SPOT', 'atacante'), 25);
  // 2
  runTest('ATACANTE_RECUA_PARA_GOLEIRO', makeStateWithPlayer('PASS_TO_KEEPER_IN_SHOT_RANGE', 'atacante'), 15);
  // 3
  runTest('PONTA_RECUA_1x1', makeStateWithPlayer('RECUAR_ON_1V1', 'ponta'), 12);
  // 4 - goalkeeper cera requires teamHasSmallLead and _secondsStopped
  const g = makeStateWithPlayer('', 'goleiro');
  g.players.p1._secondsStopped = 6;
  g.teamHasSmallLead = true;
  runTest('GOLEIRO_CERA', g, 10);
  // 5 - lateral nao avanca
  const lat = makeStateWithPlayer('', 'lateral');
  lat.players.p1._timeInAttackWithoutCrossMidline = 16;
  lat.players.p1._posX = 10;
  lat._midlineX = 50;
  runTest('LATERAL_NAO_AVANCA', lat, 8);

  console.log('FanFrustrationSystem tests passed');
})();
