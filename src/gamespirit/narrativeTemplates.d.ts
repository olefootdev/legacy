/**
 * Templates de narração — fonte única para todo texto do feed na partida rápida.
 * Regras: uma linha, sem \n, verbo forte + nomes dos intervenientes.
 * O renderer (`renderQuickFeedRichText`) já faz bold automático de nomes reconhecidos.
 *
 * Sistema de variação: evita repetir expressões em lances similares consecutivos.
 */
export declare function shot(p: {
    min: number;
    shooter: string;
}): string;
export declare function shotBlock(p: {
    min: number;
    shooter: string;
    defender?: string;
}): string;
export declare function shotSave(p: {
    min: number;
    shooter: string;
    keeper?: string;
}): string;
export declare function shotWide(p: {
    min: number;
    shooter: string;
    recoverer?: string;
}): string;
export declare function progress(p: {
    min: number;
    carrier: string;
    receiver?: string;
}): string;
export declare function progressLoss(p: {
    min: number;
    loser: string;
    winner: string;
}): string;
export declare function recycle(p: {
    min: number;
    passer: string;
    receiver?: string;
}): string;
export declare function press(p: {
    min: number;
    team: string;
    recoverer?: string;
}): string;
export declare function clear(p: {
    min: number;
    defender?: string;
}): string;
export declare function recovery(p: {
    min: number;
    team: string;
    recoverer?: string;
}): string;
export declare function counter(p: {
    min: number;
    leader: string;
}): string;
export declare function foulPenalty(p: {
    min: number;
    fouled: string;
}): string;
export declare function foulFreeKick(p: {
    min: number;
    fouled: string;
}): string;
export declare function goalPositional(p: {
    min: number;
    scorer: string;
}): string;
export declare function goalCounter(p: {
    min: number;
    scorer: string;
}): string;
export declare function goalPostIn(p: {
    min: number;
    scorer: string;
}): string;
export declare function goalAwayPositional(p: {
    min: number;
    scorer: string;
    team: string;
}): string;
export declare function goalAwayCounter(p: {
    min: number;
    scorer: string;
    team: string;
}): string;
export declare function awayShotWide(p: {
    min: number;
    shooter: string;
    team: string;
    recoverer?: string;
}): string;
export declare function awayBuild(p: {
    min: number;
    team: string;
}): string;
export declare function turnover(p: {
    min: number;
    team: string;
}): string;
export declare function noCarrierRecycle(p: {
    min: number;
    team: string;
}): string;
