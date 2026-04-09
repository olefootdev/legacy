export type PlayingStylePresetId =
  | 'balanced'
  | 'tiki_positional'
  | 'vertical_transition'
  | 'wide_crossing'
  | 'low_block_counter'
  | 'direct_long_ball';

/** Chaves dos eixos (pontos 0–100; soma = 100 no estado persistido). */
export const STYLE_AXIS_KEYS = [
  'buildUp',
  'width',
  'verticality',
  'chanceCreation',
  'shootingProfile',
  'defensiveBlock',
  'pressing',
  'compactness',
  'riskTaking',
  'velocidade',
] as const;

export type StyleAxisKey = (typeof STYLE_AXIS_KEYS)[number];

/**
 * Estilo tático no save/UI: 10 eixos, cada um é alocação de pontos; a soma deve ser 100.
 * O motor usa `normalizeStyle()` → frações 0..1 (cada eixo / soma).
 */
export interface TeamTacticalStyle {
  presetId?: PlayingStylePresetId;
  buildUp: number;
  width: number;
  verticality: number;
  chanceCreation: number;
  shootingProfile: number;
  defensiveBlock: number;
  pressing: number;
  compactness: number;
  riskTaking: number;
  /** Ritmo de transição / jogo direto (eixo tático de time, não atributo de jogador). */
  velocidade: number;
}

/** Saída de `normalizeStyle`: mesmas chaves com valores 0..1 para o motor. */
export type NormalizedTacticalStyle = Omit<TeamTacticalStyle, 'presetId'> & { presetId?: PlayingStylePresetId };

export const STYLE_PRESETS: Record<PlayingStylePresetId, TeamTacticalStyle> = {
  balanced: {
    presetId: 'balanced',
    buildUp: 10,
    width: 10,
    verticality: 10,
    chanceCreation: 10,
    shootingProfile: 10,
    defensiveBlock: 10,
    pressing: 10,
    compactness: 10,
    riskTaking: 10,
    velocidade: 10,
  },
  tiki_positional: {
    presetId: 'tiki_positional',
    buildUp: 5,
    width: 11,
    verticality: 6,
    chanceCreation: 8,
    shootingProfile: 7,
    defensiveBlock: 10,
    pressing: 14,
    compactness: 17,
    riskTaking: 8,
    velocidade: 14,
  },
  vertical_transition: {
    presetId: 'vertical_transition',
    buildUp: 8,
    width: 10,
    verticality: 15,
    chanceCreation: 9,
    shootingProfile: 10,
    defensiveBlock: 7,
    pressing: 14,
    compactness: 9,
    riskTaking: 11,
    velocidade: 11,
  },
  wide_crossing: {
    presetId: 'wide_crossing',
    buildUp: 6,
    width: 17,
    verticality: 10,
    chanceCreation: 18,
    shootingProfile: 8,
    defensiveBlock: 8,
    pressing: 10,
    compactness: 7,
    riskTaking: 8,
    velocidade: 8,
  },
  low_block_counter: {
    presetId: 'low_block_counter',
    buildUp: 6,
    width: 5,
    verticality: 12,
    chanceCreation: 8,
    shootingProfile: 9,
    defensiveBlock: 20,
    pressing: 4,
    compactness: 17,
    riskTaking: 10,
    velocidade: 9,
  },
  direct_long_ball: {
    presetId: 'direct_long_ball',
    buildUp: 15,
    width: 8,
    verticality: 14,
    chanceCreation: 7,
    shootingProfile: 9,
    defensiveBlock: 8,
    pressing: 7,
    compactness: 7,
    riskTaking: 11,
    velocidade: 14,
  },
};

export type StyleActionId =
  | 'pass_safe'
  | 'pass_progressive'
  | 'pass_long'
  | 'cross'
  | 'dribble'
  | 'shoot'
  | 'clearance'
  | 'hold';

export interface StyleDefenseIntent {
  lineHeightOffset: number;
  pressTrigger: number;
  markBias: 'central' | 'wings' | 'balanced';
  funnel: 'inside' | 'outside' | 'balanced';
}

