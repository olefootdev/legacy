/**
 * UI de Acompanhamento dos Playoffs
 * Mostra tabela de classificação e próximas rodadas
 */

import { motion } from 'motion/react';
import { useGameStore } from '@/game/store';
import { Fragment, useMemo } from 'react';
import { BackButton } from '@/components/BackButton';
import { BarraSegmentos, FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { FaltaRua, LinhaRua, VazioRua, ZonaRua } from '@/components/leagues/RuaTabela';
import { cn } from '@/lib/utils';
import { globalDivisionName } from '@/match/globalLeagueMVP';
import { L } from '@/i18n/L';

export default function GlobalLeaguePlayoffs() {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const managerId = managerProfile?.email ?? club?.id;
  const myTeamId = globalLeagueMVP?.teams.find((t) => t.managerId === managerId)?.id ?? null;

  // Ordenar times por pontos dos playoffs
  const standings = useMemo(() => {
    if (!globalLeagueMVP) return [];

    return [...globalLeagueMVP.teams].sort((a, b) => {
      if (b.playoffPoints !== a.playoffPoints) return b.playoffPoints - a.playoffPoints;
      if (b.playoffWins !== a.playoffWins) return b.playoffWins - a.playoffWins;
      const aDiff = a.playoffGoalsFor - a.playoffGoalsAgainst;
      const bDiff = b.playoffGoalsFor - b.playoffGoalsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;
      if (b.playoffGoalsFor !== a.playoffGoalsFor) return b.playoffGoalsFor - a.playoffGoalsFor;
      return a.clubName.localeCompare(b.clubName);
    });
  }, [globalLeagueMVP]);

  const currentRound = globalLeagueMVP?.currentPlayoffRound || 1;
  const totalRounds = 6;

  if (!globalLeagueMVP || globalLeagueMVP.status !== 'playoffs') {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-3 py-12 sm:px-4 lg:px-6">
        <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />
        <VazioRua titulo={L('Playoffs ainda não iniciados', 'Playoffs not started yet')} frase={L('Quando fechar o quórum, a bola rola.', 'Once the quorum closes, the ball rolls.')} />
      </div>
    );
  }

  // DS 2027: quanto falta pra subir de divisão projetada (corte em #11 e #22).
  const myIdx = myTeamId ? standings.findIndex((t) => t.id === myTeamId) : -1;
  const targetIdx = myIdx >= 22 ? 21 : myIdx >= 11 ? 10 : -1;
  const gapUp = myIdx >= 0 && targetIdx >= 0 && standings[targetIdx] ? Math.max(0, standings[targetIdx].playoffPoints - standings[myIdx].playoffPoints) : null;
  const targetDiv = targetIdx === 10 ? 1 : 2;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 overflow-x-hidden px-3 pb-6 sm:px-4 md:pb-8 lg:px-6">
      <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />

      <FitaRua tags={['#playoffs', '#ligaglobal']} className="-mx-3 sm:-mx-4 lg:-mx-6" />

      {/* Hero — a rodada em spray */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('#ligaglobal · playoffs', '#globalleague · playoffs')} />
        <h1 className="flex flex-wrap items-baseline gap-x-4">
          <span className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(48px, 13vw, 96px)' }}>
            {L('Rodada', 'Round')}
          </span>
          <span className="font-spray font-black leading-[0.86] text-rua" style={{ fontSize: 'clamp(60px, 17vw, 120px)' }}>
            {currentRound}<span className="text-fio">/{totalRounds}</span>
          </span>
        </h1>
        <BarraSegmentos valor={currentRound} max={totalRounds} segmentos={totalRounds} className="max-w-md" />
        <p className="font-voz text-[clamp(22px,6vw,30px)] leading-[1.05] text-suave">
          {L(`Faltam ${totalRounds - currentRound} rodadas. Cada ponto decide a divisão.`, `${totalRounds - currentRound} rounds left. Every point decides the division.`)}
        </p>
      </motion.header>

      {gapUp != null && (
        <FaltaRua
          valor={gapUp}
          unidade={L('pts', 'pts')}
          frase={L(`é o que separa tu da ${globalDivisionName(targetDiv)}.`, `is all that's between you and ${globalDivisionName(targetDiv)}.`)}
        />
      )}

      {/* Classificação dos playoffs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <SecaoRua label={L('Classificação dos playoffs', 'Playoff standings')} />
          <p className="font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
            {L(`Top 11 → ${globalDivisionName(1)} · meio 11 → ${globalDivisionName(2)} · últimos 10 → ${globalDivisionName(3)}`, `Top 11 → ${globalDivisionName(1)} · middle 11 → ${globalDivisionName(2)} · bottom 10 → ${globalDivisionName(3)}`)}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {standings.map((team, index) => {
            const position = index + 1;
            const division = position <= 11 ? 1 : position <= 22 ? 2 : 3;
            const saldoGols = team.playoffGoalsFor - team.playoffGoalsAgainst;
            const isMe = !!myTeamId && team.id === myTeamId;
            const isLeader = index === 0;
            const cutAfter = position === 11 || position === 22;
            return (
              <Fragment key={team.id}>
                <LinhaRua
                  pos={position}
                  tom={isMe ? 'eu' : isLeader ? 'lider' : division === 1 ? 'zona' : division === 3 ? 'abaixo' : 'normal'}
                  nome={team.clubName}
                  sub={`${team.clubShort} · ${L('J', 'P')}${team.playoffMatchesPlayed} ${L('V', 'W')}${team.playoffWins} ${L('E', 'D')}${team.playoffDraws} ${L('D', 'L')}${team.playoffLosses} · ${L('SG', 'GD')} ${saldoGols > 0 ? '+' : ''}${saldoGols}`}
                  chip={
                    <span className={cn('hidden shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.1em] min-[420px]:inline', isMe ? 'text-asfalto-27/70' : division === 1 ? 'text-ouro-27' : 'text-mudo')}>
                      {globalDivisionName(division)}
                    </span>
                  }
                  valor={team.playoffPoints}
                />
                {cutAfter && <ZonaRua label={`↑ ${globalDivisionName(division)}`} tom={division === 1 ? 'rua' : 'fio'} />}
              </Fragment>
            );
          })}
        </div>
      </motion.div>

      {/* Calendário — canhotos de rodada */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Calendário', 'Schedule')} />
        <div className="flex flex-col gap-1.5">
          {globalLeagueMVP.playoffRounds.map((round) => {
            const current = round.roundNumber === currentRound;
            return (
              <div
                key={round.roundNumber}
                className={cn('flex min-h-[52px] items-center justify-between gap-3 px-4 py-2', current ? 'border-l-[5px] border-rua bg-concreto' : 'bg-concreto')}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn('font-impact text-[20px] uppercase leading-none', current ? 'text-rua' : 'text-papel')}>
                    {L('Rodada', 'Round')} {round.roundNumber}
                  </span>
                  <span className="font-prova text-[11px] font-bold uppercase text-mudo">
                    {round.isReturning ? L('Returno', 'Second leg') : L('Turno', 'First leg')}
                  </span>
                </div>
                {round.status === 'finished' && <SeloRua tom="cal" className="py-0.5 text-[10px]">{L('Finalizada', 'Finished')}</SeloRua>}
                {round.status === 'live' && <SeloRua tom="corre" className="py-0.5 text-[10px]">● {L('Ao vivo', 'Live')}</SeloRua>}
                {round.status === 'scheduled' && <SeloRua tom="mudo" className="py-0.5 text-[10px]">{L('Agendada', 'Scheduled')}</SeloRua>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
