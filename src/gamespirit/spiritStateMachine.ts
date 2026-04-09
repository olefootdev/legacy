/**
 * Transições puras de estado GameSpirit (testáveis, sem I/O).
 * O minuto a minuto aplica patches ao `LiveMatchSnapshot` em `runMatchMinute` / reducer.
 */

import type {
  HomeShotLogicalOutcome,
  PenaltyOutcomeKind,
  PenaltyStage,
  PenaltyState,
  SpiritBallPossessionPatch,
  SpiritOverlay,
  SpiritPhase,
  PossessionSideSpirit,
} from './spiritSnapshotTypes';

/**
 * Taxas-alvo por 90' (partida rápida, ~56 ticks efetivos):
 *   Golos:     2–4 total      (shot weights + pGoalAway ≈ 2.8)
 *   Amarelos:  3–5 total      (CARD_PROB_HOME 3.5% + CARD_PROB_AWAY 2.5% → ~3.4)
 *   Vermelhos: ~0.15/jogo     (6% de cada cartão → ~1 a cada 7 jogos)
 *   Lesões:    ~0.3/jogo      (fatigue >72, 6%)
 *   Penáltis:  ~0.5/jogo      (DANGEROUS_FOUL × PENALTY_FROM_FOUL × ticks att)
 */

/** Pesos base do remate (casa); `gameSpiritTick` pode multiplicar faixas com skill/zona. */
export const DEFAULT_HOME_SHOT_WEIGHTS: Record<HomeShotLogicalOutcome, number> = {
  goal: 0.062,
  post_in: 0.028,
  save: 0.11,
  block: 0.165,
  wide: 0.36,
  post_out: 0.055,
  miss_far: 0.22,
};

/** Prob. de falta perigosa num tick em zona final (casa a atacar), antes do remate. */
export const DANGEROUS_FOUL_PROB = 0.045;
/** Dado falta perigosa, prob. de penálti (senão livre / bola parada só narrativa). */
export const PENALTY_FROM_FOUL_PROB = 0.15;

/** Duração do cartão do marcador na partida rápida; `autoDismissMs` do golo = isto + narrativa (só timer, sem 2.º overlay). */
export const GOAL_SCORER_OVERLAY_MS = 3000;
export const GOAL_NARRATIVE_OVERLAY_MS = 3000;

/** Banner de cartão vermelho (partida rápida). */
export const RED_CARD_BANNER_MS = 3800;

export function redCardBannerOverlay(args: {
  minute: number;
  side: PossessionSideSpirit;
  playerName: string;
  homeShort: string;
  awayShort: string;
  startedAtMs: number;
}): SpiritOverlay {
  const team = args.side === 'home' ? args.homeShort : args.awayShort;
  return {
    kind: 'red_card',
    title: 'Cartão vermelho',
    lines: [`${args.minute}' — ${args.playerName} (${team})`, 'A equipa fica com menos um em campo.'],
    startedAtMs: args.startedAtMs,
    autoDismissMs: RED_CARD_BANNER_MS,
  };
}

const BUILDUP_TICKS_WIDE = 2;
const BUILDUP_TICKS_SAVE = 1;
const BUILDUP_TICKS_BLOCK = 1;

function pickByWeights<T extends string>(rng: number, weights: Record<T, number>): T {
  let sum = 0;
  for (const v of Object.values(weights) as number[]) sum += v;
  let t = rng * sum;
  const entries = Object.entries(weights) as [T, number][];
  for (const [k, w] of entries) {
    t -= w;
    if (t <= 0) return k;
  }
  return entries[entries.length - 1]![0];
}

/** Ajusta pesos com skill 0–1, zona final, densidade e fatores de erro/GK (magnitude pequena). */
export function adjustHomeShotWeights(
  base: Record<HomeShotLogicalOutcome, number>,
  opts: {
    shotSkill01: number;
    zoneAtt: boolean;
    zoneMid: boolean;
    denseNearBall: boolean;
    supportBoost: number;
    gkFactor01: number;
    errorTax: number;
  },
): Record<HomeShotLogicalOutcome, number> {
  const w = { ...base };
  const sk = opts.shotSkill01;
  w.goal *= 1 + sk * 0.45 + opts.supportBoost * 0.35 + (opts.zoneAtt ? 0.22 : opts.zoneMid ? 0.08 : -0.18);
  w.post_in *= 1 + sk * 0.2;
  w.save *= 1 + opts.gkFactor01 * 0.5;
  w.block *= 1 + opts.errorTax * 0.25;
  w.wide *= 1 + opts.errorTax * 0.2;
  w.post_out *= 1 + sk * 0.05;
  w.miss_far *= 1 + (opts.zoneAtt ? -0.08 : 0.05);
  if (opts.denseNearBall) w.goal *= 1.06;
  for (const k of Object.keys(w) as HomeShotLogicalOutcome[]) {
    w[k] = Math.max(0.008, w[k]!);
  }
  return w;
}

