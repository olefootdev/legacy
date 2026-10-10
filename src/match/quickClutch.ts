/**
 * quickClutch — o MOMENTO DECISIVO antes de cada gol (alma do Quick Match).
 *
 * Quando o plano do Python aponta um gol, o jogo PAUSA e entrega uma escolha
 * de última fração de segundo, com CONTEXTO da jogada:
 *   • Atacando (chance clara): Chutar / Driblar / Tocar
 *   • Defendendo (perigo): Cercar / Carrinho / Combate
 *
 * Cada contexto tem uma escolha CERTA (ler a jogada é a skill). Acertou →
 * faz/salva o gol; errou → perde/sofre — e o feedback diz o que era melhor.
 * "Chutou, foi pra fora — com o zagueiro fechando, tocar era a saída."
 *
 * Determinístico: SpiritRng(seed + minuto + escolha). Pesa também o atributo
 * relevante do protagonista quando disponível (finalização/drible/passe etc).
 */

import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import { hashSeed } from './quickBeatDirector';
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
  /**
   * Partida Viva, Fase 9 — com quem é o duelo. Atacando: quem tenta parar o
   * nosso (goleiro ou zagueiro). Defendendo: quem dos nossos enfrenta o atacante.
   */
  rival: Rival;
}

export type Rival = 'goleiro' | 'zagueiro' | 'meio';
export type AtributoDoDuelo = 'finalizacao' | 'drible' | 'passe' | 'marcacao' | 'fisico' | 'velocidade';

/** Um lado do duelo: o jogador e os atributos que importam. */
export interface Lutador { id: string; nome: string; attrs: Partial<Record<AtributoDoDuelo, number>> }

/** O duelo: atributo contra atributo, por escolha. É o que o resultado sente. */
export interface Duelo {
  nosso: Lutador;
  deles: Lutador;
  porOpcao: Partial<Record<ClutchKey, { nosso: number; deles: number; rotuloNosso: string; rotuloDeles: string }>>;
}

/** Que atributo nosso enfrenta que atributo deles, em cada escolha. */
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

/** Monta o duelo (atributo × atributo por escolha). Sem atributo, 60. */
export function duelo(moment: ClutchMoment, nosso: Lutador, deles: Lutador): Duelo {
  const porOpcao: Duelo['porOpcao'] = {};
  for (const o of moment.options) {
    const [an, ad] = CONFRONTO[o.key];
    porOpcao[o.key] = {
      nosso: Math.round(nosso.attrs[an] ?? 60), deles: Math.round(deles.attrs[ad] ?? 60),
      rotuloNosso: ROTULO_ATTR[an],
      rotuloDeles: moment.intent === 'attack' && moment.rival === 'goleiro' && ad === 'marcacao' ? L('Goleiro', 'Keeper') : ROTULO_ATTR[ad],
    };
  }
  return { nosso, deles, porOpcao };
}

/**
 * O atributo que entra no `resolveClutch`: 70 (o de sempre) + a vantagem no
 * duelo. Empate = o jogo de antes; +20 de vantagem ≈ +3 pp; teto ±7 pp.
 */
export function forcaNoDuelo(d: Duelo | null | undefined, key: ClutchKey): number {
  const c = d?.porOpcao[key];
  if (!c) return 70;
  return Math.max(30, Math.min(100, 70 + (c.nosso - c.deles) * 0.8));
}

export interface ClutchResult {
  success: boolean;
  headline: string;
  feedback: string;
}

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

interface CtxDef { context: string; best: ClutchKey; rival: Rival }

const ATTACK_CONTEXTS: CtxDef[] = [
  { context: L('Cara a cara com o goleiro', 'One-on-one with the keeper'), best: 'driblar', rival: 'goleiro' },
  { context: L('Zagueiro fechando o ângulo', 'Defender closing the angle'), best: 'tocar', rival: 'zagueiro' },
  { context: L('Sobrou limpa na pequena área', 'Loose ball in the six-yard box'), best: 'chutar', rival: 'goleiro' },
  { context: L('Dois marcadores em cima', 'Two markers closing in'), best: 'tocar', rival: 'zagueiro' },
  { context: L('Espaço na entrada da área', 'Space at the edge of the box'), best: 'chutar', rival: 'goleiro' },
  { context: L('Companheiro livre na segunda trave', 'Teammate free at the back post'), best: 'tocar', rival: 'zagueiro' },
];
const DEFEND_CONTEXTS: CtxDef[] = [
  { context: L('Atacante dispara em velocidade', 'Forward bursting through at pace'), best: 'carrinho', rival: 'zagueiro' },
  { context: L('Atacante protege a bola na área', 'Forward shielding the ball in the box'), best: 'cercar', rival: 'zagueiro' },
  { context: L('Duelo de corpo, ombro a ombro', 'Physical duel, shoulder to shoulder'), best: 'combate', rival: 'zagueiro' },
  { context: L('Atacante isolado na pequena área', 'Forward alone in the six-yard box'), best: 'carrinho', rival: 'goleiro' },
  { context: L('Eles tabelam na entrada', 'They play a one-two at the edge'), best: 'cercar', rival: 'meio' },
];

const ATTACK_PAST: Record<AttackKey, string> = { chutar: L('Chutou', 'Shot'), driblar: L('Tentou o drible', 'Tried the dribble'), tocar: L('Tocou', 'Passed') };
const DEFEND_PAST: Record<DefendKey, string> = { cercar: L('Cercou', 'Closed down'), carrinho: L('Foi de carrinho', 'Went to ground'), combate: L('Foi pro combate', 'Went into the challenge') };
const ATTACK_NOUN: Record<AttackKey, string> = { chutar: L('chutar', 'shooting'), driblar: L('driblar', 'dribbling'), tocar: L('tocar', 'passing') };
const DEFEND_NOUN: Record<DefendKey, string> = { cercar: L('cercar', 'closing down'), carrinho: L('o carrinho', 'the slide tackle'), combate: L('o combate', 'the challenge') };

/** Monta o momento decisivo a partir do lado e do minuto (determinístico). */
export function buildClutch(opts: {
  intent: ClutchIntent;
  minute: number;
  seed: string;
  actorName: string;
}): ClutchMoment {
  const { intent, minute, seed, actorName } = opts;
  const rng = new SpiritRng(hashSeed(`${seed}:clutchctx:${minute}`));
  const pool = intent === 'attack' ? ATTACK_CONTEXTS : DEFEND_CONTEXTS;
  const def = pool[Math.floor(rng.next() * pool.length)]!;
  return {
    intent,
    minute,
    context: def.context,
    options: intent === 'attack' ? ATTACK_OPTIONS : DEFEND_OPTIONS,
    best: def.best,
    actorName,
    rival: def.rival,
  };
}

/**
 * Resolve o momento. Acertar o contexto é o que mais pesa; o atributo relevante
 * do protagonista (0-100) dá um empurrão. Retorna sucesso + manchete + feedback.
 */
export function resolveClutch(
  moment: ClutchMoment,
  picked: ClutchKey,
  seed: string,
  actorAttr = 70,
): ClutchResult {
  const rng = new SpiritRng(hashSeed(`${seed}:clutch:${moment.minute}:${picked}`));
  const right = picked === moment.best;
  const attrBonus = (actorAttr - 60) / 100 * 0.18; // ±~0.07
  const baseProb = right ? 0.82 : 0.30;
  const prob = Math.max(0.12, Math.min(0.95, baseProb + attrBonus));
  const success = rng.next() < prob;

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
