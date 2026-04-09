import type { FormLetter, PastResult } from '@/entities/types';
import type { LeagueSeasonState } from '@/match/leagueSeason';

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
    name: 'Estreia na liga',
    description: 'Dispute a primeira rodada oficial da temporada.',
    unlocked: ({ leagueSeason }) => leagueSeason.played >= 1,
  },
  {
    id: 'comp_pontos_15',
    name: 'Subindo na tabela',
    description: 'Acumule 15 pontos no campeonato.',
    unlocked: ({ leagueSeason }) => leagueSeason.points >= 15,
  },
  {
    id: 'comp_pontos_30',
    name: 'Zona nobre',
    description: 'Acumule 30 pontos no campeonato.',
    unlocked: ({ leagueSeason }) => leagueSeason.points >= 30,
  },
  {
    id: 'comp_gols_20',
    name: 'Ataque em chamas',
    description: 'Marque 20 gols na temporada (liga).',
    unlocked: ({ leagueSeason }) => leagueSeason.goalsFor >= 20,
  },
  {
    id: 'comp_invictos_5',
    name: 'Muralha invicta',
    description: 'Últimos 5 jogos sem derrota (forma).',
    unlocked: ({ form }) => {
      const tail = form.slice(-5);
      return tail.length >= 5 && tail.every((f) => f !== 'L');
    },
  },
  {
    id: 'comp_primeira_vitoria',
    name: 'Primeiro triunfo',
    description: 'Registre a primeira vitória na temporada.',
    unlocked: ({ results }) => results.some((r) => r.result === 'win'),
  },
];
