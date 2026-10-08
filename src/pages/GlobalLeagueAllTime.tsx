/**
 * GlobalLeagueAllTime - Hall da Fama · Ranking historico entre temporadas
 * Rota: /match/global/all-time
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { SecaoRua } from '@/components/ui/Rua';
import { CabecalhoRua, FaltaRua, LinhaRua, VazioRua, posRua } from '@/components/leagues/RuaTabela';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { L, emIngles } from '@/i18n/L';

export default function GlobalLeagueAllTime() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);

  const ranked = useMemo(() => {
    if (!globalLeagueMVP) return [];
    return [...globalLeagueMVP.teams].sort((a, b) => {
      if (b.allTimePoints !== a.allTimePoints) return b.allTimePoints - a.allTimePoints;
      if (b.allTimeWins !== a.allTimeWins) return b.allTimeWins - a.allTimeWins;
      const sgA = a.allTimeGoalsFor - a.allTimeGoalsAgainst;
      const sgB = b.allTimeGoalsFor - b.allTimeGoalsAgainst;
      if (sgB !== sgA) return sgB - sgA;
      return a.clubName.localeCompare(b.clubName);
    });
  }, [globalLeagueMVP]);

  const myIdx = myTeam ? ranked.findIndex((t) => t.id === myTeam.id) : -1;
  const gapAbove = myIdx > 0 ? Math.max(0, ranked[myIdx - 1].allTimePoints - ranked[myIdx].allTimePoints) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden px-3 py-6 pb-12 sm:px-4 lg:px-8">
      <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />

      <CabecalhoRua
        rotulo={L('#ligaglobal · todas as temporadas', '#globalleague · all seasons')}
        titulo={emIngles() ? 'Hall of Fame' : 'Hall da Fama'}
        voz={L('Quem fica no muro é quem durou.', 'The wall remembers who lasted.')}
      />

      {ranked.length === 0 ? (
        <VazioRua titulo={L('Nenhum time registrado ainda', 'No teams registered yet')} frase={L('O muro tá em branco. Pinta o teu nome.', 'The wall is blank. Paint your name.')} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-4">
          {gapAbove != null && (
            <FaltaRua
              valor={gapAbove}
              unidade={L('pts', 'pts')}
              frase={L(`é o que separa tu do ${posRua(myIdx)} na história.`, `is all that's between you and ${posRua(myIdx)} all-time.`)}
            />
          )}

          <SecaoRua label={L('Classificação histórica', 'All-time standings')} aside={`${ranked.length} ${L('clubes', 'clubs')}`} />

          <div className="flex min-w-0 flex-col gap-1.5">
            {ranked.map((team, index) => {
              const isMe = team.id === myTeam?.id;
              const sg = team.allTimeGoalsFor - team.allTimeGoalsAgainst;
              const posChange = team.previousPosition ? team.previousPosition - (team.position ?? 0) : 0;
              return (
                <LinhaRua
                  key={team.id}
                  pos={index + 1}
                  tom={isMe ? 'eu' : index === 0 ? 'lider' : index < 3 ? 'zona' : myIdx >= 0 && index > myIdx ? 'abaixo' : 'normal'}
                  nome={team.clubName}
                  sub={`${L('T', 'S')}${team.allTimeSeasonsPlayed ?? 0} · ${L('J', 'P')}${team.allTimeMatchesPlayed} ${L('V', 'W')}${team.allTimeWins} ${L('E', 'D')}${team.allTimeDraws} ${L('D', 'L')}${team.allTimeLosses} · ${team.allTimeGoalsFor}:${team.allTimeGoalsAgainst} (${sg > 0 ? `+${sg}` : sg})`}
                  chip={
                    posChange > 0 ? (
                      <ArrowUp aria-label={L('Subiu', 'Up')} className={isMe ? 'h-4 w-4 shrink-0 text-asfalto-27' : 'h-4 w-4 shrink-0 text-alta'} strokeWidth={3} />
                    ) : posChange < 0 ? (
                      <ArrowDown aria-label={L('Caiu', 'Down')} className={isMe ? 'h-4 w-4 shrink-0 text-asfalto-27' : 'h-4 w-4 shrink-0 text-baixa'} strokeWidth={3} />
                    ) : null
                  }
                  valor={team.allTimePoints}
                  onClick={() => navigate(`/match/global/club/${team.id}`)}
                  ariaLabel={L(`Ver perfil de ${team.clubName}`, `View ${team.clubName} profile`)}
                />
              );
            })}
          </div>

          <p className="font-prova text-[10.5px] uppercase tracking-[0.12em] text-mudo">
            {L('T = temporadas · PTS = pontos acumulados · toque pra ver o perfil', 'S = seasons · PTS = total points · tap for profile')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
