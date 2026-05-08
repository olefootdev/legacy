import type { FavoriteRealTeamRef } from '@/game/types';
import { localCrestUrl } from './crestUrl';

/** Logos locais (mesmos IDs que `sportsDataSeed.json`) — só para visualização / defaults. */
export const DEMO_CORINTHIANS_LOGO = localCrestUrl(131);
export const DEMO_REAL_MADRID_LOGO = localCrestUrl(541);

export const demoFavoriteCorinthians: FavoriteRealTeamRef = {
  id: 131,
  name: 'Corinthians',
  logo: DEMO_CORINTHIANS_LOGO,
};
