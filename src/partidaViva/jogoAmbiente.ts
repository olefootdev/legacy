/**
 * PARTIDA VIVA — o jogo ENTRE os lances (Fase 12, pedido do fundador 10/10).
 *
 * Antes, entre os ~20 lances do plano o campo tocava a bola ao acaso. Agora:
 *   1. A POSSE vem do plano, minuto a minuto (`plan.fluxo`): quem tem a bola,
 *      em que terço, quem carrega. O time joga ali — e a bola chega em quem
 *      o motor diz que a teve.
 *   2. Quando a posse muda, a mudança vira REGRA no campo: roubada, LATERAL
 *      (no meio), TIRO DE META ou IMPEDIMENTO (quando quem perdeu estava no ataque).
 *   3. Cada um DECIDE pelo perfil: o driblador encara, o armador inverte com
 *      lançamento, o velocista recebe em profundidade, o cansado toca curto.
 *
 * Tudo determinístico (rnd do coreógrafo) — o filme continua idêntico.
 */
import { C, L, lim, type Corpo } from './fisica';
import { profundidade } from './forma';
import type { Coreografo } from './coreografo';
import { L as T } from '@/i18n/L';

export type PosseDoPlano = { lado: 'home' | 'away'; zona: 'def' | 'mid' | 'att'; roubou: boolean; ator: string };

const outroLado = (l: 'home' | 'away') => (l === 'home' ? 'away' : 'home');
const ARMADORES = new Set(['regista', 'maestro']);

/** Onde o time com a bola joga: o terço do plano (metros a partir do próprio gol), afinado pelo momento. */
export function xDaZona(co: Coreografo, lado: 'home' | 'away'): number {
  const dominio = lado === 'home' ? co.momento : 100 - co.momento;
  const p = co.posseDoPlano;
  const base = p && p.lado === lado ? (p.zona === 'def' ? 30 : p.zona === 'mid' ? 50 : 70) : 30 + dominio * 0.5;
  const metros = lim(base + (dominio - 50) * 0.1, 22, 84);
  return lado === 'home' ? metros : C - metros;
}

/** A posse do minuto chegou: se mudou de lado, a mudança acontece como regra do jogo. */
export function aplicarPosse(co: Coreografo, p: PosseDoPlano): void {
  const antes = co.posseDoPlano;
  co.posseDoPlano = p;
  co.carregadorDoMinuto = p.ator;
  // Já tem um reinício acontecendo (no modo Lances os minutos voam): troca em silêncio.
  if (co.posse === p.lado || co.festa || co.t < co.reinicioAte) { co.posse = p.lado; return; }
  // A bola estava no ar: o passe é cortado onde ela está — e a troca acontece como regra.
  if (co.voo) { co.voo = null; co.dono = null; }
  const ataqueDeQuemPerdeu = antes?.zona === 'att' && antes.lado !== p.lado;
  const r = co.rnd();
  co.envolvidos = null;
  if (ataqueDeQuemPerdeu && r < 0.35) tiroDeMeta(co, p.lado);
  else if (ataqueDeQuemPerdeu && r < 0.6) impedimento(co, p.lado);
  else if (!ataqueDeQuemPerdeu && r < 0.3) lateral(co, p.lado);
  else roubada(co, p.lado, p.ator);
}

function roubada(co: Coreografo, lado: 'home' | 'away', ator: string): void {
  const prefer = co.corpos.find((c) => c.f.id === ator && c.f.lado === lado && Math.hypot(c.x - co.bola.x, c.z - co.bola.z) < 25);
  const ladrao = prefer ?? co.maisPerto(lado, co.bola.x, co.bola.z, true);
  if (!ladrao) { co.posse = lado; return; }
  ladrao.alvo = { x: co.bola.x, z: co.bola.z };
  co.reinicioAte = co.t + 1.2;
  co.depois(0.6, () => { ladrao.alvo = null; co.dono = ladrao; co.posse = lado; co.sons.push('roubada'); });
  co.proxToque = co.t + 1.6;
}

