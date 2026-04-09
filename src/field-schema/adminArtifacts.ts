import type { FieldSchemaVersion } from './constants';
import type { FieldZoneId } from './catalogTypes';

/** Fases táticas coletivas (Admin pinta ocupação alvo por fase). */
export type MatchPhaseTactic =
  | 'build_up'
  | 'press'
  | 'low_block'
  | 'transition_def'
  | 'transition_att'
  | 'set_piece_def'
  | 'set_piece_att';

export type ZoneBindingKind = 'preferred' | 'forbidden' | 'pressure';

export interface ZoneBinding {
  zoneId: FieldZoneId;
  kind: ZoneBindingKind;
  /** 0–1, opcional — prioridade relativa entre bindings do mesmo jogador */
  weight?: number;
}

export type TeachingCondition =
  | { kind: 'in_zone'; zoneId: FieldZoneId }
  | { kind: 'has_possession' }
  | { kind: 'match_phase'; phase: MatchPhaseTactic | string }
  | { kind: 'ball_in_zone'; zoneId: FieldZoneId }
  | { kind: 'and'; children: TeachingCondition[] }
  | { kind: 'or'; children: TeachingCondition[] };

export interface TeachingRule {
  id: string;
  priority: number;
  condition: TeachingCondition;
  action: {
    kind: 'yuka_weight_delta' | 'seek_bias' | 'clamp_corridor' | 'flag';
    payload: Record<string, number | string | boolean>;
  };
}

/** Perfil de campo por jogador (publicado pelo Admin, consumido na partida). */
export interface PlayerFieldProfile {
  playerId: string;
  fieldSchemaVersion: FieldSchemaVersion;
  zones: ZoneBinding[];
  teachingRules: TeachingRule[];
  /** Sobrescreve pesos default do steering (seek, separation, etc.) */
  yukaWeights?: Partial<Record<string, number>>;
  updatedAt: string;
}

export interface SlotDefinition {
  slotId: string;
  /** Offset normalizado somado ao slot base da formação (pivô: bola ou centro, conforme motor) */
  offsetNx: number;
  offsetNz: number;
}

/** Zonas que o modelo “pretende” dominar nesta fase (refs ao catálogo). */
export interface PhaseSpatialProfile {
  targetZoneIds: FieldZoneId[];
  /** Peso 0–1 por zona opcional */
  weights?: Partial<Record<FieldZoneId, number>>;
}

export interface TacticalPattern {
  id: string;
  name: string;
  fieldSchemaVersion: FieldSchemaVersion;
  formationKey: string;
  slotTemplate: SlotDefinition[];
  phasePresets: Partial<Record<MatchPhaseTactic, PhaseSpatialProfile>>;
  behavior: {
    blockDepthBias: number;
    widePlayBias: number;
    pressTriggerZones: FieldZoneId[];
  };
  version: number;
}

/**
 * Percentuais auditáveis no mint (imutável após criação).
 * Modelo de referência do produto: 25 / 10 / 50 / 15 (Olefoot / Agente / Pool jogador / Comunidade).
 */
export interface BroSplitSnapshot {
  olefoot: number;
  agent: number;
  playerPool: number;
  community: number;
}

/**
 * Ledger de criação do jogador especial (BRO).
 * facilitatorId roteia comissão; mapear a “Agente” ou sub-split conforme produto jurídico.
 */
export interface BroSpecialPlayerCreationLedger {
  playerId: string;
  priceBro: number;
  facilitatorId: string;
  splitsSnapshot: BroSplitSnapshot;
  creationTx?: string;
  paymentIntentId?: string;
  createdAt: string;
}
