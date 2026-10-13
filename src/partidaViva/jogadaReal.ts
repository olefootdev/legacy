/**
 * PARTIDA VIVA — o campo encena a VERDADE entre os lances (Fase 2 do Motor de
 * Posses, docs/MOTOR-DE-POSSES.md).
 *
 * Antes, entre os lances, o campo inventava o jogo: todo passe acertava, a
 * pressão nunca desarmava e lateral, tiro de meta e impedimento eram sorteados
 * (`jogoAmbiente.ts`). Agora o motor manda a posse de cada minuto (`jogada`) e
 * o campo toca ESSA posse:
 *   - as ações reais, nos pés de quem fez, com a bola perdida onde foi perdida
 *     (passe interceptado, drible desarmado, condução roubada);
 *   - o reinício que ACONTECEU (lateral, tiro de meta, impedimento, falta) — e
 *     só ele;
 *   - comprimida quando o minuto é curto (modo Lances): toca o FIM da posse,
 *     o que leva ao que vem depois; o começo é o que o relógio pulou.
 *
 * Nada aqui sorteia: o filme (Fase 6) continua idêntico entregando os mesmos
 * quadros nos mesmos passos.
 */
import type { AcaoDaJogada, JogadaDoPlano } from '@/match/quickPlanTypes';
import { C, L, lim, type Corpo } from './fisica';
import type { Coreografo } from './coreografo';
import { lateral, tiroDeMeta } from './jogoAmbiente';
import { L as T } from '@/i18n/L';

const VOA = new Set(['passe', 'lancamento', 'cruzamento']);
const CORRE = new Set(['conducao', 'drible']);
/** Ações que só existem em lance (o lance do plano encena; a jogada pula). */
const SO_EM_LANCE = new Set(['chute', 'cabeceio', 'cobranca', 'cobranca_falta', 'escanteio', 'desvio']);

/** Duração natural de uma ação (s), pela distância — a mesma régua do cronograma dos lances. */
export function duracaoDaAcao(ac: AcaoDaJogada, de: { x: number; z: number }): number {
  const dist = Math.hypot(ac.x - de.x, ac.z - de.z);
  if (VOA.has(ac.t)) return lim(dist / 24, 0.35, 1.1);
  if (CORRE.has(ac.t)) return lim(dist / 8, 0.6, 2.4);
  return 0.6;
}

/** Quanto tempo de reinício cada tipo pede antes das ações (s). */
const PREPARO: Partial<Record<JogadaDoPlano['inicio'], number>> = { lateral: 2.6, tiro_meta: 3.6, impedimento: 2.2, falta: 1.6 };

/**
 * As ações que cabem no tempo: o FIM da posse (o que leva ao que vem depois).
 * O desarme do começo (a roubada) fica sempre — é ele que conta quem pegou a bola.
 */
export function cortarParaCaber(acoes: readonly AcaoDaJogada[], tempo: number, inicio: { x: number; z: number }): AcaoDaJogada[] {
  const jogaveis = acoes.filter((a) => !SO_EM_LANCE.has(a.t));
  if (!jogaveis.length) return [];
  const roubada = jogaveis[0]!.t === 'desarme' ? [jogaveis[0]!] : [];
  const resto = roubada.length ? jogaveis.slice(1) : jogaveis;
  const out: AcaoDaJogada[] = [];
  let usado = roubada.length ? 0.6 : 0;
  for (let i = resto.length - 1; i >= 0; i--) {
    const ant = i > 0 ? resto[i - 1]! : (roubada[0] ?? inicio);
    const d = duracaoDaAcao(resto[i]!, ant);
    if (out.length && usado + d > tempo) break;
    out.unshift(resto[i]!);
    usado += d;
  }
  return [...roubada, ...out];
}

const ladoDe = (j: JogadaDoPlano): 'home' | 'away' => (j.lado === 'h' ? 'home' : 'away');

/**
 * A posse do minuto chegou. Cancela o que sobrou da anterior e toca esta.
 * Lance do plano em cena ou bola parada montada: a posse muda em silêncio.
 */
