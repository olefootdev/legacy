/**
 * Self-test da Fase B do Quick Match 2.0 — quickBeatDirector (lógica pura).
 *
 * Cobre:
 *   1. Determinismo: mesma decisão sobre os mesmos eventos → mesmo resultado
 *   2. Exploit (+w): só upgrada chutes home DO CANAL escolhido, dentro do tempo
 *   3. Trap (-w): derruba gols home do canal E pune com gols away
 *   4. Shield (away, +w): trava gols away do canal, nunca toca eventos home
 *   5. Limites: eventos de outro tempo/antes do beat ficam intactos
 *   6. Vereditos hit/neutral/miss + nota de Leitura de Jogo
 *
 * Uso: npm run test:quick-beats
 */

import {
  applyDecisionToRemainingEvents,
  computeBeatVerdicts,
  computeReadingScore,
  toDecisionRecord,
} from '../src/match/quickBeatDirector';
import type { AnalystBeat, AnalystBeatChoice, MatchPlanEvent } from '../src/match/quickPlanTypes';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function shot(minute: number, side: 'home' | 'away', channel: MatchPlanEvent['channel'], xg = 0.3): MatchPlanEvent {
  return {
    minute,
    kind: `shot_${side}` as MatchPlanEvent['kind'],
    actor_side: side,
    xg,
    weight_tier: 'normal',
    zone: 'att',
    channel,
    text: `${minute}' — chute ${side}`,
  };
}

function goal(minute: number, side: 'home' | 'away', channel: MatchPlanEvent['channel']): MatchPlanEvent {
  return {
    minute,
    kind: `goal_${side}` as MatchPlanEvent['kind'],
    actor_side: side,
    xg: 0.4,
    weight_tier: 'big',
    zone: 'att',
    channel,
    text: `${minute}' — gol ${side}`,
  };
}

const beat1: AnalystBeat = {
  id: 'beat-18',
  minute: 18,
  half: 1,
  insight: { text: 'x', primary_channel: 'corredor_esquerdo', threat_channel: 'criacao', momentum_trend: 'stable' },
  choices: [],
  window_ms: 5000,
};

const exploit: AnalystBeatChoice = {
  id: 'beat-18-exploit', label: 'Atacar pelo corredor esquerdo',
  channel: 'corredor_esquerdo', target_side: 'home', weight: 0.22,
};
const trap: AnalystBeatChoice = {
  id: 'beat-18-trap', label: 'Insistir no ataque central',
  channel: 'ataque_central', target_side: 'home', weight: -0.2,
};
const shield: AnalystBeatChoice = {
  id: 'beat-18-shield', label: 'Fechar a criação deles',
  channel: 'criacao', target_side: 'away', weight: 0.12,
};

function countKind(events: MatchPlanEvent[], kind: string, channel?: string) {
  return events.filter((e) => e.kind === kind && (channel === undefined || e.channel === channel)).length;
}

