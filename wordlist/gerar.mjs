// Gera a wordlist final da carteira OLEFOOT.
//
// Regras do BIP39 que isto garante, e nenhuma delas é opcional:
//   · exatamente 2048 palavras (11 bits por palavra)
//   · as 4 primeiras letras são ÚNICAS (é o que permite recuperar digitando o começo)
//   · só a-z, 4 a 8 letras, sem duplicata
//   · NENHUM par difere por uma letra só — a regra que os 4 prefixos NÃO pegam.
//     É o "woman/women" do BIP39: quem anota `bar` e lê `ban` perde o dinheiro.
//     Sem ela a lista tinha 300 pares confundíveis (bag/ban/bar, area/arena).
//   · ordenadas alfabeticamente (busca binária na recuperação)
//
// Quando sobra palavra, o corte NÃO é aleatório: cada categoria do vocabulário
// declara prioridade com `#! alta|media|baixa`. Sai primeiro o que é genérico
// (as listas de preenchimento por letra), nunca o léxico do futebol.
import { readFileSync, writeFileSync } from 'node:fs';

const META = 2048;
const linhas = readFileSync(process.argv[2], 'utf8').split('\n');

let prioridade = 'alta';
const candidatas = [];
for (const linha of linhas) {
  const t = linha.trim();
  if (t.startsWith('#')) {
    const m = t.match(/#!\s*(alta|media|baixa)/);
    if (m) prioridade = m[1];
    else if (t.startsWith('# LETRAS MAGRAS')) prioridade = 'baixa';
    else prioridade = 'alta';
    continue;
  }
  for (const p of t.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
    candidatas.push({ p, prioridade });
  }
}

const PESO = { alta: 0, media: 1, baixa: 2 };
const difereDeUmaLetra = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false;
    return d === 1;
  }
  const [curta, longa] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i <= curta.length; i++) {
    if (curta.slice(0, i) + longa[i] + curta.slice(i) === longa) return true;
  }
  return false;
};

const vistas = new Set(); const porPrefixo = new Map(); const aceitas = [];
for (const c of candidatas) {
  if (!/^[a-z]{4,8}$/.test(c.p)) continue;
  if (vistas.has(c.p)) continue;
  if (porPrefixo.has(c.p.slice(0, 4))) continue;
  if (aceitas.some((q) => difereDeUmaLetra(c.p, q.p))) continue;
  vistas.add(c.p); porPrefixo.set(c.p.slice(0, 4), c.p); aceitas.push(c);
}

console.log(`candidatas ......... ${candidatas.length}`);
console.log(`passaram nas regras  ${aceitas.length}`);
const porPrio = {};
for (const a of aceitas) porPrio[a.prioridade] = (porPrio[a.prioridade] ?? 0) + 1;
console.log(`  alta ${porPrio.alta ?? 0} · media ${porPrio.media ?? 0} · baixa ${porPrio.baixa ?? 0}`);

if (aceitas.length < META) {
  console.log(`\n❌ faltam ${META - aceitas.length}. Não escrevi nada.`);
  process.exit(1);
}

// Corta o excedente pelas de MENOR prioridade, as últimas da fila primeiro.
const ordemDeCorte = [...aceitas].sort((a, b) => PESO[b.prioridade] - PESO[a.prioridade]);
const cortar = new Set(ordemDeCorte.slice(0, aceitas.length - META).map((c) => c.p));
const finais = aceitas.filter((c) => !cortar.has(c.p)).map((c) => c.p).sort();

if (finais.length !== META) { console.log(`❌ deu ${finais.length}`); process.exit(1); }
const prefixos = new Set(finais.map((p) => p.slice(0, 4)));
if (prefixos.size !== META) { console.log(`❌ prefixo repetido`); process.exit(1); }

writeFileSync(process.argv[3], finais.join('\n') + '\n');
console.log(`\ncortadas ........... ${cortar.size} (as mais genéricas)`);
console.log(`✅ ${finais.length} palavras · ${prefixos.size} prefixos únicos · ordenadas`);
console.log(`   ${finais[0]} … ${finais[META - 1]}`);
