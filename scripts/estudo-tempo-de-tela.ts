/**
 * QUANTO TEMPO DE TELA LEVA UMA PARTIDA LEGACY NO MODO LANCES?   npm run estudo:tempo-de-tela
 *
 * Critério do plano (docs/raio-x-partida-viva.html, "Como saber que deu certo"):
 * partida no modo Lances em até 4 min de tela.
 *
 * O relógio da Partida Rápida no LEGACY é determinístico, a não ser pelo tempo
 * que o MANAGER leva pra decidir. Então o estudo toca 1.000 planos do motor
 * novo pelas MESMAS regras e números do aparelho (importados, não copiados):
 *   - minuto sem lance: 1,1 s (LEGACY contínuo, velocidade 1×) + acréscimos; minuto que abre com
 *     lance encenado: 0,2 s e o lance entra (a posse do minuto é o próprio lance);
 *   - lance: o maior entre a leitura (HOLD_MS) e a encenação no campo (msParaMostrar);
 *   - chamada antes de lance de alto sinal (classifyTransition): 1,3 s, ou a janela
 *     de reação de 2,8 s;
 *   - gol: o momento decisivo (até 10 s, o prazo) + a encenação + REPLAY + GIZ;
 *   - pênalti da casa: escolher o batedor; lesão/expulsão da casa: escolher a troca;
 *   - intervalo: o tempo que o manager fica na tela do intervalo.
 * Três perfis de manager (ágil, típico, lento) mudam só os tempos de decisão.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { acrescimoDaEtapa, HOLD_MS, LEADIN_MS, LEADIN_REACT_MS, MINUTO_COM_LANCE_MS, PRAZO_DECISIVO_MS } from '../src/match/QuickPlanPlayer';
import { classifyTransition } from '../src/match/quickBeatDirector';
import { msParaMostrar } from '../src/partidaViva/cronograma';
import { comprimirEventos } from '../src/partidaViva/compressao';
import { ESPERA_ANTES_MS, GIZ_MS, REPLAY_MS } from '../src/partidaViva/filme';
import { escolhaAutomatica } from '../src/match/placarAoVivo';
import type { MatchPlan, MatchPlanEvent } from '../src/match/quickPlanTypes';

const N = Number(process.env.N ?? 1000);
const MINUTO_MS = 1100;
/** Entrada dos times + contagem 3, 2, 1 antes do apito (coreógrafo). */
const ENTRADA_MS = 6000;

interface Perfil { nome: string; decisao: number; reacao: number; troca: number; intervalo: number }
const PERFIS: Perfil[] = [
  { nome: 'ágil', decisao: 2000, reacao: 1000, troca: 5000, intervalo: 8000 },
  { nome: 'típico', decisao: 4000, reacao: LEADIN_REACT_MS, troca: 10000, intervalo: 20000 },
  { nome: 'lento', decisao: PRAZO_DECISIVO_MS, reacao: LEADIN_REACT_MS, troca: 20000, intervalo: 45000 },
];

const SMART = path.resolve(import.meta.dirname, '../server/smartfield');
const r = spawnSync('python3', ['-c', `
import json, copy
from test_cadeia_lances import entrada
from match_simulator import simulate
out = []
for i in range(${N}):
    d = entrada(i); d.pop('mode', None); d.pop('first_half', None)
    p = simulate(d)
    out.append({'events': p['events'], 'momentum_curve': p['momentum_curve']})
print(json.dumps(out))
`], { cwd: SMART, encoding: 'utf8', maxBuffer: 1 << 30 });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const crus = JSON.parse(r.stdout) as Pick<MatchPlan, 'events' | 'momentum_curve'>[];
// O LEGACY mostra os lances de baixa tensão comprimidos (src/partidaViva/compressao.ts). SEM_COMPRESSAO=1 mede o antes.
const planos = process.env.SEM_COMPRESSAO ? crus : crus.map((p) => ({ ...p, events: comprimirEventos(p.events) }));

const golDoFilme = (cad: MatchPlanEvent['cadeia'], vel = 1) => msParaMostrar(cad) / vel + ESPERA_ANTES_MS + REPLAY_MS + GIZ_MS;

