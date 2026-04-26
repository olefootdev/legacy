import type { PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';

export type QuickMomentType =
  | 'counter_attack'
  | 'set_piece'
  | 'defensive_choice'
  | 'sub_timing';

export interface QuickMomentChoice {
  id: string;
  label: string;
  description: string;
  successChance: number;
  reward: {
    ole?: number;
    exp?: number;
  };
  momentumImpact: number;
}

export interface QuickInteractiveMoment {
  id: string;
  minute: number;
  type: QuickMomentType;
  context: string;
  choices: QuickMomentChoice[];
  timeoutMs: number;
  triggeredAtMs: number;
}

export interface QuickMomentOutcome {
  momentId: string;
  choiceId: string;
  success: boolean;
  narrative: string;
  rewards: {
    ole: number;
    exp: number;
  };
  momentumDelta: number;
}

interface MomentTriggerContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  homePlayers: PitchPlayerState[];
  momentum: { home: number; away: number };
}

function calculateSuccessChance(
  baseChance: number,
  playerAttrs: MatchPlayerAttributes,
  relevantAttr: keyof MatchPlayerAttributes,
): number {
  const attrValue = playerAttrs[relevantAttr] ?? 50;
  const attrBonus = (attrValue - 50) * 0.004;
  return Math.max(0.1, Math.min(0.95, baseChance + attrBonus));
}

export function shouldTriggerCounterAttack(ctx: MomentTriggerContext): boolean {
  if (ctx.minute < 15 || ctx.minute > 85) return false;
  if (ctx.possession !== 'home') return false;
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  if (scoreDiff > 2) return false;
  const momentumDiff = ctx.momentum.home - ctx.momentum.away;
  return momentumDiff > 10 && Math.random() < 0.3;
}

export function shouldTriggerSetPiece(ctx: MomentTriggerContext): boolean {
  if (ctx.minute < 10 || ctx.minute > 88) return false;
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  if (scoreDiff < -1 || scoreDiff > 1) return false;
  return Math.random() < 0.25;
}

export function buildCounterAttackMoment(
  ctx: MomentTriggerContext,
  attacker: PitchPlayerState,
): QuickInteractiveMoment {
  const attrs = attacker.attributes ?? { passing: 50, finishing: 50, technique: 50, pace: 50, dribbling: 50, shooting: 50, defending: 50, physical: 50 };
  const passChance = calculateSuccessChance(0.65, attrs as MatchPlayerAttributes, 'passing');
  const shootChance = calculateSuccessChance(0.45, attrs as MatchPlayerAttributes, 'finishing');

  return {
    id: `counter_${ctx.minute}_${Date.now()}`,
    minute: ctx.minute,
    type: 'counter_attack',
    context: `${attacker.name} rouba a bola no meio-campo e dispara em contra-ataque!`,
    choices: [
      {
        id: 'pass',
        label: 'Passar',
        description: 'Procurar companheiro melhor posicionado',
        successChance: passChance,
        reward: { ole: 15, exp: 5 },
        momentumImpact: 8,
      },
      {
        id: 'shoot',
        label: 'Chutar',
        description: 'Arriscar finalização imediata',
        successChance: shootChance,
        reward: { ole: 30, exp: 10 },
        momentumImpact: 15,
      },
    ],
    timeoutMs: 4000,
    triggeredAtMs: Date.now(),
  };
}

export function buildSetPieceMoment(
  ctx: MomentTriggerContext,
  takers: PitchPlayerState[],
): QuickInteractiveMoment {
  const [taker1, taker2] = takers.slice(0, 2);
  if (!taker1 || !taker2) {
    throw new Error('buildSetPieceMoment: need at least 2 takers');
  }

  const attrs1 = taker1.attributes ?? { finishing: 50, technique: 50, passing: 50, pace: 50, dribbling: 50, shooting: 50, defending: 50, physical: 50 };
  const attrs2 = taker2.attributes ?? { finishing: 50, technique: 50, passing: 50, pace: 50, dribbling: 50, shooting: 50, defending: 50, physical: 50 };
  const chance1 = calculateSuccessChance(0.35, attrs1 as MatchPlayerAttributes, 'finishing');
  const chance2 = calculateSuccessChance(0.35, attrs2 as MatchPlayerAttributes, 'finishing');

  const finishing1 = 'finishing' in attrs1 ? attrs1.finishing : 50;
  const technique1 = 'technique' in attrs1 ? attrs1.technique : 50;
  const finishing2 = 'finishing' in attrs2 ? attrs2.finishing : 50;
  const technique2 = 'technique' in attrs2 ? attrs2.technique : 50;

  return {
    id: `setpiece_${ctx.minute}_${Date.now()}`,
    minute: ctx.minute,
    type: 'set_piece',
    context: `Falta perigosa na entrada da área! Quem deve cobrar?`,
    choices: [
      {
        id: `taker_${taker1.playerId}`,
        label: taker1.name,
        description: `Finalização ${finishing1} | Técnica ${technique1}`,
        successChance: chance1,
        reward: { ole: 25, exp: 8 },
        momentumImpact: 12,
      },
      {
        id: `taker_${taker2.playerId}`,
        label: taker2.name,
        description: `Finalização ${finishing2} | Técnica ${technique2}`,
        successChance: chance2,
        reward: { ole: 25, exp: 8 },
        momentumImpact: 12,
      },
    ],
    timeoutMs: 4000,
    triggeredAtMs: Date.now(),
  };
}

export function resolveInteractiveMoment(
  moment: QuickInteractiveMoment,
  choiceId: string | null,
): QuickMomentOutcome {
  const choice = moment.choices.find((c) => c.id === choiceId);

  if (!choice) {
    const fallback = moment.choices[0]!;
    const success = Math.random() < fallback.successChance * 0.7;
    return {
      momentId: moment.id,
      choiceId: 'timeout',
      success,
      narrative: success
        ? `A IA decidiu por você e conseguiu criar perigo!`
        : `A IA decidiu por você, mas a jogada não resultou.`,
      rewards: { ole: success ? Math.floor(fallback.reward.ole! * 0.5) : 0, exp: 0 },
      momentumDelta: success ? fallback.momentumImpact * 0.5 : -5,
    };
  }

  const success = Math.random() < choice.successChance;

  let narrative = '';
  if (moment.type === 'counter_attack') {
    if (choice.id === 'pass') {
      narrative = success
        ? `Passe perfeito! O companheiro recebe livre e finaliza com perigo!`
        : `O passe foi interceptado. Oportunidade desperdiçada.`;
    } else {
      narrative = success
        ? `Chute colocado! A bola passa raspando a trave e entra!`
        : `Chute precipitado. A bola sai pela linha de fundo.`;
    }
  } else if (moment.type === 'set_piece') {
    narrative = success
      ? `Cobrança magistral! A bola desvia na barreira e entra!`
      : `A barreira bloqueou. Escanteio para a casa.`;
  }

  return {
    momentId: moment.id,
    choiceId: choice.id,
    success,
    narrative,
    rewards: {
      ole: success ? (choice.reward.ole ?? 0) : 0,
      exp: success ? (choice.reward.exp ?? 0) : 0,
    },
    momentumDelta: success ? choice.momentumImpact : -choice.momentumImpact * 0.3,
  };
}
