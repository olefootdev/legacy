/**
 * PARTIDA VIVA — self-test do coreógrafo (Fase 1).
 *
 * Roda uma partida inteira (90' de quadros sintéticos, como o QuickPlanPlayer
 * emite) e confere o que o manager VÊ:
 *  1. ninguém sai do campo (fichas e bola dentro de limites);
 *  2. sem lance, ninguém "mora" na linha de fundo (o bug do escorrimento);
 *  3. gol encenado põe a bola dentro da rede do lado certo;
 *  4. mesma seed + mesmos quadros = mesmas posições (determinismo → o "filme");
 *  5. fichas não se atropelam (distância mínima média saudável).
 *
 * npm run test:partida-viva
 */
import { Coreografo, DT } from '../src/partidaViva/coreografo';
import { montarFichas } from '../src/partidaViva/escalacao';
import type { QuadroAoVivo } from '../src/partidaViva/tipos';
import type { MatchPlanEvent } from '../src/match/quickPlanTypes';
import { ajustarPorEstilo, ajustarPorGrito, alvoNaForma, formaDe, intencaoDoTime } from '../src/partidaViva/forma';
import { pontosDoGiz, quadroDoReplay } from '../src/partidaViva/filme';
import { corredorEmMetros, lerPrancheta } from '../src/partidaViva/prancheta';
import { entregarQuadro, gravarEntrega, type Trecho } from '../src/partidaViva/gravacao';

let falhas = 0;
function confere(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) falhas++;
}

