/**
 * Self-test da Fase B do Quick Match 2.0 — quickBeatDirector (lógica pura).
 *
 * UMA VERDADE SÓ (Fase 0): a decisão do Analista NÃO muda lance nenhum no
 * aparelho (o antigo applyDecisionToRemainingEvents saiu) — ela vira peso no
 * replan do servidor. O que fica aqui:
 *   1. toDecisionRecord ecoa canal/lado/peso do beat
 *   2. buildLiveAnalystBeat: 3 opções (positiva/neutra/negativa), ordem embaralhada e estável
 *   3. Vereditos hit/neutral/miss + nota de Leitura de Jogo
 *
 * Uso: npm run test:quick-beats
 */

import {
  buildLiveAnalystBeat,
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
  return { minute, kind: `shot_${side}` as MatchPlanEvent['kind'], actor_side: side, xg, weight_tier: 'normal', zone: 'att', channel, text: `${minute}' — chute ${side}` };
}

function goal(minute: number, side: 'home' | 'away', channel: MatchPlanEvent['channel']): MatchPlanEvent {
  return { minute, kind: `goal_${side}` as MatchPlanEvent['kind'], actor_side: side, xg: 0.4, weight_tier: 'big', zone: 'att', channel, text: `${minute}' — gol ${side}` };
}

const beat1: AnalystBeat = {
  id: 'beat-18',
  minute: 18,
  half: 1,
  insight: { text: 'x', primary_channel: 'corredor_esquerdo', threat_channel: 'criacao', momentum_trend: 'stable' },
  choices: [],
  window_ms: 5000,
};

const exploit: AnalystBeatChoice = { id: 'beat-18-exploit', label: 'Atacar pelo corredor esquerdo', channel: 'corredor_esquerdo', target_side: 'home', weight: 0.22 };
const trap: AnalystBeatChoice = { id: 'beat-18-trap', label: 'Insistir no ataque central', channel: 'ataque_central', target_side: 'home', weight: -0.2 };
const shield: AnalystBeatChoice = { id: 'beat-18-shield', label: 'Fechar a criação deles', channel: 'criacao', target_side: 'away', weight: 0.12 };

function main() {
  console.log('— Fase B: quickBeatDirector —\n');

  console.log('[1] toDecisionRecord');
  const rec = toDecisionRecord(beat1, exploit);
  check('ecoa beat, escolha, minuto, tempo, canal, lado e peso', rec.beat_id === 'beat-18' && rec.choice_id === exploit.id && rec.minute === 18 && rec.half === 1
    && rec.channel === 'corredor_esquerdo' && rec.target_side === 'home' && rec.weight === 0.22);

  console.log('\n[2] buildLiveAnalystBeat');
  const args = {
    beatId: 'b-30', minute: 30, index: 1, homeScore: 0, awayScore: 1, momentum: 40,
    homeStats: [{ id: 'h9', side: 'home' as const, goals: 0, shots: 2 }], homeNameById: { h9: 'Pedro Silva' },
    awayPlayers: [{ pos: 'LD', fatigue: 60 }, { pos: 'LE', fatigue: 20 }],
  };
  const b = buildLiveAnalystBeat(args);
  const efeitos = b.choices.map((c) => c.effect).sort();
  check('3 opções: positiva, neutra e negativa', JSON.stringify(efeitos) === JSON.stringify(['negative', 'neutral', 'positive']));
  check('perdendo e sob pressão → situação de defesa', b.intent === 'defend');
  check('pesos: +0,25 / 0 / −0,25 (o motor aplica no replan)', b.choices.every((c) => c.weight === (c.effect === 'positive' ? 0.25 : c.effect === 'negative' ? -0.25 : 0)));
  check('ordem estável (mesma entrada, mesma ordem)', JSON.stringify(buildLiveAnalystBeat(args).choices.map((c) => c.id)) === JSON.stringify(b.choices.map((c) => c.id)));
  const atk = buildLiveAnalystBeat({ ...args, homeScore: 2, awayScore: 0, momentum: 65, index: 3 });
  check('dominando → situação de ataque, com o craque nomeado', atk.intent === 'attack' && /Pedro/.test(atk.insight.text + atk.choices.map((c) => c.label).join(' ')));

  console.log('\n[3] Vereditos + Leitura de Jogo');
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
  check('Leitura de Jogo 3/4 (3 escolhas com peso positivo)', reading.good === 3 && reading.total === 4, JSON.stringify(reading));

  console.log(failures === 0 ? '\n✅ Fase B OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
