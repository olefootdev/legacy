import type { FavoriteRealTeamRef } from '@/game/types';

/**
 * Lista curada de clubes da Série A brasileira + Seleção, usada no step 3
 * do Cadastro (time do coração) e como fallback de escudo em telas de jogo.
 *
 * IDs seguem API-Sports (https://media.api-sports.io/football/teams/{id}.png).
 * IDs verificados ao ponto da ordenação visual funcionar mesmo se o logo
 * remoto falhar (fallback: nome do clube sem escudo).
 */
export const BRAZILIAN_CLUBS: FavoriteRealTeamRef[] = [
  { id: 127, name: 'Flamengo',       logo: 'https://media.api-sports.io/football/teams/127.png' },
  { id: 121, name: 'Palmeiras',      logo: 'https://media.api-sports.io/football/teams/121.png' },
  { id: 131, name: 'Corinthians',    logo: 'https://media.api-sports.io/football/teams/131.png' },
  { id: 126, name: 'São Paulo',      logo: 'https://media.api-sports.io/football/teams/126.png' },
  { id: 128, name: 'Santos',         logo: 'https://media.api-sports.io/football/teams/128.png' },
  { id: 124, name: 'Fluminense',     logo: 'https://media.api-sports.io/football/teams/124.png' },
  { id: 133, name: 'Vasco',          logo: 'https://media.api-sports.io/football/teams/133.png' },
  { id: 120, name: 'Botafogo',       logo: 'https://media.api-sports.io/football/teams/120.png' },
  { id: 1062, name: 'Atlético-MG',   logo: 'https://media.api-sports.io/football/teams/1062.png' },
  { id: 135, name: 'Cruzeiro',       logo: 'https://media.api-sports.io/football/teams/135.png' },
  { id: 130, name: 'Grêmio',         logo: 'https://media.api-sports.io/football/teams/130.png' },
  { id: 119, name: 'Internacional',  logo: 'https://media.api-sports.io/football/teams/119.png' },
  { id: 118, name: 'Bahia',          logo: 'https://media.api-sports.io/football/teams/118.png' },
  { id: 154, name: 'Fortaleza',      logo: 'https://media.api-sports.io/football/teams/154.png' },
  { id: 129, name: 'Athletico-PR',   logo: 'https://media.api-sports.io/football/teams/129.png' },
  { id: 152, name: 'Ceará',          logo: 'https://media.api-sports.io/football/teams/152.png' },
];

export const SELECAO_BRASIL: FavoriteRealTeamRef = {
  id: 6,
  name: 'Seleção Brasil',
  logo: 'https://media.api-sports.io/football/teams/6.png',
};
