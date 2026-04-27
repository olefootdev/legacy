import type { ClubStructuresState } from './types';

const clampLevel = (n: number | undefined): number => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
};

// ---------------------------------------------------------------------------
// Categoria de base — booster em treinos para `novo_talento`
// ---------------------------------------------------------------------------

/** Multiplicador extra (1 + bónus) aplicado ao ganho de atributos em treino. */
export function youthAcademyProspectTrainingMultiplier(youthAcademyLevel: number): number {
  const lvl = clampLevel(youthAcademyLevel);
  const bonusPct = lvl <= 2 ? 20 : lvl === 3 ? 30 : lvl === 4 ? 40 : 50;
  return 1 + bonusPct / 100;
}

// ---------------------------------------------------------------------------
// Megaloja — pontos de apoio efectivos + EXP extra em vitória
// ---------------------------------------------------------------------------

/** Pontos percentuais somados ao apoio base em jogos em casa. */
export function megastoreHomeConfidenceBonusPoints(megastoreLevel: number): number {
  const lvl = clampLevel(megastoreLevel);
  return [10, 20, 30, 40, 50][lvl - 1]!;
}

/** Pontos percentuais somados ao apoio base em jogos fora (L4+). */
export function megastoreAwayConfidenceBonusPoints(megastoreLevel: number): number {
  const lvl = clampLevel(megastoreLevel);
  if (lvl < 4) return 0;
  return lvl === 4 ? 10 : 20;
}

/**
 * Apoio da torcida usado na simulação e no cálculo de assistência.
 * Soma bónus da Megaloja (pontos) e limita a [0, 99].
 */
export function effectiveCrowdSupportPercent(
  baseSupportPercent: number,
  structures: ClubStructuresState,
  isHomeFixture: boolean,
): number {
  const meg = clampLevel(structures.megastore);
  const add = isHomeFixture ? megastoreHomeConfidenceBonusPoints(meg) : megastoreAwayConfidenceBonusPoints(meg);
  return Math.min(99, Math.max(0, baseSupportPercent + add));
}

/**
 * EXP extra por vitória: confiança (efectiva) × coeficiente por nível da Megaloja.
 * Valores moderados para combinar com o bónus do estádio.
 */
export function megastoreWinExpFromCrowd(effectiveSupportPercent: number, megastoreLevel: number): number {
  const lvl = clampLevel(megastoreLevel);
  const coef = [0.35, 0.55, 0.75, 0.95, 1.15][lvl - 1]!;
  return Math.max(0, Math.round(effectiveSupportPercent * coef));
}

// ---------------------------------------------------------------------------
// Departamento médico — slots de tratamento + velocidade de recuperação
// ---------------------------------------------------------------------------

export function medicalDeptTreatmentSlots(medicalDeptLevel: number): number {
  const lvl = clampLevel(medicalDeptLevel);
  return [1, 3, 5, 7, 10][lvl - 1]!;
}

/** Bónus % à velocidade de recuperação (fadiga, risco, lesão-fora). */
export function medicalDeptRecoverySpeedBonusPercent(medicalDeptLevel: number): number {
  const lvl = clampLevel(medicalDeptLevel);
  return [10, 20, 30, 40, 50][lvl - 1]!;
}

// ---------------------------------------------------------------------------
// Centro de treinamento — slots por tipo, colectivos, booster, AI Labs
// ---------------------------------------------------------------------------

export function trainingCenterSlotsPerSkillType(trainingCenterLevel: number): number {
  const lvl = clampLevel(trainingCenterLevel);
  return [1, 3, 5, 7, 10][lvl - 1]!;
}

/** Máximo de planos de treino colectivo em simultâneo (L1–2: 1; L3+: 3). */
export function trainingCenterMaxConcurrentCollectivePlans(trainingCenterLevel: number): number {
  const lvl = clampLevel(trainingCenterLevel);
  return lvl >= 3 ? 3 : 1;
}

export function trainingCenterHasAiLabs(trainingCenterLevel: number): boolean {
  return clampLevel(trainingCenterLevel) >= 2;
}

/** Multiplicador extra (1 + bónus) em ganhos de atributo por treino (só CT ≥4). */
export function trainingCenterAttributeGainMultiplier(trainingCenterLevel: number): number {
  const lvl = clampLevel(trainingCenterLevel);
  if (lvl < 4) return 1;
  if (lvl === 4) return 1.25;
  return 1.35;
}

// ---------------------------------------------------------------------------
// Estádio — capacidade e EXP por assistente (vitória)
// ---------------------------------------------------------------------------

export function stadiumCapacityByLevel(stadiumLevel: number): number {
  const lvl = clampLevel(stadiumLevel);
  return [10_000, 25_000, 35_000, 50_000, 75_000][lvl - 1]!;
}

/** EXP por unidade de assistência (arredondada no produto final). */
export function stadiumExpPerSpectatorByLevel(stadiumLevel: number): number {
  const lvl = clampLevel(stadiumLevel);
  return [0.1, 0.15, 0.2, 0.25, 0.5][lvl - 1]!;
}

/**
 * Assistência aproximada = capacidade × (apoio efectivo / 100).
 * Só em jogos em casa o clube “enche” o próprio estádio.
 */
export function stadiumSpectatorsPresent(
  stadiumLevel: number,
  effectiveSupportPercent: number,
  isHomeFixture: boolean,
): number {
  if (!isHomeFixture) return 0;
  const cap = stadiumCapacityByLevel(stadiumLevel);
  const fill = Math.min(1, Math.max(0, effectiveSupportPercent / 100));
  return Math.floor(cap * fill);
}

/** EXP por assistência no estádio do clube (jogos em casa; qualquer resultado). */
export function stadiumMatchExpFromSpectators(
  stadiumLevel: number,
  effectiveSupportPercent: number,
  isHomeFixture: boolean,
): number {
  const spectators = stadiumSpectatorsPresent(stadiumLevel, effectiveSupportPercent, isHomeFixture);
  const rate = stadiumExpPerSpectatorByLevel(stadiumLevel);
  return Math.max(0, Math.floor(spectators * rate));
}

// ---------------------------------------------------------------------------
// Agregado pós-jogo
// ---------------------------------------------------------------------------

export function structureMatchExpBonuses(input: {
  structures: ClubStructuresState;
  baseCrowdSupportPercent: number;
  isHomeFixture: boolean;
  userWin: boolean;
}): { effectiveCrowd: number; stadiumExp: number; megastoreExp: number; totalExtra: number } {
  const eff = effectiveCrowdSupportPercent(input.baseCrowdSupportPercent, input.structures, input.isHomeFixture);
  const stadiumExp = stadiumMatchExpFromSpectators(input.structures.stadium ?? 1, eff, input.isHomeFixture);
  const megastoreExp = input.userWin ? megastoreWinExpFromCrowd(eff, input.structures.megastore ?? 1) : 0;
  return {
    effectiveCrowd: eff,
    stadiumExp,
    megastoreExp,
    totalExtra: stadiumExp + megastoreExp,
  };
}