export const STYLE_ACTION_MATRIX: Record<StyleActionId, number> = {
  pass_safe: 0,
  pass_progressive: 0,
  pass_long: 0,
  cross: 0,
  dribble: 0,
  shoot: 0,
  clearance: 0,
  hold: 0,
};

export const STYLE_DEFENSE_MATRIX = {
  lineScale: 16,
  pressScale: 0.38,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function totalStylePoints(style: Partial<TeamTacticalStyle> | undefined): number {
  if (!style) return 0;
  return STYLE_AXIS_KEYS.reduce((acc, k) => acc + Math.max(0, Math.round(Number(style[k]) || 0)), 0);
}

/**
 * Ajusta um eixo e redistribui os outros para manter soma = 100.
 * Limpa `presetId` na UI ao chamar com presetId undefined no objeto retornado — feito no componente.
 */
export function redistributeStylePoints(style: TeamTacticalStyle, key: StyleAxisKey, nextVal: number): TeamTacticalStyle {
  const v = Math.max(0, Math.min(100, Math.round(nextVal)));
  const keys = [...STYLE_AXIS_KEYS];
  const others = keys.filter((k) => k !== key);
  const cur = { ...style };
  const oldOtherSum = others.reduce((acc, k) => acc + Math.max(0, Math.round(Number(cur[k]) || 0)), 0);
  const targetOther = 100 - v;
  const next: TeamTacticalStyle = { ...cur, [key]: v };

  if (targetOther <= 0) {
    for (const k of others) (next as Record<string, number>)[k] = 0;
    (next as Record<string, number>)[key] = 100;
    return next;
  }

  if (oldOtherSum <= 0) {
    const each = Math.floor(targetOther / others.length);
    let rem = targetOther - each * others.length;
    for (const k of others) {
      let add = each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      (next as Record<string, number>)[k] = add;
    }
    return next;
  }

  let allocated = 0;
  for (let i = 0; i < others.length - 1; i++) {
    const k = others[i]!;
    const prev = Math.max(0, Math.round(Number(cur[k]) || 0));
    const share = Math.round((prev / oldOtherSum) * targetOther);
    const assign = Math.min(targetOther - allocated, Math.max(0, share));
    (next as Record<string, number>)[k] = assign;
    allocated += assign;
  }
  (next as Record<string, number>)[others[others.length - 1]!] = targetOther - allocated;
  return next;
}

/** Converte saves antigos (0..1 por eixo) ou dados incompletos para 10 eixos somando 100. */
export function migrateTacticalStyle(raw: Partial<TeamTacticalStyle> | undefined | null): TeamTacticalStyle {
  const balanced = STYLE_PRESETS.balanced;
  if (!raw || typeof raw !== 'object') return { ...balanced };

  const o = raw as Record<string, unknown>;
  const keys = STYLE_AXIS_KEYS;
  const nums = keys.map((k) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? n : NaN;
  });
  const finite = nums.filter((n) => !Number.isNaN(n));
  const max = finite.length ? Math.max(0, ...finite) : 0;
  const sumFinite = finite.reduce((acc, n) => acc + (n > 0 ? n : 0), 0);

  const presetId = (o.presetId as PlayingStylePresetId | undefined) ?? balanced.presetId;

  // Legado: valores por eixo em 0..1 (tipicamente soma < 25)
  if (max <= 1.05 && sumFinite < 28) {
    const velMissing = o.velocidade === undefined || o.velocidade === null;
    let pts = keys.map((k) => {
      const n = Number(o[k]);
      const x = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
      return Math.round(x * 100);
    });
    if (velMissing) {
      const vi = keys.indexOf('velocidade');
      const vert = Number(o.verticality);
      const risk = Number(o.riskTaking);
      const avg = (Number.isFinite(vert) ? vert : 0.5) + (Number.isFinite(risk) ? risk : 0.5);
      pts[vi] = Math.round(Math.max(0, Math.min(1, avg / 2)) * 100);
    }
    const s = pts.reduce((a, b) => a + b, 0) || 1;
    pts = pts.map((p) => Math.max(1, Math.round((p / s) * 100)));
    let drift = 100 - pts.reduce((a, b) => a + b, 0);
    pts[pts.length - 1] += drift;
    return {
      presetId,
      buildUp: pts[0]!,
      width: pts[1]!,
      verticality: pts[2]!,
      chanceCreation: pts[3]!,
      shootingProfile: pts[4]!,
      defensiveBlock: pts[5]!,
      pressing: pts[6]!,
      compactness: pts[7]!,
      riskTaking: pts[8]!,
      velocidade: pts[9]!,
    };
  }

  let pts = keys.map((k) => Math.max(0, Math.round(Number(o[k]) || 0)));
  if (o.velocidade === undefined || o.velocidade === null) {
    const vi = keys.indexOf('velocidade');
    const vx = keys.indexOf('verticality');
    const rx = keys.indexOf('riskTaking');
    pts[vi] = Math.round((pts[vx]! + pts[rx]!) / 2) || 10;
  }
  const s = pts.reduce((a, b) => a + b, 0) || 1;
  if (s !== 100) {
    pts = pts.map((p) => Math.max(0, Math.round((p / s) * 100)));
    let drift = 100 - pts.reduce((a, b) => a + b, 0);
    pts[pts.length - 1] += drift;
  }
  return {
    presetId,
    buildUp: pts[0]!,
    width: pts[1]!,
    verticality: pts[2]!,
    chanceCreation: pts[3]!,
    shootingProfile: pts[4]!,
    defensiveBlock: pts[5]!,
    pressing: pts[6]!,
    compactness: pts[7]!,
    riskTaking: pts[8]!,
    velocidade: pts[9]!,
  };
}

