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

interface CtxDef { context: string; best: ClutchKey }

const ATTACK_CONTEXTS: CtxDef[] = [
  { context: L('Cara a cara com o goleiro', 'One-on-one with the keeper'), best: 'driblar' },
  { context: L('Zagueiro fechando o ângulo', 'Defender closing the angle'), best: 'tocar' },
  { context: L('Sobrou limpa na pequena área', 'Loose ball in the six-yard box'), best: 'chutar' },
  { context: L('Dois marcadores em cima', 'Two markers closing in'), best: 'tocar' },
  { context: L('Espaço na entrada da área', 'Space at the edge of the box'), best: 'chutar' },
  { context: L('Companheiro livre na segunda trave', 'Teammate free at the back post'), best: 'tocar' },
];
const DEFEND_CONTEXTS: CtxDef[] = [
  { context: L('Atacante dispara em velocidade', 'Forward bursting through at pace'), best: 'carrinho' },
  { context: L('Atacante protege a bola na área', 'Forward shielding the ball in the box'), best: 'cercar' },
  { context: L('Duelo de corpo, ombro a ombro', 'Physical duel, shoulder to shoulder'), best: 'combate' },
  { context: L('Atacante isolado na pequena área', 'Forward alone in the six-yard box'), best: 'carrinho' },
  { context: L('Eles tabelam na entrada', 'They play a one-two at the edge'), best: 'cercar' },
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
