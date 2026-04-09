import { createPlayer } from './player';
import type { ClubEntity, Fixture, OpponentStub, PlayerAttributes, PlayerEntity } from './types';

export const DEFAULT_CLUB: ClubEntity = {
  id: 'ole-fc',
  name: 'OLE FC',
  shortName: 'OLE',
  city: 'Neo City',
  stadium: 'Estádio Neo Arena',
};

export const DEFAULT_OPPONENT: OpponentStub = {
  id: 'titans',
  name: 'Titans FC',
  shortName: 'TITANS',
  strength: 78,
  highlightPlayer: { name: 'MOREIRA', ovr: 79 },
};

export function defaultFixture(): Fixture {
  return {
    id: 'fx-next-1',
    kickoffLabel: 'Hoje, 20:00',
    venue: DEFAULT_CLUB.stadium,
    competition: 'Liga Principal',
    homeName: DEFAULT_CLUB.name,
    awayName: DEFAULT_OPPONENT.name,
    opponent: DEFAULT_OPPONENT,
    isHome: true,
  };
}

/** Plantel inicial espelhando o elenco mock da UI (Team.tsx) */
export function createInitialSquad(): Record<string, PlayerEntity> {
  const rows: Array<{ id: string; num: number; name: string; pos: string; attrs?: Partial<PlayerAttributes> }> = [
    { id: 'p1', num: 9, name: 'SILVA', pos: 'ATA', attrs: { finalizacao: 90, velocidade: 89, passe: 82 } },
    { id: 'p2', num: 10, name: 'SANTOS', pos: 'MC', attrs: { passe: 88, finalizacao: 82, velocidade: 84 } },
    { id: 'p3', num: 7, name: 'OLIVEIRA', pos: 'PD', attrs: { velocidade: 91, drible: 80, finalizacao: 79 } },
    { id: 'p4', num: 11, name: 'RODRIGUES', pos: 'PE', attrs: { velocidade: 92, drible: 79, finalizacao: 81 } },
    { id: 'p5', num: 5, name: 'COSTA', pos: 'VOL', attrs: { marcacao: 78, passe: 81, fisico: 80 } },
    { id: 'p6', num: 8, name: 'FERNANDES', pos: 'MC', attrs: { passe: 85, tatico: 80, mentalidade: 82 } },
    { id: 'p7', num: 3, name: 'PEREIRA', pos: 'ZAG', attrs: { marcacao: 82, fisico: 84, tatico: 76 } },
    { id: 'p8', num: 4, name: 'LIMA', pos: 'ZAG', attrs: { marcacao: 76, fisico: 80 } },
    { id: 'p9', num: 6, name: 'ALVES', pos: 'LE', attrs: { velocidade: 88, passe: 75, marcacao: 74 } },
    { id: 'p10', num: 2, name: 'RAMOS', pos: 'LD', attrs: { velocidade: 85, passe: 72, marcacao: 73 } },
    { id: 'p11', num: 1, name: 'GOMES', pos: 'GOL', attrs: { mentalidade: 88, confianca: 86, tatico: 84 } },
    { id: 'p12', num: 17, name: 'MARTINS', pos: 'ATA', attrs: { finalizacao: 78, velocidade: 82 } },
  ];
  const out: Record<string, PlayerEntity> = {};
  for (const r of rows) {
    out[r.id] = createPlayer({ ...r, attrs: r.attrs });
  }
  return out;
}
