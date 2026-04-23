import type { PlayerAttributes } from '@/entities/types';
import type { StaffRoleId, StaffState } from '@/game/types';

const clampLvl = (n: number | undefined): number => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
};

/** Tabela por nível (índice 0 = nível 1). */
const PHYS_MATCH_ENERGY_PCT = [5, 7.5, 10, 15, 25];
const PHYS_RECOVERY_HOUR_PCT = [10, 15, 20, 25, 35];

const MENTAL_ERROR_REDUCE_PCT = [5, 7.5, 10, 15, 20];
const MENTAL_PRESSURE_CONF_PCT = [5, 7.5, 10, 15, 20];
const MENTAL_CLUTCH_EXTRA_PCT = [0, 0, 0, 0, 5];

const NUT_FATIGUE_ACTION_PCT = [5, 7.5, 10, 15, 20];
const NUT_INJURY_PCT = [5, 7.5, 10, 15, 20];
const NUT_POST_MATCH_RECOVERY_PCT = [0, 0, 0, 0, 10];

const TACTIC_POSITION_PCT = [5, 7.5, 10, 15, 20];
const TACTIC_PASS_PCT = [0, 5, 7.5, 10, 15];
const TACTIC_CHANCE_PCT = [0, 0, 0, 5, 10];

const COACH_ATTR_PCT = [3, 5, 7.5, 10, 15];
const COACH_AFTER_CONCEDE_CONF_SCALE = [1, 1, 1, 1.25, 1.25];
const COACH_INITIAL_MORALE_PCT = [0, 0, 0, 0, 10];
const COACH_AWAY_CONF_SCALE = [1, 1, 1, 1, 1.25];

const SCOUT_ATTR_ABOVE_MEAN_PCT = [5, 7.5, 10, 15, 20];
const SCOUT_MARKET_DISCOUNT_PCT = [0, 0, 5, 7.5, 10];
const SCOUT_RARE_TALENT_PCT = [0, 0, 0, 0, 5];

const GK_SAVE_PCT = [5, 7.5, 10, 15, 20];
const GK_BAD_REBOUND_REDUCE_PCT = [0, 0, 5, 10, 15];
const GK_CLUTCH_PCT = [0, 0, 0, 0, 5];

export interface HomeStaffMatchBonuses {
  /** Multiplicador de dreno de stamina em jogo (Casa). Menor = mais “energia”. */
  staminaDrainMulHome: number;
  /** Soma ao multiplicador de execução (passe/chute/drible) — reduz erros. */
  mentalExecAdd01: number;
  /** Confiança em pressão: soma ao `confidenceRuntime` antes de decisões chave (via bias em remate). */
  mentalPressureConfAdd01: number;
  /** Prob. extra de “clutch” sob pressão (execução). */
  mentalClutchProb: number;
  /** Bónus em pSuccess de passes (lado Casa a atacar). */
  passSuccessAdd01Home: number;
  /** Bónus em pOnTarget de remates. */
  shotOnTargetAdd01Home: number;
  /** Bónus em xG (criação / fluidez). */
  shotXgAdd01Home: number;
  /** Soma a gkDef01 do GR da Casa quando defende. */
  gkDefAdd01Home: number;
  /** Soma ao viés de defesa “hold” vs rebote. */
  gkHoldLeanAdd01Home: number;
  /** Prob. extra de defesa espectacular (Casa). */
  gkClutchSaveProbHome: number;
  /** Multiplicador de atributos de jogo (Casa). */
  coachAttrMulHome: number;
  /** Bónus inicial de moral/confiança (aplicado uma vez no arranque). */
  coachMoraleStartAdd01: number;
  /** Multiplicador na duração da desorganização defensiva quando a Casa é atacada. <1 = recupera forma mais depressa. */
  homeDefShapeBreakSecMul: number;
  /** Bump extra de confiança (positivo) para titulares Casa quando sofrem golo. */
  coachConfAfterConcedeBonus01: number;
  /** Escala deltas positivos de confiança Casa fora de casa. */
  coachAwayConfPositiveDeltaScale: number;
}

