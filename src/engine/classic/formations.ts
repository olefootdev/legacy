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
}

// Posições de AÇÃO (não kickoff): snapshot de jogo em curso, HOME em posse
// construindo de trás, AWAY em bloco médio defensivo. Posições assimétricas
// para dar sensação de partida real e fazer o movimento da bola fazer sentido.
// Campo lógico horizontal, meio-campo em x=0.5.
// Espaçamento mínimo entre nós ≥ 0.11 (≈45px) para evitar sobreposição.
const HOME_433_SLOTS: RawSlot[] = [
  { id:1,  pct:[0.05, 0.50], role:'GK', archetype:'COLD_BLOOD',  name:'R. Bastos',  shortName:'R. BASTOS',  number:1  },
  // Back four (linha defensiva alta porque time está em posse)
  { id:2,  pct:[0.30, 0.10], role:'RB', archetype:'ENGINE',      name:'Tatajuba',   shortName:'TATAJUBA',   number:7  }, // RB pushed
  { id:3,  pct:[0.18, 0.40], role:'CB', archetype:'DESTROYER',   name:'R. Silva',   shortName:'R. SILVA',   number:9  },
  { id:4,  pct:[0.18, 0.60], role:'CB', archetype:'VETERAN',     name:'M. Junior',  shortName:'M. JUNIOR',  number:21 },
  { id:5,  pct:[0.20, 0.88], role:'LB', archetype:'ENGINE',      name:'Carvalho',   shortName:'CARVALHO',   number:3  }, // LB more conservative
  // Midfield 3 (DM + 2 CMs avançados em half-spaces)
  { id:6,  pct:[0.34, 0.50], role:'CM', archetype:'HUNTER',      name:'Souza',      shortName:'SOUZA',      number:6  }, // DM
  { id:8,  pct:[0.42, 0.30], role:'CM', archetype:'MAESTRO',     name:'P. Moraes',  shortName:'P. MORAES',  number:11 }, // LCM half-space
  { id:10, pct:[0.42, 0.70], role:'CM', archetype:'ENGINE',      name:'Ferreira',   shortName:'FERREIRA',   number:8  }, // RCM half-space
  // Front 3 (RW alto e largo, ST infiltrando, LW caindo dentro)
  { id:7,  pct:[0.55, 0.13], role:'RW', archetype:'WILD',        name:'Andrade',    shortName:'ANDRADE',    number:17 },
  { id:9,  pct:[0.58, 0.46], role:'ST', archetype:'FINISHER',    name:'Gomes',      shortName:'GOMES',      number:9  },
  { id:11, pct:[0.52, 0.83], role:'LW', archetype:'BOX_INVADER', name:'Lima',       shortName:'LIMA',       number:11 },
];

const AWAY_433_SLOTS: RawSlot[] = [
  { id:21, pct:[0.95, 0.50], role:'GK', archetype:'COLD_BLOOD',  name:'Pereira',    shortName:'PEREIRA',    number:1  },
  // Back four (compactado defendendo bloco médio)
  { id:22, pct:[0.78, 0.10], role:'LB', archetype:'ENGINE',      name:'Alves',      shortName:'ALVES',      number:3  },
  { id:23, pct:[0.82, 0.40], role:'CB', archetype:'VETERAN',     name:'Costa',      shortName:'COSTA',      number:5  },
  { id:24, pct:[0.82, 0.60], role:'CB', archetype:'DESTROYER',   name:'Oliveira',   shortName:'OLIVEIRA',   number:4  },
  { id:25, pct:[0.78, 0.88], role:'RB', archetype:'ENGINE',      name:'Santos',     shortName:'SANTOS',     number:2  },
  // Midfield 3 (linha de pressão dropada)
  { id:26, pct:[0.66, 0.50], role:'CM', archetype:'MAESTRO',     name:'Cavalcanti', shortName:'CAVA',       number:10 },
  { id:28, pct:[0.70, 0.30], role:'CM', archetype:'ENGINE',      name:'Nunes',      shortName:'NUNES',      number:8  },
  { id:30, pct:[0.70, 0.70], role:'CM', archetype:'HUNTER',      name:'Ribeiro',    shortName:'RIBEIRO',    number:6  },
  // Front 3 (1ª linha de pressão, dropada para mid-block) — recuados das alas
  // do HOME para evitar overlap nos labels
  { id:27, pct:[0.62, 0.22], role:'LW', archetype:'BOX_INVADER', name:'Mendes',     shortName:'MENDES',     number:11 },
  { id:29, pct:[0.50, 0.55], role:'ST', archetype:'FINISHER',    name:'Rocha',      shortName:'ROCHA',      number:9  }, // dropped
  { id:31, pct:[0.62, 0.78], role:'RW', archetype:'WILD',        name:'Dias',       shortName:'DIAS',       number:7  },
];

function buildPlayers(slots: RawSlot[], team: 'home' | 'away'): ClassicPlayer[] {
  return slots.map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    number: s.number,
    position: { x: s.pct[0] * FIELD_W, y: s.pct[1] * FIELD_H },
    archetype: s.archetype,
    team,
    role: s.role,
    fatigue: 20 + Math.floor(Math.random() * 30),
    confidence: 60 + Math.floor(Math.random() * 30),
    isStar: s.number === 11 && team === 'home',
  }));
}

export function getHomePlayers(): ClassicPlayer[] {
  return buildPlayers(HOME_433_SLOTS, 'home');
}

export function getAwayPlayers(): ClassicPlayer[] {
  return buildPlayers(AWAY_433_SLOTS, 'away');
}

export const FIELD_W_LOGIC = FIELD_W;
export const FIELD_H_LOGIC = FIELD_H;
