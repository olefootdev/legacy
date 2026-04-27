/**
 * Página de Setup do Match Global
 *
 * Cria 3 divisões com 10 times cada para simulação local.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch } from '@/game/store';
import type { GlobalFixture } from '@/match/globalMatch';
import { newGlobalFixtureId } from '@/match/globalMatch';

interface MockTeam {
  id: string;
  name: string;
  overall: number;
  division: number;
}

function generateMockTeams(): MockTeam[] {
  const teams: MockTeam[] = [];

  const teamNames = [
    'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
    'Grêmio', 'Internacional', 'Atlético-MG', 'Cruzeiro', 'Botafogo',
    'Vasco', 'Fluminense', 'Athletico-PR', 'Bahia', 'Fortaleza',
    'Sport', 'Vitória', 'Ceará', 'Goiás', 'Coritiba',
    'Ponte Preta', 'Guarani', 'Avaí', 'Figueirense', 'Chapecoense',
    'América-MG', 'Atlético-GO', 'CRB', 'CSA', 'Náutico'
  ];

  let teamIndex = 0;

  // 3 divisões com 10 times cada
  for (let division = 1; division <= 3; division++) {
    const baseOverall = division === 1 ? 85 : division === 2 ? 78 : 72;

    for (let i = 0; i < 10; i++) {
      teams.push({
        id: `team_${division}_${i}`,
        name: teamNames[teamIndex % teamNames.length],
        overall: baseOverall + Math.floor(Math.random() * 8),
        division,
      });
      teamIndex++;
    }
  }

  return teams;
}

function generateFixturesForRound(teams: MockTeam[], roundNumber: number): GlobalFixture[] {
  const fixtures: GlobalFixture[] = [];

  // Agrupar times por divisão
  const byDivision = new Map<number, MockTeam[]>();
  for (const team of teams) {
    if (!byDivision.has(team.division)) {
      byDivision.set(team.division, []);
    }
    byDivision.get(team.division)!.push(team);
  }

  // Criar confrontos dentro de cada divisão
  for (const [division, divTeams] of byDivision) {
    // Embaralhar times
    const shuffled = [...divTeams].sort(() => Math.random() - 0.5);

    // Criar 5 jogos (10 times = 5 confrontos)
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const home = shuffled[i];
        const away = shuffled[i + 1];

        fixtures.push({
          id: newGlobalFixtureId(),
          homeTeamId: home.id,
          homeTeamName: home.name,
          homeOverall: home.overall,
          awayTeamId: away.id,
          awayTeamName: away.name,
          awayOverall: away.overall,
          division,
          scoreHome: 0,
          scoreAway: 0,
          currentMinute: 0,
          events: [],
          status: 'scheduled',
        });
      }
    }
  }

  return fixtures;
}

export default function MatchGlobalSetup() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();

  useEffect(() => {
    // Criar times e fixtures automaticamente
    const teams = generateMockTeams();
    const fixtures = generateFixturesForRound(teams, 1);

    // Salvar estado global
    dispatch({
      type: 'SET_GLOBAL_LEAGUE_STATE',
      payload: {
        currentRound: {
          id: 'round_1',
          roundNumber: 1,
          status: 'scheduled',
          scheduledKickoffMs: Date.now(),
          fixtures,
          highlights: [],
          durationMs: 3 * 60 * 1000,
        },
        recentRounds: [],
        nextScheduledMs: Date.now(),
      },
    });

    console.log('[MatchGlobalSetup] Ligas criadas:', {
      teams: teams.length,
      fixtures: fixtures.length,
    });

    // Redirecionar para o painel
    navigate('/match/global');
  }, [dispatch, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-neon-yellow mx-auto" />
        <p className="font-display text-xl font-bold uppercase tracking-wider text-white">
          Criando Mundo...
        </p>
        <p className="mt-2 text-sm text-white/60">
          3 divisões • 30 times • 15 jogos
        </p>
      </div>
    </div>
  );
}
