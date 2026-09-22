// Confere o ARQUIVO FINAL do zero, sem confiar no gerador.
// Inclui a checagem que a regra dos 4 prefixos NÃO pega: pares que diferem
// por uma letra só (o "woman/women" do BIP39), que confundem na hora de anotar.
import { readFileSync } from 'node:fs';
const ps = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
const falhas = [];
if (ps.length !== 2048) falhas.push(`são ${ps.length}, não 2048`);
if (ps.some((p) => !/^[a-z]{3,8}$/.test(p))) falhas.push('há palavra fora de [a-z]{3,8}');
if (new Set(ps).size !== ps.length) falhas.push('há duplicata');
if (new Set(ps.map((p) => p.slice(0, 4))).size !== ps.length) falhas.push('há prefixo repetido');
if (ps.join('\n') !== [...ps].sort().join('\n')) falhas.push('não está ordenada');

// distância 1: substituição, inserção ou remoção de uma letra
const dist1 = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) return a.split('').filter((c, i) => c !== b[i]).length === 1;
  const [c, d] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i <= c.length; i++) if (c.slice(0, i) + d[i] + c.slice(i) === d) return true;
  return false;
};
const confusos = [];
for (let i = 0; i < ps.length; i++) {
  for (let j = i + 1; j < ps.length && ps[j][0] <= ps[i][0]; j++) {
    if (dist1(ps[i], ps[j])) confusos.push(`${ps[i]}/${ps[j]}`);
  }
}
console.log(falhas.length ? `❌ ${falhas.join(' · ')}` : '✅ 2048 · a-z 3-8 · sem duplicata · prefixos únicos · ordenada');
console.log(`pares que diferem por 1 letra: ${confusos.length}${confusos.length ? ' → ' + confusos.slice(0, 12).join('  ') : ''}`);
console.log(`\namostra: ${ps.slice(0, 6).join(' ')} … ${ps.slice(1020, 1026).join(' ')} … ${ps.slice(-6).join(' ')}`);
