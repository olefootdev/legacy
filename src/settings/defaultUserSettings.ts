import type { UserSettings } from '@/game/types';

export const defaultUserSettings: UserSettings = {
  soundEnabled: true,
  graphicQuality: 'high',
  language: 'pt-BR',
  reduceMotion: 'system',
  worldSimulateInBackground: false,
  trainerAvatarDataUrl: null,
  managerCrestPngDataUrl: null,
  managerProfile: undefined,
  favoriteRealTeam: undefined,
};
