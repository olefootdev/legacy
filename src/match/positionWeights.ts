import type { MatchPlayerAttributes, MatchTacticalRole } from '@/match/playerInMatch';

/**
 * Pesos de atributos por role: torna o overall "contextual".
 * Um zagueiro com marcação 90 supera um com marcação 60 +
 * finalização 90, mesmo com a soma igual.
 *
 * Se um atributo não aparece no mapa da role, peso padrão = 1.
 */
export const POSITION_ATTR_WEIGHTS: Record<
  MatchTacticalRole,
  Partial<Record<keyof MatchPlayerAttributes, number>>
> = {
  goleiro: {
    marcacao: 1.6,
    mentalidade: 1.5,
    fisico: 1.1,
    confianca: 1.3,
    velocidade: 0.7,
    drible: 0.3,
    finalizacao: 0.3,
    cruzamento: 0.4,
  },
  zagueiro: {
    marcacao: 2.0,
    fisico: 1.5,
    tatico: 1.4,
    velocidade: 1.2,
    mentalidade: 1.2,
    fairPlay: 1.0,
    finalizacao: 0.5,
    drible: 0.6,
    cruzamento: 0.5,
  },
  lateral: {
    velocidade: 1.6,
    marcacao: 1.4,
    cruzamento: 1.4,
    fisico: 1.2,
    passeCurto: 1.1,
    tatico: 1.2,
    finalizacao: 0.6,
  },
  volante: {
    marcacao: 1.6,
    tatico: 1.5,
    passeCurto: 1.4,
    mentalidade: 1.3,
    fisico: 1.3,
    finalizacao: 0.7,
  },
  meia: {
    passeCurto: 1.8,
    passeLongo: 1.5,
    tatico: 1.5,
    drible: 1.3,
    mentalidade: 1.2,
    finalizacao: 1.0,
    marcacao: 0.7,
  },
  ponta: {
    velocidade: 1.6,
    drible: 1.6,
    cruzamento: 1.3,
    finalizacao: 1.3,
    passeCurto: 1.0,
    marcacao: 0.5,
  },
  atacante: {
    finalizacao: 2.0,
    drible: 1.4,
    velocidade: 1.4,
    mentalidade: 1.3,
    fisico: 1.2,
    cruzamento: 0.7,
    marcacao: 0.4,
  },
};

const ATTR_KEYS: (keyof MatchPlayerAttributes)[] = [
  'passeCurto',
  'passeLongo',
  'cruzamento',
  'marcacao',
  'velocidade',
  'fairPlay',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
];

/** Overall ponderado por role (0-100). */
export function weightedOverall(
  attrs: MatchPlayerAttributes,
  role: MatchTacticalRole | undefined,
): number {
  // Blindagem: jogador legado / catch-up offline pode chegar sem `attrs` —
  // sem isto, `attrs[k]` derruba buildSpiritContext → applyWorldCatchUp →
  // RootErrorBoundary ("algo deu errado") no load. Default neutro = 50.
  if (!attrs) return 50;
  if (!role) {
    let s = 0;
    for (const k of ATTR_KEYS) s += attrs[k] ?? 50;
    return s / ATTR_KEYS.length;
  }
  const weights = POSITION_ATTR_WEIGHTS[role];
  let sum = 0;
  let total = 0;
  for (const k of ATTR_KEYS) {
    const w = weights[k] ?? 1;
    sum += (attrs[k] ?? 50) * w;
    total += w;
  }
  return total > 0 ? sum / total : 50;
}

/** Mapeia id de slot (ex.: 'gk', 'zc1', 'le', 'vol1', 'ata') pra role tática. */
export function roleFromSlotId(slotId: string | undefined): MatchTacticalRole | undefined {
  if (!slotId) return undefined;
  const s = slotId.toLowerCase();
  if (s.startsWith('gk') || s === 'gol') return 'goleiro';
  if (s.startsWith('zc') || s.startsWith('zag') || s === 'cb') return 'zagueiro';
  if (s.startsWith('le') || s.startsWith('ld') || s.startsWith('lb')) return 'lateral';
  if (s.startsWith('vol') || s === 'dm') return 'volante';
  if (s.startsWith('mc') || s.startsWith('am') || s.startsWith('mei')) return 'meia';
  if (s.startsWith('pe') || s.startsWith('pd') || s.startsWith('w')) return 'ponta';
  if (s.startsWith('ata') || s.startsWith('cf') || s === 'st') return 'atacante';
  return undefined;
}
