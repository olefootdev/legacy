import type { ClassicPlayer, ArchetypeId } from './types';

// Logical field: 600 x 400
const FIELD_W = 600;
const FIELD_H = 400;

interface RawSlot {
  id: number;
  pct: [number, number]; // [xPct, yPct] 0-1
  role: string;
  archetype: ArchetypeId;
  name: string;
  shortName: string;
  number: number;
  ovr: number;
}

// Formation slot positions (normalized 0-1) for each formation
// HOME attacks left→right, AWAY attacks right→left (mirrored)
export const FORMATION_SLOTS: Record<string, Array<[number, number]>> = {
  '4-3-3': [
    [0.05,0.50], // GK
    [0.30,0.10],[0.18,0.40],[0.18,0.60],[0.20,0.88], // DEF
    [0.34,0.50],[0.42,0.30],[0.42,0.70], // MID
    [0.56,0.13],[0.58,0.46],[0.56,0.85], // ATT — mirror p/ AWAY garante 12% de separação
  ],
  '4-4-2': [
    [0.05,0.50],
    [0.28,0.10],[0.18,0.38],[0.18,0.62],[0.28,0.90],
    [0.44,0.12],[0.38,0.38],[0.38,0.62],[0.44,0.88],
    [0.58,0.35],[0.58,0.65],
  ],
  '4-2-3-1': [
    [0.05,0.50],
    [0.28,0.10],[0.18,0.38],[0.18,0.62],[0.28,0.90],
    [0.36,0.38],[0.36,0.62],
    [0.50,0.15],[0.48,0.50],[0.50,0.85],
    [0.60,0.50],
  ],
  '3-5-2': [
    [0.05,0.50],
    [0.20,0.25],[0.18,0.50],[0.20,0.75],
    [0.38,0.10],[0.36,0.32],[0.36,0.50],[0.36,0.68],[0.38,0.90],
    [0.56,0.35],[0.56,0.65],
  ],
  '4-5-1': [
    [0.05,0.50],
    [0.28,0.10],[0.18,0.38],[0.18,0.62],[0.28,0.90],
    [0.44,0.10],[0.40,0.30],[0.38,0.50],[0.40,0.70],[0.44,0.90],
    [0.58,0.50],
  ],
  '5-3-2': [
    [0.05,0.50],
    [0.22,0.08],[0.20,0.30],[0.18,0.50],[0.20,0.70],[0.22,0.92],
    [0.40,0.30],[0.38,0.50],[0.40,0.70],
    [0.56,0.35],[0.56,0.65],
  ],
  '3-4-3': [
    [0.05,0.50],
    [0.20,0.25],[0.18,0.50],[0.20,0.75],
    [0.38,0.12],[0.36,0.38],[0.36,0.62],[0.38,0.88],
    [0.54,0.15],[0.58,0.50],[0.54,0.85],
  ],
};

// HOME: Tigres — 4-3-3, em posse construindo de trás
const HOME_433_SLOTS: RawSlot[] = [
  { id:1,  pct:[0.05,0.50], role:'GK', archetype:'COLD_BLOOD',  name:'R. Bastos', shortName:'R. BASTOS', number:1,  ovr:78 },
  { id:2,  pct:[0.30,0.10], role:'RB', archetype:'ENGINE',      name:'Tatajuba',  shortName:'TATAJUBA',  number:7,  ovr:74 },
  { id:3,  pct:[0.18,0.40], role:'CB', archetype:'DESTROYER',   name:'R. Silva',  shortName:'R. SILVA',  number:5,  ovr:80 },
  { id:4,  pct:[0.18,0.60], role:'CB', archetype:'VETERAN',     name:'M. Junior', shortName:'M. JUNIOR', number:21, ovr:77 },
  { id:5,  pct:[0.20,0.88], role:'LB', archetype:'ENGINE',      name:'Carvalho',  shortName:'CARVALHO',  number:3,  ovr:73 },
  { id:6,  pct:[0.34,0.50], role:'DM', archetype:'HUNTER',      name:'Souza',     shortName:'SOUZA',     number:6,  ovr:79 },
  { id:8,  pct:[0.42,0.30], role:'CM', archetype:'MAESTRO',     name:'P. Moraes', shortName:'P. MORAES', number:8,  ovr:85 },
  { id:10, pct:[0.42,0.70], role:'CM', archetype:'ENGINE',      name:'Ferreira',  shortName:'FERREIRA',  number:10, ovr:76 },
  { id:7,  pct:[0.55,0.13], role:'RW', archetype:'WILD',        name:'Andrade',   shortName:'ANDRADE',   number:17, ovr:82 },
  { id:9,  pct:[0.58,0.46], role:'ST', archetype:'FINISHER',    name:'Gomes',     shortName:'GOMES',     number:9,  ovr:88 },
  { id:11, pct:[0.52,0.83], role:'LW', archetype:'BOX_INVADER', name:'Lima',      shortName:'LIMA',      number:11, ovr:83 },
];

