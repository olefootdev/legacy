/**
 * GlobalLeagueHistory — Rodadas Passadas
 *
 * Lista todas as rodadas finalizadas da Global League com resultados reais.
 * Destaca as partidas do time do manager.
 */

import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CabecalhoRua, VazioRua } from '@/components/leagues/RuaTabela';
import { PlacarRua } from '@/components/leagues/Convocacao';
import { cn } from '@/lib/utils';
import type { GlobalFixture } from '@/match/globalMatch';
import type { LeagueRound } from '@/match/globalLeagueMVP';
import { L, LOCALE } from '@/i18n/L';

function formatKickoff(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

function HistoryFixtureRow({ fixture, myTeamId }: { fixture: GlobalFixture; myTeamId: string | null }) {
  const isMyMatch = myTeamId && (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId);
  const isMyHome = myTeamId && fixture.homeTeamId === myTeamId;
  const isMyAway = myTeamId && fixture.awayTeamId === myTeamId;

  let resultLabel = '';
  if (isMyMatch) {
    const myGoals = isMyHome ? fixture.scoreHome : fixture.scoreAway;
    const theirGoals = isMyHome ? fixture.scoreAway : fixture.scoreHome;
    if (myGoals > theirGoals) resultLabel = L('V', 'W');
    else if (myGoals === theirGoals) resultLabel = L('E', 'D');
    else resultLabel = L('D', 'L');
  }

  return (
    <div className={cn('flex min-h-[46px] min-w-0 items-center gap-2 px-3', isMyMatch ? 'bg-rua text-asfalto-27' : 'bg-concreto')}>
      {/* Resultado do manager */}
      <div className="w-7 shrink-0 text-center">
        {isMyMatch && <span className="inline-block bg-asfalto-27 px-1.5 font-impact text-[14px] text-rua">{resultLabel}</span>}
      </div>

      {/* Time casa */}
      <span className={cn('min-w-0 flex-1 truncate text-right font-impact text-[15px] uppercase leading-none', isMyMatch ? (isMyHome ? '' : 'text-asfalto-27/70') : 'text-suave')}>
        {fixture.homeTeamName}
      </span>

      {/* Placar */}
      <span className={cn('shrink-0 px-1 font-spray text-[22px] font-black leading-none tabular-nums', isMyMatch ? '' : 'text-papel')}>
        {fixture.scoreHome}×{fixture.scoreAway}
      </span>

      {/* Time fora */}
      <span className={cn('min-w-0 flex-1 truncate font-impact text-[15px] uppercase leading-none', isMyMatch ? (isMyAway ? '' : 'text-asfalto-27/70') : 'text-suave')}>
        {fixture.awayTeamName}
      </span>

      <span className={cn('shrink-0 font-prova text-[10px] font-bold', isMyMatch ? 'text-asfalto-27/70' : 'text-mudo')}>D{fixture.division}</span>
    </div>
  );
}

function RoundSection({ round, myTeamId, index }: { round: LeagueRound; myTeamId: string | null; index: number }) {
  // Fixtures do manager primeiro, depois o resto
  const sorted = useMemo(() => {
    const mine = round.fixtures.filter(f => myTeamId && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId));
    const others = round.fixtures.filter(f => !myTeamId || (f.homeTeamId !== myTeamId && f.awayTeamId !== myTeamId));
    return [...mine, ...others];
  }, [round.fixtures, myTeamId]);

  const myFixture = sorted.find(f => myTeamId && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="font-impact text-[22px] uppercase leading-none text-papel">
            {L('Rodada', 'Round')} {round.roundNumber}
          </h3>
          {myFixture && <SeloRua tom="corre-contorno" className="py-0 text-[10px]">{L('Teu jogo', 'Your match')}</SeloRua>}
        </div>
        <span className="shrink-0 font-prova text-[11px] font-bold text-mudo">{formatKickoff(round.scheduledKickoffMs)}</span>
      </div>
      {sorted.map((fx) => (
        <HistoryFixtureRow key={fx.id} fixture={fx} myTeamId={myTeamId} />
      ))}
    </motion.div>
  );
}

