/**
 * DailyCycleHero — bloco destacado do Ciclo Diário (Coroa do Dia) em /match/global.
 *
 * Adaptativo nas 3 fases. Renderiza no TOPO da página de Liga Global para que
 * o ciclo diário tenha presença visual permanente, não fique escondido.
 *
 *   • qualifying → cronômetro pro corte 19h BRT + top 5 da corrida + meu rank
 *   • knockout   → fase atual + countdown da próxima rodada + bracket inline
 *   • crowned    → hero do campeão de hoje
 */

import { L } from '@/i18n/L';
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Crown, Flag, Swords } from 'lucide-react';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { useGameStore } from '@/game/store';
import { DailyBracket } from './DailyBracket';
import { GlobalChampionHonor } from './GlobalChampionHonor';
import { resolveManagerName } from '@/lib/championManager';
import { SeloRua } from '@/components/ui/Rua';
import { LinhaRua } from '@/components/leagues/RuaTabela';
import { cn } from '@/lib/utils';

/** Célula de painel: rótulo prova + valor + nota. */
function Celula({ rotulo, children, nota, className }: { rotulo: string; children: React.ReactNode; nota?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 bg-asfalto-27 p-3', className)}>
      <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{rotulo}</span>
      {children}
      {nota != null && <span className="font-prova text-[11px] text-suave">{nota}</span>}
    </div>
  );
}

function fmt(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function phaseLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return L('Semifinal', 'Semi-final');
    case 8: return L('Quartas de Final', 'Quarter-finals');
    case 16: return L('Oitavas de Final', 'Round of 16');
    case 32: return L('Fase de 32', 'Round of 32');
    default: return L(`Fase de ${size}`, `Round of ${size}`);
  }
}

