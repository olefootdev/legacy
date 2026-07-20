/** Self-test do LEGENDS CUP: máquina de fases, elencos e treinador máquina.
 *  Roda: npm run test:legends-cup */
import {
  createLegendsCupState, applyMatchResult, roundOf, isFinalRound,
  LEGENDS_CUP_ROUNDS, LEGENDS_CUP_SQUADS, GROUP_MATCHES, GROUP_WINS_TO_ADVANCE,
} from '../src/match/legendsCup/legendsCupModel';
import { aggressionFromSquad, coachTicks, canSub, MAX_BOT_SUBS } from '../src/match/legendsCup/legendsCupCoach';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${d}`); }
};

console.log('\n🏆 LEGENDS CUP — estrutura\n');

// ── classificatória ──
let s = createLegendsCupState('seed-1');
check('campanha começa na Classificatória', roundOf(s.roundIndex) === 'Classificatória');
s = applyMatchResult(s, true);
s = applyMatchResult(s, true);
check(`2 vitórias em ${GROUP_MATCHES} avançam pro Playoff`, roundOf(s.roundIndex) === 'Playoff' && s.status === 'active');

let e = createLegendsCupState('seed-2');
e = applyMatchResult(e, false);
e = applyMatchResult(e, false);
check('2 derrotas na classificatória eliminam', e.status === 'eliminated');

let m = createLegendsCupState('seed-3');
m = applyMatchResult(m, false);
m = applyMatchResult(m, true);
m = applyMatchResult(m, true);
check('perder a 1ª e vencer as 2 seguintes avança', roundOf(m.roundIndex) === 'Playoff' && m.status === 'active');

// ── mata-mata ──
let k = createLegendsCupState('seed-4');
k = applyMatchResult(k, true); k = applyMatchResult(k, true); // passa fase de grupo
const antes = k.roundIndex;
k = applyMatchResult(k, false);
check('derrota no mata-mata elimina na hora', k.status === 'eliminated' && k.roundIndex === antes);

let champ = createLegendsCupState('seed-5');
champ = applyMatchResult(champ, true); champ = applyMatchResult(champ, true);
for (let i = 0; i < LEGENDS_CUP_ROUNDS.length - 1; i++) champ = applyMatchResult(champ, true);
check('vencer todas torna CAMPEÃO', champ.status === 'champion', `status=${champ.status}`);
check('campeão fica registrado na Final', champ.reachedRound === 'Final');

const finished = applyMatchResult(champ, false);
check('campanha encerrada ignora novos resultados', finished.status === 'champion');

// ── elencos ──
console.log('\n  elencos por fase:');
for (const r of LEGENDS_CUP_ROUNDS) {
  const sq = LEGENDS_CUP_SQUADS[r];
  console.log(`    ${r.padEnd(16)} ${sq ? sq.length + ' lendas' : 'só Genesis'}`);
}
const cresce = LEGENDS_CUP_ROUNDS.slice(1).map((r) => LEGENDS_CUP_SQUADS[r]!.length);
check('nº de lendas nunca diminui de fase pra fase', cresce.every((n, i) => i === 0 || n >= cresce[i - 1]! - 0), cresce.join('→'));
check('Final tem o maior elenco', LEGENDS_CUP_SQUADS['Final']!.length === Math.max(...cresce));
check('Final inclui o Palhinha', LEGENDS_CUP_SQUADS['Final']!.includes('mem-palhinha-2026'));
check('Classificatória não tem lenda', LEGENDS_CUP_SQUADS['Classificatória'] === null);
check('isFinalRound só na última', isFinalRound(LEGENDS_CUP_ROUNDS.length - 1) && !isFinalRound(0));

// ── treinador máquina ──
console.log('\n  treinador máquina:');
const ticks = coachTicks(90);
check(`reavalia ${ticks.length}× por partida (${ticks.join("', ")}')`, ticks.length >= 4);
check(`limite de ${MAX_BOT_SUBS} substituições respeitado`, canSub(0) && canSub(1) && !canSub(2));

const conservador = [{ agentProfile: { riskProfile: { baseRisk: 40 } } }] as never[];
const ousado = [{ agentProfile: { riskProfile: { baseRisk: 76 } } }] as never[];
const semPerfil = [{}] as never[];
check('elenco conservador → agressividade negativa', aggressionFromSquad(conservador) < 0);
check('elenco ousado → agressividade positiva', aggressionFromSquad(ousado) > 0);
check('elenco sem agentProfile → neutro', aggressionFromSquad(semPerfil) === 0);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