// AWAY: Alvorada FC — formação sorteada a cada partida entre 4 opções
// Cada slot espelha o HOME (xPct invertido para AWAY)
const AWAY_SLOT_SETS: Record<string, RawSlot[]> = {
  '4-3-3': [
    { id:21, pct:[0.95,0.50], role:'GK', archetype:'COLD_BLOOD',  name:'Pereira',    shortName:'PEREIRA',   number:1,  ovr:76 },
    { id:22, pct:[0.78,0.10], role:'LB', archetype:'ENGINE',      name:'Alves',      shortName:'ALVES',     number:3,  ovr:72 },
    { id:23, pct:[0.82,0.40], role:'CB', archetype:'VETERAN',     name:'Costa',      shortName:'COSTA',     number:5,  ovr:78 },
    { id:24, pct:[0.82,0.60], role:'CB', archetype:'DESTROYER',   name:'Oliveira',   shortName:'OLIVEIRA',  number:4,  ovr:79 },
    { id:25, pct:[0.78,0.88], role:'RB', archetype:'ENGINE',      name:'Santos',     shortName:'SANTOS',    number:2,  ovr:71 },
    { id:26, pct:[0.66,0.50], role:'DM', archetype:'MAESTRO',     name:'Cavalcanti', shortName:'CAVA',      number:10, ovr:84 },
    { id:28, pct:[0.70,0.30], role:'CM', archetype:'ENGINE',      name:'Nunes',      shortName:'NUNES',     number:8,  ovr:75 },
    { id:30, pct:[0.70,0.70], role:'CM', archetype:'HUNTER',      name:'Ribeiro',    shortName:'RIBEIRO',   number:6,  ovr:77 },
    { id:27, pct:[0.62,0.22], role:'LW', archetype:'BOX_INVADER', name:'Mendes',     shortName:'MENDES',    number:11, ovr:80 },
    { id:29, pct:[0.50,0.55], role:'ST', archetype:'FINISHER',    name:'Rocha',      shortName:'ROCHA',     number:9,  ovr:86 },
    { id:31, pct:[0.62,0.78], role:'RW', archetype:'WILD',        name:'Dias',       shortName:'DIAS',      number:7,  ovr:81 },
  ],
  '4-4-2': [
    { id:21, pct:[0.95,0.50], role:'GK', archetype:'COLD_BLOOD',  name:'Pereira',    shortName:'PEREIRA',   number:1,  ovr:76 },
    { id:22, pct:[0.72,0.10], role:'LB', archetype:'ENGINE',      name:'Alves',      shortName:'ALVES',     number:3,  ovr:72 },
    { id:23, pct:[0.82,0.38], role:'CB', archetype:'VETERAN',     name:'Costa',      shortName:'COSTA',     number:5,  ovr:78 },
    { id:24, pct:[0.82,0.62], role:'CB', archetype:'DESTROYER',   name:'Oliveira',   shortName:'OLIVEIRA',  number:4,  ovr:79 },
    { id:25, pct:[0.72,0.90], role:'RB', archetype:'ENGINE',      name:'Santos',     shortName:'SANTOS',    number:2,  ovr:71 },
    { id:26, pct:[0.56,0.12], role:'LW', archetype:'WILD',        name:'Mendes',     shortName:'MENDES',    number:11, ovr:80 },
    { id:28, pct:[0.62,0.38], role:'CM', archetype:'MAESTRO',     name:'Cavalcanti', shortName:'CAVA',      number:10, ovr:84 },
    { id:30, pct:[0.62,0.62], role:'CM', archetype:'HUNTER',      name:'Ribeiro',    shortName:'RIBEIRO',   number:6,  ovr:77 },
    { id:27, pct:[0.56,0.88], role:'RW', archetype:'ENGINE',      name:'Nunes',      shortName:'NUNES',     number:8,  ovr:75 },
    { id:29, pct:[0.42,0.35], role:'ST', archetype:'FINISHER',    name:'Rocha',      shortName:'ROCHA',     number:9,  ovr:86 },
    { id:31, pct:[0.42,0.65], role:'ST', archetype:'BOX_INVADER', name:'Dias',       shortName:'DIAS',      number:7,  ovr:81 },
  ],
  '4-2-3-1': [
    { id:21, pct:[0.95,0.50], role:'GK', archetype:'COLD_BLOOD',  name:'Pereira',    shortName:'PEREIRA',   number:1,  ovr:76 },
    { id:22, pct:[0.72,0.10], role:'LB', archetype:'ENGINE',      name:'Alves',      shortName:'ALVES',     number:3,  ovr:72 },
    { id:23, pct:[0.82,0.38], role:'CB', archetype:'VETERAN',     name:'Costa',      shortName:'COSTA',     number:5,  ovr:78 },
    { id:24, pct:[0.82,0.62], role:'CB', archetype:'DESTROYER',   name:'Oliveira',   shortName:'OLIVEIRA',  number:4,  ovr:79 },
    { id:25, pct:[0.72,0.90], role:'RB', archetype:'ENGINE',      name:'Santos',     shortName:'SANTOS',    number:2,  ovr:71 },
    { id:26, pct:[0.64,0.38], role:'DM', archetype:'HUNTER',      name:'Ribeiro',    shortName:'RIBEIRO',   number:6,  ovr:77 },
    { id:28, pct:[0.64,0.62], role:'DM', archetype:'DESTROYER',   name:'Nunes',      shortName:'NUNES',     number:8,  ovr:75 },
    { id:27, pct:[0.50,0.15], role:'LW', archetype:'WILD',        name:'Mendes',     shortName:'MENDES',    number:11, ovr:80 },
    { id:30, pct:[0.52,0.50], role:'AM', archetype:'MAESTRO',     name:'Cavalcanti', shortName:'CAVA',      number:10, ovr:84 },
    { id:31, pct:[0.50,0.85], role:'RW', archetype:'BOX_INVADER', name:'Dias',       shortName:'DIAS',      number:7,  ovr:81 },
    { id:29, pct:[0.40,0.50], role:'ST', archetype:'FINISHER',    name:'Rocha',      shortName:'ROCHA',     number:9,  ovr:86 },
  ],
  '5-3-2': [
    { id:21, pct:[0.95,0.50], role:'GK', archetype:'COLD_BLOOD',  name:'Pereira',    shortName:'PEREIRA',   number:1,  ovr:76 },
    { id:22, pct:[0.78,0.08], role:'LB', archetype:'ENGINE',      name:'Alves',      shortName:'ALVES',     number:3,  ovr:72 },
    { id:23, pct:[0.80,0.30], role:'CB', archetype:'VETERAN',     name:'Costa',      shortName:'COSTA',     number:5,  ovr:78 },
    { id:24, pct:[0.82,0.50], role:'CB', archetype:'DESTROYER',   name:'Oliveira',   shortName:'OLIVEIRA',  number:4,  ovr:79 },
    { id:32, pct:[0.80,0.70], role:'CB', archetype:'DESTROYER',   name:'Barros',     shortName:'BARROS',    number:15, ovr:74 },
    { id:25, pct:[0.78,0.92], role:'RB', archetype:'ENGINE',      name:'Santos',     shortName:'SANTOS',    number:2,  ovr:71 },
    { id:26, pct:[0.60,0.30], role:'CM', archetype:'MAESTRO',     name:'Cavalcanti', shortName:'CAVA',      number:10, ovr:84 },
    { id:28, pct:[0.60,0.50], role:'DM', archetype:'HUNTER',      name:'Ribeiro',    shortName:'RIBEIRO',   number:6,  ovr:77 },
    { id:30, pct:[0.60,0.70], role:'CM', archetype:'ENGINE',      name:'Nunes',      shortName:'NUNES',     number:8,  ovr:75 },
    { id:29, pct:[0.44,0.35], role:'ST', archetype:'FINISHER',    name:'Rocha',      shortName:'ROCHA',     number:9,  ovr:86 },
    { id:31, pct:[0.44,0.65], role:'ST', archetype:'BOX_INVADER', name:'Dias',       shortName:'DIAS',      number:7,  ovr:81 },
  ],
};

