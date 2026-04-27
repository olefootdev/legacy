/**
 * Transições puras de estado GameSpirit (testáveis, sem I/O).
 * O minuto a minuto aplica patches ao `LiveMatchSnapshot` em `runMatchMinute` / reducer.
 */
/**
 * Taxas-alvo por 90' (partida rápida, ~56 ticks efetivos):
 *   Golos:     2–4 total      (shot weights + pGoalAway ≈ 2.8)
 *   Amarelos:  3–5 total      (CARD_PROB_HOME 3.5% + CARD_PROB_AWAY 2.5% → ~3.4)
 *   Vermelhos: ~0.15/jogo     (6% de cada cartão → ~1 a cada 7 jogos)
 *   Lesões:    ~0.3/jogo      (fatigue >72, 6%)
 *   Penalties:  ~0.625/jogo   (DANGEROUS_FOUL × PENALTY_FROM_FOUL × ticks att - aumentado 25%)
 */
/** Pesos base do remate (casa); `gameSpiritTick` pode multiplicar faixas com skill/zona. */
export const DEFAULT_HOME_SHOT_WEIGHTS = {
    goal: 0.062,
    post_in: 0.028,
    save: 0.11,
    block: 0.165,
    wide: 0.36,
    post_out: 0.055,
    miss_far: 0.22,
};
/** Prob. de falta perigosa num tick em zona final (casa a atacar), antes do remate.
 *  Aumentado 25% para mais pênaltis: 4.5% → 5.625% */
export const DANGEROUS_FOUL_PROB = 0.05625;
/** Dado falta perigosa, prob. de virar pênalti (senão fica livre / bola parada só narrativa).
 *  Aumentado 25% para mais pênaltis: 7.5% → 9.375% */
