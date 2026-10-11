/**
 * ESTUDO DE EQUILÍBRIO — UMA VERDADE SÓ (Partida Viva, Fase 0).
 *
 *   npm run estudo:fase0            (N=1000; N=200 pra rodar rápido)
 *   SO_DEPOIS=1 OLEFOOT_DECISIVO_CERTA=0.92 OLEFOOT_DECISIVO_ERRADA=0.60 SAIDA=scripts/fase0/variante.json npm run estudo:fase0
 *                                   (só o DEPOIS, com outras bases do momento decisivo — pra calibrar)
 *
 * Mede o jogo que o manager SENTE, antes × depois, nas mesmas 1.000 partidas
 * sintéticas (test_cadeia_lances.entrada):
 *
 *   ANTES  = motor do commit 100fd32 (o de 11/10) + o aparelho de então, com o
 *            código REAL que saiu (scripts/fase0/antigo/*: estilo que vira gol,
 *            formação que vira gol, cartões semeados no aparelho, castigo do
 *            expulso, momento decisivo e pênalti sorteados no celular).
 *   DEPOIS = motor atual + aparelho atual (placarAoVivo: só escolhe).
 *
 * Nos dois, o manager não mexe em nada além do momento decisivo e do batedor
 * (sugerido): estilo padrão "Posse", formação 4-3-3, sem leitura do Analista,
 * sem reação, sem lenda, replan do intervalo como na Rápida. Três perfis de
 * momento decisivo: ALEATÓRIO (escolhe ao acaso), ESPERTO (sempre a leitura
 * certa) e ERRADO (nunca a certa).
 *
 * Saída: tabela com média de gols da casa e de fora, % de vitória/empate/
 * derrota da casa e cartões por jogo. Os geradores de números diferem entre
 * antes e depois (o motor passou a sortear por minuto), então a comparação é
 * estatística; com 1.000 partidas o erro padrão da média de gols é ~0,04.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpiritRng } from '../shared/gamespirit/SpiritRng';
import type { MatchPlan, MatchPlanEvent } from '../src/match/quickPlanTypes';
import { emendarEventos, estadoAte, golDoLance, lanceDe, escolhaAutomatica, escolhasVazias, type Escolhas } from '../src/match/placarAoVivo';
// O aparelho de ANTES, congelado do git (ver scripts/fase0/antigo/).
import * as antigoVivo from './fase0/antigo/quickTacticalLive';
import * as antigoClutch from './fase0/antigo/quickClutch';
import * as antigoBeats from './fase0/antigo/quickBeatDirector';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT_ANTES = '100fd32';

class Motor {
  private proc;
  private fila: Array<(linha: string) => void> = [];
  private resto = '';
  constructor(simulador?: string) {
    this.proc = spawn('python3', [path.join(RAIZ, 'scripts/fase0/motor-residente.py'), ...(simulador ? [simulador] : [])], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.resto += chunk.toString();
      let i: number;
      while ((i = this.resto.indexOf('\n')) >= 0) { const linha = this.resto.slice(0, i); this.resto = this.resto.slice(i + 1); this.fila.shift()?.(linha); }
    });
  }
  pedir<T>(corpo: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.fila.push((linha) => { const r = JSON.parse(linha); if (r?.error) reject(new Error(r.error)); else resolve(r as T); });
      this.proc.stdin.write(JSON.stringify(corpo) + '\n');
    });
  }
  fechar() { this.proc.stdin.end(); }
}

type Jogador = { id: string; name: string; pos: string; role: string; finalizacao: number; passe: number; marcacao: number; velocidade: number; fisico: number; confianca: number; drible: number; fatigue: number; fair_play: number };
type Entrada = { seed: string; home_team: { lineup: Jogador[]; banco?: Jogador[] }; away_team: { lineup: Jogador[] } } & Record<string, unknown>;
type Perfil = 'aleatorio' | 'esperto' | 'errado';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Resultado { casa: number; fora: number; cartoes: number }

/** O estado do 1º tempo que o aparelho mandava pro replan (as duas versões). */
function primeiroTempo(casa: number, fora: number, momentum: number[], cartoes: { h: number; a: number }, expulsos: { h: number; a: number }) {
  return { home_score: casa, away_score: fora, momentum_end: momentum[44] ?? 50, cards_home: cartoes.h, cards_away: cartoes.a, sent_off_home: expulsos.h, sent_off_away: expulsos.a };
}