const POS = ['GOL', 'ZAG', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MC', 'PE', 'ATA', 'PD'];
const time = (lado: 'home' | 'away') =>
  montarFichas(lado, POS.map((pos, i) => ({ id: `${lado}-${i}`, nome: `${lado}${i} Teste`, pos, fadiga: 20, velocidade: 50 + i * 3 })));
const fichas = [...time('home'), ...time('away')];

function quadro(minuto: number, extra: Partial<QuadroAoVivo> = {}): QuadroAoVivo {
  return { minuto, fase: 'playing', placarCasa: 0, placarFora: 0, momento: 50 + 18 * Math.sin(minuto / 9), lance: null, gol: null, narracao: [], ...extra };
}
function lance(minuto: number, kind: MatchPlanEvent['kind'], lado: 'home' | 'away', zone: MatchPlanEvent['zone'], channel: MatchPlanEvent['channel']): MatchPlanEvent {
  return { minute: minuto, kind, actor_side: lado, actor_id: `${lado}-9`, weight_tier: 'big', zone, channel, text: '' };
}

/** Roteiro: um lance a cada ~7', um gol de cada lado. Devolve o histórico de posições. */
function rodar(seed: string) {
  const c = new Coreografo(fichas, '4-3-3', '4-4-2', seed);
  const hist: number[] = [];
  let fundoSemLance = 0, amostras = 0, foraDoCampo = 0, somaMin = 0;
  const golCasa: { x: number; z: number }[] = [];
  const golFora: { x: number; z: number }[] = [];
  for (let m = 1; m <= 90; m++) {
    let q = quadro(m);
    let emLance = false;
    if (m % 7 === 0) { q = quadro(m, { lance: lance(m, m % 14 === 0 ? 'save_away' : 'shot_home', m % 14 === 0 ? 'away' : 'home', 'att', m % 21 === 0 ? 'corredor_esquerdo' : 'ataque_central') }); emLance = true; }
    if (m === 30) q = quadro(m, { gol: { chave: 'g1', nome: 'X', lado: 'home', actorId: 'home-9' } });
    if (m === 70) q = quadro(m, { gol: { chave: 'g2', nome: 'Y', lado: 'away', actorId: 'away-9' } });
    c.receber(q);
    // ~6 s de "tela" por minuto, como na Partida Rápida
    for (let i = 0; i < 6 / DT; i++) {
      c.passo();
      const f = c.quadro(1);
      for (const j of f.jogadores) {
        hist.push(Math.round(j.x * 100), Math.round(j.z * 100));
        if (j.x < -2.5 || j.x > 107.5 || j.z < -2.5 || j.z > 70.5) foraDoCampo++;
      }
      if (!emLance && !q.gol && m !== 31 && m !== 71) {
        amostras++;
        if (f.jogadores.some((j) => j.f.slot !== 'gol' && (j.x < 4 || j.x > 101))) fundoSemLance++;
        let menor = Infinity;
        for (const a of f.jogadores) for (const b of f.jogadores) if (a !== b) menor = Math.min(menor, Math.hypot(a.x - b.x, a.z - b.z));
        somaMin += menor;
      }
      if (m === 30 && i === 15) golCasa.push({ x: f.bola.x, z: f.bola.z });
      if (m === 70 && i === 15) golFora.push({ x: f.bola.x, z: f.bola.z });
    }
    if (q.gol) c.receber(quadro(m)); // comemoração acabou → recomeço
  }
  return { hist, fundoSemLance, amostras, foraDoCampo, minMedio: somaMin / Math.max(1, amostras), golCasa, golFora };
}

/** 10' sem lance nenhum, jogo equilibrado: a bola tem que circular no meio, não escorrer pro fundo. */
function semLance(seed: string) {
  const c = new Coreografo(fichas, '4-3-3', '4-3-3', seed);
  let noFundo = 0, total = 0, somaX = 0;
  for (let m = 1; m <= 10; m++) {
    c.receber({ ...quadro(m), momento: 50 });
    for (let i = 0; i < 6 / DT; i++) {
      c.passo();
      const bx = c.quadro(1).bola.x;
      total++; somaX += bx;
      if (bx < 12 || bx > 93) noFundo++;
    }
  }
  return { pctFundo: noFundo / total, xMedio: somaX / total };
}

const a = rodar('seed-teste');
const b = rodar('seed-teste');
const outra = rodar('outra-seed');

confere(a.foraDoCampo === 0, `ninguém sai do campo (${a.foraDoCampo} saídas)`);
const pctFundo = a.fundoSemLance / Math.max(1, a.amostras);
confere(pctFundo < 0.03, `sem lance, ninguém mora na linha de fundo (${(pctFundo * 100).toFixed(1)}% dos quadros)`);
const eq = semLance('equilibrio');
confere(eq.pctFundo < 0.1, `jogo equilibrado sem lance: bola perto da linha de fundo só ${(eq.pctFundo * 100).toFixed(1)}% do tempo`);
confere(Math.abs(eq.xMedio - 52.5) < 18, `jogo equilibrado: bola circula no meio (x médio ${eq.xMedio.toFixed(1)} m)`);
confere(a.minMedio > 1.6, `fichas não se atropelam (distância mínima média ${a.minMedio.toFixed(2)} m)`);
const gc = a.golCasa[0], gf = a.golFora[0];
confere(!!gc && gc.x > 104 && Math.abs(gc.z - 34) < 4.5, `gol da casa entra na rede da direita (bola em ${gc?.x.toFixed(1)}, ${gc?.z.toFixed(1)})`);
confere(!!gf && gf.x < 1 && Math.abs(gf.z - 34) < 4.5, `gol de fora entra na rede da esquerda (bola em ${gf?.x.toFixed(1)}, ${gf?.z.toFixed(1)})`);
confere(a.hist.length === b.hist.length && a.hist.every((v, i) => v === b.hist[i]), 'mesma seed → mesmo filme (determinístico)');
confere(a.hist.some((v, i) => v !== outra.hist[i]), 'outra seed → outro filme');

// ── Fase 2: jogada contada pelo servidor, toque a toque ─────────────────────
{
  const cadeia = {
    inicio: { x: 40, z: 30 },
    finalizacao: 'chute' as const,
    acoes: [
      { t: 'passe' as const, de: 'home-6', para: 'home-10', x: 62, z: 12 },
      { t: 'drible' as const, de: 'home-10', para: 'away-4', x: 80, z: 12 },
      { t: 'cruzamento' as const, de: 'home-10', para: 'home-9', x: 94, z: 33 },
      { t: 'chute' as const, de: 'home-9', para: null, x: 104.5, z: 34 },
    ],
  };
  const c = new Coreografo(fichas, '4-3-3', '4-3-3', 'cadeia');
  for (let i = 0; i < 30; i++) c.passo();
  c.receber(quadro(20, { gol: { chave: 'goal-3', nome: 'Nove', lado: 'home', actorId: 'home-9', cadeia } }));
  const donos: string[] = [];
  const pertoDe = cadeia.acoes.slice(0, 3).map(() => Infinity);
  let fimBola = { x: 0, z: 0 };
  for (let i = 0; i < 70; i++) {
    c.passo();
    const f = c.quadro(1);
    if (f.dono && donos[donos.length - 1] !== f.dono.id) donos.push(f.dono.id);
    cadeia.acoes.slice(0, 3).forEach((ac, k) => { pertoDe[k] = Math.min(pertoDe[k]!, Math.hypot(f.bola.x - ac.x, f.bola.z - ac.z)); });
    if (i === 50) fimBola = { x: f.bola.x, z: f.bola.z };
  }
  confere(pertoDe.every((d) => d < 2.5), `a bola passa por cada ponto da jogada (${pertoDe.map((d) => d.toFixed(1)).join(' / ')} m)`);
  const ordem = ['home-6', 'home-10', 'home-9'];
  confere(ordem.every((id, k) => donos.indexOf(id) >= 0 && (k === 0 || donos.indexOf(id) > donos.indexOf(ordem[k - 1]!))),
    `a bola passa pelos pés na ordem da jogada (${donos.join(' → ')})`);
  confere(fimBola.x > 104 && Math.abs(fimBola.z - 34) < 4.5, `a jogada termina dentro da rede (bola em ${fimBola.x.toFixed(1)}, ${fimBola.z.toFixed(1)})`);
}

// ── Fase 3: forma do time + classe do SMART-PROFILE ─────────────────────────
{
  const osc = { x: 0, z: 0 };
  const alvo = (o: { comBola: boolean; profBola: number; classe?: string; ancoraProf: number; ancoraZ?: number }) => {
    const intencao = intencaoDoTime({ comBola: o.comBola, profBola: o.profBola, emTransicao: false, ultimoLanceChute: false, dominio: 50 });
    return alvoNaForma({
      lado: 'home', ancoraProf: o.ancoraProf, ancoraZ: o.ancoraZ ?? 34, centroProf: 0.45,
      forma: formaDe(intencao, '4-3-3'), bola: { x: o.profBola * 105, z: 34 }, comBola: o.comBola, classe: o.classe, oscilacao: osc,
    });
  };
  const zagAtacando = alvo({ comBola: true, profBola: 0.8, ancoraProf: 0.26 }).x;
  const zagDefendendo = alvo({ comBola: false, profBola: 0.2, ancoraProf: 0.26 }).x;
  confere(zagAtacando - zagDefendendo > 15, `o bloco sobe atacando e desce defendendo (zagueiro ${zagDefendendo.toFixed(0)} m → ${zagAtacando.toFixed(0)} m)`);
  const meio = { comBola: true, profBola: 0.55, ancoraProf: 0.5 };
  confere(alvo({ ...meio, classe: 'regista' }).x < alvo(meio).x - 4, 'regista recua pra buscar a bola');
  confere(alvo({ ...meio, classe: 'velocista', ancoraProf: 0.72 }).x > alvo({ ...meio, ancoraProf: 0.72 }).x + 6, 'velocista ataca as costas');
  const area = { comBola: true, profBola: 0.75, ancoraProf: 0.78, ancoraZ: 20 };
  const mat = alvo({ ...area, classe: 'matador' });
  confere(mat.x >= 0.85 * 105 - 0.1 && Math.abs(mat.z - 34) < Math.abs(alvo(area).z - 34), `matador ronda a área (x ${mat.x.toFixed(0)} m, mais perto do centro)`);
  const ladoEsq = { comBola: true, profBola: 0.55, ancoraProf: 0.7, ancoraZ: 10 };
  confere(alvo({ ...ladoEsq, classe: 'ponta_driblador' }).z < alvo(ladoEsq).z, 'ponta driblador abre o campo');
}

// ── Fase 3: direção (câmera lenta pelo xG, gol congela, cinema, linha do passe) ──
{
  const cad = {
    inicio: { x: 50, z: 34 }, finalizacao: 'chute' as const,
    acoes: [
      { t: 'passe' as const, de: 'home-6', para: 'home-9', x: 86, z: 34 },
      { t: 'chute' as const, de: 'home-9', para: null, x: 104.5, z: 34 },
    ],
  };
  const menorEscala = (xg: number, kind: MatchPlanEvent['kind']) => {
    const c = new Coreografo(fichas, '4-3-3', '4-3-3', 'direcao');
    c.receber(quadro(30, { lance: { ...lance(30, kind, 'home', 'att', 'ataque_central'), xg, weight_tier: 'big', cadeia: cad } }));
    let menor = 1, cinema = false, linha = false;
    for (let i = 0; i < 40; i++) {
      c.passo();
      const f = c.quadro(1);
      menor = Math.min(menor, c.escalaDoTempo());
      cinema = cinema || f.cinema;
      linha = linha || !!f.passe;
    }
    return { menor, cinema, linha };
  };
  const clara = menorEscala(0.45, 'save_home'), dificil = menorEscala(0.06, 'shot_home');
  confere(clara.menor < 0.45 && dificil.menor > 0.85, `câmera lenta pelo xG (chance clara ${clara.menor.toFixed(2)}×, chute difícil ${dificil.menor.toFixed(2)}×)`);
  confere(clara.cinema, 'lance grande ganha faixas de cinema');
  confere(clara.linha, 'a linha do passe aparece antes de a bola sair');
  const g = new Coreografo(fichas, '4-3-3', '4-3-3', 'congela');
  g.receber(quadro(40, { gol: { chave: 'goal-9', nome: 'Nove', lado: 'home', actorId: 'home-9', cadeia: cad, xg: 0.5 } }));
  let congelou = 0;
  for (let i = 0; i < 60; i++) { g.passo(); if (g.consumirCongelamento()) congelou++; }
  confere(congelou === 1, `o gol congela a imagem uma vez (${congelou})`);
}

// ── Fase 4: comando camada 1 — o estilo muda a forma da casa NA HORA ─────────
{
  const base = formaDe('bloco_medio', '4-3-3');
  const zag = (estilo?: string) => alvoNaForma({
    lado: 'home', ancoraProf: 0.26, ancoraZ: 34, centroProf: 0.45, forma: ajustarPorEstilo(base, estilo, false),
    bola: { x: 60, z: 34 }, comBola: false, oscilacao: { x: 0, z: 0 },
  }).x;
  confere(zag('press') > zag() + 5 && zag('defend') < zag() - 5,
    `pressão sobe o bloco e retranca baixa (zagueiro: retranca ${zag('defend').toFixed(0)} m · normal ${zag().toFixed(0)} m · pressão ${zag('press').toFixed(0)} m)`);
  confere(ajustarPorEstilo(base, 'press', false).pressao > base.pressao + 0.3, 'pressão liga o gatilho de pressionar o portador');
}

// ── Fase 5: entrada em campo, som, filme do gol, jogada a giz ───────────────
{
  const e = new Coreografo(fichas, '4-3-3', '4-3-3', 'entrada', true);
  const noTunel = e.quadro(1).jogadores.every((j) => j.z < 0);
  const nomes = new Set<string>();
  let apito = false;
  for (let i = 0; i < 60; i++) {
    e.passo();
    e.quadro(1).fitas.forEach((f) => nomes.add(f.texto));
    if (e.consumirSons().includes('apito')) apito = true;
  }
  const emCampo = e.quadro(1).jogadores.every((j) => j.z > 1 && j.z < 67);
  confere(noTunel && emCampo, 'entrada: os times saem do túnel e ocupam o campo');
  confere(nomes.size >= 10, `entrada: os jogadores da casa são apresentados (${nomes.size} nomes)`);
  confere(apito, 'entrada: apito inicial');

  const cad = {
    inicio: { x: 50, z: 34 }, finalizacao: 'chute' as const,
    acoes: [
      { t: 'passe' as const, de: 'home-6', para: 'home-10', x: 70, z: 14 },
      { t: 'drible' as const, de: 'home-10', para: 'away-4', x: 84, z: 16 },
      { t: 'cruzamento' as const, de: 'home-10', para: 'home-9', x: 95, z: 33 },
      { t: 'chute' as const, de: 'home-9', para: null, x: 104.5, z: 34 },
    ],
  };
  const g = new Coreografo(fichas, '4-3-3', '4-3-3', 'filme');
  g.receber(quadro(50, { gol: { chave: 'goal-4', nome: 'Nove', lado: 'home', actorId: 'home-9', cadeia: cad, xg: 0.4 } }));
  const sons = new Set<string>();
  const fitas = new Set<string>();
  for (let i = 0; i < 80; i++) { g.passo(); g.consumirSons().forEach((x) => sons.add(x)); g.quadro(1).fitas.forEach((f) => fitas.add(f.texto)); }
  confere(sons.has('chute') && sons.has('gol') && sons.has('passe'), `som: passe, chute e gol (${[...sons].join(', ')})`);
  confere(fitas.has('DRIBLE') || fitas.has('DRIBBLE'), 'fita DRIBLE colada no campo');
  confere(g.filme.length > 20 && !g.gravando && g.golGravado?.autorId === 'home-9', `o gol fica gravado pro replay (${g.filme.length} quadros)`);
  const rp = quadroDoReplay(g.filme, fichas, 'home-9', 0.5);
  confere(!!rp && rp.camera.zoom > 1.4, 'replay: câmera colada no autor');
  const giz = pontosDoGiz(cad, fichas);
  confere(giz[0]!.numero === 1 && giz[giz.length - 1]!.gol && giz.filter((p) => p.numero != null).length === 4,
    `jogada a giz: ${giz.filter((p) => p.numero != null).length} toques numerados e termina no GOL`);
}

// ── Fase 4b: gritos e ordens — o time reage NA HORA ────────────────────────
{
  const base = formaDe(intencaoDoTime({ comBola: false, profBola: 0.5, emTransicao: false, ultimoLanceChute: false, dominio: 50 }), '4-3-3');
  const cobra = ajustarPorGrito(base, 'cobrar', false);
  const calma = ajustarPorGrito(base, 'acalmar', false);
  confere(cobra.pressao > base.pressao + 0.2 && cobra.alturaLinha > base.alturaLinha, 'grito "cobrar": o time sobe e aperta');
  confere(calma.compactacao > base.compactacao && calma.alturaLinha < base.alturaLinha, 'grito "acalmar": o time recua e fecha');
  const args = { lado: 'home' as const, ancoraProf: 0.62, ancoraZ: 34, centroProf: 0.45, forma: base, bola: { x: 80, z: 34 }, comBola: true, oscilacao: { x: 0, z: 0 } };
  const livre = alvoNaForma(args), espaco = alvoNaForma({ ...args, ordem: 'atacar_espaco' }), segura = alvoNaForma({ ...args, ordem: 'segurar' });
  confere(espaco.x > livre.x + 4, `ordem "atacar o espaço": avança (${livre.x.toFixed(1)} → ${espaco.x.toFixed(1)} m)`);
  confere(segura.x <= livre.x && segura.x <= 0.62 * 105 + 1, `ordem "segurar": não passa da posição (${segura.x.toFixed(1)} m)`);

  const c = new Coreografo(fichas, '4-3-3', '4-3-3', 'grito');
  for (let i = 0; i < 60; i++) c.passo(); // entrada
  c.receber(quadro(30));
  for (let i = 0; i < 10; i++) c.passo();
  c.receber(quadro(31, { grito: { tipo: 'cobrar', ate: 41 }, gritoLivreEm: 46, ordens: { 'home-9': 'atacar_espaco' } }));
  const fitas = new Set<string>();
  for (let i = 0; i < 6; i++) { c.passo(); c.quadro(1).fitas.forEach((f) => fitas.add(f.texto)); }
  confere(fitas.has('APERTA!') || fitas.has('PRESS!'), `grito vira fita no campo (${[...fitas].join(', ')})`);
  confere(fitas.has('ESPAÇO') || fitas.has('SPACE'), 'ordem vira fita presa no jogador');
  const fitas2 = new Set<string>();
  c.receber(quadro(32, { grito: { tipo: 'cobrar', ate: 41 }, gritoLivreEm: 46, ordens: { 'home-9': 'atacar_espaco' } }));
  for (let i = 0; i < 30; i++) { c.passo(); }
  c.receber(quadro(33, { grito: { tipo: 'cobrar', ate: 41 }, gritoLivreEm: 46, ordens: { 'home-9': 'atacar_espaco' } }));
  for (let i = 0; i < 3; i++) { c.passo(); c.quadro(1).fitas.forEach((f) => fitas2.add(f.texto)); }
  confere(!fitas2.has('APERTA!') && !fitas2.has('PRESS!'), 'o mesmo grito não repete a fita a cada quadro');
}

// ── Fase 4c: banco, prancheta e o analista desenhado ───────────────────────
{
  const c = new Coreografo(fichas, '4-3-3', '4-3-3', 'banco');
  for (let i = 0; i < 80; i++) c.passo();
  const slot = c.corpos.find((k) => k.f.id === 'home-9')!.f.slot;
  const reserva = { id: 'reserva-1', nome: 'Reserva', iniciais: 'RE', lado: 'home' as const, slot: '', rosto: null, fadiga: 0, velocidade: 80 };
  const nova = c.trocar('home-9', reserva);
  confere(!!nova && nova.slot === slot && !c.corpos.some((k) => k.f.id === 'home-9'), `troca: quem entra assume o slot de quem sai (${slot})`);
  const corpo = c.corpos.find((k) => k.f.id === 'reserva-1')!;
  const z0 = corpo.z;
  c.receber(quadro(60));
  for (let i = 0; i < 60; i++) c.passo();
  confere(z0 > 67 && corpo.z < 64, `troca: entra pela lateral e corre pro lugar (z ${z0.toFixed(1)} → ${corpo.z.toFixed(1)})`);
  confere(c.trocar('nao-existe', reserva) === null, 'troca: quem não está em campo não sai');

  // Prancheta: posições congeladas → leitura.
  const pos = (lado: 'home' | 'away', x: number, z: number, i: number, slot = 'mc1') =>
    ({ f: { ...fichas[0]!, id: `${lado}-${i}`, lado, slot }, x, z });
  // Eles (atacam −x): defesa em x 70 com um buraco no meio; meio em x 50 → entrelinhas de 20 m.
  const deles = [pos('away', 103, 34, 0, 'gol'), pos('away', 70, 8, 1), pos('away', 70, 20, 2), pos('away', 70, 48, 3), pos('away', 70, 60, 4),
    pos('away', 50, 20, 5), pos('away', 50, 34, 6), pos('away', 50, 48, 7), pos('away', 30, 15, 8), pos('away', 30, 34, 9), pos('away', 30, 53, 10)];
  const nossos = [pos('home', 2, 34, 0, 'gol'), pos('home', 25, 10, 1), pos('home', 25, 26, 2), pos('home', 25, 42, 3), pos('home', 25, 58, 4),
    pos('home', 45, 22, 5), pos('home', 45, 46, 6), pos('home', 55, 34, 7), pos('home', 65, 12, 8), pos('home', 75, 34, 9), pos('home', 65, 56, 10)];
  const lido = lerPrancheta([...nossos, ...deles], 'home-7');
  confere(lido.bloco.away === 40 && lido.bloco.home > 30, `prancheta: comprimento dos blocos (nós ${lido.bloco.home} m, eles ${lido.bloco.away} m)`);
  confere(!!lido.entrelinhas && Math.round(lido.entrelinhas.x1 - lido.entrelinhas.x0) === 20, 'prancheta: entrelinhas deles = 20 m');
  confere(!!lido.buraco && lido.buraco.z0 > 20 && lido.buraco.z1 < 48, 'prancheta: acha o buraco no meio da defesa deles');
  const fechado = lido.passes.find((p) => p.para === 'home-9');
  const livre = lido.passes.find((p) => p.para === 'home-6');
  confere(!!livre?.livre, 'prancheta: passe sem ninguém no caminho é livre');
  confere(lido.passes.length >= 4 && lido.passes.some((p) => !p.livre) === !!fechado && fechado !== undefined, `prancheta: ${lido.passes.filter((p) => p.livre).length} de ${lido.passes.length} passes livres`);

  const nosso = corredorEmMetros('corredor_esquerdo', 'nosso')!, perigo = corredorEmMetros('corredor_esquerdo', 'perigo')!;
  confere(nosso.x0 > 52.5 && nosso.z1 < 34, 'analista: nossa chance pela esquerda = campo de ataque, faixa de cima');
  confere(perigo.x1 < 52.5 && perigo.z0 > 34, 'analista: o perigo pela esquerda DELES = nosso campo, faixa de baixo');
  confere(corredorEmMetros('qualquer', 'nosso') === null, 'analista: canal desconhecido não desenha nada');
}

// ── Fase 6: o filme — ao vivo e reassistido têm de ser IDÊNTICOS ──────────
{
  const reserva = { id: 'reserva-9', nome: 'Reserva Nove', iniciais: 'RN', lado: 'home' as const, slot: '', rosto: null, fadiga: 0, velocidade: 78 };
  const banco = [reserva];
  const emCampo = fichas.filter((f) => f.lado === 'home').map((f) => f.id);
  const comTroca = emCampo.map((id) => (id === 'home-9' ? 'reserva-9' : id));
  const gol = { chave: 'goal-x', nome: 'Dez', lado: 'home' as const, actorId: 'home-10', xg: 0.3 };
  // Roteiro "ao vivo": quadros chegando em passos irregulares (como o React entrega), repetidos às vezes.
  const chegadas: { p: number; q: QuadroAoVivo }[] = [];
  let p = 3;
  for (let m = 1; m <= 40; m++) {
    const extra: Partial<QuadroAoVivo> = { emCampo: m >= 22 ? comTroca : emCampo, estilo: m >= 15 ? 'press' : 'possession' };
    if (m % 6 === 0) extra.lance = lance(m, m % 12 === 0 ? 'shot_away' : 'chance_home', m % 12 === 0 ? 'away' : 'home', 'att', 'ataque_central');
    if (m === 30) extra.gol = gol;
    if (m >= 25 && m < 35) extra.grito = { tipo: 'cobrar', ate: 35 };
    chegadas.push({ p, q: quadro(m, { ...extra, placarCasa: m >= 30 ? 1 : 0 }) });
    if (m % 5 === 0) chegadas.push({ p: p + 1, q: quadro(m, { ...extra, placarCasa: m >= 30 ? 1 : 0 }) }); // quadro repetido
    p += 7 + ((m * 13) % 11);
  }
  const total = p + 120;
  const rodarAoVivo = () => {
    const c = new Coreografo(fichas, '4-3-3', '4-3-3', 'filme-seed', true);
    const t: Trecho = { comEntrada: true, roteiro: [] };
    const hist: number[] = [];
    let k = 0;
    for (let passo = 0; passo < total; passo++) {
      while (k < chegadas.length && chegadas[k]!.p <= c.passos) {
        const e = chegadas[k++]!;
        gravarEntrega(t, c.passos, e.q);
        entregarQuadro(c, e.q, banco);
      }
      c.passo();
      for (const j of c.quadro(1).jogadores) hist.push(Math.round(j.x * 100), Math.round(j.z * 100));
    }
    return { hist, t, ids: c.corpos.map((k2) => k2.f.id) };
  };
  const vivo = rodarAoVivo();
  const roteiro = (JSON.parse(JSON.stringify(vivo.t)) as Trecho).roteiro; // como sai do localStorage
  const c2 = new Coreografo(fichas, '4-3-3', '4-3-3', 'filme-seed', true);
  const hist2: number[] = [];
  let k = 0;
  for (let passo = 0; passo < total; passo++) {
    while (k < roteiro.length && roteiro[k]!.p <= c2.passos) entregarQuadro(c2, roteiro[k++]!.q, banco);
    c2.passo();
    for (const j of c2.quadro(1).jogadores) hist2.push(Math.round(j.x * 100), Math.round(j.z * 100));
  }
  const iguais = vivo.hist.length === hist2.length && vivo.hist.every((v, i) => v === hist2[i]);
  const primeira = vivo.hist.findIndex((v, i) => v !== hist2[i]);
  confere(iguais, `filme: reassistido == ao vivo, posição a posição (${total} passos${iguais ? '' : `, diverge no passo ${Math.floor(primeira / 44)}`})`);
  confere(vivo.ids.includes('reserva-9') && c2.corpos.some((c) => c.f.id === 'reserva-9'), 'filme: a troca entra no filme');
  confere(roteiro.length < chegadas.length, `filme: quadros repetidos não são gravados (${roteiro.length} de ${chegadas.length})`);
  const kb = JSON.stringify(vivo.t).length / 1024;
  confere(kb < 120, `filme: cabe no aparelho (${kb.toFixed(1)} KB pra 40 minutos)`);
}

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log('\nPartida Viva: coreógrafo ok');