export function tocarJogada(co: Coreografo, j: JogadaDoPlano): void {
  const lado = ladoDe(j);
  // Quanto dura um minuto na tela agora (média das chegadas): é o orçamento da jogada.
  if (co.jogadaChegouEm >= 0) {
    const passou = lim(co.t - co.jogadaChegouEm, 0.8, 8);
    co.minutoNaTela = co.minutoNaTela < 0 ? passou : co.minutoNaTela * 0.6 + passou * 0.4;
  }
  co.jogadaChegouEm = co.t;
  co.jogadaSeq++;
  for (const c of co.jogadaAlvos) c.alvo = null;
  co.jogadaAlvos.clear();
  if (co.t < co.encenandoAte || co.posicionados.size || co.festa) { co.posse = lado; return; }

  const seq = co.jogadaSeq;
  const vale = () => seq === co.jogadaSeq;
  const por = (id: string | null | undefined) => (id ? co.corpos.find((c) => c.f.id === id) ?? null : null);
  const orcamento = (co.minutoNaTela < 0 ? 1.6 : co.minutoNaTela) * 0.9;

  // 1) O reinício que aconteceu (só ele).
  let t0 = co.voo ? Math.max(0, co.voo.dur - co.voo.t) : 0;
  const prep = PREPARO[j.inicio] ?? 0;
  const primeira = j.acoes.find((a) => !SO_EM_LANCE.has(a.t));
  if (prep && primeira && co.reinicioAte <= co.t) {
    co.voo = null;
    if (j.inicio === 'lateral') lateral(co, lado);
    else if (j.inicio === 'tiro_meta') tiroDeMeta(co, lado);
    else if (j.inicio === 'impedimento') impedimentoMarcado(co, lado, primeira, vale);
    else if (j.inicio === 'falta') faltaMarcada(co, lado, por(primeira.de), vale);
    t0 = Math.max(t0, co.reinicioAte - co.t);
  }
  co.posse = lado;
  if (!j.acoes.length) {
    const p = j.portador ? por(j.portador.id) : null;
    if (p && co.dono !== p && !co.voo) co.dono = p;
    return;
  }

  // 2) As ações, comprimidas pro tempo do minuto.
  const acoes = cortarParaCaber(j.acoes, Math.max(0.6, orcamento - t0), co.bola);
  let t = t0;
  let onde = { x: co.bola.x, z: co.bola.z };
  // Ponte: a 1ª ação é de alguém do mesmo time que não está com a bola — ela chega nele
  // (é o pedaço da posse que o relógio pulou), sem teleporte.
  const abre = acoes[0];
  if (abre && abre.t !== 'desarme') {
    const de = por(abre.de);
    if (de && co.dono && co.dono !== de && co.dono.f.lado === de.f.lado) {
      const dur = duracaoDaAcao({ ...abre, x: de.x, z: de.z }, onde);
      co.depois(t, () => { if (vale() && !co.voo) { co.passar(de, dur, 0.3); co.sons.push('passe'); } });
      t += dur;
    } else if (de && (!co.dono || co.dono.f.lado !== de.f.lado)) {
      // A bola estava solta ou com o rival: quem age primeiro vai buscá-la.
      seguir(co, de, onde);
      co.depois(t + 0.5, () => { if (vale()) { co.dono = de; co.voo = null; } });
      t += 0.6;
    }
  }
  for (const ac of acoes) {
    const de = por(ac.de);
    const para = por(ac.para);
    if (!de) continue;
    const dur = duracaoDaAcao(ac, onde);
    const ponto = { x: ac.x, z: ac.z };
    const falhou = ac.ok === 0;
    co.depois(t, () => { if (vale()) executar(co, ac, de, para, ponto, dur, falhou, vale); });
    t += dur;
    onde = ponto;
  }
  co.jogadaAte = co.t + t;
  co.proxToque = co.jogadaAte + 0.4;
}

/** Corre pra um ponto (e o alvo é solto quando a próxima jogada chegar). */
function seguir(co: Coreografo, c: Corpo, ponto: { x: number; z: number }): void {
  c.alvo = { x: lim(ponto.x, 0.6, C - 0.6), z: lim(ponto.z, 0.6, L - 0.6) };
  co.jogadaAlvos.add(c);
}

