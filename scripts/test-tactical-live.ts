/**
 * test-tactical-live.ts — o estilo de jogo AO VIVO depois de UMA VERDADE SÓ.
 *
 * Roda: npm run test:tactical-live
 *
 * O que fica no aparelho é LEITURA e SENSAÇÃO; o resultado vem do servidor:
 *   • idealStyle lê placar/minuto/momento (usado pelo técnico da Legends Cup)
 *   • nudgeMomentumCurve move a barra na direção do estilo (só tela)
 *   • o módulo NÃO exporta mais nenhuma virada de resultado
 *   • o estilo chega ao motor como comando (comandos_ao_vivo.py) — conferido
 *     pelo test:uma-verdade e pelo test_cadeia_lances.py
 */

import * as vivo from '../src/match/quickTacticalLive';
import { idealStyle, styleMomentumBias, nudgeMomentumCurve } from '../src/match/quickTacticalLive';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { pass += 1; console.log(`  ✓ ${msg}`); }
  else { fail += 1; console.log(`  ✗ ${msg}`); }
}

console.log('\n[1] idealStyle lê o contexto');
ok(idealStyle({ scoreDiff: -1, minute: 80, momentum: 45 }) === 'attack', 'perdendo no fim → Ataque');
ok(idealStyle({ scoreDiff: -1, minute: 30, momentum: 50 }) === 'press', 'perdendo cedo → Pressão');
ok(idealStyle({ scoreDiff: 2, minute: 82, momentum: 50 }) === 'defend', 'ganhando por 2 no fim → Retranca');
ok(idealStyle({ scoreDiff: 1, minute: 40, momentum: 60 }) === 'possession', 'ganhando por 1, no controle → Posse');
ok(idealStyle({ scoreDiff: 0, minute: 30, momentum: 70 }) === 'press', 'empate dominando cedo → Pressão');
ok(idealStyle({ scoreDiff: 0, minute: 30, momentum: 30 }) === 'counter', 'empate sufocado → Contra');

console.log('\n[2] nudgeMomentumCurve move a barra na direção do estilo (só tela)');
const flat = new Array(90).fill(50);
const pushed = nudgeMomentumCurve(flat, 60, styleMomentumBias('attack'));
const parked = nudgeMomentumCurve(flat, 60, styleMomentumBias('defend'));
ok(pushed[61]! > 50, 'Ataque empurra o momento pra cima');
ok(parked[61]! < 50, 'Retranca puxa o momento pra baixo');
ok(pushed[88]! === 50 || Math.abs(pushed[88]! - 50) < Math.abs(pushed[61]! - 50), 'efeito decai com o tempo');
ok(nudgeMomentumCurve(flat, 60, 0) === flat, 'sem viés, a curva volta intacta');

console.log('\n[3] nenhuma virada de resultado no aparelho');
const proibidos = ['resolveStyleOnEvent', 'resolveLegacyBoost', 'resolveFormationOnEvent', 'styleFit'];
for (const nome of proibidos) ok(!(nome in vivo), `o módulo não exporta ${nome}`);

console.log(`\n${fail === 0 ? '✅ OK' : '❌ FALHOU'} — Estilo ao vivo: ${pass} checks, ${fail} falhas\n`);
if (fail > 0) process.exit(1);
