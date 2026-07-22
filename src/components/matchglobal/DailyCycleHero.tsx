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

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Crown, Flag, Swords, Clock } from 'lucide-react';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { useGameStore } from '@/game/store';
import { DailyBracket } from './DailyBracket';
import { GlobalChampionHonor } from './GlobalChampionHonor';
import { resolveManagerName } from '@/lib/championManager';

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
    case 4: return 'Semifinal';
    case 8: return 'Quartas de Final';
    case 16: return 'Oitavas de Final';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
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
    <section className="relative overflow-hidden rounded-lg border border-neon-yellow/30 bg-gradient-to-br from-neon-yellow/5 via-black to-black p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {daily.phase === 'qualifying' && <Flag className="w-6 h-6 text-neon-yellow" />}
          {daily.phase === 'knockout' && <Swords className="w-6 h-6 text-neon-yellow animate-pulse" />}
          {daily.phase === 'crowned' && <Crown className="w-6 h-6 text-neon-yellow" />}
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-neon-yellow">
              Coroa do Dia
            </p>
            <h2 className="font-display text-lg sm:text-2xl font-bold uppercase text-white leading-tight">
              {daily.phase === 'qualifying' && 'Corrida do Dia'}
              {daily.phase === 'knockout' && 'Mata-Mata ao Vivo'}
              {daily.phase === 'crowned' && 'Campeão Coroado'}
            </h2>
          </div>
        </div>
        {daily.phase === 'knockout' && liveRound && (
          <span className="font-mono text-[10px] text-neon-green animate-pulse hidden sm:inline">
            ● {phaseLabel(liveRound.size)} agora
          </span>
        )}
      </div>

      {/* ════ QUALIFYING ════ */}
      {daily.phase === 'qualifying' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Meu rank */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1">
                Sua posição
              </p>
              {daily.myRank != null ? (
                <>
                  <p className="font-mono text-3xl font-bold text-neon-yellow leading-none">
                    {daily.myRank}º
                  </p>
                  <p className="text-xs text-text-soft mt-2">
                    {daily.inCut
                      ? '✅ dentro do top ' + daily.cutSize
                      : daily.distanceToCut != null
                        ? `${daily.distanceToCut} a frente do top ${daily.cutSize}`
                        : 'jogue para entrar'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-soft">Jogue 1 partida hoje pra entrar</p>
              )}
            </div>

            {/* Countdown */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1">
                Corte do mata-mata
              </p>
              <p className="font-mono text-3xl font-bold text-white leading-none">
                {fmt(daily.msToCut)}
              </p>
              <p className="text-xs text-text-soft mt-2">
                top {daily.cutSize} avança às {daily.qualifyHour}h
              </p>
            </div>

            {/* Líder */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1">
                Líder do dia
              </p>
              {daily.standings[0] ? (
                <>
                  <p className="font-display text-base font-bold uppercase text-neon-yellow truncate">
                    {daily.standings[0].team.clubName}
                  </p>
                  <p className="font-mono text-xs text-text-soft mt-2">
                    {daily.standings[0].team.dailyPoints ?? 0} pts
                    {' · '}
                    SG {daily.standings[0].team.dailyGoalDifference ?? 0}
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-soft">Sem partidas ainda</p>
              )}
            </div>
          </div>

          {/* Top 5 */}
          {daily.standings.length > 0 && (
            <div className="sports-panel rounded-lg p-3">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-2">
                Top 5 da Corrida
              </p>
              <div className="space-y-1">
                {daily.standings.slice(0, 5).map((row) => {
                  const inCut = row.rank <= daily.cutSize;
                  return (
                    <div
                      key={row.team.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded ${
                        row.isMe ? 'bg-neon-yellow/10 border-l-2 border-neon-yellow' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono text-xs w-5 text-right ${inCut ? 'text-neon-green' : 'text-text-soft'}`}>
                          {row.rank}
                        </span>
                        <span className="text-sm text-white truncate">
                          {row.team.clubName}
                          {row.isMe && <span className="text-[10px] text-neon-yellow ml-2">(você)</span>}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-text-soft shrink-0">
                        {row.team.dailyPoints ?? 0}p
                        <span className="text-white/30 ml-2">{row.team.dailyGoalDifference ?? 0 >= 0 ? '+' : ''}{row.team.dailyGoalDifference ?? 0}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ KNOCKOUT ════ */}
      {daily.phase === 'knockout' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Fase atual */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1">
                Fase atual
              </p>
              <p className="font-display text-lg font-bold uppercase text-neon-yellow">
                {liveRound ? phaseLabel(liveRound.size) : nextRound ? phaseLabel(nextRound.size) : '—'}
              </p>
              <p className="text-xs text-text-soft mt-2">
                {liveRound ? 'rolando agora' : nextRound ? 'aguardando' : 'mata-mata encerrado'}
              </p>
            </div>

            {/* Countdown próxima rodada */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Próxima rodada
              </p>
              {nextRound && nextRound.status === 'scheduled' ? (
                <>
                  <p className="font-mono text-2xl font-bold text-white leading-none">
                    {fmt(Math.max(0, nextRound.scheduledKickoffMs - now))}
                  </p>
                  <p className="text-xs text-text-soft mt-2">
                    {phaseLabel(nextRound.size)}
                  </p>
                </>
              ) : liveRound ? (
                <>
                  <p className="font-mono text-2xl font-bold text-neon-green leading-none animate-pulse">
                    ao vivo
                  </p>
                  <p className="text-xs text-text-soft mt-2">simulando agora</p>
                </>
              ) : (
                <p className="text-xs text-text-soft">—</p>
              )}
            </div>

            {/* Status do meu time */}
            <div className="sports-panel rounded-lg p-3 border border-white/10">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-1">
                Seu time
              </p>
              {myTeamId ? (
                (() => {
                  const lastRound = [...daily.bracket].reverse().find((r) =>
                    r.fixtures.some((fx) => fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId),
                  );
                  if (!lastRound) {
                    return <p className="text-sm text-text-soft">Não classificou para o mata-mata</p>;
                  }
                  const fx = lastRound.fixtures.find((f) => f.homeTeamId === myTeamId || f.awayTeamId === myTeamId);
                  if (!fx) return <p className="text-sm text-text-soft">—</p>;
                  if (fx.status !== 'finished') {
                    return (
                      <>
                        <p className="font-display text-base font-bold uppercase text-neon-yellow">
                          Você está vivo
                        </p>
                        <p className="text-xs text-text-soft mt-2">
                          {phaseLabel(lastRound.size)}
                        </p>
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
                      <p className="font-display text-base font-bold uppercase text-neon-green">
                        Avançou
                      </p>
                      <p className="font-mono text-xs text-text-soft mt-2">
                        {myScore}–{theirScore}{fx.wentToPenalties ? ' (P)' : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-base font-bold uppercase text-white/60">
                        Eliminado
                      </p>
                      <p className="font-mono text-xs text-text-soft mt-2">
                        {phaseLabel(lastRound.size)} · {myScore}–{theirScore}{fx.wentToPenalties ? ' (P)' : ''}
                      </p>
                    </>
                  );
                })()
              ) : (
                <p className="text-xs text-text-soft">—</p>
              )}
            </div>
          </div>

          {/* Bracket inline */}
          <div className="sports-panel rounded-lg p-3">
            <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} />
          </div>
        </div>
      )}

      {/* ════ CROWNED ════ */}
      {daily.phase === 'crowned' && daily.todayCrown && (
        <div className="space-y-4">
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
            <div className="sports-panel rounded-lg p-3">
              <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-2">
                O caminho do campeão
              </p>
              <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} championName={daily.todayCrown.clubName} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
