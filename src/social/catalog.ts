/** Managers/clubes que podem ser encontrados para convite (MVP local; futuro: API). */
export interface DiscoverableManager {
  id: string;
  clubName: string;
  city: string;
  /** Se true, o convite é aceito na hora (simula retorno online). */
  autoAccept: boolean;
}

export const DISCOVERABLE_MANAGERS: DiscoverableManager[] = [
  { id: 'mgr_titans', clubName: 'TITANS', city: 'São Paulo', autoAccept: true },
  { id: 'mgr_spartans', clubName: 'SPARTANS', city: 'Porto', autoAccept: false },
  { id: 'mgr_dragons', clubName: 'DRAGONS', city: 'Madrid', autoAccept: false },
  { id: 'mgr_wolves', clubName: 'WOLVES', city: 'Londres', autoAccept: false },
  { id: 'mgr_royals', clubName: 'ROYALS', city: 'Paris', autoAccept: false },
  { id: 'mgr_steel', clubName: 'STEEL FC', city: 'Berlim', autoAccept: false },
];

export function discoverableById(id: string): DiscoverableManager | undefined {
  return DISCOVERABLE_MANAGERS.find((m) => m.id === id);
}