export function buildHomeStaffMatchBonuses(
  staff: StaffState,
  ctx: { isHomeFixture: boolean },
): HomeStaffMatchBonuses {
  const pf = clampLvl(staff.roles.preparador_fisico);
  const men = clampLvl(staff.roles.mental);
  const nut = clampLvl(staff.roles.nutricao);
  const tac = clampLvl(staff.roles.tatico);
  const co = clampLvl(staff.roles.treinador);
  const gk = clampLvl(staff.roles.preparador_goleiros);

  const physEnergy = PHYS_MATCH_ENERGY_PCT[pf - 1]! / 100;
  const nutFat = NUT_FATIGUE_ACTION_PCT[nut - 1]! / 100;
  const staminaDrainMulHome = Math.max(0.55, 1 - physEnergy - nutFat * 0.85);

  const mentalExecAdd01 =
    MENTAL_ERROR_REDUCE_PCT[men - 1]! / 100 * 0.42 + (men >= 5 ? MENTAL_CLUTCH_EXTRA_PCT[men - 1]! / 100 * 0.12 : 0);
  const mentalPressureConfAdd01 = MENTAL_PRESSURE_CONF_PCT[men - 1]! / 100 * 0.08;
  const mentalClutchProb = men >= 5 ? MENTAL_CLUTCH_EXTRA_PCT[men - 1]! / 100 : 0;

  const passSuccessAdd01Home =
    TACTIC_PASS_PCT[tac - 1]! / 100 * 0.55 + TACTIC_POSITION_PCT[tac - 1]! / 100 * 0.12;
  const shotOnTargetAdd01Home = TACTIC_POSITION_PCT[tac - 1]! / 100 * 0.1 + TACTIC_CHANCE_PCT[tac - 1]! / 100 * 0.35;
  const shotXgAdd01Home = TACTIC_CHANCE_PCT[tac - 1]! / 100 * 0.06;

  const gkDefAdd01Home = GK_SAVE_PCT[gk - 1]! / 100 * 0.55;
  const gkHoldLeanAdd01Home = GK_BAD_REBOUND_REDUCE_PCT[gk - 1]! / 100 * 0.38;
  const gkClutchSaveProbHome = GK_CLUTCH_PCT[gk - 1]! / 100;

  const coachAttrMulHome = 1 + COACH_ATTR_PCT[co - 1]! / 100;
  const coachMoraleStartAdd01 = COACH_INITIAL_MORALE_PCT[co - 1]! / 100 * 0.12;
  const homeDefShapeBreakSecMul = Math.max(0.62, 1 - TACTIC_POSITION_PCT[tac - 1]! / 100 * 0.85);
  const coachConfAfterConcedeBonus01 =
    (COACH_AFTER_CONCEDE_CONF_SCALE[co - 1]! - 1) * 0.055 + (co >= 4 ? 0.012 : 0);
  const coachAwayConfPositiveDeltaScale = ctx.isHomeFixture ? 1 : COACH_AWAY_CONF_SCALE[co - 1]!;

  return {
    staminaDrainMulHome,
    mentalExecAdd01,
    mentalPressureConfAdd01,
    mentalClutchProb,
    passSuccessAdd01Home,
    shotOnTargetAdd01Home,
    shotXgAdd01Home,
    gkDefAdd01Home,
    gkHoldLeanAdd01Home,
    gkClutchSaveProbHome,
    coachAttrMulHome,
    coachMoraleStartAdd01,
    homeDefShapeBreakSecMul,
    coachConfAfterConcedeBonus01,
    coachAwayConfPositiveDeltaScale,
  };
}

export interface StaffRunMatchMinuteEffects {
  fatigueGainMul: number;
  injuryStressMul: number;
  injuryRiskGrowthMul: number;
}

export function staffRunMatchMinuteEffects(staff: StaffState): StaffRunMatchMinuteEffects {
  const pf = clampLvl(staff.roles.preparador_fisico);
  const nut = clampLvl(staff.roles.nutricao);
  const phys = PHYS_MATCH_ENERGY_PCT[pf - 1]! / 100;
  const nutF = NUT_FATIGUE_ACTION_PCT[nut - 1]! / 100;
  const fatigueGainMul = Math.max(0.5, 1 - phys - nutF * 0.9);
  const inj = NUT_INJURY_PCT[nut - 1]! / 100;
  return {
    fatigueGainMul,
    injuryStressMul: Math.max(0.55, 1 - inj),
    injuryRiskGrowthMul: Math.max(0.55, 1 - inj * 0.85),
  };
}

export function staffPhysicalRecoveryBonusPercent(staff: StaffState): number {
  const pf = clampLvl(staff.roles.preparador_fisico);
  return PHYS_RECOVERY_HOUR_PCT[pf - 1]!;
}

export function nutritionPostMatchFatigueRecoveryBonus(staff: StaffState): number {
  const nut = clampLvl(staff.roles.nutricao);
  return NUT_POST_MATCH_RECOVERY_PCT[nut - 1]! / 100;
}

