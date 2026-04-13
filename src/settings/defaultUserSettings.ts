import type { UserSettings } from '@/game/types';
import { demoFavoriteCorinthians } from '@/settings/demoSupporterCrests';

export const defaultUserSettings: UserSettings = {
  soundEnabled: true,
  graphicQuality: 'high',
  language: 'pt-BR',
  reduceMotion: 'system',
  worldSimulateInBackground: false,
  trainerAvatarDataUrl: null,
  managerCrestPngDataUrl: null,
  managerProfile: undefined,
  /** Visualização: OLE FC torce pelo Corinthians (substitui em Config / cadastro). */
  favoriteRealTeam: demoFavoriteCorinthians,
};
