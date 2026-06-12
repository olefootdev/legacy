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
  { key: 'chutar', label: 'Chutar' },
  { key: 'driblar', label: 'Driblar' },
  { key: 'tocar', label: 'Tocar' },
];
const DEFEND_OPTIONS: ClutchOption[] = [
  { key: 'cercar', label: 'Cercar' },
  { key: 'carrinho', label: 'Carrinho' },
  { key: 'combate', label: 'Combate' },
];

interface CtxDef { context: string; best: ClutchKey }

const ATTACK_CONTEXTS: CtxDef[] = [
  { context: 'Cara a cara com o goleiro', best: 'driblar' },
  { context: 'Zagueiro fechando o ângulo', best: 'tocar' },
  { context: 'Sobrou limpa na pequena área', best: 'chutar' },
  { context: 'Dois marcadores em cima', best: 'tocar' },
  { context: 'Espaço na entrada da área', best: 'chutar' },
  { context: 'Companheiro livre na segunda trave', best: 'tocar' },
];
const DEFEND_CONTEXTS: CtxDef[] = [
  { context: 'Atacante dispara em velocidade', best: 'carrinho' },
  { context: 'Atacante protege a bola na área', best: 'cercar' },
  { context: 'Duelo de corpo, ombro a ombro', best: 'combate' },
  { context: 'Atacante isolado na pequena área', best: 'carrinho' },
  { context: 'Eles tabelam na entrada', best: 'cercar' },
];

const ATTACK_PAST: Record<AttackKey, string> = { chutar: 'Chutou', driblar: 'Tentou o drible', tocar: 'Tocou' };
const DEFEND_PAST: Record<DefendKey, string> = { cercar: 'Cercou', carrinho: 'Foi de carrinho', combate: 'Foi pro combate' };
const ATTACK_NOUN: Record<AttackKey, string> = { chutar: 'chutar', driblar: 'driblar', tocar: 'tocar' };
const DEFEND_NOUN: Record<DefendKey, string> = { cercar: 'cercar', carrinho: 'o carrinho', combate: 'o combate' };

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
        headline: `${pastTxt} e é GOL!`,
        feedback: right
          ? `Leitura perfeita — com ${lower(moment.context)}, ${bestNoun} era exatamente a saída.`
          : `Na sorte! Mas o mais seguro ali era ${bestNoun}.`,
      };
    }
    return {
      success: false,
      headline: `${pastTxt}… e perdeu!`,
      feedback: `Com ${lower(moment.context)}, ${bestNoun} era a melhor escolha.`,
    };
  }

  // Defesa
  const pastTxt = DEFEND_PAST[picked as DefendKey];
  const bestNoun = DEFEND_NOUN[moment.best as DefendKey];
  if (success) {
    return {
      success: true,
      headline: `${pastTxt} — salvou o gol!`,
      feedback: right
        ? `Na hora certa — com ${lower(moment.context)}, ${bestNoun} era o caminho.`
        : `Deu sorte, mas o ideal era ${bestNoun}.`,
    };
  }
  return {
    success: false,
    headline: `${pastTxt}… e sofreu o gol!`,
    feedback: `Com ${lower(moment.context)}, ${bestNoun} segurava a jogada.`,
  };
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