const AWAY_FORMATIONS = Object.keys(AWAY_SLOT_SETS) as Array<keyof typeof AWAY_SLOT_SETS>;

function pickAwayFormation(): string {
  return AWAY_FORMATIONS[Math.floor(Math.random() * AWAY_FORMATIONS.length)];
}

function buildPlayers(slots: RawSlot[], team: 'home' | 'away'): ClassicPlayer[] {
  return slots.map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    number: s.number,
    ovr: s.ovr,
    position: { x: s.pct[0] * FIELD_W, y: s.pct[1] * FIELD_H },
    archetype: s.archetype,
    team,
    role: s.role,
    fatigue: 20 + Math.floor(Math.random() * 30),
    confidence: 60 + Math.floor(Math.random() * 30),
    isStar: (team === 'home' && s.id === 9) || (team === 'away' && s.id === 29),
  }));
}

export function getHomePlayers(): ClassicPlayer[] {
  return buildPlayers(HOME_433_SLOTS, 'home');
}

export function getAwayPlayers(): ClassicPlayer[] {
  const formation = pickAwayFormation();
  return buildPlayers(AWAY_SLOT_SETS[formation], 'away');
}

/** Retorna a formação atual do AWAY (para exibição no modal). */
export function getAwayFormation(): string {
  return pickAwayFormation();
}

// Returns repositioned players for a given formation, preserving identity
export function repositionForFormation(
  players: ClassicPlayer[],
  formation: string,
  team: 'home' | 'away',
): ClassicPlayer[] {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) return players;
  const teamPlayers = players.filter(p => p.team === team);
  return players.map(p => {
    if (p.team !== team) return p;
    const idx = teamPlayers.indexOf(p);
    if (idx < 0 || idx >= slots.length) return p;
    let [xPct, yPct] = slots[idx];
    // Mirror for away team
    if (team === 'away') xPct = 1 - xPct;
    return { ...p, position: { x: xPct * FIELD_W, y: yPct * FIELD_H } };
  });
}

export const FIELD_W_LOGIC = FIELD_W;
export const FIELD_H_LOGIC = FIELD_H;