export const PENALTY_FROM_FOUL_PROB = 0.09375;
/** Duração do cartão do marcador na partida rápida; `autoDismissMs` do golo = isto + narrativa (só timer, sem 2.º overlay). */
export const GOAL_SCORER_OVERLAY_MS = 3000;
export const GOAL_NARRATIVE_OVERLAY_MS = 3000;
/** Banner de cartão vermelho (partida rápida). */
export const RED_CARD_BANNER_MS = 3800;
export function redCardBannerOverlay(args) {
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
function pickByWeights(rng, weights) {
    let sum = 0;
    for (const v of Object.values(weights))
        sum += v;
    let t = rng * sum;
    const entries = Object.entries(weights);
    for (const [k, w] of entries) {
        t -= w;
        if (t <= 0)
            return k;
    }
    return entries[entries.length - 1][0];
}
/** Ajusta pesos com skill 0–1, zona final, densidade e fatores de erro/GK (magnitude pequena). */
export function adjustHomeShotWeights(base, opts) {
    const w = { ...base };
    const sk = opts.shotSkill01;
    w.goal *= 1 + sk * 0.45 + opts.supportBoost * 0.35 + (opts.zoneAtt ? 0.22 : opts.zoneMid ? 0.08 : -0.18);
    w.post_in *= 1 + sk * 0.2;
    w.save *= 1 + opts.gkFactor01 * 0.5;
    w.block *= 1 + opts.errorTax * 0.25;
    w.wide *= 1 + opts.errorTax * 0.2;
    w.post_out *= 1 + sk * 0.05;
    w.miss_far *= 1 + (opts.zoneAtt ? -0.08 : 0.05);
    if (opts.denseNearBall)
        w.goal *= 1.06;
    for (const k of Object.keys(w)) {
        w[k] = Math.max(0.008, w[k]);
    }
    return w;
}
export function rollHomeShotLogicalOutcome(rng, weights) {
    return pickByWeights(rng, weights);
}
export function rollTackleOutcome(rng, opts = {}) {
    const mentality = Math.min(100, Math.max(0, opts.tacticalMentality ?? 50));
    const fairPlay = Math.min(1, Math.max(0, opts.fairPlay01 ?? 0.7));
    const aggressive = (mentality - 50) / 100; // -0.5..+0.5
    // Vantagem líquida do duelo desarme vs drible (−1..+1).
    const defSkill01 = (((opts.defenderMarcacao ?? 50) + (opts.defenderVelocidade ?? 50) * 0.45) / 145);
    const atkSkill01 = (opts.attackerDrible ?? 50) / 100;
    const edge = Math.max(-1, Math.min(1, defSkill01 - atkSkill01));
    let pClean = 0.46 + aggressive * 0.08 + edge * 0.18;
    let pMiss = 0.25 - aggressive * 0.10 - edge * 0.12;
    let pFoulHard = 0.10 + aggressive * 0.12 - (fairPlay - 0.5) * 0.08 - Math.max(0, edge) * 0.04;
    let pFoulSoft = 1 - pClean - pMiss - pFoulHard;
    pClean = Math.max(0.2, Math.min(0.72, pClean));
    pMiss = Math.max(0.06, Math.min(0.42, pMiss));
    pFoulHard = Math.max(0.03, Math.min(0.28, pFoulHard));
    pFoulSoft = Math.max(0.06, 1 - pClean - pMiss - pFoulHard);
    let t = Math.max(0, Math.min(1, rng));
    if (t < pClean)
        return 'clean';
    t -= pClean;
    if (t < pMiss)
        return 'miss';
    t -= pMiss;
    if (t < pFoulSoft)
        return 'foul_soft';
    void pFoulHard;
    return 'foul_hard';
}
export function rollGkSaveSubtype(rng, gkSkill01, gkFatigue01 = 0) {
    const skill = Math.min(1, Math.max(0, gkSkill01));
    const fat = Math.min(1, Math.max(0, gkFatigue01));
    // Fadiga > 70% amplifica erros até +15%.
    const fatiguePenalty = Math.max(0, fat - 0.7) * 0.5;
    // Falha do goleiro: cai muito se skill alto. Base ~7% em GK fraco, ~1.2% em GK elite.
    const pError = Math.min(0.32, Math.max(0.012, 0.07 * (1 - skill)) + fatiguePenalty);
    // Segurou: base 48% + bônus skill até 78%, levemente reduzido por fadiga.
    const pHold = Math.max(0.3, 0.48 + skill * 0.3 - fat * 0.08);
    // Espalma pro escanteio: 12–17% (pouco sensível a skill).
    const pParryCorner = 0.17 - skill * 0.05;
    // Resto = espalma pra frente (rebote).
    const pParryForward = Math.max(0, 1 - pError - pHold - pParryCorner);
    let t = Math.max(0, Math.min(1, rng));
    if (t < pError)
        return 'error_goal';
    t -= pError;
    if (t < pHold)
        return 'hold';
    t -= pHold;
    if (t < pParryCorner)
        return 'parry_corner';
    void pParryForward;
    return 'parry_forward';
}
/** Mapeia desfecho lógico → `shot_result.outcome` no log causal. */
export function causalOutcomeFromHomeShot(out) {
    if (out === 'miss_far')
        return 'miss';
    return out;
}
/**
 * Após remate da casa (não gol): posse e bola coerentes com saída de baliza / reinício.
 * Gol: posse para quem sofreu (saída); bola ao centro; fase celebração (overlay trata pausa).
 */
export function patchAfterHomeShot(outcome, yNorm) {
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
export function patchAfterAwayShotWide(yNorm) {
    const y = 22 + Math.min(1, Math.max(0, yNorm)) * 56;
    return {
        possession: 'home',
        ball: { x: 10 + yNorm * 6, y },
        spiritPhase: 'buildup_gk',
        spiritBuildupGkTicksRemaining: BUILDUP_TICKS_WIDE,
    };
}
export function createGoalOverlay(input) {
    return {
        overlay: {
            kind: 'goal',
            title: 'Gol!',
            lines: [input.narrativeLine],
            startedAtMs: input.nowMs,
            autoDismissMs: GOAL_SCORER_OVERLAY_MS + GOAL_NARRATIVE_OVERLAY_MS,
        },
        spiritMomentumClamp01: input.scorerSide === 'home' ? 0.98 : 0.02,
    };
}
/** Após fechar overlay de golo: volta ao jogo com saída para quem sofreu o golo (já em `possession`). */
export function spiritPhaseAfterGoalOverlay() {
    return 'open_play';
}
export function initialPenaltyState(attackingSide, takerName, takerId) {
    return { stage: 'banner', side: attackingSide, takerName, takerId };
}
const PENALTY_ORDER = ['banner', 'walk', 'kick', 'result'];
/** Avança banner→walk→kick; de `kick` para `result` só via `penalty_resolve` (com desfecho). */
export function advancePenaltyStage(prev) {
    const i = PENALTY_ORDER.indexOf(prev.stage);
    if (i < 0)
        return prev;
    if (i >= 2)
        return prev;
    return { ...prev, stage: PENALTY_ORDER[i + 1] };
}
export function rollPenaltyOutcome(rng) {
    if (rng < 0.5)
        return 'goal';
    if (rng < 0.64)
        return 'save';
    if (rng < 0.72)
        return 'post_in';
    if (rng < 0.8)
        return 'post_out';
    if (rng < 0.9)
        return 'miss_wide';
    return 'miss_far';
}
export function penaltyNarrativeLine(outcome, takerName, keeperHint) {
    switch (outcome) {
        case 'goal':
            return `${takerName} converte com frieza — golo!`;
        case 'post_in':
            return `A trave ajuda: a bola picota por dentro — golo para ${takerName}!`;
        case 'save':
            return `${keeperHint} voa e defende o penalty de ${takerName}!`;
        case 'post_out':
            return `${takerName} acerta na trave; a bola salta para fora.`;
        case 'miss_wide':
            return `${takerName} desvia-se; o remate vai largo da baliza.`;
        case 'miss_far':
            return `${takerName} envia por cima da grelha.`;
        default:
            return 'Penalty resolvido.';
    }
}
export function penaltyOverlayForStage(stage, takerName, homeShort, awayShort, nowMs, autoMs, extraLine) {
    const baseTitle = 'Penalty';
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
export function tickBuildupGk(phase, remaining) {
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
export function shouldRunSpiritPlayTick(s) {
    if (s.spiritOverlay)
        return false;
    if (s.spiritPhase === 'penalty' && s.penalty && s.penalty.stage !== 'result')
        return false;
    if (s.spiritPhase === 'celebration_goal')
        return false;
    if (s.spiritPhase === 'shot_resolve')
        return false;
    if (s.spiritPhase === 'set_piece')
        return false;
    if (s.spiritPhase === 'buildup_gk' && (s.spiritBuildupGkTicksRemaining ?? 0) > 0)
        return false;
    return true;
}
//# sourceMappingURL=spiritStateMachine.js.map