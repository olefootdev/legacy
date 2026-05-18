import type { ClubEntity, Fixture, OpponentStub, PlayerEntity } from './types';

export const DEFAULT_CLUB: ClubEntity = {
  id: 'ole-fc',
  name: 'OLE FC',
  shortName: 'OLE',
  city: 'Neo City',
  stadium: 'Estádio Neo Arena',
};

// [2026-05-18] TITANS FC mockada removida. O placeholder padrão fica neutro;
// MatchQuick e MatchClassic auto-buscam um adversário (manager real → bot)
// no mount via `quickFindOpponent`, então este stub raramente é exibido.
export const DEFAULT_OPPONENT: OpponentStub = {
  id: 'placeholder-opponent',
  name: 'Buscando…',
  shortName: '...',
  strength: 70,
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
 * Normaliza o stub do adversário. TITANS-specific crest injection removido
 * em 2026-05-18 junto com a remoção da TITANS FC mockada.
 */
export function normalizeOpponentStub(o: OpponentStub | undefined | null): OpponentStub {
  if (!o || typeof o !== 'object' || !o.id) {
    return { ...DEFAULT_OPPONENT };
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