const familia = (pos: string) => {
  const p = pos.toUpperCase();
  if (p.includes('GOL') || p === 'GK') return 'goleiro';
  if (p.includes('ZAG') || p === 'CB' || p === 'LE' || p === 'LD') return 'zagueiro';
  if (/(VOL|MC|MEI)/.test(p)) return 'meio';
  return 'ataque';
};
const ovrDe = (j: Jogador) => (j.finalizacao + j.passe + j.marcacao + j.velocidade + j.fisico + j.confianca) / 6;
const lutador = (j: Jogador) => ({ id: j.id, nome: j.name, attrs: { finalizacao: j.finalizacao, drible: j.drible, passe: j.passe, marcacao: j.marcacao, fisico: j.fisico, velocidade: j.velocidade } });

// ── ANTES: o aparelho de 11/10, com o código real de então ───────────────────
async function jogarAntes(motor: Motor, entrada: Entrada, perfil: Perfil, formacao: string, sorteio: () => number): Promise<Resultado> {
  const seed = entrada.seed;
  const home = entrada.home_team.lineup, away = entrada.away_team.lineup;
  const plan = await motor.pedir<MatchPlan>(entrada);
  // sprinkleDisciplineEvents: cartões, vermelhos e lesões semeados NO APARELHO.
  let events = antigoBeats.sprinkleDisciplineEvents({
    events: plan.events,
    home: home.map((p) => ({ id: p.id, name: p.name, fatigue: p.fatigue, fairPlay: p.fair_play })),
    away: away.map((p) => ({ id: p.id, name: p.name, fatigue: p.fatigue, fairPlay: p.fair_play })),
    seed,
  });
  let momentum = [...plan.momentum_curve];
  let casa = 0, fora = 0; const cartoes = { h: 0, a: 0 }, expulsos = { h: 0, a: 0 };
  const style = 'possession' as const;
  let idx = 0;
  const escolher = (m: antigoClutch.ClutchMoment): antigoClutch.ClutchKey => {
    if (perfil === 'esperto') return m.best;
    if (perfil === 'errado') return m.options.find((o) => o.key !== m.best)!.key;
    return m.options[Math.floor(sorteio() * m.options.length)]!.key;
  };
  const porFamilia = (lista: Jogador[], f: string) => [...lista].filter((j) => familia(j.pos) === f).sort((a, b) => ovrDe(b) - ovrDe(a))[0];
  for (let m = 1; m <= 90; m++) {
    while (idx < events.length && events[idx]!.minute === m) {
      const ev = events[idx]!; const i = idx; idx++;
      let shown = ev;
      if (!ev.decision_influenced) {
        const res = antigoVivo.resolveStyleOnEvent({ event: ev, chosen: style, state: { scoreDiff: casa - fora, minute: m, momentum: momentum[Math.max(0, Math.min(89, m - 1))] ?? 50 }, seed, index: i });
        if (res.flip) shown = res.event;
      }
      if (!shown.decision_influenced) {
        const ff = antigoVivo.resolveFormationOnEvent({ event: shown, formation: formacao, seed, index: i });
        if (ff) shown = ff;
      }
      events[i] = shown;
      const base = shown.kind.replace(/_(home|away)$/, '');
      if (shown.kind === 'penalty_home') {
        const taker = [...home].sort((a, b) => b.finalizacao - a.finalizacao)[0]!;
        const prob = Math.max(0.5, Math.min(0.92, 0.55 + (taker.finalizacao - 50) / 100 * 0.5));
        if (new SpiritRng(antigoBeats.hashSeed(`${seed}:penH:${shown.minute}:${taker.id}`)).next() < prob) { casa++; momentum = antigoVivo.nudgeMomentumCurve(momentum, m, 15); } else momentum = antigoVivo.nudgeMomentumCurve(momentum, m, -16);
      } else if (shown.kind === 'penalty_away') {
        if (new SpiritRng(antigoBeats.hashSeed(`${seed}:penA:${shown.minute}`)).next() < 0.74) { fora++; momentum = antigoVivo.nudgeMomentumCurve(momentum, m, -15); } else momentum = antigoVivo.nudgeMomentumCurve(momentum, m, 16);
      } else if (shown.kind === 'red_home') {
        expulsos.h++; events = antigoBeats.applyManDownPenalty({ events, fromIndex: i + 1, seed });
      } else if (shown.kind === 'red_away') {
        expulsos.a++;
      } else if (base === 'yellow') {
        if (shown.actor_side === 'home') cartoes.h++; else cartoes.a++;
      } else if (base === 'goal') {
        if (shown.decision_influenced) {
          if (shown.actor_side === 'home') casa++; else fora++;
          momentum = antigoVivo.nudgeMomentumCurve(momentum, m, shown.actor_side === 'home' ? 14 : -14);
        } else {
          const intent = shown.kind === 'goal_home' ? 'attack' : 'defend';
          const moment = antigoClutch.buildClutch({ intent, minute: shown.minute, seed, actorName: shown.actor_name ?? 'x' });
          // montarDuelo de então: atacando, o nosso autor × goleiro/zagueiro deles; defendendo, o deles × o nosso por família.
          let duelo: antigoClutch.Duelo | null = null;
          if (intent === 'attack') {
            const n = home.find((j) => j.id === shown.actor_id) ?? porFamilia(home, 'ataque');
            const d = porFamilia(away, moment.rival === 'goleiro' ? 'goleiro' : 'zagueiro') ?? away[0];
            if (n && d) duelo = antigoClutch.duelo(moment, lutador(n), lutador(d));
          } else {
            const d = away.find((j) => j.id === shown.actor_id) ?? porFamilia(away, 'ataque');
            const n = porFamilia(home, moment.rival) ?? home[0];
            if (n && d) duelo = antigoClutch.duelo(moment, lutador(n), lutador(d));
          }
          const key = escolher(moment);
          const res = antigoClutch.resolveClutch(moment, key, seed, antigoClutch.forcaNoDuelo(duelo, key));
          const gol = intent === 'attack' ? res.success : !res.success;
          if (gol) { if (intent === 'attack') casa++; else fora++; momentum = antigoVivo.nudgeMomentumCurve(momentum, m, intent === 'attack' ? 14 : -14); }
        }
      }
    }
    if (m === 45) {
      const h2 = await motor.pedir<MatchPlan>({ ...entrada, mode: 'second_half', first_half: primeiroTempo(casa, fora, momentum, cartoes, expulsos), decisions: [] });
      events = [...events.slice(0, idx), ...h2.events];
      momentum = [...momentum.slice(0, 45), ...h2.momentum_curve];
    }
  }
  return { casa, fora, cartoes: cartoes.h + cartoes.a + expulsos.h + expulsos.a };
}

