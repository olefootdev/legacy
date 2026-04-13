import { createPlayer } from './player';
import type { ClubEntity, Fixture, OpponentStub, PlayerAttributes, PlayerEntity } from './types';
import { DEMO_REAL_MADRID_LOGO } from '@/settings/demoSupporterCrests';

export const DEFAULT_CLUB: ClubEntity = {
  id: 'ole-fc',
  name: 'OLE FC',
  shortName: 'OLE',
  city: 'Neo City',
  stadium: 'Estádio Neo Arena',
};

export const DEFAULT_OPPONENT: OpponentStub = {
  id: 'titans',
  name: 'TITANS FC',
  shortName: 'TITANS',
  strength: 78,
  highlightPlayer: { name: 'MOREIRA', ovr: 79 },
  supporterCrestUrl: DEMO_REAL_MADRID_LOGO,
};

export function defaultFixture(): Fixture {
  return {
    id: 'fx-next-1',
    kickoffLabel: 'Hoje, 20:00',
    venue: DEFAULT_CLUB.stadium,
    competition: 'Liga Principal',
    homeName: DEFAULT_CLUB.name,
    awayName: DEFAULT_OPPONENT.name,
    opponent: { ...DEFAULT_OPPONENT },
    isHome: true,
  };
}

/**
 * Garante `supporterCrestUrl` para TITANS FC (id `titans`, `t1` na liga, ou nome com “TITANS”).
 * Não mistura outros campos do adversário padrão — só completa o escudo de visualização.
 */
export function normalizeOpponentStub(o: OpponentStub | undefined | null): OpponentStub {
  if (!o || typeof o !== 'object' || !o.id) {
    return { ...DEFAULT_OPPONENT };
  }
  const nameU = o.name.trim().toUpperCase();
  const titansLike = o.id === 'titans' || o.id === 't1' || nameU.includes('TITANS');
  if (titansLike && !o.supporterCrestUrl?.trim()) {
    return { ...o, supporterCrestUrl: DEMO_REAL_MADRID_LOGO };
  }
  return { ...o };
}

export function normalizeFixture(f: Partial<Fixture> | null | undefined): Fixture {
  const base = defaultFixture();
  if (!f || typeof f !== 'object') return base;
  const fx = f as Fixture;
  return {
    ...base,
    ...fx,
    opponent: normalizeOpponentStub(fx.opponent),
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
    { id: 'p13', num: 18, name: 'NUNES', pos: 'MC', attrs: { passe: 76, tatico: 74 } },
    { id: 'p14', num: 19, name: 'RIBEIRO', pos: 'ZAG', attrs: { marcacao: 75, fisico: 78 } },
    { id: 'p15', num: 20, name: 'CARVALHO', pos: 'LE', attrs: { velocidade: 80, passe: 70 } },
    { id: 'p16', num: 21, name: 'MENDES', pos: 'VOL', attrs: { marcacao: 77, passe: 72 } },
    { id: 'p17', num: 22, name: 'BARBOSA', pos: 'ATA', attrs: { finalizacao: 76, velocidade: 79 } },
  ];
  const out: Record<string, PlayerEntity> = {};
  for (const r of rows) {
    out[r.id] = createPlayer({ ...r, attrs: r.attrs });
  }
  return out;
}