function main() {
  console.log('— Fase B: quickBeatDirector —\n');

  // Fixture: muitos eventos pra efeito estatístico ser visível num run
  const mkEvents = (): MatchPlanEvent[] => {
    const evts: MatchPlanEvent[] = [];
    for (let m = 20; m <= 44; m += 2) {
      evts.push(shot(m, 'home', 'corredor_esquerdo', 0.3));
      evts.push(shot(m, 'home', 'criacao', 0.3));
      evts.push(goal(m, 'home', 'ataque_central'));
      evts.push(shot(m, 'away', 'criacao', 0.3));
      evts.push(goal(m, 'away', 'criacao'));
    }
    // Eventos fora do alcance do beat (antes do 18' e no 2º tempo)
    evts.unshift(shot(10, 'home', 'corredor_esquerdo', 0.5));
    evts.push(shot(60, 'home', 'corredor_esquerdo', 0.5));
    return evts;
  };

  console.log('[1] Determinismo');
  const ev = mkEvents();
  const r1 = applyDecisionToRemainingEvents({ events: ev, fromIndex: 1, beat: beat1, choice: exploit, seed: 'det' });
  const r2 = applyDecisionToRemainingEvents({ events: ev, fromIndex: 1, beat: beat1, choice: exploit, seed: 'det' });
  check('mesma escolha → mesmo desfecho', JSON.stringify(r1.events) === JSON.stringify(r2.events));
  check('seed diferente → desfecho pode divergir (sanidade do rng)', (() => {
    for (let i = 0; i < 20; i += 1) {
      const alt = applyDecisionToRemainingEvents({ events: ev, fromIndex: 1, beat: beat1, choice: exploit, seed: `alt-${i}` });
      if (JSON.stringify(alt.events) !== JSON.stringify(r1.events)) return true;
    }
    return false;
  })());

  console.log('\n[2] Exploit (+w)');
  // Estatístico sobre 60 seeds: upgrades acontecem e só no canal certo
  let flips = 0;
  let wrongTouches = 0;
  for (let i = 0; i < 60; i += 1) {
    const events = mkEvents();
    const res = applyDecisionToRemainingEvents({ events, fromIndex: 1, beat: beat1, choice: exploit, seed: `s-${i}` });
    flips += res.flips;
    res.events.forEach((e, idx) => {
      const orig = events[idx]!;
      if (e === orig) return;
      const okFlip = orig.kind === 'shot_home' && orig.channel === 'corredor_esquerdo' && e.kind === 'goal_home';
      const inWindow = orig.minute >= 18 && orig.minute <= 45;
      if (!okFlip || !inWindow) wrongTouches += 1;
    });
  }
  check(`upgrades acontecem (${flips} em 60 seeds)`, flips > 0);
  check('só chutes home do canal escolhido viram gol, dentro da janela', wrongTouches === 0, `wrong=${wrongTouches}`);

  console.log('\n[3] Trap (-w)');
  let homeGoalsLost = 0;
  let awayGoalsGained = 0;
  let trapWrong = 0;
  for (let i = 0; i < 60; i += 1) {
    const events = mkEvents();
    const res = applyDecisionToRemainingEvents({ events, fromIndex: 1, beat: beat1, choice: trap, seed: `t-${i}` });
    res.events.forEach((e, idx) => {
      const orig = events[idx]!;
      if (e === orig) return;
      if (orig.kind === 'goal_home' && orig.channel === 'ataque_central' && e.kind === 'shot_home') homeGoalsLost += 1;
      else if (orig.kind === 'shot_away' && e.kind === 'goal_away') awayGoalsGained += 1;
      else trapWrong += 1;
    });
  }
  check(`armadilha derruba gols home no canal (${homeGoalsLost})`, homeGoalsLost > 0);
  check(`armadilha pune com gols away (${awayGoalsGained})`, awayGoalsGained > 0);
  check('nenhum flip fora das regras da armadilha', trapWrong === 0, `wrong=${trapWrong}`);

  console.log('\n[4] Shield (away, +w)');
  let awayGoalsBlocked = 0;
  let shieldWrong = 0;
  for (let i = 0; i < 60; i += 1) {
    const events = mkEvents();
    const res = applyDecisionToRemainingEvents({ events, fromIndex: 1, beat: beat1, choice: shield, seed: `sh-${i}` });
    res.events.forEach((e, idx) => {
      const orig = events[idx]!;
      if (e === orig) return;
      if (orig.kind === 'goal_away' && orig.channel === 'criacao' && e.kind === 'shot_away') awayGoalsBlocked += 1;
      else shieldWrong += 1;
    });
  }
  check(`escudo trava gols away do canal (${awayGoalsBlocked})`, awayGoalsBlocked > 0);
  check('escudo nunca toca eventos home', shieldWrong === 0, `wrong=${shieldWrong}`);

  console.log('\n[5] Limites de janela');
  let boundaryViolations = 0;
  for (let i = 0; i < 40; i += 1) {
    const events = mkEvents();
    const res = applyDecisionToRemainingEvents({ events, fromIndex: 1, beat: beat1, choice: exploit, seed: `b-${i}` });
    if (res.events[0] !== events[0]) boundaryViolations += 1; // 10' (antes do beat, fromIndex protege)
    const last = res.events[res.events.length - 1]!;
    if (last !== events[events.length - 1]) boundaryViolations += 1; // 60' (2º tempo, beat half=1)
  }
  check('eventos antes do beat e do outro tempo ficam intactos', boundaryViolations === 0, `violations=${boundaryViolations}`);

  console.log('\n[6] Vereditos + Leitura de Jogo');
  const played: MatchPlanEvent[] = [
    goal(30, 'home', 'corredor_esquerdo'),
    shot(38, 'home', 'criacao'),
    goal(70, 'away', 'bola_parada'),
  ];
  const ledger = [
    toDecisionRecord(beat1, exploit), // hit: gol home no canal depois do 18'
    toDecisionRecord({ ...beat1, id: 'beat-35', minute: 35 }, { ...shield, id: 'b35-shield' }), // hit: sem gol away na criacao depois
    toDecisionRecord({ ...beat1, id: 'beat-58', minute: 58, half: 2 }, { ...trap, id: 'b58-trap' }), // miss: armadilha
    toDecisionRecord({ ...beat1, id: 'beat-78', minute: 78, half: 2 }, { ...exploit, id: 'b78-exploit', channel: 'criacao' as const }), // miss: nada na criacao depois do 78'
  ];
  const verdicts = computeBeatVerdicts(played, ledger);
  check('vereditos: hit/hit/miss/miss', JSON.stringify(verdicts.map((v) => v.kind)) === JSON.stringify(['hit', 'hit', 'miss', 'miss']),
    JSON.stringify(verdicts.map((v) => v.kind)));
  const neutral = computeBeatVerdicts([shot(40, 'home', 'corredor_esquerdo')], [toDecisionRecord(beat1, exploit)]);
  check('chegou sem gol → neutral', neutral[0]?.kind === 'neutral');
  const reading = computeReadingScore(ledger, 4);
  check('Leitura de Jogo 3/4 (3 escolhas com peso positivo)', reading.good === 3 && reading.total === 4,
    JSON.stringify(reading));

  console.log(failures === 0 ? '\n✅ Fase B OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