export default function GlobalLeagueHistory() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);
  const myTeamId = myTeam?.id ?? null;

  // Rodadas finalizadas em ordem decrescente (mais recente primeiro)
  const finishedRounds = useMemo(() => {
    if (!globalLeagueMVP) return [];
    const allRounds = [
      ...globalLeagueMVP.playoffRounds.filter(r => r.status === 'finished'),
      ...globalLeagueMVP.leagueRounds.filter(r => r.status === 'finished'),
    ];
    return allRounds.sort((a, b) => b.scheduledKickoffMs - a.scheduledKickoffMs);
  }, [globalLeagueMVP]);

  // Stats do manager nas rodadas passadas
  const myStats = useMemo(() => {
    if (!myTeamId) return null;
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const round of finishedRounds) {
      for (const fx of round.fixtures) {
        const isHome = fx.homeTeamId === myTeamId;
        const isAway = fx.awayTeamId === myTeamId;
        if (!isHome && !isAway) continue;
        const gf = isHome ? fx.scoreHome : fx.scoreAway;
        const ga = isHome ? fx.scoreAway : fx.scoreHome;
        goalsFor += gf;
        goalsAgainst += ga;
        if (gf > ga) wins++;
        else if (gf === ga) draws++;
        else losses++;
      }
    }
    return { wins, draws, losses, goalsFor, goalsAgainst, matches: wins + draws + losses };
  }, [finishedRounds, myTeamId]);

  // DS 2027: o último resultado do manager vira o placar pichado do topo.
  const lastMine = useMemo(() => {
    if (!myTeamId) return null;
    for (const round of finishedRounds) {
      const fx = round.fixtures.find((f) => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
      if (fx) return { fx, round: round.roundNumber };
    }
    return null;
  }, [finishedRounds, myTeamId]);
  const lastResult: 'W' | 'D' | 'L' | null = lastMine
    ? (() => {
        const home = lastMine.fx.homeTeamId === myTeamId;
        const gf = home ? lastMine.fx.scoreHome : lastMine.fx.scoreAway;
        const ga = home ? lastMine.fx.scoreAway : lastMine.fx.scoreHome;
        return gf > ga ? 'W' : gf === ga ? 'D' : 'L';
      })()
    : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden px-3 py-6 pb-12 sm:px-4 lg:px-8">
      <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />

      <CabecalhoRua rotulo={L('#ligaglobal · arquivo', '#globalleague · archive')} titulo={L('Rodadas passadas', 'Past rounds')} />

      {/* Último resultado — placar pichado (PDF 2b) */}
      {lastMine && (
        <section className="rua-grao flex min-w-0 flex-col gap-3 overflow-hidden bg-concreto pt-5">
          <div className="flex items-center justify-between gap-3 px-5 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            <span>{L('Fim de jogo', 'Full time')}</span>
            <span>{L('Rodada', 'Round')} {String(lastMine.round).padStart(2, '0')}</span>
          </div>
          <PlacarRua golsCasa={lastMine.fx.scoreHome} golsFora={lastMine.fx.scoreAway} resultado={lastResult} className="self-center" />
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-5">
            <span className={cn('min-w-0 truncate font-impact text-[20px] uppercase leading-none', lastMine.fx.homeTeamId === myTeamId ? 'text-papel' : 'text-mudo')}>
              {lastMine.fx.homeTeamName}
            </span>
            <span className={cn('min-w-0 truncate text-right font-impact text-[20px] uppercase leading-none', lastMine.fx.awayTeamId === myTeamId ? 'text-papel' : 'text-mudo')}>
              {lastMine.fx.awayTeamName}
            </span>
          </div>
          <p className="px-5 font-voz text-[clamp(34px,9vw,52px)] leading-[0.95] text-papel">
            {lastResult === 'W' ? L('Vitória na moral.', 'A win with respect.') : lastResult === 'D' ? L('Empate. Ponto é ponto.', 'A draw. A point is a point.') : L('Perdeu essa. Volta amanhã.', 'Lost this one. Back tomorrow.')}
          </p>
          <FitaRua tags={['#correloko', '#persista']} inclinacao={-1.5} className="mt-2" />
        </section>
      )}

      {/* Stats do manager */}
      {myStats && myStats.matches > 0 && (
        <div className="flex min-w-0 flex-col gap-3">
          <SecaoRua label={`${L('Meu desempenho', 'My record')} · ${myTeam?.clubName ?? ''}`} />
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {([
              [L('Jogos', 'Played'), myStats.matches, 'text-papel'],
              [L('Vitórias', 'Wins'), myStats.wins, 'text-rua'],
              [L('Empates', 'Draws'), myStats.draws, 'text-papel'],
              [L('Derrotas', 'Losses'), myStats.losses, 'text-mudo'],
              [L('Gols pró', 'Goals for'), myStats.goalsFor, 'text-papel'],
              [L('Gols contra', 'Goals against'), myStats.goalsAgainst, 'text-mudo'],
            ] as [string, number, string][]).map(([label, n, tone]) => (
              <div key={label} className="flex min-w-0 flex-col gap-1 bg-concreto px-3 py-3">
                <span className={cn('font-spray text-[34px] font-black leading-none', tone)}>{n}</span>
                <span className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de rodadas */}
      {finishedRounds.length === 0 ? (
        <VazioRua
          titulo={L('Nenhuma rodada finalizada ainda', 'No finished rounds yet')}
          frase={L('Slots: 05:30, 11:00, 15:00, 19:00, 21:30 UTC.', 'Slots: 05:30, 11:00, 15:00, 19:00, 21:30 UTC.')}
        />
      ) : (
        <div className="space-y-8">
          {finishedRounds.map((round, index) => (
            <RoundSection key={round.roundNumber + '-' + round.scheduledKickoffMs} round={round} myTeamId={myTeamId} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