function lateral(co: Coreografo, lado: 'home' | 'away'): void {
  const ponto = { x: lim(co.bola.x, 4, C - 4), z: co.bola.z < L / 2 ? 0.3 : L - 0.3 };
  co.voo = { x0: co.bola.x, z0: co.bola.z, x1: ponto.x, z1: ponto.z, t: 0, dur: 0.6, altura: 0.4, para: null, fixo: true };
  co.dono = null;
  co.fita(T('LATERAL', 'THROW-IN'), ponto.x, ponto.z, 1.6);
  const cobrador = co.maisPerto(lado, ponto.x, ponto.z, true);
  if (cobrador) cobrador.alvo = { ...ponto };
  co.reinicioAte = co.t + 2.6;
  co.proxToque = co.t + 2.6;
  co.depois(1.8, () => {
    co.posse = lado;
    if (!cobrador) return;
    cobrador.x = cobrador.px = ponto.x; cobrador.z = cobrador.pz = ponto.z;
    co.bola = { x: ponto.x, z: ponto.z, h: 0 };
    const receptor = co.corpos.filter((c) => c.f.lado === lado && c !== cobrador && c.f.slot !== 'gol')
      .sort((a, b) => Math.hypot(a.x - ponto.x, a.z - ponto.z) - Math.hypot(b.x - ponto.x, b.z - ponto.z))[0];
    cobrador.alvo = null;
    if (receptor) { co.passar(receptor, 0.7, 1.4); co.sons.push('passe'); }
  });
}

function tiroDeMeta(co: Coreografo, lado: 'home' | 'away'): void {
  const linha = lado === 'home' ? 0.3 : C - 0.3;
  co.voo = { x0: co.bola.x, z0: co.bola.z, x1: linha, z1: lim(co.bola.z, L / 2 - 18, L / 2 + 18), t: 0, dur: 0.7, altura: 0.8, para: null, fixo: true };
  co.dono = null;
  co.fita(T('TIRO DE META', 'GOAL KICK'), linha, co.bola.z, 1.8);
  const goleiro = co.achar(lado, 'gol');
  const marca = { x: lado === 'home' ? 5.5 : C - 5.5, z: L / 2 + (co.rnd() < 0.5 ? -8 : 8) };
  co.reinicioAte = co.t + 3.6;
  co.proxToque = co.t + 3.6;
  co.depois(1.2, () => {
    co.bola = { ...marca, h: 0 };
    if (goleiro) goleiro.alvo = { x: marca.x - (lado === 'home' ? 1.5 : -1.5), z: marca.z };
  });
  co.depois(2.8, () => {
    co.posse = lado;
    if (goleiro) { goleiro.x = goleiro.px = marca.x; goleiro.z = goleiro.pz = marca.z; goleiro.alvo = null; co.dono = goleiro; }
    const alvo = co.corpos.filter((c) => c.f.lado === lado && c.f.slot !== 'gol')
      .sort((a, b) => Math.abs(a.x - C / 2) - Math.abs(b.x - C / 2))[0];
    if (alvo) { co.passar(alvo, 1.4, 4); co.sons.push('passe'); }
  });
}

