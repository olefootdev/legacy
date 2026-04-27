import type { FavoriteRealTeamRef } from '@/game/types';

/**
 * Catálogo de ligas × clubes para o step 3 do Cadastro (time do coração).
 * IDs são do API-Sports (https://media.api-sports.io/football/teams/{id}.png).
 * Se um logo falhar, o `<img>` esconde via onError — só o nome fica.
 */

export interface LeagueBucket {
  id: string;
  label: string;
  /** Emoji da bandeira pra chip da aba. */
  flag: string;
  teams: FavoriteRealTeamRef[];
}

function team(id: number, name: string): FavoriteRealTeamRef {
  return { id, name, logo: `https://media.api-sports.io/football/teams/${id}.png` };
}

export const SELECAO_BRASIL: FavoriteRealTeamRef = team(6, 'Seleção Brasil');

export const LEAGUE_BUCKETS: LeagueBucket[] = [
  {
    id: 'brasil',
    label: 'Brasil — Série A',
    flag: '🇧🇷',
    teams: [
      team(127, 'Flamengo'),
      team(121, 'Palmeiras'),
      team(131, 'Corinthians'),
      team(126, 'São Paulo'),
      team(128, 'Santos'),
      team(124, 'Fluminense'),
      team(133, 'Vasco'),
      team(120, 'Botafogo'),
      team(1062, 'Atlético-MG'),
      team(135, 'Cruzeiro'),
      team(130, 'Grêmio'),
      team(119, 'Internacional'),
      team(118, 'Bahia'),
      team(154, 'Fortaleza'),
      team(129, 'Athletico-PR'),
      team(152, 'Ceará'),
    ],
  },
  {
    id: 'england',
    label: 'Inglaterra — Premier League',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    teams: [
      team(33, 'Manchester United'),
      team(34, 'Newcastle'),
      team(40, 'Liverpool'),
      team(42, 'Arsenal'),
      team(47, 'Tottenham'),
      team(49, 'Chelsea'),
      team(50, 'Manchester City'),
      team(51, 'Brighton'),
      team(45, 'Everton'),
      team(48, 'West Ham'),
      team(66, 'Aston Villa'),
      team(62, 'Crystal Palace'),
    ],
  },
  {
    id: 'spain',
    label: 'Espanha — La Liga',
    flag: '🇪🇸',
    teams: [
      team(541, 'Real Madrid'),
      team(529, 'Barcelona'),
      team(530, 'Atlético Madrid'),
      team(536, 'Sevilla'),
      team(532, 'Valencia'),
      team(533, 'Villarreal'),
      team(543, 'Real Betis'),
      team(548, 'Real Sociedad'),
      team(538, 'Celta Vigo'),
      team(531, 'Athletic Club'),
    ],
  },
  {
    id: 'italy',
    label: 'Itália — Serie A',
    flag: '🇮🇹',
    teams: [
      team(496, 'Juventus'),
      team(489, 'AC Milan'),
      team(505, 'Inter Milan'),
      team(492, 'Napoli'),
      team(497, 'Roma'),
      team(487, 'Lazio'),
      team(499, 'Atalanta'),
      team(502, 'Fiorentina'),
      team(503, 'Torino'),
      team(500, 'Bologna'),
    ],
  },
  {
    id: 'germany',
    label: 'Alemanha — Bundesliga',
    flag: '🇩🇪',
    teams: [
      team(157, 'Bayern Munich'),
      team(165, 'Borussia Dortmund'),
      team(173, 'RB Leipzig'),
      team(168, 'Bayer Leverkusen'),
      team(169, 'Eintracht Frankfurt'),
      team(163, "Borussia M'gladbach"),
      team(172, 'VfB Stuttgart'),
      team(160, 'SC Freiburg'),
    ],
  },
  {
    id: 'france',
    label: 'França — Ligue 1',
    flag: '🇫🇷',
    teams: [
      team(85, 'Paris Saint-Germain'),
      team(81, 'Marseille'),
      team(80, 'Lyon'),
      team(91, 'Monaco'),
      team(79, 'Lille'),
      team(84, 'Nice'),
      team(94, 'Rennes'),
      team(83, 'Nantes'),
    ],
  },
  {
    id: 'portugal',
    label: 'Portugal — Primeira Liga',
    flag: '🇵🇹',
    teams: [
      team(211, 'Benfica'),
      team(212, 'Porto'),
      team(228, 'Sporting CP'),
      team(217, 'Braga'),
      team(234, 'Vitória SC'),
    ],
  },
  {
    id: 'netherlands',
    label: 'Holanda — Eredivisie',
    flag: '🇳🇱',
    teams: [
      team(194, 'Ajax'),
      team(197, 'PSV'),
      team(209, 'Feyenoord'),
      team(201, 'AZ Alkmaar'),
      team(202, 'Utrecht'),
    ],
  },
  {
    id: 'argentina',
    label: 'Argentina — Liga Profesional',
    flag: '🇦🇷',
    teams: [
      team(451, 'Boca Juniors'),
      team(435, 'River Plate'),
      team(450, 'Racing Club'),
      team(442, 'Independiente'),
      team(478, 'San Lorenzo'),
      team(474, 'Vélez Sarsfield'),
    ],
  },
  {
    id: 'usa',
    label: 'EUA — MLS',
    flag: '🇺🇸',
    teams: [
      team(1616, 'Inter Miami'),
      team(1611, 'LA Galaxy'),
      team(1615, 'LAFC'),
      team(1603, 'Atlanta United'),
      team(1604, 'Chicago Fire'),
      team(1610, 'New York City FC'),
    ],
  },
  {
    id: 'mexico',
    label: 'México — Liga MX',
    flag: '🇲🇽',
    teams: [
      team(2279, 'Club América'),
      team(2287, 'Chivas Guadalajara'),
      team(2282, 'Cruz Azul'),
      team(2295, 'Tigres UANL'),
      team(2290, 'Monterrey'),
    ],
  },
  {
    id: 'turkey',
    label: 'Turquia — Süper Lig',
    flag: '🇹🇷',
    teams: [
      team(645, 'Galatasaray'),
      team(611, 'Fenerbahçe'),
      team(610, 'Beşiktaş'),
      team(619, 'Trabzonspor'),
    ],
  },
  {
    id: 'saudi',
    label: 'Arábia Saudita — Pro League',
    flag: '🇸🇦',
    teams: [
      team(2938, 'Al-Nassr'),
      team(2939, 'Al-Hilal'),
      team(2941, 'Al-Ittihad'),
      team(2932, 'Al-Ahli'),
    ],
  },
];