export function normalizeStyle(style?: TeamTacticalStyle | NormalizedTacticalStyle): NormalizedTacticalStyle {
  const migrated = migrateTacticalStyle(style as TeamTacticalStyle);
  const total = totalStylePoints(migrated);
  const inv = total > 0 ? 1 / total : 0.01;
  return {
    presetId: migrated.presetId,
    buildUp: clamp01((migrated.buildUp ?? 0) * inv),
    width: clamp01((migrated.width ?? 0) * inv),
    verticality: clamp01((migrated.verticality ?? 0) * inv),
    chanceCreation: clamp01((migrated.chanceCreation ?? 0) * inv),
    shootingProfile: clamp01((migrated.shootingProfile ?? 0) * inv),
    defensiveBlock: clamp01((migrated.defensiveBlock ?? 0) * inv),
    pressing: clamp01((migrated.pressing ?? 0) * inv),
    compactness: clamp01((migrated.compactness ?? 0) * inv),
    riskTaking: clamp01((migrated.riskTaking ?? 0) * inv),
    velocidade: clamp01((migrated.velocidade ?? 0) * inv),
  };
}

export function styleActionBias(
  styleInput: TeamTacticalStyle | NormalizedTacticalStyle | undefined,
  action: StyleActionId,
  zoneTags?: readonly string[],
): number {
  const style = normalizeStyle(styleInput as TeamTacticalStyle);
  const wingZone = !!zoneTags?.some((z) => z.includes('wing') || z.includes('wide') || z.includes('lateral'));
  const boxZone = !!zoneTags?.some((z) => z.includes('box') || z.includes('area'));
  const ownBox = !!zoneTags?.some((z) => z === 'own_box');
  const middle = !!zoneTags?.some((z) => z.includes('middle') || z === 'middle_third');

  switch (action) {
    case 'pass_safe':
      return (1 - style.buildUp) * 0.32 + (1 - style.verticality) * 0.24 + (1 - style.riskTaking) * 0.2;
    case 'pass_progressive':
      return (
        style.verticality * 0.3 +
        style.riskTaking * 0.22 +
        (1 - style.buildUp) * 0.08 +
        style.velocidade * 0.18
      );
    case 'pass_long':
      return style.buildUp * 0.38 + style.verticality * 0.18 + style.riskTaking * 0.14 + style.velocidade * 0.12;
    case 'cross':
      if (!wingZone) return -0.22;
      return style.chanceCreation * 0.46 + style.width * 0.3;
    case 'dribble':
      return style.verticality * 0.16 + style.riskTaking * 0.26 + style.velocidade * 0.22;
    case 'shoot': {
      const insideBoxPriority = 1 - style.shootingProfile;
      if (!boxZone && insideBoxPriority > 0.55 && !middle) return -0.24;
      return style.shootingProfile * 0.24 + style.riskTaking * 0.2 + (boxZone ? insideBoxPriority * 0.14 : 0);
    }
    case 'clearance':
      return ownBox ? 0.42 : style.buildUp * 0.22;
    case 'hold':
      return (1 - style.verticality) * 0.24 + (1 - style.riskTaking) * 0.18 + (1 - style.velocidade) * 0.12;
    default:
      return 0;
  }
}

