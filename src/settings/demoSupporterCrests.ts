import type { FavoriteRealTeamRef } from '@/game/types';

/** Logos API-Sports (mesmos IDs que `sportsDataSeed.json`) — só para visualização / defaults. */
export const DEMO_CORINTHIANS_LOGO = 'https://media.api-sports.io/football/teams/131.png';
export const DEMO_REAL_MADRID_LOGO = 'https://media.api-sports.io/football/teams/541.png';

export const demoFavoriteCorinthians: FavoriteRealTeamRef = {
  id: 131,
  name: 'Corinthians',
  logo: DEMO_CORINTHIANS_LOGO,
};