export function rollHomeShotLogicalOutcome(
  rng: number,
  weights: Record<HomeShotLogicalOutcome, number>,
): HomeShotLogicalOutcome {
  return pickByWeights(rng, weights);
}

/** Mapeia desfecho lógico → `shot_result.outcome` no log causal. */
export function causalOutcomeFromHomeShot(out: HomeShotLogicalOutcome): 'goal' | 'post_in' | 'save' | 'block' | 'wide' | 'post_out' | 'miss' {
  if (out === 'miss_far') return 'miss';
  return out;
}

/**
 * Após remate da casa (não golo): posse e bola coerentes com saída de baliza / reinício.
 * Golo: posse para quem sofreu (saída); bola ao centro; fase celebração (overlay trata pausa).
 */
export function patchAfterHomeShot(
  outcome: HomeShotLogicalOutcome,
  yNorm: number,
): SpiritBallPossessionPatch {
  const y = 22 + Math.min(1, Math.max(0, yNorm)) * 56;
  if (outcome === 'goal' || outcome === 'post_in') {
    return {
      possession: 'away',
      ball: { x: 50, y: 50 },
      spiritPhase: 'celebration_goal',
      spiritBuildupGkTicksRemaining: 0,
    };
  }
  if (outcome === 'block') {
    return {
      possession: 'away',
      ball: { x: 36 + yNorm * 10, y },
      spiritPhase: 'buildup_gk',
      spiritBuildupGkTicksRemaining: BUILDUP_TICKS_BLOCK,
    };
  }
  if (outcome === 'save') {
    return {
      possession: 'away',
      ball: { x: 78 + yNorm * 8, y },
      spiritPhase: 'buildup_gk',
      spiritBuildupGkTicksRemaining: BUILDUP_TICKS_SAVE,
    };
  }
  // wide, post_out, miss_far → adversário recupera desde zona do GR
  return {
    possession: 'away',
    ball: { x: 86 + yNorm * 6, y },
    spiritPhase: 'buildup_gk',
    spiritBuildupGkTicksRemaining: BUILDUP_TICKS_WIDE,
  };
}

/** Remate visitante para fora / ao lado: posse casa, bola baixa % (construção desde GR). */
export function patchAfterAwayShotWide(yNorm: number): SpiritBallPossessionPatch {
  const y = 22 + Math.min(1, Math.max(0, yNorm)) * 56;
  return {
    possession: 'home',
    ball: { x: 10 + yNorm * 6, y },
    spiritPhase: 'buildup_gk',
    spiritBuildupGkTicksRemaining: BUILDUP_TICKS_WIDE,
  };
}

export function createGoalOverlay(input: {
  nowMs: number;
  narrativeLine: string;
  scorerSide: PossessionSideSpirit;
}): { overlay: SpiritOverlay; spiritMomentumClamp01: number } {
  return {
    overlay: {
      kind: 'goal',
      title: 'Golo!',
      lines: [input.narrativeLine],
      startedAtMs: input.nowMs,
      autoDismissMs: GOAL_SCORER_OVERLAY_MS + GOAL_NARRATIVE_OVERLAY_MS,
    },
    spiritMomentumClamp01: input.scorerSide === 'home' ? 0.98 : 0.02,
  };
}

/** Após fechar overlay de golo: volta ao jogo com saída para quem sofreu o golo (já em `possession`). */
export function spiritPhaseAfterGoalOverlay(): SpiritPhase {
  return 'open_play';
}

export function initialPenaltyState(attackingSide: PossessionSideSpirit, takerName: string, takerId?: string): PenaltyState {
  return { stage: 'banner', side: attackingSide, takerName, takerId };
}

const PENALTY_ORDER: PenaltyStage[] = ['banner', 'walk', 'kick', 'result'];

