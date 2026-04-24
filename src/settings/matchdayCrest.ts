import type { UserSettings } from '@/game/types';

/**
 * Escudo ao lado do "teu" clube em matchday, ligas e partida rápida:
 * usa o logo do time do coração cadastrado.
 */
export function matchdayHomeCrestUrl(
  settings: Pick<UserSettings, 'favoriteRealTeam'>,
): string | null {
  const heart = settings.favoriteRealTeam?.logo?.trim();
  return heart || null;
}
