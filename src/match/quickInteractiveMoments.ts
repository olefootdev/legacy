import type { PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';

export type QuickMomentType =
  | 'counter_attack'
  | 'set_piece'
  | 'defensive_choice'
  | 'sub_timing'
  | 'squad_decision';

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
  /** §5: sucesso desta escolha pode virar GOL de verdade (finalização). */
  scoreOnSuccess?: boolean;
  /** §5: quem executa (pro gol/scout/narrador). */
  executorId?: string;
  executorName?: string;
  /** Narrativa custom de sucesso/erro (paleta gerada pelo elenco). */
  successText?: string;
  failText?: string;
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
  /** §5: quando uma finalização dá certo, vira GOL de verdade no placar. */
  goal?: { scorerId?: string; scorerName?: string };
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

/**
 * FIX G: Defensive choice — adversário ataca com bola dentro do nosso terço de defesa.
 * Manager escolhe postura: bloco baixo (segura) ou pressão alta (rouba mas se expõe).
 * Dispara quando momentum away > 15 (pressão real do adversário).
 */
export function shouldTriggerDefensiveChoice(ctx: MomentTriggerContext): boolean {
  if (ctx.minute < 8 || ctx.minute > 88) return false;
  if (ctx.possession !== 'away') return false;
  const momentumGap = ctx.momentum.away - ctx.momentum.home;
  if (momentumGap < 15) return false;
  return Math.random() < 0.22;
}

export function buildDefensiveChoiceMoment(ctx: MomentTriggerContext): QuickInteractiveMoment {
  // Pega defensor mais tático/marcador pra calibrar successChance
  const defenders = ctx.homePlayers.filter((p) => p.role === 'def');
  const best = defenders.sort(
    (a, b) => (b.attributes?.marcacao ?? 50) - (a.attributes?.marcacao ?? 50),
  )[0];
  const fallback: MatchPlayerAttributes = {
    passeCurto: 50, passeLongo: 50, cruzamento: 50, marcacao: 50, velocidade: 50,
    fairPlay: 50, drible: 50, finalizacao: 50, fisico: 50, tatico: 50,
    mentalidade: 50, confianca: 50,
  };
  const attrs = (best?.attributes as MatchPlayerAttributes) ?? fallback;
  const blockChance = calculateSuccessChance(0.62, attrs, 'marcacao');
  const pressChance = calculateSuccessChance(0.38, attrs, 'tatico');

  return {
    id: `defense_${ctx.minute}_${Date.now()}`,
    minute: ctx.minute,
    type: 'defensive_choice',
    context: `Adversário avança com perigo no nosso terço. Linha defensiva pede orientação.`,
    choices: [
      {
        id: 'block_low',
        label: 'Bloco baixo',
        description: 'Recua, fecha espaços, segura o resultado',
        successChance: blockChance,
        reward: { ole: 18, exp: 6 },
        momentumImpact: 6,
      },
      {
        id: 'press_high',
        label: 'Pressão alta',
        description: 'Sobe a linha, rouba na frente — alto risco/recompensa',
        successChance: pressChance,
        reward: { ole: 32, exp: 12 },
        momentumImpact: 18,
      },
    ],
    timeoutMs: 4500,
    triggeredAtMs: Date.now(),
  };
}

/**
 * FIX G: Sub timing — sugere substituição quando há titular esgotado e
 * substituto fresco disponível. Manager decide se troca já ou aguenta.
 */
export function shouldTriggerSubTiming(
  ctx: MomentTriggerContext & { freshBenchCount: number; tiredStarter?: PitchPlayerState },
): boolean {
  if (ctx.minute < 55 || ctx.minute > 80) return false;
  if (!ctx.tiredStarter || ctx.freshBenchCount < 1) return false;
  return Math.random() < 0.30;
}

export function buildSubTimingMoment(
  ctx: MomentTriggerContext,
  tired: PitchPlayerState,
): QuickInteractiveMoment {
  // Sub agora: garante intensidade. Aguentar: economiza vaga de sub, mas
  // arrisca queda de rendimento + lesão.
  return {
    id: `subtiming_${ctx.minute}_${Date.now()}`,
    minute: ctx.minute,
    type: 'sub_timing',
    context: `${tired.name} está visivelmente cansado (${Math.round(tired.fatigue)}% fadiga). Trocar agora?`,
    choices: [
      {
        id: 'sub_now',
        label: 'Trocar agora',
        description: 'Mantém intensidade, gasta vaga de substituição',
        successChance: 0.78,
        reward: { ole: 14, exp: 5 },
        momentumImpact: 9,
      },
      {
        id: 'hold_on',
        label: 'Aguentar mais',
        description: 'Economiza sub, risco de lesão e queda',
        successChance: 0.45,
        reward: { ole: 26, exp: 9 },
        momentumImpact: -4,
      },
    ],
    timeoutMs: 5000,
    triggeredAtMs: Date.now(),
  };
}

export function buildCounterAttackMoment(
  ctx: MomentTriggerContext,
  attacker: PitchPlayerState,
): QuickInteractiveMoment {
  const attrs = attacker.attributes ?? { passeCurto: 50, finalizacao: 50, tatico: 50, velocidade: 50, drible: 50, fisico: 50, marcacao: 50, passeLongo: 50, cruzamento: 50, fairPlay: 50, mentalidade: 50, confianca: 50 };
  const passChance = calculateSuccessChance(0.65, attrs as MatchPlayerAttributes, 'passeCurto');
  const shootChance = calculateSuccessChance(0.45, attrs as MatchPlayerAttributes, 'finalizacao');

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

  const attrs1 = taker1.attributes ?? { finalizacao: 50, tatico: 50, passeCurto: 50, velocidade: 50, drible: 50, fisico: 50, marcacao: 50, passeLongo: 50, cruzamento: 50, fairPlay: 50, mentalidade: 50, confianca: 50 };
  const attrs2 = taker2.attributes ?? { finalizacao: 50, tatico: 50, passeCurto: 50, velocidade: 50, drible: 50, fisico: 50, marcacao: 50, passeLongo: 50, cruzamento: 50, fairPlay: 50, mentalidade: 50, confianca: 50 };
  const chance1 = calculateSuccessChance(0.35, attrs1 as MatchPlayerAttributes, 'finalizacao');
  const chance2 = calculateSuccessChance(0.35, attrs2 as MatchPlayerAttributes, 'finalizacao');

  const finishing1 = 'finalizacao' in attrs1 ? attrs1.finalizacao : 50;
  const technique1 = 'tatico' in attrs1 ? attrs1.tatico : 50;
  const finishing2 = 'finalizacao' in attrs2 ? attrs2.finalizacao : 50;
  const technique2 = 'tatico' in attrs2 ? attrs2.tatico : 50;

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

  // §5: paleta gerada pelo elenco traz a própria narrativa (e pode virar gol).
  if (moment.type === 'squad_decision' || choice.successText || choice.failText) {
    const goal = success && choice.scoreOnSuccess
      ? { scorerId: choice.executorId, scorerName: choice.executorName }
      : undefined;
    return {
      momentId: moment.id,
      choiceId: choice.id,
      success,
      narrative: success
        ? choice.successText ?? 'Deu certo! A jogada saiu como o manager pediu.'
        : choice.failText ?? 'Não saiu como planejado. Bola perdida.',
      rewards: {
        ole: success ? (choice.reward.ole ?? 0) : 0,
        exp: success ? (choice.reward.exp ?? 0) : 0,
      },
      momentumDelta: success ? choice.momentumImpact : -choice.momentumImpact * 0.3,
      goal,
    };
  }

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
  } else if (moment.type === 'defensive_choice') {
    if (choice.id === 'block_low') {
      narrative = success
        ? `Linha cerrada! O zagueiro corta o cruzamento e a defesa respira.`
        : `Linha baixa permitiu o chute. Goleiro trabalha, mas a pressão continua.`;
    } else {
      narrative = success
        ? `Pressão alta funciona! Roubada na frente e contra-ataque a caminho!`
        : `Pressão arriscada — adversário furou a linha e criou perigo claro.`;
    }
  } else if (moment.type === 'sub_timing') {
    if (choice.id === 'sub_now') {
      narrative = success
        ? `Troca certeira! Sangue novo em campo, intensidade recuperada.`
        : `Substituição feita, mas o time leva tempo pra encaixar o entrante.`;
    } else {
      narrative = success
        ? `Aguentou bravamente! Cansado, mas decisivo no momento certo.`
        : `Cansaço cobrou caro — jogador errou jogada chave e baixou a energia da equipe.`;
    }
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