/** Avança banner→walk→kick; de `kick` para `result` só via `penalty_resolve` (com desfecho). */
export function advancePenaltyStage(prev: PenaltyState): PenaltyState {
  const i = PENALTY_ORDER.indexOf(prev.stage);
  if (i < 0) return prev;
  if (i >= 2) return prev;
  return { ...prev, stage: PENALTY_ORDER[i + 1]! };
}

export function rollPenaltyOutcome(rng: number): PenaltyOutcomeKind {
  if (rng < 0.5) return 'goal';
  if (rng < 0.64) return 'save';
  if (rng < 0.72) return 'post_in';
  if (rng < 0.8) return 'post_out';
  if (rng < 0.9) return 'miss_wide';
  return 'miss_far';
}

export function penaltyNarrativeLine(
  outcome: PenaltyOutcomeKind,
  takerName: string,
  keeperHint: string,
): string {
  switch (outcome) {
    case 'goal':
      return `${takerName} converte com frieza — golo!`;
    case 'post_in':
      return `A trave ajuda: a bola picota por dentro — golo para ${takerName}!`;
    case 'save':
      return `${keeperHint} voa e defende o penálti de ${takerName}!`;
    case 'post_out':
      return `${takerName} acerta na trave; a bola salta para fora.`;
    case 'miss_wide':
      return `${takerName} desvia-se; o remate vai largo da baliza.`;
    case 'miss_far':
      return `${takerName} envia por cima da grelha.`;
    default:
      return 'Penálti resolvido.';
  }
}

export function penaltyOverlayForStage(
  stage: PenaltyStage,
  takerName: string,
  homeShort: string,
  awayShort: string,
  nowMs: number,
  autoMs: number,
  extraLine?: string,
): SpiritOverlay {
  const baseTitle = 'Penálti';
  switch (stage) {
    case 'banner':
      return {
        kind: 'penalty',
        title: baseTitle,
        lines: [`Árbitro aponta para a marca. ${takerName} vai bater.`],
        startedAtMs: nowMs,
        autoDismissMs: autoMs,
      };
    case 'walk':
      return {
        kind: 'penalty',
        title: baseTitle,
        lines: [`${takerName} coloca a bola na marca branca.`, `${homeShort} e ${awayShort} afastam-se da área.`],
        startedAtMs: nowMs,
        autoDismissMs: autoMs,
      };
    case 'kick':
      return {
        kind: 'penalty',
        title: baseTitle,
        lines: ['Autorizado — parte a corrida…'],
        startedAtMs: nowMs,
        autoDismissMs: autoMs,
      };
    case 'result':
      return {
        kind: 'penalty',
        title: baseTitle,
        lines: extraLine ? [extraLine] : ['…'],
        startedAtMs: nowMs,
        autoDismissMs: Math.max(autoMs, 2200),
      };
    default:
      return {
        kind: 'penalty',
        title: baseTitle,
        lines: [],
        startedAtMs: nowMs,
        autoDismissMs: autoMs,
      };
  }
}

/** Decrementa buildup; quando chega a 0, reabre `open_play`. */
export function tickBuildupGk(
  phase: SpiritPhase,
  remaining: number,
): { spiritPhase: SpiritPhase; spiritBuildupGkTicksRemaining: number } {
  if (phase !== 'buildup_gk') {
    return { spiritPhase: phase, spiritBuildupGkTicksRemaining: Math.max(0, remaining) };
  }
  if (remaining <= 0) {
    return { spiritPhase: 'open_play', spiritBuildupGkTicksRemaining: 0 };
  }
  const next = remaining - 1;
  return {
    spiritPhase: next <= 0 ? 'open_play' : 'buildup_gk',
    spiritBuildupGkTicksRemaining: Math.max(0, next),
  };
}

export function shouldRunSpiritPlayTick(s: {
  spiritOverlay: SpiritOverlay | null | undefined;
  spiritPhase: SpiritPhase | undefined;
  penalty: PenaltyState | null | undefined;
  spiritBuildupGkTicksRemaining?: number;
}): boolean {
  if (s.spiritOverlay) return false;
  if (s.spiritPhase === 'penalty' && s.penalty && s.penalty.stage !== 'result') return false;
  if (s.spiritPhase === 'celebration_goal') return false;
  if (s.spiritPhase === 'shot_resolve') return false;
  if (s.spiritPhase === 'set_piece') return false;
  if (s.spiritPhase === 'buildup_gk' && (s.spiritBuildupGkTicksRemaining ?? 0) > 0) return false;
  return true;
}
