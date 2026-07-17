/**
 * Self-test da regra de marcos da rede.
 *
 * Trava a decisão do fundador (2026-07-17) em teste, incluindo o exemplo que ele
 * deu e a exceção do marco 1. A contagem em si (CTE recursivo) vive no SQL da
 * migration 20260717120000 — aqui garantimos que a RÉGUA não muda sem alguém
 * perceber.
 *
 * Roda: npm run test:network-milestones
 */
import {
  NETWORK_MILESTONES,
  MILESTONE_LEGS_COUNTED,
  MIN_LEGS_CAREER_PLAN,
  isMilestoneReached,
  progressForMilestone,
  nextMilestone,
} from './milestones.js';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

/** Espelha a regra do servidor: soma das N maiores pernas. */
function qualifyingFromLegs(legSizes: number[]): number {
  return [...legSizes]
    .sort((a, b) => b - a)
    .slice(0, MILESTONE_LEGS_COUNTED)
    .reduce((s, n) => s + n, 0);
}

console.log('\n🌐 Marcos da rede — regra do fundador\n');

// ── O exemplo do fundador: A=10, B=50, C=5 → conta só A+B = 60
const exemplo = qualifyingFromLegs([10, 50, 5]);
check('exemplo do fundador (A=10,B=50,C=5) => 60', exemplo === 60, `veio ${exemplo}`);
check('a menor perna (C=5) é ignorada', exemplo === 60 && exemplo !== 65);

// ── Só as 2 maiores contam, mesmo com muitas pernas
check('4 pernas: só as 2 maiores', qualifyingFromLegs([3, 40, 7, 30]) === 70);
check('1 perna só: soma ela mesma', qualifyingFromLegs([12]) === 12);
check('sem perna: 0', qualifyingFromLegs([]) === 0);

// ── Escada
const targets = NETWORK_MILESTONES.map((m) => m.target);
check('marcos são 1/10/25/50/100', JSON.stringify(targets) === '[1,10,25,50,100]', JSON.stringify(targets));
const exps = NETWORK_MILESTONES.map((m) => m.exp);
check(
  'prêmios 200k/1M/3M/8M/25M',
  JSON.stringify(exps) === '[200000,1000000,3000000,8000000,25000000]',
  JSON.stringify(exps),
);
check('prêmio sempre cresce', exps.every((v, i) => i === 0 || v > exps[i - 1]!));
// O topo rompe o ×100 de propósito (seria 20M) — trava pra ninguém "corrigir".
check('marco de 100 é 25M, não 20M', exps[4] === 25_000_000, String(exps[4]));

// ── EXCEÇÃO DO MARCO 1: a perna não conta o direto, então 1 direto sem rede
//    daria 0 qualificados. O marco 1 olha diretos ativos.
const umDiretoSemRede = { directsActive: 1, qualifyingCount: 0 };
check('1 direto ativo sem rede ATINGE o marco 1', isMilestoneReached(1, umDiretoSemRede));
check('...e NÃO atinge o marco 10', !isMilestoneReached(10, umDiretoSemRede));
check('marco 1 usa diretos, não qualificados', progressForMilestone(1, umDiretoSemRede) === 1);
check('marco 10 usa qualificados', progressForMilestone(10, { directsActive: 30, qualifyingCount: 4 }) === 4);

// ── Direto inativo não conta
const diretoInativo = { directsActive: 0, qualifyingCount: 0 };
check('direto que nunca jogou não atinge o marco 1', !isMilestoneReached(1, diretoInativo));

// ── Marcos altos pela soma das 2 maiores
const rede60 = { directsActive: 3, qualifyingCount: exemplo };
check('60 qualificados atinge 50', isMilestoneReached(50, rede60));
check('60 qualificados NÃO atinge 100', !isMilestoneReached(100, rede60));
check('próximo marco de quem tem 60 é o 100', nextMilestone(rede60)?.target === 100, String(nextMilestone(rede60)?.target));
check('escada completa => próximo é null', nextMilestone({ directsActive: 200, qualifyingCount: 200 }) === null);

// ── Regra futura registrada
check('regra futura: carreira exige 4 pernas (equipe D)', MIN_LEGS_CAREER_PLAN === 4);
check('marcos contam 2 equipes', MILESTONE_LEGS_COUNTED === 2);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
