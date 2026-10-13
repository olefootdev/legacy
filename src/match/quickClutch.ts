/**
 * quickClutch — o MOMENTO DECISIVO antes de cada gol (alma do Quick Match).
 *
 * Quando o plano aponta um gol natural, o jogo PAUSA e entrega uma escolha de
 * última fração de segundo, com CONTEXTO da jogada:
 *   • Atacando (chance clara): Chutar / Driblar / Tocar
 *   • Defendendo (perigo): Cercar / Carrinho / Combate
 *
 * UMA VERDADE SÓ (Partida Viva, Fase 0): o desfecho de CADA opção já vem
 * decidido do motor (`event.decisivo.opcoes`, server/smartfield/decisivo.py).
 * Este módulo não sorteia nada: traduz a chave do contexto em texto PT/EN,
 * monta o duelo pra tela e escreve a manchete do desfecho escolhido.
 */

import type { MatchPlanEvent } from './quickPlanTypes';
import { L } from '@/i18n/L';

export type ClutchIntent = 'attack' | 'defend';
export type AttackKey = 'chutar' | 'driblar' | 'tocar';
export type DefendKey = 'cercar' | 'carrinho' | 'combate';
export type ClutchKey = AttackKey | DefendKey;

export interface ClutchOption {
  key: ClutchKey;
  label: string;
}

export interface ClutchMoment {
  intent: ClutchIntent;
  minute: number;
  /** Contexto da jogada — define qual escolha é a melhor. */
  context: string;
  options: ClutchOption[];
  best: ClutchKey;
  actorName: string;
  /** Com quem é o duelo: atacando, quem tenta parar o nosso; defendendo, quem dos nossos enfrenta. */
  rival: Rival;
  /** opção → o gol acontece? (do motor). */
  opcoes: Record<string, boolean>;
}

export type Rival = 'goleiro' | 'zagueiro' | 'meio';
export type AtributoDoDuelo = 'finalizacao' | 'drible' | 'passe' | 'marcacao' | 'fisico' | 'velocidade';

/** Um lado do duelo: o jogador e os atributos que importam. */
export interface Lutador { id: string; nome: string; attrs: Partial<Record<AtributoDoDuelo, number>> }

/** O duelo: atributo contra atributo, por escolha — só pra tela (o desfecho já veio decidido). */
export interface Duelo {
  nosso: Lutador;
  deles: Lutador;
  porOpcao: Partial<Record<ClutchKey, { nosso: number; deles: number; rotuloNosso: string; rotuloDeles: string }>>;
}

/** Que atributo nosso enfrenta que atributo deles, em cada escolha (espelho de decisivo.py). */
const CONFRONTO: Record<ClutchKey, [AtributoDoDuelo, AtributoDoDuelo]> = {
  chutar: ['finalizacao', 'marcacao'],
  driblar: ['drible', 'marcacao'],
  tocar: ['passe', 'marcacao'],
  cercar: ['marcacao', 'drible'],
  carrinho: ['velocidade', 'velocidade'],
  combate: ['fisico', 'fisico'],
};
const ROTULO_ATTR: Record<AtributoDoDuelo, string> = {
  finalizacao: L('Finalização', 'Finishing'), drible: L('Drible', 'Dribbling'), passe: L('Passe', 'Passing'),
  marcacao: L('Marcação', 'Marking'), fisico: L('Físico', 'Physical'), velocidade: L('Velocidade', 'Pace'),
};

const ATTACK_OPTIONS: ClutchOption[] = [
  { key: 'chutar', label: L('Chutar', 'Shoot') },
  { key: 'driblar', label: L('Driblar', 'Dribble') },
  { key: 'tocar', label: L('Tocar', 'Pass') },
];
const DEFEND_OPTIONS: ClutchOption[] = [
  { key: 'cercar', label: L('Cercar', 'Close down') },
  { key: 'carrinho', label: L('Carrinho', 'Slide tackle') },
  { key: 'combate', label: L('Combate', 'Challenge') },
];

