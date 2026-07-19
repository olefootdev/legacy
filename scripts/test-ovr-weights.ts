/** Invariante: todo perfil de peso do OVR soma 1.0. Se quebrar, a escala do
 *  OVR deixa de ser comparável entre posições — o bug que isso veio corrigir. */
import { OVR_WEIGHTS_BY_POS, OVR_WEIGHTS_NEUTRAL } from '../src/entities/ovrWeights';

let fail = 0;
const check = (name: string, w: Record<string, number>) => {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const ok = Math.abs(sum - 1) < 1e-9;
  if (!ok) fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(8)} soma=${sum.toFixed(4)}`);
};
console.log('Pesos do OVR por posição:');
for (const [pos, w] of Object.entries(OVR_WEIGHTS_BY_POS)) check(pos, w);
check('NEUTRO', OVR_WEIGHTS_NEUTRAL);

// O neutro TEM que ser idêntico ao peso antigo (jogador sem posição não muda).
const ANTIGO = { passe: .12, marcacao: .10, velocidade: .12, drible: .10, finalizacao: .12, fisico: .10, tatico: .12, mentalidade: .08, confianca: .08, fairPlay: .06 };
const igual = Object.entries(ANTIGO).every(([k, v]) => Math.abs((OVR_WEIGHTS_NEUTRAL as any)[k] - v) < 1e-9);
console.log(`\n  ${igual ? '✅' : '❌'} perfil neutro == fórmula antiga (compatibilidade)`);
if (!igual) fail++;

console.log(fail ? `\n❌ ${fail} falha(s)` : '\n✅ tudo certo');
process.exit(fail ? 1 : 0);