function executar(co: Coreografo, ac: AcaoDaJogada, de: Corpo, para: Corpo | null, ponto: { x: number; z: number }, dur: number, falhou: boolean, vale: () => boolean): void {
  // Os passos de dentro da ação também conferem: a jogada seguinte já pode ter chegado.
  const depois = (seg: number, faz: () => void) => co.depois(seg, () => { if (vale()) faz(); });
  const rival = de.f.lado === 'home' ? 'away' : 'home';
  switch (ac.t) {
    case 'passe':
    case 'lancamento':
    case 'cruzamento': {
      // Ok: o receptor ataca o ponto e a bola chega nele. Falhou: a bola vai ao ponto
      // e quem corta é o rival mais perto dali (a posse seguinte começa com ele).
      const recebe = falhou ? co.maisPerto(rival, ponto.x, ponto.z, true) : para;
      if (recebe) seguir(co, recebe, ponto);
      if (co.dono !== de && !co.voo) co.dono = de;
      co.ultimoPassador = de;
      const altura = ac.t === 'passe' ? 0.3 : ac.t === 'cruzamento' ? 2.4 : 1.8;
      co.voo = { x0: co.bola.x, z0: co.bola.z, x1: ponto.x, z1: ponto.z, t: 0, dur, altura, para: recebe, fixo: true };
      co.dono = null;
      if (ac.t === 'lancamento' && (de.f.classe === 'regista' || de.f.classe === 'maestro')) co.arcos.push({ x0: co.bola.x, z0: co.bola.z, x1: ponto.x, z1: ponto.z, em: co.t });
      co.sons.push('passe');
      if (falhou && recebe) depois(dur, () => { co.posse = recebe.f.lado; });
      break;
    }
    case 'conducao':
    case 'drible': {
      if (!co.voo) co.dono = de;
      seguir(co, de, ponto);
      if (para) seguir(co, para, ac.t === 'drible' && !falhou ? { x: de.x, z: de.z } : ponto);
      if (falhou) {
        // Perdeu: o marcador (ou o rival mais perto) fica com a bola no fim da corrida.
        const ladrao = para ?? co.maisPerto(rival, ponto.x, ponto.z, true);
        depois(dur * 0.7, () => {
          if (!ladrao) return;
          co.dono = ladrao; co.posse = ladrao.f.lado; co.voo = null;
          co.sons.push('roubada');
          co.fita(T('ROUBOU!', 'WON IT!'), 0, 0, 1.2, false, ladrao);
        });
      } else if (ac.t === 'drible' && ac.skill) {
        co.registrarSkill(ac.skill, ac.skill_nota ?? 0, de);
      }
      break;
    }
    case 'desarme': {
      seguir(co, de, { x: co.bola.x, z: co.bola.z });
      // Antes do fim da ação (o passo arredonda até 0,1 s): a próxima ação não pode ser atropelada.
      depois(Math.min(dur, 0.6) * 0.65, () => {
        co.voo = null; co.dono = de; co.posse = de.f.lado;
        co.sons.push('roubada');
      });
      break;
    }
    case 'falta': {
      // Quem derruba chega em quem conduzia; apito e a fita. A cobrança é a posse seguinte.
      if (para) seguir(co, de, { x: para.x, z: para.z });
      depois(Math.min(dur, 0.6) * 0.65, () => {
        co.sons.push('apito');
        co.fita(T('FALTA', 'FOUL'), 0, 0, 1.4, false, para ?? de);
        co.voo = null; co.dono = null;
        co.bola = { x: ponto.x, z: ponto.z, h: 0 };
      });
      break;
    }
    default:
      break;
  }
}

/** Impedimento marcado: o apito, a fita no atacante adiantado, a defesa cobra onde a bola parou. */
function impedimentoMarcado(co: Coreografo, lado: 'home' | 'away', primeira: AcaoDaJogada, vale: () => boolean): void {
  const ataca = lado === 'home' ? 'away' : 'home';
  const adiantado = co.maisPerto(ataca, co.bola.x, co.bola.z, true);
  co.sons.push('apito');
  if (adiantado) co.fita(T('IMPEDIMENTO', 'OFFSIDE'), 0, 0, 1.8, true, adiantado);
  const cobrador = co.corpos.find((c) => c.f.id === primeira.de) ?? co.maisPerto(lado, co.bola.x, co.bola.z, true);
  co.voo = null; co.dono = null;
  co.reinicioAte = co.t + (PREPARO.impedimento ?? 2);
  if (cobrador) {
    seguir(co, cobrador, { x: co.bola.x, z: co.bola.z });
    co.depois(1.6, () => { if (vale()) { co.dono = cobrador; co.posse = lado; } });
  }
}

/** Falta (fora da área de perigo) marcada: a bola parada onde foi, quem cobra chega nela. */
function faltaMarcada(co: Coreografo, lado: 'home' | 'away', cobrador: Corpo | null, vale: () => boolean): void {
  co.voo = null; co.dono = null;
  co.reinicioAte = co.t + (PREPARO.falta ?? 1.4);
  const quem = cobrador ?? co.maisPerto(lado, co.bola.x, co.bola.z, true);
  if (!quem) return;
  seguir(co, quem, { x: co.bola.x - (lado === 'home' ? 1 : -1), z: co.bola.z });
  co.depois(1.2, () => { if (vale()) { co.dono = quem; co.posse = lado; } });
}
