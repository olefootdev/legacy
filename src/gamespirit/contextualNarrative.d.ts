/**
 * Narração contextual rica — reage ao placar, minuto, momentum e situação emocional.
 * Fase 1 — Quick Win #6
 */
import type { SpiritContext, SpiritOutcome } from './types';
/** Narração contextual para GOLS — reage ao timing e placar. */
export declare function contextualGoalNarrative(event: SpiritOutcome, ctx: SpiritContext, awayShort: string, scorerName: string): string | null;
/** Narração contextual para CHUTES — reage à pressão do placar/tempo. */
export declare function contextualShotNarrative(event: SpiritOutcome, ctx: SpiritContext, awayShort: string, shooterName: string): string | null;
/** Narração contextual para MOMENTUM — quando time domina completamente. */
export declare function contextualMomentumNarrative(ctx: SpiritContext, awayShort: string): string | null;
/** Narração contextual para AÇÕES TÁTICAS — faltas, posse, pressão. */
export declare function contextualTacticalNarrative(event: SpiritOutcome, ctx: SpiritContext, awayShort: string): string | null;
/** Narração contextual para FALTAS — reage à gravidade e contexto. */
export declare function contextualFoulNarrative(ctx: SpiritContext, awayShort: string, fouledName: string, isPenalty: boolean): string | null;
/** Wrapper principal — tenta narração contextual, fallback pra padrão. */
export declare function enrichNarrative(event: SpiritOutcome, ctx: SpiritContext, awayShort: string, defaultNarrative: string): string;