function impedimento(co: Coreografo, lado: 'home' | 'away'): void {
  // `lado` é quem defende (e fica com a bola). O atacante passa da linha do último zagueiro.
  const ataca = outroLado(lado);
  const defensores = co.corpos.filter((c) => c.f.lado === lado && c.f.slot !== 'gol');
  if (!defensores.length) { roubada(co, lado, ''); return; }
  const ultimo = lado === 'away' ? Math.max(...defensores.map((c) => c.x)) : Math.min(...defensores.map((c) => c.x));
  const dir = ataca === 'home' ? 1 : -1;
  const corredor = co.achar(ataca, 'ata') ?? co.maisPerto(ataca, co.bola.x, co.bola.z, true);
  const passador = co.dono && co.dono.f.lado === ataca ? co.dono : co.maisPerto(ataca, co.bola.x, co.bola.z, true);
  if (!corredor || !passador || corredor === passador) { roubada(co, lado, ''); return; }
  const ponto = { x: lim(ultimo + dir * 3.5, 3, C - 3), z: lim(corredor.z, 10, L - 10) };
  corredor.alvo = { ...ponto };
  co.reinicioAte = co.t + 3.6;
  co.proxToque = co.t + 3.6;
  co.depois(0.5, () => {
    co.voo = { x0: co.bola.x, z0: co.bola.z, x1: ponto.x, z1: ponto.z, t: 0, dur: 0.8, altura: 0.6, para: corredor, fixo: true };
    co.dono = null;
    co.sons.push('passe');
  });
  co.depois(1.4, () => {
    co.fita(T('IMPEDIMENTO', 'OFFSIDE'), 0, 0, 1.8, true, corredor);
    co.sons.push('apito');
    corredor.alvo = null;
    co.voo = null;
    co.bola = { x: ponto.x, z: ponto.z, h: 0 };
    co.dono = null;
  });
  co.depois(2.8, () => {
    co.posse = lado;
    const cobrador = co.maisPerto(lado, ponto.x, ponto.z, true);
    if (!cobrador) return;
    cobrador.x = cobrador.px = ponto.x; cobrador.z = cobrador.pz = ponto.z;
    co.dono = cobrador;
    const receptor = co.corpos.filter((c) => c.f.lado === lado && c !== cobrador && c.f.slot !== 'gol')
      .sort((a, b) => Math.hypot(a.x - ponto.x, a.z - ponto.z) - Math.hypot(b.x - ponto.x, b.z - ponto.z))[1];
    if (receptor) { co.passar(receptor, 0.9, 0.5); co.sons.push('passe'); }
  });
}

/**
 * Um toque entre os lances — o portador DECIDE pelo perfil dele.
 * Devolve true se fez algo (o coreógrafo agenda o próximo toque).
 */
