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
  /** Preenchido no step 3 do Cadastro; Real Madrid como padrão para testes. */
  favoriteRealTeam: {
    id: 541,
    name: 'Real Madrid',
    logo: 'https://media.api-sports.io/football/teams/541.png',
  },
};
