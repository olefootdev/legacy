/**
 * Calibração e prova do DNA na Liga Global (Fase 0 da "Fundação do Clube").
 * Mesma régua do `smartfield/test_dna.py`: neutro = ×1 exato; cada eixo mexe
 * pro lado certo; e perfis reais de técnico não viram atalho de vitória.
 * Rodar: npm run test:liga-dna
 */
import { readDna, dnaLambdaMults, dnaCardMult, DNA_EIXOS, type Dna } from '../supabase/functions/global-league-tick/_dnaModel';
import { dnaDaIdentidade, dnaParaMotor } from '../src/club/identidade';

let falhas = 0;
const checa = (nome: string, ok: boolean, det = '') => {
  console.log(`${ok ? '  OK  ' : '  FALHA '}${nome}${det ? `  ${det}` : ''}`);
  if (!ok) falhas++;
};

// RNG determinístico (mulberry32) — o teste não pode oscilar.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(l: number, r: () => number) {
  const L = Math.exp(-l); let k = 0; let p = 1;
  do { k++; p *= r(); } while (p > L && k < 8);
  return k - 1;
}
const neutro = (): Record<string, number> => Object.fromEntries(DNA_EIXOS.map((k) => [k, 0.5]));
const com = (o: Record<string, number>) => ({ ...neutro(), ...o });

/** N jogos de liga, OVR iguais (+3 de mando, como no tick). */
function temporada(home: Dna | null, away: Dna | null, n = 20000) {
  const r = rng(7);
  const diff = 3;
  const m = dnaLambdaMults(home, away);
  let v = 0, e = 0, gp = 0, gc = 0;
  for (let i = 0; i < n; i++) {
    const h = poisson(Math.max(0.2, 1.4 + diff / 16) * m.home, r);
    const a = poisson(Math.max(0.2, 1.4 - diff / 16) * m.away, r);
    gp += h; gc += a; if (h > a) v++; else if (h === a) e++;
  }
  return { vit: v / n, emp: e / n, gp: gp / n, gc: gc / n };
}

console.log('1) Neutro = placar de sempre');
const mN = dnaLambdaMults(null, null);
checa('sem DNA: λ ×1 nos dois lados', mN.home === 1 && mN.away === 1);
const mN2 = dnaLambdaMults(readDna(neutro()), readDna(neutro()));
checa('DNA neutro: λ ×1 nos dois lados', mN2.home === 1 && mN2.away === 1);
checa('sem DNA: cartão ×1', dnaCardMult(null).yellow === 1 && dnaCardMult(null).red === 1);
const alto = readDna(Object.fromEntries(DNA_EIXOS.map((k) => [k, 0.9])));
checa('orçamento: tudo em 0.9 vira neutro', !!alto && DNA_EIXOS.every((k) => Math.abs(alto[k] - 0.5) < 1e-9));
checa('lixo no payload = sem DNA', readDna('x') === null && readDna(null) === null);

console.log('2) Direção');
const base = temporada(null, null);
const t = (o: Record<string, number>) => temporada(readDna(com(o)), null);
checa('vertical → mais gols feitos', t({ vertical: 0.9 }).gp > t({ vertical: 0.1 }).gp);
checa('solidez → menos gols sofridos', t({ solidez: 0.9 }).gc < t({ solidez: 0.1 }).gc);
checa('disciplina → menos cartão', dnaCardMult(readDna(com({ disciplina: 0.9 }))).yellow < dnaCardMult(readDna(com({ disciplina: 0.1 }))).yellow);
checa('pressão → mais cartão', dnaCardMult(readDna(com({ pressao: 0.9 }))).yellow > dnaCardMult(readDna(com({ pressao: 0.1 }))).yellow);

console.log('3) Equilíbrio (perfis reais de técnico × time sem DNA)');
// Perfis reais montados pelo mesmo cálculo da fundação (`dnaDaIdentidade`).
const P = (tatico: number, fairplay: number, criativo: number, ataque: number, defesa: number, mentalidade: number) =>
  ({ tatico, fairplay, criativo, ataque, defesa, mentalidade });
const IDS: Record<string, Parameters<typeof dnaDaIdentidade>[0]> = {
  equilibrado: { pontos: P(15, 15, 20, 15, 20, 15), estilo: 'posse', tecnico: null, historico: null, treino: 'flexivel' },
  guardiola: { pontos: P(25, 10, 25, 15, 10, 15), estilo: 'posse', tecnico: 'guardiola', historico: { time: 'barcelona', temporada: '2010–11' }, treino: 'flexivel' },
  klopp: { pontos: P(10, 10, 15, 25, 15, 25), estilo: 'pressao', tecnico: 'klopp', historico: { time: 'liverpool', temporada: '2019–20' }, treino: 'rigido' },
  mourinho: { pontos: P(25, 15, 5, 15, 30, 10), estilo: 'reativo', tecnico: 'mourinho', historico: { time: 'milan', temporada: '2006–07' }, treino: 'rigido' },
  simeone: { pontos: P(20, 15, 5, 10, 35, 15), estilo: 'defensivo', tecnico: 'simeone', historico: { time: 'atletico', temporada: '2013–14' }, treino: 'rigido' },
  tele: { pontos: P(15, 10, 35, 25, 5, 10), estilo: 'liberdade', tecnico: 'tele', historico: { time: 'saopaulo', temporada: '1992' }, treino: 'tranquilo' },
  bielsa: { pontos: P(10, 5, 15, 30, 15, 25), estilo: 'longos', tecnico: 'bielsa', historico: { time: 'flamengo', temporada: '2019' }, treino: 'rigido' },
  todoataque: { pontos: P(0, 0, 30, 50, 0, 20), estilo: 'longos', tecnico: 'klopp', historico: { time: 'santos', temporada: '1962' }, treino: 'rigido' },
};
const perfis: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(IDS).map(([k, v]) => [k, dnaParaMotor(dnaDaIdentidade(v))]),
);
console.log(`  sem DNA      vitórias ${(base.vit * 100).toFixed(1)}%  empates ${(base.emp * 100).toFixed(1)}%`);
const deltas: number[] = [];
for (const [nome, d] of Object.entries(perfis)) {
  const r = temporada(readDna(d), null);
  const dv = (r.vit - base.vit) * 100;
  deltas.push(dv);
  console.log(`  ${nome.padEnd(12)} vitórias ${(r.vit * 100).toFixed(1)}%  empates ${(r.emp * 100).toFixed(1)}%  (Δ ${dv >= 0 ? '+' : ''}${dv.toFixed(1)}pp)`);
}
{
  const spread = Math.max(...deltas) - Math.min(...deltas);
  checa('nenhum perfil vira atalho (todos a menos de 10pp do sem-DNA)', deltas.every((d) => Math.abs(d) < 10), `faixa ${spread.toFixed(1)}pp`);
}

console.log();
if (falhas) { console.log(`${falhas} falha(s).`); process.exit(1); }
console.log('DNA na Liga Global: tudo certo.');
