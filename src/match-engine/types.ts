/**
 * Match Engine — tipos de domínio (sem render).
 * Posse, zonas, pressão, transição e fase da jogada guiam o comportamento coletivo.
 */

import type { PossessionSide } from '@/engine/types';

/** Terços lógicos ao longo do eixo X (casa ataca +X). */
export type PitchZone = 'def_low' | 'def_mid' | 'mid' | 'att' | 'final_third';

/** Contexto tático da posse (define como o bloco se comporta). */
export type PossessionContext =
  | 'build' // saída / construção
  | 'progression' // meio, avanço controlado
  | 'attack' // último terço, criação
  | 'transition_attack' // acabou de recuperar — pode acelerar
  | 'transition_defend'; // acabou de perder — recuar ou pressionar

/** Fases da “história” da jogada (continuidade). */
export type PlayBeat =
  | 'recovery'
  | 'organization'
  | 'progression'
  | 'chance_creation'
  | 'finishing'
  | 'turnover';

export type FormationSchemeId =
  | '4-3-3'
  | '4-4-2'
  | '4-2-3-1'
  | '3-5-2'
  | '4-5-1'
  | '5-3-2'
  | '3-4-3';

export interface PressureReading {
  opponentsWithin6m: number;
  opponentsWithin12m: number;
  closestOpponentM: number;
  /** 0–1, usado para “tempo de decisão” / erro implícito no futuro */
  intensity: number;
}

export interface PossessionState {
  side: PossessionSide;
  /** null se disputa aberta longe da bola */
  carrierPlayerId: string | null;
  context: PossessionContext;
  ballZone: PitchZone;
  pressure: PressureReading;
}

export interface PlayStoryState {
  beat: PlayBeat;
  /** segundos no beat atual */
  timeInBeat: number;
  /** lado que “conduz” a narrativa da jogada */
  drivingSide: PossessionSide;
}

/** Alvo normalizado + papel de linha para coesão de bloco. */
export interface EngineSlotIntent {
  nx: number;
  nz: number;
  line: 'def' | 'mid' | 'att';
}

export interface MatchEngineFrame {
  possession: PossessionState;
  story: PlayStoryState;
  /** Alvos normalizados (0–1) por slot, já com bloco + contexto + apoio */
  homeSlots: Map<string, EngineSlotIntent>;
  awaySlots: Map<string, EngineSlotIntent>;
}
