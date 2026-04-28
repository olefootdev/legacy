// Tipos compartilhados do sistema de pênalti

export type SlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PenaltyOutcome =
  | 'goal'
  | 'save'
  | 'weak-save'
  | 'over-bar'
  | 'post'
  | 'wide';

export type PenaltyPhase = 'pick' | 'charging' | 'reveal' | 'result';

export type PenaltyPOV = 'manager' | 'player';

export interface PenaltyShooter {
  id: string;
  displayName: string;
  shirtNumber: number;
  finishingRating: number; // 0-100
  forcaMental?: number; // 0-100, afeta steady aim em Player POV
}

export interface PenaltyKeeper {
  id: string;
  displayName: string;
  readingRating: number; // 0-100 (capacidade de ler o batedor)
  positioningRating: number; // 0-100
  tendency?: 'left' | 'center' | 'right'; // bias de leitura
}

export interface PenaltyShootResult {
  outcome: PenaltyOutcome;
  pickedSlot: SlotIndex;
  keeperSlot: SlotIndex;
  power: number;
  landing: { x: number; y: number };
  finalRotation: number;
}

export type ShotResult = 'goal' | 'save' | 'pending';

export interface ShootoutContext {
  homeShots: ShotResult[];
  awayShots: ShotResult[];
  currentShooter: number;
  rounds: number;
  homeLabel?: string;
  awayLabel?: string;
}
