/**
 * Transições puras de estado GameSpirit (testáveis, sem I/O).
 * O minuto a minuto aplica patches ao `LiveMatchSnapshot` em `runMatchMinute` / reducer.
 */
import type { HomeShotLogicalOutcome, PenaltyOutcomeKind, PenaltyStage, PenaltyState, SpiritBallPossessionPatch, SpiritOverlay, SpiritPhase, PossessionSideSpirit } from './spiritSnapshotTypes';
/**
 * Taxas-alvo por 90' (partida rápida, ~56 ticks efetivos):
 *   Golos:     2–4 total      (shot weights + pGoalAway ≈ 2.8)
 *   Amarelos:  3–5 total      (CARD_PROB_HOME 3.5% + CARD_PROB_AWAY 2.5% → ~3.4)
 *   Vermelhos: ~0.15/jogo     (6% de cada cartão → ~1 a cada 7 jogos)
 *   Lesões:    ~0.3/jogo      (fatigue >72, 6%)
 *   Penalties:  ~0.625/jogo   (DANGEROUS_FOUL × PENALTY_FROM_FOUL × ticks att - aumentado 25%)
 */
/** Pesos base do remate (casa); `gameSpiritTick` pode multiplicar faixas com skill/zona. */
export declare const DEFAULT_HOME_SHOT_WEIGHTS: Record<HomeShotLogicalOutcome, number>;
/** Prob. de falta perigosa num tick em zona final (casa a atacar), antes do remate.
 *  Aumentado 25% para mais pênaltis: 4.5% → 5.625% */
export declare const DANGEROUS_FOUL_PROB = 0.05625;
/** Dado falta perigosa, prob. de virar pênalti (senão fica livre / bola parada só narrativa).
 *  Aumentado 25% para mais pênaltis: 7.5% → 9.375% */
export declare const PENALTY_FROM_FOUL_PROB = 0.09375;
/** Duração do cartão do marcador na partida rápida; `autoDismissMs` do golo = isto + narrativa (só timer, sem 2.º overlay). */
export declare const GOAL_SCORER_OVERLAY_MS = 3000;
export declare const GOAL_NARRATIVE_OVERLAY_MS = 3000;
/** Banner de cartão vermelho (partida rápida). */
export declare const RED_CARD_BANNER_MS = 3800;
export declare function redCardBannerOverlay(args: {
    minute: number;
    side: PossessionSideSpirit;
    playerName: string;
    homeShort: string;
    awayShort: string;
    startedAtMs: number;
}): SpiritOverlay;
/** Ajusta pesos com skill 0–1, zona final, densidade e fatores de erro/GK (magnitude pequena). */
export declare function adjustHomeShotWeights(base: Record<HomeShotLogicalOutcome, number>, opts: {
    shotSkill01: number;
    zoneAtt: boolean;
    zoneMid: boolean;
    denseNearBall: boolean;
    supportBoost: number;
    gkFactor01: number;
    errorTax: number;
}): Record<HomeShotLogicalOutcome, number>;
export declare function rollHomeShotLogicalOutcome(rng: number, weights: Record<HomeShotLogicalOutcome, number>): HomeShotLogicalOutcome;
/**
 * Subtype do `save` — resolve o que o goleiro faz ao pegar o remate.
 * - hold: defende e segura (posse do defensor).
 * - parry_forward: espalma pra frente, vira rebote (atacante pode chegar na sobra).
 * - parry_corner: espalma pro lado/linha de fundo → escanteio.
 * - error_goal: falha do GR → vira gol adversário (modulado por gkSkill01).
 *
 * gkSkill01 0..1 vem do nível do goleiro adversário (quanto maior, menos falha).
 */