// ── DEPOIS: o aparelho atual (só escolhe; o motor decide) ────────────────────
async function jogarDepois(motor: Motor, entrada: Entrada, perfil: Perfil | 'cru', sorteio: () => number): Promise<Resultado> {
  const plan = await motor.pedir<MatchPlan>(entrada);
  let events: MatchPlanEvent[] = [...plan.events];
  let momentum = [...plan.momentum_curve];
  const escolhas: Escolhas = escolhasVazias();
  let casa = 0, fora = 0, cartoes = 0;
  let idx = 0;
  for (let m = 1; m <= 90; m++) {
    while (idx < events.length && events[idx]!.minute === m) {
      const e = events[idx]!; idx++;
      const base = e.kind.replace(/_(home|away)$/, '');
      const lance = lanceDe(e);
      if (base === 'goal' && e.decisivo && perfil !== 'cru') {
        const opcoes = Object.keys(e.decisivo.opcoes);
        const certa = e.decisivo.melhor;
        escolhas.decisivos[String(e.minute)] = perfil === 'esperto' ? certa
          : perfil === 'errado' ? (opcoes.find((k) => k !== certa) ?? certa)
            : opcoes[Math.floor(sorteio() * opcoes.length)]!;
      }
      // "cru" = o que o motor decidiu sem o filtro do momento decisivo (referência: o gol natural vale).
      const gol = perfil === 'cru'
        ? (base === 'goal' || (lance && base === 'penalty' && golDoLance(lance, escolhas)))
        : (lance && (base === 'goal' || base === 'penalty') && golDoLance(lance, escolhas));
      if (gol) { if (e.actor_side === 'home') casa++; else fora++; }
      if (base === 'yellow' || base === 'red') cartoes++;
    }
    if (m === 45) {
      const est = estadoAte(events, escolhas, 46);
      const h2 = await motor.pedir<MatchPlan>({ ...entrada, mode: 'second_half', first_half: { ...est, momentum_end: momentum[44] ?? 50 }, decisions: [], escolhas });
      const emenda = emendarEventos(events, idx, 45, h2);
      if (!emenda) throw new Error('intervalo não emendou');
      events = emenda.events;
      momentum = [...momentum.slice(0, 45), ...h2.momentum_curve];
    }
  }
  void escolhaAutomatica;
  return { casa, fora, cartoes };
}

function resumir(rs: Resultado[]) {
  const n = rs.length;
  const media = (f: (r: Resultado) => number) => rs.reduce((s, r) => s + f(r), 0) / n;
  const pct = (f: (r: Resultado) => boolean) => (100 * rs.filter(f).length) / n;
  return {
    golsCasa: media((r) => r.casa), golsFora: media((r) => r.fora), golsTotal: media((r) => r.casa + r.fora),
    vitoria: pct((r) => r.casa > r.fora), empate: pct((r) => r.casa === r.fora), derrota: pct((r) => r.casa < r.fora),
    cartoes: media((r) => r.cartoes), zeroAZero: pct((r) => r.casa === 0 && r.fora === 0), goleada: pct((r) => Math.abs(r.casa - r.fora) >= 4),
  };
}