export function decidirToque(co: Coreografo, daVez: Corpo): boolean {
  const lado = daVez.f.lado;
  const dir = lado === 'home' ? 1 : -1;
  const avanco = profundidade(lado, daVez.x);
  const colegas = co.corpos.filter((c) => c.f.lado === lado && c !== daVez && c.f.slot !== 'gol');
  const cansado = daVez.f.fadiga > 70;

  // 1) O DRIBLADOR ENCARA: conduz pra cima do marcador no campo de ataque.
  //    Só com campo pela frente: colado na linha de fundo ele não encara o nada (ficava parado).
  const alvoDoDrible = { x: lim(daVez.x + dir * 9, 4, C - 4), z: lim(daVez.z + (L / 2 - daVez.z) * 0.2, 4, L - 4) };
  const temCampo = Math.abs(alvoDoDrible.x - daVez.x) > 5;
  if (!cansado && temCampo && avanco > 0.45 && (daVez.f.classe === 'ponta_driblador' || (daVez.f.drible ?? 0) >= 78) && co.rnd() < 0.45) {
    const alvo = alvoDoDrible;
    daVez.alvo = alvo;
    const marcador = co.maisPerto(lado === 'home' ? 'away' : 'home', alvo.x, alvo.z, true);
    if (marcador) marcador.alvo = { x: alvo.x, z: alvo.z };
    co.depois(1.3, () => { daVez.alvo = null; if (marcador) marcador.alvo = null; });
    co.proxToque = co.t + 1.6;
    return true;
  }
  // 2) O ARMADOR INVERTE: lançamento pro lado oposto, à frente.
  if (!cansado && (ARMADORES.has(daVez.f.classe ?? '') || (daVez.f.passe ?? 0) >= 80) && co.rnd() < 0.4) {
    const longe = colegas.filter((c) => Math.abs(c.z - daVez.z) > 20 && (c.x - daVez.x) * dir > -2)
      .sort((a, b) => Math.abs(b.z - daVez.z) - Math.abs(a.z - daVez.z))[0];
    if (longe) {
      if (ARMADORES.has(daVez.f.classe ?? '')) co.arcos.push({ x0: co.bola.x, z0: co.bola.z, x1: longe.x, z1: longe.z, em: co.t });
      co.passar(longe, 1.2, 3);
      co.sons.push('passe');
      co.proxToque = co.t + 2.2;
      return true;
    }
  }
  // 3) O VELOCISTA ATACA AS COSTAS: bola em profundidade, no espaço.
  if (avanco > 0.5 && co.rnd() < 0.35) {
    const vel = colegas.find((c) => c.f.classe === 'velocista' && (c.x - daVez.x) * dir > 4);
    if (vel) {
      const espaco = { x: lim(vel.x + dir * 8, 3, C - 3), z: vel.z };
      vel.alvo = { ...espaco };
      co.voo = { x0: co.bola.x, z0: co.bola.z, x1: espaco.x, z1: espaco.z, t: 0, dur: 0.9, altura: 0.3, para: vel, fixo: true };
      co.dono = null;
      co.depois(1.4, () => { vel.alvo = null; });
      co.sons.push('passe');
      co.proxToque = co.t + 2;
      return true;
    }
  }
  // 4) A bola chega em quem o plano diz que a carregou neste minuto.
  const carregador = co.carregadorDoMinuto ? colegas.find((c) => c.f.id === co.carregadorDoMinuto) : undefined;
  if (carregador && carregador !== co.ultimoPassador && Math.hypot(carregador.x - daVez.x, carregador.z - daVez.z) < 40) {
    co.carregadorDoMinuto = null;
    const longe = Math.hypot(carregador.x - daVez.x, carregador.z - daVez.z) > 22;
    co.passar(carregador, longe ? 1.1 : 0.7, longe ? 2.4 : 0.3);
    co.sons.push('passe');
    co.proxToque = co.t + 1.6 + co.rnd() * 1.2;
    return true;
  }
  // 5) O resto: passe pra quem está mais perto da zona de jogo — o cansado toca curto.
  const xAlvo = xDaZona(co, lado);
  const alcance = cansado ? 16 : 34;
  // Ninguém no alcance (o cansado isolado): toca no mais perto, onde estiver — senão a bola parava no pé dele pra sempre.
  const noAlcance = colegas.filter((c) => Math.hypot(c.x - daVez.x, c.z - daVez.z) < alcance);
  const maisPerto = [...colegas].sort((a, b) => Math.hypot(a.x - daVez.x, a.z - daVez.z) - Math.hypot(b.x - daVez.x, b.z - daVez.z)).slice(0, 2);
  const perto = noAlcance.length ? noAlcance : maisPerto;
  // Sem pingue-pongue: não devolve pra quem acabou de passar (só se não houver mais ninguém).
  const semVolta = perto.filter((c) => c !== co.ultimoPassador);
  const opcoes = semVolta.length ? semVolta : perto;
  if (!opcoes.length) return false;
  let alvo = opcoes[0]!, melhor = Infinity;
  for (const c of opcoes) {
    const nota = Math.abs(c.x - xAlvo) * 0.6 + Math.hypot(c.x - daVez.x, c.z - daVez.z) * 0.3 + co.rnd() * 14;
    if (nota < melhor) { melhor = nota; alvo = c; }
  }
  const longe = Math.hypot(alvo.x - daVez.x, alvo.z - daVez.z) > 22;
  co.passar(alvo, longe ? 1.1 : 0.7, longe ? 2.4 : 0.3);
  co.sons.push('passe');
  co.proxToque = co.t + (cansado ? 2.2 : 1.6) + co.rnd() * 1.6;
  return true;
}