export function getDefensiveIntent(
  styleInput: TeamTacticalStyle | NormalizedTacticalStyle | undefined,
): StyleDefenseIntent {
  const s = normalizeStyle(styleInput as TeamTacticalStyle);
  const lineHeightOffset = (1 - s.defensiveBlock) * STYLE_DEFENSE_MATRIX.lineScale - s.defensiveBlock * 6;
  const pressTrigger = 11 + s.pressing * 10 + (1 - s.defensiveBlock) * 4 + s.velocidade * 3;
  const wingBias = s.width > 0.68 || s.chanceCreation > 0.72;
  const compactBias = s.compactness > 0.62;
  return {
    lineHeightOffset,
    pressTrigger,
    markBias: wingBias ? 'wings' : compactBias ? 'central' : 'balanced',
    funnel: compactBias ? 'inside' : wingBias ? 'outside' : 'balanced',
  };
}

export interface TeamStyleMatchMetrics {
  shortPasses: number;
  longPasses: number;
  crossesAttempted: number;
  crossesCompleted: number;
  dribblesAttempted: number;
  dribblesSuccess: number;
  shotsInsideBox: number;
  shotsOutsideBox: number;
  highPressEvents: number;
  defensiveLineSum: number;
  defensiveLineSamples: number;
}

export function createStyleMetrics(): TeamStyleMatchMetrics {
  return {
    shortPasses: 0,
    longPasses: 0,
    crossesAttempted: 0,
    crossesCompleted: 0,
    dribblesAttempted: 0,
    dribblesSuccess: 0,
    shotsInsideBox: 0,
    shotsOutsideBox: 0,
    highPressEvents: 0,
    defensiveLineSum: 0,
    defensiveLineSamples: 0,
  };
}

export function styleAdherence(
  styleInput: TeamTacticalStyle | NormalizedTacticalStyle | undefined,
  m: TeamStyleMatchMetrics,
): number {
  const s = normalizeStyle(styleInput as TeamTacticalStyle);
  const passTotal = Math.max(1, m.shortPasses + m.longPasses);
  const longShare = m.longPasses / passTotal;
  const crossTotal = Math.max(1, m.crossesAttempted);
  const crossComp = m.crossesCompleted / crossTotal;
  const shotsTotal = Math.max(1, m.shotsInsideBox + m.shotsOutsideBox);
  const insideShare = m.shotsInsideBox / shotsTotal;
  const compactTarget = 1 - s.width * 0.3;
  const compactActual = m.defensiveLineSamples > 0 ? (m.defensiveLineSum / m.defensiveLineSamples) / 100 : compactTarget;

  const dLong = 1 - Math.min(1, Math.abs(longShare - s.buildUp));
  const dCross = 1 - Math.min(1, Math.abs(crossComp - s.chanceCreation));
  const dInside = 1 - Math.min(1, Math.abs(insideShare - (1 - s.shootingProfile)));
  const dCompact = 1 - Math.min(1, Math.abs(compactActual - compactTarget));
  return Math.round((dLong * 0.3 + dCross * 0.2 + dInside * 0.3 + dCompact * 0.2) * 100);
}
