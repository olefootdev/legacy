import type { FormLetter, PastResult } from '@/entities/types';
import type { LeagueSeasonState } from '@/match/leagueSeason';
import { L } from '@/i18n/L';

export interface CompetitionTrophyContext {
  leagueSeason: LeagueSeasonState;
  results: PastResult[];
  form: FormLetter[];
}

export interface CompetitionTrophyDef {
  id: string;
  name: string;
  description: string;
  unlocked: (ctx: CompetitionTrophyContext) => boolean;
}

/** Troféus de competição / temporada derivados do estado da liga e do histórico. */
export const COMPETITION_TROPHY_CATALOG: readonly CompetitionTrophyDef[] = [
  {
    id: 'comp_estreia',
    name: L('Estreia na liga', 'League debut'),
    description: L('Dispute a primeira rodada oficial da temporada.', 'Play the first official matchday of the season.'),
    unlocked: ({ leagueSeason }) => leagueSeason.played >= 1,
  },
  {
    id: 'comp_pontos_15',
    name: L('Subindo na tabela', 'Climbing the table'),
    description: L('Acumule 15 pontos no campeonato.', 'Collect 15 points in the league.'),
    unlocked: ({ leagueSeason }) => leagueSeason.points >= 15,
  },
  {
    id: 'comp_pontos_30',
    name: L('Zona nobre', 'Top zone'),
    description: L('Acumule 30 pontos no campeonato.', 'Collect 30 points in the league.'),
    unlocked: ({ leagueSeason }) => leagueSeason.points >= 30,
  },
  {
    id: 'comp_gols_20',
    name: L('Ataque em chamas', 'Attack on fire'),
    description: L('Marque 20 gols na temporada (liga).', 'Score 20 goals in the season (league).'),
    unlocked: ({ leagueSeason }) => leagueSeason.goalsFor >= 20,
  },
  {
    id: 'comp_invictos_5',
    name: L('Muralha invicta', 'Unbeaten wall'),
    description: L('Últimos 5 jogos sem derrota (forma).', 'Last 5 games unbeaten (form).'),
    unlocked: ({ form }) => {
      const tail = form.slice(-5);
      return tail.length >= 5 && tail.every((f) => f !== 'L');
    },
  },
  {
    id: 'comp_primeira_vitoria',
    name: L('Primeiro triunfo', 'First triumph'),
    description: L('Registre a primeira vitória na temporada.', 'Get your first win of the season.'),
    unlocked: ({ results }) => results.some((r) => r.result === 'win'),
  },
];
