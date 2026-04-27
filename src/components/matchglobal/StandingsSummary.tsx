/**
 * Resumo Simplificado da Classificação após Rodada
 */

import { motion } from 'motion/react';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { OlefootLeagueTeam } from '@/match/olefootLeague';

interface StandingsSummaryProps {
  standings: Array<{
    division: number;
    teams: OlefootLeagueTeam[];
  }>;
}

export function StandingsSummary({ standings }: StandingsSummaryProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-neon-yellow" />
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
            Classificação Atualizada
          </h2>
        </div>

        <button
          onClick={() => navigate('/match/olefoot-liga')}
          className="btn-primary"
        >
          <span className="btn-primary-inner">
            Ver Liga Completa
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>
      </div>

      {/* Divisões */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {standings.map((standing) => (
          <motion.div
            key={standing.division}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: standing.division * 0.1 }}
            className="sports-panel rounded-lg overflow-hidden"
          >
            {/* Header da Divisão */}
            <div className="bg-deep-black border-b border-white/5 px-4 py-3">
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                {standing.division}ª Divisão
              </h3>
            </div>

            {/* Top 5 Times */}
            <div className="p-2">
              {standing.teams.slice(0, 5).map((team, index) => {
                const positionChange =
                  team.previousPosition !== undefined
                    ? team.previousPosition - team.position
                    : 0;

                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors"
                  >
                    {/* Posição + Time */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 w-12">
                        <span className="font-serif-hero text-lg font-bold text-white">
                          {team.position}
                        </span>
                        {positionChange > 0 && (
                          <TrendingUp className="w-3 h-3 text-neon-green" />
                        )}
                        {positionChange < 0 && (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        {positionChange === 0 && team.matchesPlayed > 0 && (
                          <Minus className="w-3 h-3 text-text-muted" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm font-bold text-white truncate">
                          {team.name}
                        </p>
                        <p className="text-xs text-text-soft">
                          {team.matchesPlayed}J • {team.wins}V • {team.draws}E • {team.losses}D
                        </p>
                      </div>
                    </div>

                    {/* Pontos */}
                    <div className="text-right ml-2">
                      <span className="font-serif-hero text-xl font-bold text-neon-yellow">
                        {team.points}
                      </span>
                      <p className="text-xs text-text-soft">pts</p>
                    </div>
                  </motion.div>
                );
              })}

              {/* Ver Mais */}
              <button
                onClick={() => navigate('/match/olefoot-liga')}
                className="w-full mt-2 py-2 text-xs text-text-soft hover:text-neon-yellow transition-colors font-display uppercase tracking-wider"
              >
                Ver Tabela Completa
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA Principal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="sports-panel panel-accent rounded-lg p-6 text-center"
      >
        <Trophy className="w-12 h-12 text-neon-yellow mx-auto mb-3" />
        <p className="font-display text-lg font-bold uppercase tracking-wider text-white mb-2">
          Acompanhe a OLEFOOT LIGA
        </p>
        <p className="text-sm text-text-soft mb-4">
          Veja estatísticas completas, histórico de jogos e muito mais
        </p>
        <button
          onClick={() => navigate('/match/olefoot-liga')}
          className="btn-primary"
        >
          <span className="btn-primary-inner">
            <Trophy className="w-5 h-5" />
            Ir para Liga
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
}