export type GkSaveSubtype = 'hold' | 'parry_forward' | 'parry_corner' | 'error_goal';
/**
 * Roubada de bola (tackle) — quando o time ativa marcação / desarme no portador adversário.
 * Saídas:
 *   - `clean`: rouba sem falta. Inicia contra-ataque.
 *   - `foul_soft`: rouba com falta "forte" (dividida pesada). Árbitro para o jogo; adversário reinicia na bola parada.
 *   - `foul_hard`: falta grave / agressiva. Reinício para o adversário + risco de cartão e de lesão no atacante.
 *   - `miss`: erro crítico — o marcador passa batido. Atacante segue com a bola.
 *
 * Modulado por `tacticalMentality` (time agressivo erra menos mas comete mais faltas duras)
 * e `fairPlay01` (jogador com fairPlay alto comete menos agressivas).
 */
export type TackleOutcome = 'clean' | 'foul_soft' | 'foul_hard' | 'miss';
export declare function rollTackleOutcome(rng: number, opts?: {
    tacticalMentality?: number;
    fairPlay01?: number;
    /** Desarme do defensor (0-100). Sobe pClean, desce pMiss. */
    defenderMarcacao?: number;
    /** Velocidade do defensor (0-100). Pequeno bônus em pClean. */
    defenderVelocidade?: number;
    /** Drible do carregador (0-100). Contrapeso: sobe pMiss. */
    attackerDrible?: number;
}): TackleOutcome;
export declare function rollGkSaveSubtype(rng: number, gkSkill01: number, gkFatigue01?: number): GkSaveSubtype;
/** Mapeia desfecho lógico → `shot_result.outcome` no log causal. */
export declare function causalOutcomeFromHomeShot(out: HomeShotLogicalOutcome): 'goal' | 'post_in' | 'save' | 'block' | 'wide' | 'post_out' | 'miss';
/**
 * Após remate da casa (não gol): posse e bola coerentes com saída de baliza / reinício.
 * Gol: posse para quem sofreu (saída); bola ao centro; fase celebração (overlay trata pausa).
 */
export declare function patchAfterHomeShot(outcome: HomeShotLogicalOutcome, yNorm: number): SpiritBallPossessionPatch;
/** Remate visitante para fora / ao lado: posse casa, bola baixa % (construção desde GR). */
export declare function patchAfterAwayShotWide(yNorm: number): SpiritBallPossessionPatch;
export declare function createGoalOverlay(input: {
    nowMs: number;
    narrativeLine: string;
    scorerSide: PossessionSideSpirit;
}): {
    overlay: SpiritOverlay;
    spiritMomentumClamp01: number;
};
/** Após fechar overlay de golo: volta ao jogo com saída para quem sofreu o golo (já em `possession`). */
export declare function spiritPhaseAfterGoalOverlay(): SpiritPhase;
export declare function initialPenaltyState(attackingSide: PossessionSideSpirit, takerName: string, takerId?: string): PenaltyState;
/** Avança banner→walk→kick; de `kick` para `result` só via `penalty_resolve` (com desfecho). */
export declare function advancePenaltyStage(prev: PenaltyState): PenaltyState;
export declare function rollPenaltyOutcome(rng: number): PenaltyOutcomeKind;
export declare function penaltyNarrativeLine(outcome: PenaltyOutcomeKind, takerName: string, keeperHint: string): string;
export declare function penaltyOverlayForStage(stage: PenaltyStage, takerName: string, homeShort: string, awayShort: string, nowMs: number, autoMs: number, extraLine?: string): SpiritOverlay;
/** Decrementa buildup; quando chega a 0, reabre `open_play`. */
export declare function tickBuildupGk(phase: SpiritPhase, remaining: number): {
    spiritPhase: SpiritPhase;
    spiritBuildupGkTicksRemaining: number;
};
export declare function shouldRunSpiritPlayTick(s: {
    spiritOverlay: SpiritOverlay | null | undefined;
    spiritPhase: SpiritPhase | undefined;
    penalty: PenaltyState | null | undefined;
    spiritBuildupGkTicksRemaining?: number;
}): boolean;
