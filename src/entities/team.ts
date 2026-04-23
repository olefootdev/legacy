import type { ClubEntity, Fixture, OpponentStub, PlayerEntity } from './types';
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

/** Plantel inicial vazio — jogadores entram via Admin ou outros fluxos (`MERGE_PLAYERS`). */
export function createInitialSquad(): Record<string, PlayerEntity> {
  return {};
}