async function main() {
  const N = Number(process.env.N ?? 1000);
  const pasta = path.join(RAIZ, 'scripts/fase0/.motor-antes');
  mkdirSync(pasta, { recursive: true });
  for (const f of ['match_simulator', 'xg_model', 'narrative_weighter', 'matchup_matrix', 'cadeia_lances', 'idioma', 'comandos_ao_vivo', 'analyst_beats']) {
    writeFileSync(path.join(pasta, `${f}.py`), execSync(`git show ${COMMIT_ANTES}:server/smartfield/${f}.py`, { cwd: RAIZ }));
  }
  const motorAntes = new Motor(path.join(pasta, 'match_simulator.py'));
  const motorDepois = new Motor();
  const linhas: Record<string, Resultado[]> = {
    'ANTES · aleatório · 4-4-2': [], 'ANTES · aleatório · 4-3-3': [], 'ANTES · esperto · 4-3-3': [], 'ANTES · errado · 4-3-3': [],
    'DEPOIS · aleatório': [], 'DEPOIS · esperto': [], 'DEPOIS · errado': [], 'DEPOIS · motor cru (sem momento decisivo)': [],
  };
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const entrada = await motorDepois.pedir<Entrada>({ entrada: i });
    delete entrada.mode; delete entrada.first_half;
    const base = JSON.stringify(entrada);
    const e = () => JSON.parse(base) as Entrada;
    if (!process.env.SO_DEPOIS) {
      linhas['ANTES · aleatório · 4-4-2']!.push(await jogarAntes(motorAntes, e(), 'aleatorio', '4-4-2', rng(i)));
      linhas['ANTES · aleatório · 4-3-3']!.push(await jogarAntes(motorAntes, e(), 'aleatorio', '4-3-3', rng(i)));
      linhas['ANTES · esperto · 4-3-3']!.push(await jogarAntes(motorAntes, e(), 'esperto', '4-3-3', rng(i)));
      linhas['ANTES · errado · 4-3-3']!.push(await jogarAntes(motorAntes, e(), 'errado', '4-3-3', rng(i)));
    }
    linhas['DEPOIS · aleatório']!.push(await jogarDepois(motorDepois, e(), 'aleatorio', rng(i)));
    linhas['DEPOIS · esperto']!.push(await jogarDepois(motorDepois, e(), 'esperto', rng(i)));
    linhas['DEPOIS · errado']!.push(await jogarDepois(motorDepois, e(), 'errado', rng(i)));
    linhas['DEPOIS · motor cru (sem momento decisivo)']!.push(await jogarDepois(motorDepois, e(), 'cru', rng(i)));
    if ((i + 1) % 100 === 0) console.error(`  ${i + 1}/${N} partidas (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  motorAntes.fechar(); motorDepois.fechar();

  const f1 = (v: number) => v.toFixed(2).replace('.', ',');
  const p0 = (v: number) => `${v.toFixed(0)}%`;
  console.log(`\nEQUILÍBRIO — ${N} partidas por linha (mesmos confrontos), manager passivo exceto no momento decisivo\n`);
  console.log('| linha | gols casa | gols fora | total | vitória casa | empate | derrota casa | 0×0 | goleada ≥4 | cartões |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  const saida: Record<string, ReturnType<typeof resumir>> = {};
  for (const [nome, rs] of Object.entries(linhas)) {
    if (!rs.length) continue;
    const r = resumir(rs); saida[nome] = r;
    console.log(`| ${nome} | ${f1(r.golsCasa)} | ${f1(r.golsFora)} | ${f1(r.golsTotal)} | ${p0(r.vitoria)} | ${p0(r.empate)} | ${p0(r.derrota)} | ${p0(r.zeroAZero)} | ${p0(r.goleada)} | ${f1(r.cartoes)} |`);
  }
  const arquivo = process.env.SAIDA ?? 'scripts/fase0/equilibrio.json';
  writeFileSync(path.join(RAIZ, arquivo), JSON.stringify({ n: N, commitAntes: COMMIT_ANTES, quando: new Date().toISOString(),
    decisivo: { certa: process.env.OLEFOOT_DECISIVO_CERTA ?? '0.82', errada: process.env.OLEFOOT_DECISIVO_ERRADA ?? '0.30' }, linhas: saida }, null, 2));
  console.log(`\n(gravado em ${arquivo} · ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

void main();