export function DailyCycleHero() {
  const daily = useDailyCycle();
  const [now, setNow] = useState(() => Date.now());

  // Tick a cada 1s pra countdown fluido
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Próxima rodada do bracket (a primeira não-finalizada)
  const nextRound = useMemo(() => {
    return daily.bracket.find((r) => r.status !== 'finished');
  }, [daily.bracket]);

  const liveRound = useMemo(() => {
    return daily.bracket.find((r) => r.status === 'live');
  }, [daily.bracket]);

  const myTeamId = daily.myTeam?.id ?? null;

  // Nome público do manager campeão. Se o campeão sou EU, uso meu próprio nome
  // (confiável); senão resolvo via RPC social (handles públicos, sem PII).
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const [championManager, setChampionManager] = useState<string | null>(null);
  const crownClub = daily.todayCrown?.clubName;
  const crownShort = daily.todayCrown?.clubShort;
  const crownManagerId = daily.todayCrown?.managerId;
  useEffect(() => {
    if (daily.phase !== 'crowned' || !crownClub) { setChampionManager(null); return; }
    const myEmail = managerProfile?.email;
    if (myEmail && crownManagerId && crownManagerId === myEmail) {
      const mine = `${managerProfile?.firstName ?? ''} ${managerProfile?.lastName ?? ''}`.trim();
      setChampionManager(mine || null);
      return;
    }
    let alive = true;
    resolveManagerName(crownClub, crownShort).then((n) => { if (alive) setChampionManager(n); });
    return () => { alive = false; };
  }, [daily.phase, crownClub, crownShort, crownManagerId, managerProfile]);

  // Se ainda não tem nada significativo, esconde (evita "buraco" na página).
  if (daily.standings.length === 0 && daily.recentCrowns.length === 0 && daily.bracket.length === 0) {
    return null;
  }

  return (
    <section className="rua-grao relative flex min-w-0 flex-col gap-4 overflow-hidden bg-concreto p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {daily.phase === 'qualifying' && <Flag aria-hidden className="h-6 w-6 shrink-0 text-rua" />}
          {daily.phase === 'knockout' && <Swords aria-hidden className="h-6 w-6 shrink-0 text-rua" />}
          {daily.phase === 'crowned' && <Crown aria-hidden className="h-6 w-6 shrink-0 text-ouro-27" />}
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('#coroadodia', '#crownoftheday')}</span>
            <h2 className="truncate font-impact text-[28px] uppercase leading-none text-papel sm:text-[34px]">
              {daily.phase === 'qualifying' && L('Corrida do Dia', 'Daily Race')}
              {daily.phase === 'knockout' && L('Mata-Mata ao Vivo', 'Live Knockout')}
              {daily.phase === 'crowned' && L('Campeão Coroado', 'Champion Crowned')}
            </h2>
          </div>
        </div>
        {daily.phase === 'knockout' && liveRound && (
          <SeloRua tom="corre" className="hidden sm:inline-flex">● {phaseLabel(liveRound.size)} {L('agora', 'now')}</SeloRua>
        )}
      </div>

      {/* ════ QUALIFYING ════ */}
      {daily.phase === 'qualifying' && (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Celula
              rotulo={L('Tua posição', 'Your position')}
              nota={
                daily.myRank != null
                  ? daily.inCut
                    ? L(`Dentro do top ${daily.cutSize}. Segura.`, `Inside the top ${daily.cutSize}. Hold it.`)
                    : daily.distanceToCut != null
                      ? L(`Faltam ${daily.distanceToCut} posições pro top ${daily.cutSize}.`, `${daily.distanceToCut} places to the top ${daily.cutSize}.`)
                      : L('Joga pra entrar.', 'Play to get in.')
                  : undefined
              }
            >
              {daily.myRank != null ? (
                <span className={cn('font-spray text-[44px] font-black leading-none', daily.inCut ? 'text-rua' : 'text-papel')}>#{daily.myRank}</span>
              ) : (
                <span className="font-voz text-[22px] leading-none text-suave">{L('Joga 1 partida hoje pra entrar.', 'Play 1 match today to get in.')}</span>
              )}
            </Celula>

            <Celula rotulo={L('Corte do mata-mata', 'Knockout cut-off')} nota={L(`top ${daily.cutSize} avança às ${daily.qualifyHour}h`, `top ${daily.cutSize} advance at ${daily.qualifyHour}h`)}>
              <span className="font-spray text-[44px] font-black leading-none text-rua">{fmt(daily.msToCut)}</span>
            </Celula>

            <Celula
              rotulo={L('Líder do dia', 'Leader of the day')}
              className={daily.standings[0] ? 'border-2 border-ouro-27' : undefined}
              nota={daily.standings[0] ? `${daily.standings[0].team.dailyPoints ?? 0} pts · ${L('SG', 'GD')} ${daily.standings[0].team.dailyGoalDifference ?? 0}` : undefined}
            >
              {daily.standings[0] ? (
                <span className="truncate font-impact text-[24px] uppercase leading-none text-ouro-27">{daily.standings[0].team.clubName}</span>
              ) : (
                <span className="font-prova text-[12px] text-mudo">{L('Sem partidas ainda', 'No matches yet')}</span>
              )}
            </Celula>
          </div>

          {/* Top 5 */}
          {daily.standings.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Top 5 da corrida', 'Race top 5')}</span>
              {daily.standings.slice(0, 5).map((row) => {
                const inCut = row.rank <= daily.cutSize;
                const gd = row.team.dailyGoalDifference ?? 0;
                return (
                  <LinhaRua
                    key={row.team.id}
                    pos={row.rank}
                    tom={row.isMe ? 'eu' : row.rank === 1 ? 'lider' : inCut ? 'zona' : 'normal'}
                    nome={row.team.clubName}
                    sub={`${L('SG', 'GD')} ${gd >= 0 ? '+' : ''}${gd}`}
                    valor={row.team.dailyPoints ?? 0}
                    className="bg-asfalto-27"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ KNOCKOUT ════ */}
      {daily.phase === 'knockout' && (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Celula
              rotulo={L('Fase atual', 'Current round')}
              nota={liveRound ? L('rolando agora', 'live now') : nextRound ? L('aguardando', 'waiting') : L('mata-mata encerrado', 'knockout finished')}
            >
              <span className="font-impact text-[26px] uppercase leading-none text-papel">
                {liveRound ? phaseLabel(liveRound.size) : nextRound ? phaseLabel(nextRound.size) : '—'}
              </span>
            </Celula>

            <Celula rotulo={L('Próxima rodada', 'Next round')}>
              {nextRound && nextRound.status === 'scheduled' ? (
                <>
                  <span className="font-spray text-[40px] font-black leading-none text-rua">{fmt(Math.max(0, nextRound.scheduledKickoffMs - now))}</span>
                  <span className="font-prova text-[11px] text-suave">{phaseLabel(nextRound.size)}</span>
                </>
              ) : liveRound ? (
                <>
                  <SeloRua tom="corre" className="self-start">● {L('Ao vivo', 'Live')}</SeloRua>
                  <span className="font-prova text-[11px] text-suave">{L('simulando agora', 'simulating now')}</span>
                </>
              ) : (
                <span className="font-prova text-[12px] text-mudo">—</span>
              )}
            </Celula>

            <Celula rotulo={L('Teu time', 'Your team')}>
              {myTeamId ? (
                (() => {
                  const lastRound = [...daily.bracket].reverse().find((r) =>
                    r.fixtures.some((fx) => fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId),
                  );
                  if (!lastRound) {
                    return <span className="font-voz text-[20px] leading-none text-suave">{L('Ficou fora hoje. Volta amanhã.', 'Out today. Back tomorrow.')}</span>;
                  }
                  const fx = lastRound.fixtures.find((f) => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
                  if (!fx) return <span className="font-prova text-[12px] text-mudo">—</span>;
                  if (fx.status !== 'finished') {
                    return (
                      <>
                        <span className="font-impact text-[24px] uppercase leading-none text-rua">{L('Tá vivo', 'Still alive')}</span>
                        <span className="font-prova text-[11px] text-suave">{phaseLabel(lastRound.size)}</span>
                      </>
                    );
                  }
                  const isHome = fx.homeTeamId === myTeamId;
                  const myScore = isHome ? fx.scoreHome : fx.scoreAway;
                  const theirScore = isHome ? fx.scoreAway : fx.scoreHome;
                  const myPen = isHome ? fx.penaltyScoreHome : fx.penaltyScoreAway;
                  const theirPen = isHome ? fx.penaltyScoreAway : fx.penaltyScoreHome;
                  let won = myScore > theirScore;
                  if (myScore === theirScore && myPen != null && theirPen != null) won = myPen > theirPen;
                  return won ? (
                    <>
                      <span className="font-impact text-[24px] uppercase leading-none text-rua">{L('Avançou', 'Advanced')}</span>
                      <span className="font-spray text-[22px] font-black leading-none text-papel">{myScore}×{theirScore}{fx.wentToPenalties ? ' (P)' : ''}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-impact text-[24px] uppercase leading-none text-mudo">{L('Eliminado', 'Eliminated')}</span>
                      <span className="font-prova text-[11px] text-suave">
                        {phaseLabel(lastRound.size)} · {myScore}×{theirScore}{fx.wentToPenalties ? ' (P)' : ''}
                      </span>
                    </>
                  );
                })()
              ) : (
                <span className="font-prova text-[12px] text-mudo">—</span>
              )}
            </Celula>
          </div>

          <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} />
        </div>
      )}

      {/* ════ CROWNED ════ */}
      {daily.phase === 'crowned' && daily.todayCrown && (
        <div className="flex min-w-0 flex-col gap-4">
          <GlobalChampionHonor
            variant="hero"
            clubName={daily.todayCrown.clubName}
            clubShort={daily.todayCrown.clubShort}
            managerName={championManager}
            dailyDate={daily.todayCrown.dailyDate}
            runnerUpClubName={daily.todayCrown.runnerUpClubName}
            finalScoreHome={daily.todayCrown.finalScoreHome}
            finalScoreAway={daily.todayCrown.finalScoreAway}
            finalWentToPens={daily.todayCrown.finalWentToPens}
          />

          {daily.bracket.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('O caminho do campeão', "The champion's path")}</span>
              <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} championName={daily.todayCrown.clubName} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