/** Chave do contexto (decisivo.py) → texto. A opção certa e o rival vêm do motor. */
const CONTEXTO_TEXTO: Record<string, string> = {
  cara_a_cara: L('Cara a cara com o goleiro', 'One-on-one with the keeper'),
  zagueiro_fechando: L('Zagueiro fechando o ângulo', 'Defender closing the angle'),
  sobrou_limpa: L('Sobrou limpa na pequena área', 'Loose ball in the six-yard box'),
  dois_marcadores: L('Dois marcadores em cima', 'Two markers closing in'),
  espaco_na_entrada: L('Espaço na entrada da área', 'Space at the edge of the box'),
  companheiro_livre: L('Companheiro livre na segunda trave', 'Teammate free at the back post'),
  dispara_em_velocidade: L('Atacante dispara em velocidade', 'Forward bursting through at pace'),
  protege_a_bola: L('Atacante protege a bola na área', 'Forward shielding the ball in the box'),
  ombro_a_ombro: L('Duelo de corpo, ombro a ombro', 'Physical duel, shoulder to shoulder'),
  isolado_na_pequena_area: L('Atacante isolado na pequena área', 'Forward alone in the six-yard box'),
  tabelam_na_entrada: L('Eles tabelam na entrada', 'They play a one-two at the edge'),
};

/** Texto do contexto (a prancheta da arena mostra o momento antes do desfecho). */
export function textoDoContexto(chave: string, intent: ClutchIntent): string {
  return CONTEXTO_TEXTO[chave] ?? (intent === 'attack' ? L('Chance clara', 'Clear chance') : L('Perigo na área', 'Danger in the box'));
}

/** Rótulo de uma opção e os atributos que ela põe frente a frente (nosso × deles). */
export function rotuloDaOpcao(key: string): { rotulo: string; nosso: string; deles: string } {
  const o = [...ATTACK_OPTIONS, ...DEFEND_OPTIONS].find((x) => x.key === key);
  const par = CONFRONTO[key as ClutchKey];
  return { rotulo: o?.label ?? key, nosso: par ? ROTULO_ATTR[par[0]] : '', deles: par ? ROTULO_ATTR[par[1]] : '' };
}

const ATTACK_KEYS = new Set<string>(['chutar', 'driblar', 'tocar']);
const DEFEND_KEYS = new Set<string>(['cercar', 'carrinho', 'combate']);

/**
 * Monta o momento decisivo a partir do que o motor emitiu no gol. Null quando
 * o lance não traz `decisivo` (plano de antes da Fase 0): o gol vale direto.
 */
export function montarDecisivo(ev: MatchPlanEvent, fallbackName: string): ClutchMoment | null {
  const d = ev.decisivo;
  if (!d || !d.opcoes || !Object.keys(d.opcoes).length) return null;
  const intent: ClutchIntent = d.intent === 'defend' ? 'defend' : 'attack';
  const keys = intent === 'attack' ? ATTACK_KEYS : DEFEND_KEYS;
  const options = (intent === 'attack' ? ATTACK_OPTIONS : DEFEND_OPTIONS).filter((o) => o.key in d.opcoes);
  if (!options.length) return null;
  const best = (keys.has(d.melhor) ? d.melhor : options[0]!.key) as ClutchKey;
  const rival: Rival = d.rival === 'goleiro' || d.rival === 'meio' ? d.rival : 'zagueiro';
  return {
    intent, minute: ev.minute, options, best, rival,
    context: CONTEXTO_TEXTO[d.contexto] ?? (intent === 'attack' ? L('Chance clara', 'Clear chance') : L('Perigo na área', 'Danger in the box')),
    actorName: ev.actor_name ?? fallbackName,
    opcoes: { ...d.opcoes },
  };
}

