import type { PlayerProfile, PlayerArchetype } from './types';

const ARCHETYPES: Record<PlayerArchetype, Omit<PlayerProfile, 'archetype'>> = {
  creative: {
    riskAppetite: 0.7,
    verticality: 0.6,
    possessionBias: 0.5,
    dribbleTendency: 0.5,
    firstTouchPlay: 0.6,
    composure: 0.7,
    vision: 0.85,
    workRate: 0.5,
  },
  conservative: {
    riskAppetite: 0.2,
    verticality: 0.3,
    possessionBias: 0.85,
    dribbleTendency: 0.15,
    firstTouchPlay: 0.3,
    composure: 0.7,
    vision: 0.5,
    workRate: 0.6,
  },
  dribbler: {
    riskAppetite: 0.75,
    verticality: 0.55,
    possessionBias: 0.35,
    dribbleTendency: 0.9,
    firstTouchPlay: 0.4,
    composure: 0.6,
    vision: 0.5,
    workRate: 0.45,
  },
  playmaker: {
    riskAppetite: 0.55,
    verticality: 0.65,
    possessionBias: 0.6,
    dribbleTendency: 0.3,
    firstTouchPlay: 0.7,
    composure: 0.8,
    vision: 0.9,
    workRate: 0.45,
  },
  target_man: {
    riskAppetite: 0.5,
    verticality: 0.4,
    possessionBias: 0.4,
    dribbleTendency: 0.15,
    firstTouchPlay: 0.6,
    composure: 0.55,
    vision: 0.4,
    workRate: 0.5,
  },
  box_to_box: {
    riskAppetite: 0.5,
    verticality: 0.55,
    possessionBias: 0.5,
    dribbleTendency: 0.35,
    firstTouchPlay: 0.45,
    composure: 0.6,
    vision: 0.55,
    workRate: 0.9,
  },
  destroyer: {
    riskAppetite: 0.15,
    verticality: 0.2,
    possessionBias: 0.7,
    dribbleTendency: 0.1,
    firstTouchPlay: 0.35,
    composure: 0.65,
    vision: 0.35,
    workRate: 0.85,
  },
  winger: {
    riskAppetite: 0.65,
    verticality: 0.7,
    possessionBias: 0.3,
    dribbleTendency: 0.75,
    firstTouchPlay: 0.5,
    composure: 0.55,
    vision: 0.5,
    workRate: 0.6,
  },
  fullback_offensive: {
    riskAppetite: 0.5,
    verticality: 0.55,
    possessionBias: 0.5,
    dribbleTendency: 0.4,
    firstTouchPlay: 0.4,
    composure: 0.55,
    vision: 0.45,
    workRate: 0.85,
  },
  anchor: {
    riskAppetite: 0.1,
    verticality: 0.15,
    possessionBias: 0.9,
    dribbleTendency: 0.05,
    firstTouchPlay: 0.35,
    composure: 0.75,
    vision: 0.55,
    workRate: 0.65,
  },
  poacher: {
    riskAppetite: 0.7,
    verticality: 0.8,
    possessionBias: 0.2,
    dribbleTendency: 0.25,
    firstTouchPlay: 0.65,
    composure: 0.65,
    vision: 0.4,
    workRate: 0.4,
  },
};

export function buildProfile(archetype: PlayerArchetype): PlayerProfile {
  return { archetype, ...ARCHETYPES[archetype] };
}

export function profileForRole(role: string): PlayerProfile {
  switch (role) {
    case 'gk': return buildProfile('anchor');
    case 'def': return buildProfile('conservative');
    case 'mid': return buildProfile('box_to_box');
    case 'attack': return buildProfile('poacher');
    default: return buildProfile('box_to_box');
  }
}

/**
 * Derive archetype from positional slot for more granularity.
 * Slot IDs like 'vol', 'mc1', 'pe', 'pd', 'le', 'ld', etc.
 */
export function profileForSlot(slotId: string, role: string): PlayerProfile {
  switch (slotId) {
    case 'gol': return buildProfile('anchor');
    case 'zag1':
    case 'zag2':
    case 'zag3': return buildProfile('conservative');
    case 'le':
    case 'ld': return buildProfile('fullback_offensive');
    case 'vol': return buildProfile('destroyer');
    case 'mc1':
    case 'mc2': return buildProfile('box_to_box');
    case 'meia':
    case 'mei': return buildProfile('playmaker');
    case 'pe':
    case 'pd': return buildProfile('winger');
    case 'sa': return buildProfile('creative');
    case 'ca':
    case 'ata1':
    case 'ata2': return buildProfile('poacher');
    default: return profileForRole(role);
  }
}
