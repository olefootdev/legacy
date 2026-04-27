import type { UserSettings } from '@/game/types';

/**
 * Escudo ao lado do "teu" clube em matchday, ligas e partida rápida:
 * usa o logo do time do coração cadastrado.
 *
 * TESTE LOCAL: Se não houver time cadastrado, usa Corinthians ou Manchester aleatoriamente.
 */
export function matchdayHomeCrestUrl(
  settings: Pick<UserSettings, 'favoriteRealTeam'>,
): string | null {
  const heart = settings.favoriteRealTeam?.logo?.trim();

  // Se houver time do coração cadastrado, usa ele
  if (heart) return heart;

  // TESTE LOCAL: Brasões de fallback para desenvolvimento
  const testCrests = [
    // Corinthians
    'https://media.api-sports.io/football/teams/131.png',
    // Manchester City
    'https://media.api-sports.io/football/teams/50.png',
  ];

  // Alterna entre Corinthians e Manchester baseado no timestamp
  const index = Math.floor(Date.now() / 10000) % testCrests.length;
  return testCrests[index];
}
