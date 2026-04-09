export type ClubStructureId =
  | 'stadium'
  | 'megastore'
  | 'youth_academy'
  | 'training_center'
  | 'medical_dept';

export const ALL_STRUCTURE_IDS: readonly ClubStructureId[] = [
  'stadium',
  'megastore',
  'youth_academy',
  'training_center',
  'medical_dept',
] as const;

export const STRUCTURE_LABELS: Record<ClubStructureId, string> = {
  stadium: 'Estádio',
  megastore: 'Megaloja',
  youth_academy: 'Categoria de base',
  training_center: 'Centro de treinamento',
  medical_dept: 'Departamento médico',
};

/** Minimum level (always unlocked). */
export const MIN_LEVEL = 1;
/** Maximum level. */
export const MAX_LEVEL = 5;
/** Last level reachable with EXP. */
export const MAX_EXP_LEVEL = 3;

export type UpgradeCurrency = 'exp' | 'bro';

export interface UpgradeCost {
  currency: UpgradeCurrency;
  /** EXP units or BRO cents, depending on currency. */
  amount: number;
}

/** BRO prices from Admin/API (cents). */
export interface ClubStructureBroPrices {
  level3to4BroCents: number;
  level4to5BroCents: number;
}

/** Full BRO price table from Admin. */
export type AdminBroPriceTable = Record<ClubStructureId, ClubStructureBroPrices>;

/** Per-structure level state. */
export type ClubStructuresState = Record<ClubStructureId, number>;

/** Ledger reasons for audit trail. */
export const LEDGER_REASON_EXP = 'structure_upgrade_exp' as const;
export const LEDGER_REASON_BRO = 'structure_upgrade_bro' as const;
