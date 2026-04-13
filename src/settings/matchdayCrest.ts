import type { UserSettings } from '@/game/types';

/**
 * Escudo ao lado do “teu” clube em matchday, ligas e partida rápida:
 * prioriza o time do coração (logo remoto); fallback para brasão uploadado em Config.
 */
export function matchdayHomeCrestUrl(
  settings: Pick<UserSettings, 'favoriteRealTeam' | 'managerCrestPngDataUrl'>,
): string | null {
  const heart = settings.favoriteRealTeam?.logo?.trim();
  if (heart) return heart;
  const uploaded = settings.managerCrestPngDataUrl?.trim();
  return uploaded || null;
}
