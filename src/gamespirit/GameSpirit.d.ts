import type { PitchPlayerState, PitchPoint, PossessionSide } from '@/engine/types';
import type { SpiritContext, SpiritOutcome } from './types';
import type { PlayerEntity } from '@/entities/types';
import { type TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
export declare function buildSpiritContext(input: {
    minute: number;
    homeScore: number;
    awayScore: number;
    possession: PossessionSide;
    ball: PitchPoint;
    onBall?: PitchPlayerState;
    crowdSupport: number;
    tacticalMentality: number;
    tacticalStyle?: import('@/tactics/playingStyle').TeamTacticalStyle;
    opponentStrength: number;
    homeRoster: PlayerEntity[];
    homePlayers: PitchPlayerState[];
    homeShort?: string;
    recentFeedLines?: string[];
    awayRoster?: {
        id: string;
        num: number;
        name: string;
        pos: string;
    }[];
    test2dTickModifiers?: SpiritContext['test2dTickModifiers'];
    live2dStagnationTicks?: number;
    motorTelemetryTail?: SpiritContext['motorTelemetryTail'];
    penaltyCooldownTicks?: number;
    momentum?: SpiritContext['momentum'];
    pendingCornerForSide?: SpiritContext['pendingCornerForSide'];
    pendingFreeKickForSide?: SpiritContext['pendingFreeKickForSide'];
    smartfieldActionHint?: SpiritContext['smartfieldActionHint'];
    tacticalIntensity?: TacticalIntensityLevel;
}): SpiritContext;
/** Ciclo: contexto → decisão → consequência → narrativa + log causal (A1–A3). */
export declare function gameSpiritTick(ctx: SpiritContext, awayShort: string, causalSeqStart: number, nowMs?: number): SpiritOutcome;