function tempoDaPartida(p: Pick<MatchPlan, 'events' | 'momentum_curve'>, f: Perfil, vel = 1): number {
  // Velocidade (1× / 2×): divide o relógio e a encenação no campo, como `velVivo` no aparelho; decisões e replay não.
  const mostrar = (cad: MatchPlanEvent['cadeia']) => msParaMostrar(cad) / vel;
  let t = ENTRADA_MS + f.intervalo;
  let prev: MatchPlanEvent['kind'] | undefined;
  const ev = [...p.events].sort((a, b) => a.minute - b.minute);
  for (const e of ev) {
    const lead = classifyTransition({ event: e, momentumHome: p.momentum_curve[Math.max(0, e.minute - 1)] ?? 50, prevKind: prev });
    prev = e.kind;
    const ehGol = e.kind === 'goal_home' || e.kind === 'goal_away';
    if (lead) t += !ehGol && lead.reactions.length === 3 ? Math.min(f.reacao, LEADIN_REACT_MS) : LEADIN_MS;
    if (ehGol && e.decisivo) {
      t += Math.min(f.decisao, PRAZO_DECISIVO_MS);
      t += e.decisivo.opcoes[escolhaAutomatica(e.decisivo)] ? golDoFilme(e.cadeia, vel) : 1100;
    } else if (ehGol) {
      t += golDoFilme(e.cadeia, vel);
    } else if (e.kind === 'penalty_home') {
      const pen = e.penalti;
      t += f.decisao + Math.max(HOLD_MS.big, mostrar(e.cadeia));
      t += pen?.por_batedor?.[pen.batedor ?? ''] ? ESPERA_ANTES_MS + REPLAY_MS + GIZ_MS : 900;
    } else if (e.kind === 'penalty_away') {
      t += Math.max(HOLD_MS.big, mostrar(e.cadeia)) + (e.penalti?.gol ? ESPERA_ANTES_MS + REPLAY_MS + GIZ_MS : 900);
    } else if (e.kind === 'red_home' || e.kind === 'injury_home') {
      t += f.troca;
    } else {
      t += Math.max(HOLD_MS[e.weight_tier], mostrar(e.cadeia));
    }
  }
  const acrescimos = acrescimoDaEtapa(ev, 1) + acrescimoDaEtapa(ev, 2, 2);
  // Minuto que abre com lance encenado: o relógio só pisca (MINUTO_COM_LANCE_MS) e o lance entra.
  const comLance = new Set(ev.filter((e) => e.cadeia?.acoes.length).map((e) => e.minute)).size;
  return t + ((90 + acrescimos - comLance) * MINUTO_MS + comLance * MINUTO_COM_LANCE_MS) / vel;
}

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const fmt = (ms: number) => { const seg = Math.round(ms / 1000); return `${Math.floor(seg / 60)}min${String(seg % 60).padStart(2, '0')}s`; };
console.log(`\n⏱️  ${planos.length} partidas do motor novo no modo Lances (velocidade 1×)\n`);
let falhou = false;
for (const vel of [1, 2]) {
  console.log(`  velocidade ${vel}×`);
  for (const f of PERFIS) {
    const ts = planos.map((p) => tempoDaPartida(p, f, vel));
    const dentro = ts.filter((t) => t <= 4 * 60000).length;
    console.log(`    ${f.nome.padEnd(7)} mediana ${fmt(q(ts, 0.5))} · p90 ${fmt(q(ts, 0.9))} · máx ${fmt(q(ts, 1))} · até 4 min: ${(100 * dentro / ts.length).toFixed(0)}%`);
    if (vel === 1 && f.nome === 'típico' && q(ts, 0.5) > 4 * 60000) falhou = true;
  }
}
const comCadeia = planos.map((p) => p.events.filter((e) => e.cadeia?.acoes.length && !e.kind.startsWith('goal_')).length);
const encenacao = planos.flatMap((p) => p.events.filter((e) => e.cadeia?.acoes.length && !e.kind.startsWith('goal_')).map((e) => msParaMostrar(e.cadeia)));
console.log(`\n  lances encenados por partida: média ${(comCadeia.reduce((a, b) => a + b, 0) / comCadeia.length).toFixed(1)} · cada um leva em média ${(encenacao.reduce((a, b) => a + b, 0) / encenacao.length / 1000).toFixed(1)} s`);
// Onde vai o tempo (perfil típico): o peso de cada parte.
{
  const f = PERFIS[1]!;
  let minutos = 0, lances = 0, gols = 0, decisoes = 0;
  for (const p of planos) {
    const ev = p.events;
    const comLance = new Set(ev.filter((e) => e.cadeia?.acoes.length).map((e) => e.minute)).size;
    minutos += (90 + acrescimoDaEtapa(ev, 1) + acrescimoDaEtapa(ev, 2, 2) - comLance) * MINUTO_MS + comLance * MINUTO_COM_LANCE_MS;
    for (const e of ev) {
      if ((e.kind === 'goal_home' || e.kind === 'goal_away') && e.decisivo) {
        decisoes += f.decisao;
        if (e.decisivo.opcoes[escolhaAutomatica(e.decisivo)]) gols += golDoFilme(e.cadeia);
      } else if (!e.kind.startsWith('goal_')) lances += Math.max(HOLD_MS[e.weight_tier], msParaMostrar(e.cadeia));
    }
  }
  const n = planos.length;
  console.log(`\n  onde vai o tempo (típico, média por partida): relógio ${fmt(minutos / n)} · lances ${fmt(lances / n)} · gols (encenação + replay + giz) ${fmt(gols / n)} · momentos decisivos ${fmt(decisoes / n)} · intervalo ${fmt(f.intervalo)} · entrada ${fmt(ENTRADA_MS)}`);
}
console.log(`\ncritério do plano (até 4 min de tela, manager típico, velocidade 1×): ${falhou ? 'FORA' : 'DENTRO'}\n`);
