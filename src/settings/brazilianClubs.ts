import type { FavoriteRealTeamRef } from '@/game/types';
import { localCrestUrl } from './crestUrl';

/**
 * Lista curada de clubes da Série A brasileira + Seleção, usada no step 3
 * do Cadastro (time do coração) e como fallback de escudo em telas de jogo.
 *
 * Os PNGs vivem em `public/crests/{id}.png`. Para baixá-los do API-Sports,
 * rode `npm run crests:download` uma vez.
 */
export const BRAZILIAN_CLUBS: FavoriteRealTeamRef[] = [
  { id: 127,  name: 'Flamengo',      logo: localCrestUrl(127) },
  { id: 121,  name: 'Palmeiras',     logo: localCrestUrl(121) },
  { id: 131,  name: 'Corinthians',   logo: localCrestUrl(131) },
  { id: 126,  name: 'São Paulo',     logo: localCrestUrl(126) },
  { id: 128,  name: 'Santos',        logo: localCrestUrl(128) },
  { id: 124,  name: 'Fluminense',    logo: localCrestUrl(124) },
  { id: 133,  name: 'Vasco',         logo: localCrestUrl(133) },
  { id: 120,  name: 'Botafogo',      logo: localCrestUrl(120) },
  { id: 1062, name: 'Atlético-MG',   logo: localCrestUrl(1062) },
  { id: 135,  name: 'Cruzeiro',      logo: localCrestUrl(135) },
  { id: 130,  name: 'Grêmio',        logo: localCrestUrl(130) },
  { id: 119,  name: 'Internacional', logo: localCrestUrl(119) },
  { id: 118,  name: 'Bahia',         logo: localCrestUrl(118) },
  { id: 154,  name: 'Fortaleza',     logo: localCrestUrl(154) },
  { id: 129,  name: 'Athletico-PR',  logo: localCrestUrl(129) },
  { id: 152,  name: 'Ceará',         logo: localCrestUrl(152) },
];

export const SELECAO_BRASIL: FavoriteRealTeamRef = {
  id: 6,
  name: 'Seleção Brasil',
  logo: localCrestUrl(6),
};
