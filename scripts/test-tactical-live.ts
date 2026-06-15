/**
 * test-tactical-live.ts — valida a mecânica de ESTILO AO VIVO.
 *
 * Roda: npm run test:tactical-live
 *
 * Garante a regra pedida pelo produto:
 *   • estilo CERTO pro momento → mais GOL da casa + blinda ameaça
 *   • estilo ERRADO pro momento → mais gol SOFRIDO + gol perdido
 *   • idealStyle lê placar/minuto/momento · fit ordena defesa↔ataque
 *   • nudgeMomentumCurve move a barra na direção do estilo
 */

import {
  idealStyle,
  styleFit,
  styleMomentumBias,
  nudgeMomentumCurve,
  resolveStyleOnEvent,
  resolveFormationOnEvent,
  type LiveMatchState,
} from '../src/match/quickTacticalLive';
import type { MatchPlanEvent } from '../src/match/quickPlanTypes';
import type { TacticalIntensityLevel } from '../src/match/quickTacticalIntensity';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { pass += 1; console.log(`  ✓ ${msg}`); }
  else { fail += 1; console.log(`  ✗ ${msg}`); }
}

function ev(kind: MatchPlanEvent['kind'], xg = 0.14): MatchPlanEvent {
  return { minute: 80, kind, weight_tier: 'normal', text: '', xg } as MatchPlanEvent;
}

/** Conta flips ao rodar N eventos (variando o índice → distribuição). */
function countFlips(kind: MatchPlanEvent['kind'], chosen: TacticalIntensityLevel, state: LiveMatchState, n = 600) {
  const tally: Record<string, number> = { home_goal: 0, shield: 0, home_miss: 0, away_goal: 0, none: 0 };
  for (let i = 0; i < n; i += 1) {
    const r = resolveStyleOnEvent({ event: ev(kind), chosen, state, seed: 'test-seed', index: i });
    tally[r.flip ?? 'none'] += 1;
  }
  return tally;
}

console.log('\n[1] idealStyle lê o contexto');
ok(idealStyle({ scoreDiff: -1, minute: 80, momentum: 45 }) === 'attack', 'perdendo no fim → Ataque');
ok(idealStyle({ scoreDiff: -1, minute: 30, momentum: 50 }) === 'press', 'perdendo cedo → Pressão');
ok(idealStyle({ scoreDiff: 2, minute: 82, momentum: 50 }) === 'defend', 'ganhando por 2 no fim → Retranca');
ok(idealStyle({ scoreDiff: 1, minute: 40, momentum: 60 }) === 'possession', 'ganhando por 1, no controle → Posse');
ok(idealStyle({ scoreDiff: 0, minute: 30, momentum: 70 }) === 'press', 'empate dominando cedo → Pressão');
ok(idealStyle({ scoreDiff: 0, minute: 30, momentum: 30 }) === 'counter', 'empate sufocado → Contra');

console.log('\n[2] styleFit ordena defesa↔ataque');
const losingLate: LiveMatchState = { scoreDiff: -1, minute: 80, momentum: 45 };
ok(styleFit('attack', losingLate) === 1, 'Ataque perdendo no fim = +1 (perfeito)');
ok(styleFit('defend', losingLate) === -1, 'Retranca perdendo no fim = -1 (oposto)');
ok(styleFit('press', losingLate) > 0 && styleFit('press', losingLate) < 1, 'Pressão = parcial (perto do ideal)');

console.log('\n[3] estilo CERTO converte chance da casa em gol');
const smartHome = countFlips('shot_home', 'attack', losingLate);
const wrongHome = countFlips('shot_home', 'defend', losingLate);
console.log(`    Ataque(certo): ${smartHome.home_goal} gols  ·  Retranca(errado): ${wrongHome.home_goal} gols`);
ok(smartHome.home_goal > 60, 'estilo certo converte uma fatia relevante das chances');
ok(smartHome.home_goal > wrongHome.home_goal, 'estilo certo faz MAIS gol que o errado');

console.log('\n[4] estilo ERRADO faz o time SOFRER gol');
const wrongConcede = countFlips('shot_away', 'defend', losingLate);
const smartConcede = countFlips('shot_away', 'attack', losingLate);
console.log(`    Retranca(errado): ${wrongConcede.away_goal} sofridos  ·  Ataque(certo): ${smartConcede.away_goal} sofridos`);
ok(wrongConcede.away_goal > 50, 'estilo errado transforma ameaça em gol sofrido');
ok(wrongConcede.away_goal > smartConcede.away_goal, 'estilo errado sofre MAIS que o certo');

console.log('\n[5] ameaça real: estilo certo BLINDA, errado vira gol');
const shieldSmart = countFlips('chance_away', 'attack', losingLate);
const shieldWrong = countFlips('chance_away', 'defend', losingLate);
console.log(`    Certo: ${shieldSmart.shield} blindagens  ·  Errado: ${shieldWrong.away_goal} gols sofridos`);
ok(shieldSmart.shield > 0, 'estilo certo blinda parte das ameaças reais');
ok(shieldWrong.away_goal > 0, 'estilo errado deixa a ameaça virar gol');

console.log('\n[6] estilo NEUTRO (fit ~0) não mexe no placar');
ok(styleFit('possession', losingLate) === 0, 'Posse perdendo no fim = 0 (escolha morna)');
const neutral = countFlips('shot_home', 'possession', losingLate);
ok(neutral.home_goal === 0 && neutral.away_goal === 0, 'fit ~0 não força gol nem sofrido');

console.log('\n[7] nudgeMomentumCurve move a barra na direção do estilo');
const flat = new Array(90).fill(50);
const pushed = nudgeMomentumCurve(flat, 60, styleMomentumBias('attack'));
const parked = nudgeMomentumCurve(flat, 60, styleMomentumBias('defend'));
ok(pushed[61]! > 50, 'Ataque empurra o momento pra cima');
ok(parked[61]! < 50, 'Retranca puxa o momento pra baixo');
ok(pushed[88]! === 50 || Math.abs(pushed[88]! - 50) < Math.abs(pushed[61]! - 50), 'efeito decai com o tempo');

console.log('\n[8] formação muda o jogo de verdade');
function countForm(kind: MatchPlanEvent['kind'], formation: string, n = 600) {
  let goals = 0, away = 0, shields = 0;
  for (let i = 0; i < n; i += 1) {
    const r = resolveFormationOnEvent({ event: ev(kind), formation, seed: 'test-seed', index: i });
    if (r?.kind === 'goal_home') goals += 1;
    if (r?.kind === 'goal_away') away += 1;
    if (r?.kind === 'shot_away') shields += 1;
  }
  return { goals, away, shields };
}
ok(countForm('shot_home', '3-4-3').goals > 30, 'formação ofensiva (3-4-3) converte mais chance da casa');
ok(countForm('shot_home', '4-4-2').goals === 0, 'formação neutra (4-4-2) não força gol');
ok(countForm('shot_away', '3-4-3').away > 0, 'formação ofensiva expõe a defesa (sofre mais)');
ok(countForm('chance_away', '5-3-2').shields > 0, 'formação defensiva (5-3-2) blinda a ameaça');

console.log(`\n${fail === 0 ? '✅ OK' : '❌ FALHOU'} — Estilo ao vivo: ${pass} checks, ${fail} falhas\n`);
if (fail > 0) process.exit(1);