/** O duelo pra tela, com os números que o motor usou (nosso × deles por opção). */
export function dueloDoDecisivo(ev: MatchPlanEvent, moment: ClutchMoment): Duelo | null {
  const d = ev.decisivo;
  if (!d?.duelo) return null;
  const porOpcao: Duelo['porOpcao'] = {};
  const nosso: Lutador = { id: d.duelo.nosso?.id ?? '', nome: d.duelo.nosso?.nome ?? '', attrs: {} };
  const deles: Lutador = { id: d.duelo.deles?.id ?? '', nome: d.duelo.deles?.nome ?? '', attrs: {} };
  for (const o of moment.options) {
    const par = d.duelo.por_opcao?.[o.key];
    if (!par) continue;
    const [an, ad] = CONFRONTO[o.key];
    nosso.attrs[an] = par[0];
    deles.attrs[ad] = par[1];
    porOpcao[o.key] = {
      nosso: Math.round(par[0]), deles: Math.round(par[1]),
      rotuloNosso: ROTULO_ATTR[an],
      rotuloDeles: moment.intent === 'attack' && moment.rival === 'goleiro' && ad === 'marcacao' ? L('Goleiro', 'Keeper') : ROTULO_ATTR[ad],
    };
  }
  return { nosso, deles, porOpcao };
}

export interface ClutchResult {
  success: boolean;
  headline: string;
  feedback: string;
}

const ATTACK_PAST: Record<AttackKey, string> = { chutar: L('Chutou', 'Shot'), driblar: L('Tentou o drible', 'Tried the dribble'), tocar: L('Tocou', 'Passed') };
const DEFEND_PAST: Record<DefendKey, string> = { cercar: L('Cercou', 'Closed down'), carrinho: L('Foi de carrinho', 'Went to ground'), combate: L('Foi pro combate', 'Went into the challenge') };
const ATTACK_NOUN: Record<AttackKey, string> = { chutar: L('chutar', 'shooting'), driblar: L('driblar', 'dribbling'), tocar: L('tocar', 'passing') };
const DEFEND_NOUN: Record<DefendKey, string> = { cercar: L('cercar', 'closing down'), carrinho: L('o carrinho', 'the slide tackle'), combate: L('o combate', 'the challenge') };

/**
 * A manchete e o feedback do desfecho ESCOLHIDO. `golAconteceu` é o que o
 * motor decidiu pra esta opção; atacando, sucesso = gol; defendendo, sucesso =
 * gol evitado. O feedback sempre cita a melhor escolha quando erra.
 */
export function textoDoDesfecho(moment: ClutchMoment, picked: ClutchKey, golAconteceu: boolean): ClutchResult {
  const right = picked === moment.best;
  const success = moment.intent === 'attack' ? golAconteceu : !golAconteceu;

  if (moment.intent === 'attack') {
    const pastTxt = ATTACK_PAST[picked as AttackKey];
    const bestNoun = ATTACK_NOUN[moment.best as AttackKey];
    if (success) {
      return {
        success: true,
        headline: L(`${pastTxt} e é GOL!`, `${pastTxt} and it's a GOAL!`),
        feedback: right
          ? L(`Leitura perfeita — com ${lower(moment.context)}, ${bestNoun} era exatamente a saída.`, `Perfect read — with ${lower(moment.context)}, ${bestNoun} was exactly the answer.`)
          : L(`Na sorte! Mas o mais seguro ali era ${bestNoun}.`, `Lucky! But the safer option was ${bestNoun}.`),
      };
    }
    return {
      success: false,
      headline: L(`${pastTxt}… e perdeu!`, `${pastTxt}… and lost it!`),
      feedback: L(`Com ${lower(moment.context)}, ${bestNoun} era a melhor escolha.`, `With ${lower(moment.context)}, ${bestNoun} was the best choice.`),
    };
  }

  // Defesa
  const pastTxt = DEFEND_PAST[picked as DefendKey];
  const bestNoun = DEFEND_NOUN[moment.best as DefendKey];
  if (success) {
    return {
      success: true,
      headline: L(`${pastTxt} — salvou o gol!`, `${pastTxt} — goal saved!`),
      feedback: right
        ? L(`Na hora certa — com ${lower(moment.context)}, ${bestNoun} era o caminho.`, `Perfect timing — with ${lower(moment.context)}, ${bestNoun} was the way.`)
        : L(`Deu sorte, mas o ideal era ${bestNoun}.`, `Got lucky, but the ideal was ${bestNoun}.`),
    };
  }
  return {
    success: false,
    headline: L(`${pastTxt}… e sofreu o gol!`, `${pastTxt}… and conceded!`),
    feedback: L(`Com ${lower(moment.context)}, ${bestNoun} segurava a jogada.`, `With ${lower(moment.context)}, ${bestNoun} would have stopped it.`),
  };
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
