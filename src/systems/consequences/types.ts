/**
 * OLEFOOT PYTHON MODE — Tipos do Sistema A (Impacto Persistente).
 *
 * Uma `PersistentConsequence` é um efeito com tempo de vida em horas reais
 * que aplica overlay sobre o estado base do clube/jogador. Ao expirar,
 * desaparece (ou é colhida pelo `tickConsequences`).
 */
import type {
  ConsequenceDimension,
  ConsequenceScope,
  DecayCurve,
} from '@/systems/impactCatalog';

export type { ConsequenceDimension, ConsequenceScope, DecayCurve };

export interface PersistentConsequence {
  /** UUID estável. */
  id: string;
  /** Manager dono do clube. */
  managerId: string;
  /** Clube alvo. */
  clubId: string;
  /** Jogador alvo, se scope='player'. */
  playerId?: string;
  /** Identificador semântico (ex: 'red_card_suspension'). */
  kind: string;
  dimension: ConsequenceDimension;
  scope: ConsequenceScope;
  /** Valor base em t=0. */
  magnitude: number;
  decayCurve: DecayCurve;
  startsAt: number; // ms epoch
  expiresAt: number; // ms epoch
  /** ID do evento que originou (partida, ausência, etc.). */
  sourceEventId?: string;
  /** Dados extras (ex: { matchId, scoreContext, weather }). */
  metadata?: Record<string, unknown>;
}

/** Estado serializável guardado no game state + Supabase. */
export interface ConsequenceStoreState {
  /** Consequências ativas indexadas por id. */
  active: Record<string, PersistentConsequence>;
  /** Último tick que rodou (pra evitar trabalho duplicado). */
  lastTickAt?: number;
}

export const EMPTY_CONSEQUENCE_STORE: ConsequenceStoreState = {
  active: {},
};

/** Avaliação derivada — UI e selectors usam isto, nunca o magnitude raw. */
export interface EvaluatedConsequence {
  consequence: PersistentConsequence;
  /** Valor efetivo agora, após aplicar decay. */
  currentValue: number;
  /** % de vida restante (0..1). */
  lifeRemaining: number;
  /** ms até expirar. */
  msUntilExpiry: number;
}