export function headCoachTrainingAttrMultiplier(staff: StaffState): number {
  const co = clampLvl(staff.roles.treinador);
  return 1 + COACH_ATTR_PCT[co - 1]! / 100;
}

export function scoutNpcPriceDiscountFraction(staff: StaffState): number {
  const sc = clampLvl(staff.roles.olheiro);
  return SCOUT_MARKET_DISCOUNT_PCT[sc - 1]! / 100;
}

export function scoutNpcAttrRollAboveMeanChance(staff: StaffState): number {
  const sc = clampLvl(staff.roles.olheiro);
  return SCOUT_ATTR_ABOVE_MEAN_PCT[sc - 1]! / 100;
}

/** Aplica bónus de olheiro a atributos de snapshot NPC (já normalizados ao teto OVR). */
export function applyScoutBonusToNpcAttrs(attrs: PlayerAttributes, scoutLevel: number, rng: () => number): PlayerAttributes {
  const sc = clampLvl(scoutLevel);
  const rollMean = SCOUT_ATTR_ABOVE_MEAN_PCT[sc - 1]! / 100;
  const keys: (keyof PlayerAttributes)[] = [
    'passe',
    'marcacao',
    'velocidade',
    'drible',
    'finalizacao',
    'fisico',
    'tatico',
    'mentalidade',
    'confianca',
    'fairPlay',
  ];
  const out = { ...attrs };
  const bumpOne = () => {
    const k = keys[Math.floor(rng() * keys.length)]!;
    out[k] = Math.min(99, out[k] + (rng() > 0.55 ? 2 : 1));
  };
  if (rng() < rollMean) bumpOne();
  if (rng() < rollMean * 0.55) bumpOne();
  if (sc >= 5 && rng() < SCOUT_RARE_TALENT_PCT[4]! / 100) bumpOne();
  return out;
}

export function npcProspectBasePriceExp(ovr: number): number {
  return Math.round(380 + ovr * 28 + Math.min(420, ovr * ovr * 0.04));
}

export function npcProspectPriceAfterScoutDiscount(basePriceExp: number, staff: StaffState): number {
  const d = scoutNpcPriceDiscountFraction(staff);
  return Math.max(120, Math.round(basePriceExp * (1 - d)));
}

export const STAFF_BENEFIT_SUMMARY: Record<
  StaffRoleId,
  { title: string; lines: string[] }
> = {
  preparador_fisico: {
    title: 'Preparador físico',
    lines: [
      'N1: +5% energia em jogo; +10% recuperação de fadiga/hora fora de jogo.',
      'N2: +7,5% energia; +15% recuperação/hora.',
      'N3: +10% energia; +20% recuperação/hora.',
      'N4: +15% energia; +25% recuperação/hora.',
      'N5: +25% energia; +35% recuperação/hora.',
    ],
  },
  mental: {
    title: 'Preparador mental',
    lines: [
      'N1–N4: menos erros em passe/drible/remate; mais confiança sob pressão (5% → 15%).',
      'N5: até −20% erros; +20% confiança sob pressão; +5% chance de execução “clutch”.',
    ],
  },
  nutricao: {
    title: 'Nutrição',
    lines: [
      'N1–N4: menos fadiga acumulada em jogo; menor acúmulo de risco de lesão.',
      'N5: efeitos N4 + +10% recuperação de fadiga após jogo (sinergia com preparação física).',
    ],
  },
  tatico: {
    title: 'Preparador tático',
    lines: [
      'N1: melhor posicionamento colectivo; bloco defensivo mais estável.',
      'N2–N5: passes certos e criação de jogo conforme nível.',
    ],
  },
  treinador: {
    title: 'Treinador',
    lines: [
      'N1–N3: boost global de atributos em jogo e ganhos de treino.',
      'N4: +25% de recuperação de confiança após sofrer golo.',
      'N5: +10% moral inicial no apito; +25% confiança positiva fora de casa.',
    ],
  },
  olheiro: {
    title: 'Olheiro',
    lines: [
      'N1–N2: mais chance de talentos NPC com atributos acima da média.',
      'N3–N5: desconto em EXP no mercado de prospects NPC.',
      'N5: +5% chance de talento raro no scouting.',
    ],
  },
  preparador_goleiros: {
    title: 'Preparador de GR',
    lines: [
      'N1–N2: melhor taxa de defesa do GR da equipa.',
      'N3–N4: menos rebotes perigosos após defesa.',
      'N5: defesas fortes + chance de defesa “clutch”.',
    ],
  },
};
