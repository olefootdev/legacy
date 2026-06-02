/**
 * /liga-global/hoje — Ciclo Diário (Coroa do Dia)
 *
 * Aplica o hero pattern editorial Olefoot (BG neon-yellow + watermark gigante
 * "COROA" + hero text preto + divider + serif-hero italic). Ranking polido,
 * bracket integrado e galeria de coroas no rodapé.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Flag, Swords, Clock, ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { DailyBracket } from '@/components/matchglobal/DailyBracket';
import { CrownsGallery } from '@/components/matchglobal/CrownsGallery';

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseSizeLabel(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas';
    case 16: return 'Oitavas';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}

export default function GlobalLeagueDaily() {
  const navigate = useNavigate();
  const daily = useDailyCycle();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const myTeamId = daily.myTeam?.id ?? null;
  const liveRound = daily.bracket.find((r) => r.status === 'live');
  const nextRound = daily.bracket.find((r) => r.status !== 'finished');

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 pb-10">
      {/* Botão voltar (discreto, antes do hero) */}
      <div className="pt-3">
        <button
          type="button"
          onClick={() => navigate('/match/global')}
          className="inline-flex items-center gap-2 text-[10px] font-display uppercase tracking-[0.25em] text-white/40 hover:text-neon-yellow transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Liga Global
        </button>
      </div>

      {/* HERO EDITORIAL — BG neon-yellow + watermark COROA + hero text preto */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm">
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden" aria-hidden>
          <span
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{ fontSize: 'clamp(120px, 24vw, 360px)', lineHeight: '0.85', letterSpacing: '-0.02em' }}
          >
            COROA
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
        >
          <p className="font-display text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-black/60 mb-2">
            Liga Global · Ciclo Diário
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase text-black leading-none">
            Coroa do Dia
          </h1>
          <span aria-hidden className="mx-auto mt-4 block w-16 h-[3px] bg-black" />
          <p className="font-serif-hero text-xl sm:text-2xl italic text-black/80 mt-4">
            {daily.phase === 'qualifying' && 'A corrida está aberta'}
            {daily.phase === 'knockout' && 'Mata-Mata em andamento'}
            {daily.phase === 'crowned' && daily.todayCrown
              ? `${daily.todayCrown.clubName} é o campeão`
              : daily.phase === 'crowned' && 'Campeão coroado'}
          </p>
        </motion.div>
      </section>

      {/* Indicador de fase + countdown */}
      <div className="sports-panel rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <PhaseChip active={daily.phase === 'qualifying'} icon={<Flag className="w-3.5 h-3.5" />} label="Classificação" />
          <span className="text-white/30">›</span>
          <PhaseChip active={daily.phase === 'knockout'} icon={<Swords className="w-3.5 h-3.5" />} label="Mata-Mata" />
          <span className="text-white/30">›</span>
          <PhaseChip active={daily.phase === 'crowned'} icon={<Crown className="w-3.5 h-3.5" />} label="Coroa" />
        </div>
        <div className="flex items-center gap-2">
          {daily.phase === 'qualifying' && (
            <div className="flex items-center gap-1.5 text-text-soft">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                corte em <span className="font-bold text-white">{fmtCountdown(daily.msToCut)}</span>
              </span>
            </div>
          )}
          {daily.phase === 'knockout' && nextRound && (
            <div className="flex items-center gap-1.5 text-text-soft">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                {liveRound ? (
                  <span className="text-neon-green font-bold animate-pulse">● ao vivo</span>
                ) : (
                  <>próxima em <span className="font-bold text-white">{fmtCountdown(Math.max(0, nextRound.scheduledKickoffMs - now))}</span></>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CAMPEÃO COROADO — faixa hero secundária */}
      {daily.phase === 'crowned' && daily.todayCrown && (
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-lg border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/10 via-black to-black p-6 sm:p-8"
        >
          <div className="absolute -top-8 -right-8 text-neon-yellow/10 select-none pointer-events-none" aria-hidden>
            <Trophy className="w-48 h-48" strokeWidth={1} />
          </div>
          <div className="relative z-10 flex items-start gap-4 sm:gap-6">
            <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-neon-yellow shrink-0 drop-shadow-[0_0_24px_rgba(255,220,0,0.4)]" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-neon-yellow/80 mb-2">
                Campeão de {daily.todayCrown.dailyDate}
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-black uppercase text-white leading-none">
                {daily.todayCrown.clubName}
              </h2>
              <span aria-hidden className="block w-12 h-[2px] bg-neon-yellow mt-3" />
              <p className="font-serif-hero italic text-base sm:text-lg text-white/70 mt-3">
                {daily.todayCrown.runnerUpClubName && daily.todayCrown.finalScoreHome != null && daily.todayCrown.finalScoreAway != null
                  ? `final ${daily.todayCrown.finalScoreHome}–${daily.todayCrown.finalScoreAway} vs ${daily.todayCrown.runnerUpClubName}${daily.todayCrown.finalWentToPens ? ' (pênaltis)' : ''}`
                  : `bracket de ${daily.todayCrown.bracketSize} clubes`}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* QUALIFYING — corrida do dia */}
      {daily.phase === 'qualifying' && (
        <section className="sports-panel rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-neon-yellow/15 via-neon-yellow/5 to-transparent border-b border-neon-yellow/30 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-neon-yellow/80">
                Classificação
              </p>
              <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                Corrida do Dia
              </h2>
            </div>
            <span className="font-mono text-xs text-text-soft text-right">
              top <span className="text-neon-green font-bold">{daily.cutSize || '—'}</span> avançam<br />
              <span className="text-[10px] uppercase tracking-wider text-text-soft/70">às {daily.qualifyHour}h BRT</span>
            </span>
          </div>

          {daily.standings.length === 0 ? (
            <div className="text-center text-text-soft py-12 px-4">
              <Flag className="w-10 h-10 mx-auto mb-3 text-text-soft/40" />
              <p className="font-display text-sm uppercase tracking-wider text-white/60 mb-1">Nenhuma partida hoje</p>
              <p className="text-xs text-text-soft max-w-md mx-auto">
                As partidas de liga somam pontos na corrida. Jogue para entrar no mata-mata das {daily.qualifyHour}h.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <div className="grid grid-cols-[44px_1fr_36px_36px_44px_56px] gap-2 px-3 py-2 bg-black/30 text-[10px] font-display uppercase tracking-wider text-text-soft">
                <div className="text-center">#</div>
                <div>Clube</div>
                <div className="text-center">J</div>
                <div className="text-center">V</div>
                <div className="text-center">SG</div>
                <div className="text-center font-bold">PTS</div>
              </div>
              {daily.standings.map((row) => {
                const isCut = daily.cutSize >= 2 && row.rank === daily.cutSize;
                const inZone = daily.cutSize >= 2 && row.rank <= daily.cutSize;
                return (
                  <div key={row.team.id}>
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(row.rank * 0.01, 0.3) }}
                      className={`grid grid-cols-[44px_1fr_36px_36px_44px_56px] gap-2 px-3 py-2.5 items-center transition-colors ${
                        row.isMe
                          ? 'bg-neon-yellow/10 border-l-4 border-neon-yellow'
                          : inZone
                            ? 'bg-neon-green/[0.04] border-l-4 border-neon-green/40 hover:bg-neon-green/[0.08]'
                            : 'border-l-4 border-transparent hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="text-center font-mono font-bold text-white">{row.rank}</div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-white truncate">{row.team.clubName}</span>
                        {row.isMe && (
                          <span className="text-[9px] font-display uppercase tracking-wider bg-neon-yellow text-black px-1.5 py-0.5 rounded-sm shrink-0">
                            você
                          </span>
                        )}
                        {(row.team.seasonCrowns ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-neon-yellow shrink-0">
                            <Crown className="w-3 h-3" />{row.team.seasonCrowns}
                          </span>
                        )}
                      </div>
                      <div className="text-center font-mono text-xs text-text-soft">{row.team.dailyMatchesPlayed ?? 0}</div>
                      <div className="text-center font-mono text-xs text-neon-green">{row.team.dailyWins ?? 0}</div>
                      <div className={`text-center font-mono text-xs ${(row.team.dailyGoalDifference ?? 0) >= 0 ? 'text-text-soft' : 'text-red-400/70'}`}>
                        {(row.team.dailyGoalDifference ?? 0) > 0 ? '+' : ''}{row.team.dailyGoalDifference ?? 0}
                      </div>
                      <div className="text-center font-mono text-sm font-bold text-neon-yellow">{row.team.dailyPoints ?? 0}</div>
                    </motion.div>
                    {isCut && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50">
                        <div className="h-px flex-1 bg-neon-green/40" />
                        <span className="text-[9px] font-display font-bold uppercase tracking-[0.25em] text-neon-green flex items-center gap-1.5">
                          <Swords className="w-3 h-3" />
                          Corte · top {daily.cutSize} ao mata-mata
                        </span>
                        <div className="h-px flex-1 bg-neon-green/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* KNOCKOUT / CROWNED — bracket */}
      {(daily.phase === 'knockout' || daily.phase === 'crowned') && (
        <section className="sports-panel rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-neon-yellow/15 via-neon-yellow/5 to-transparent border-b border-neon-yellow/30 flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-neon-yellow/80">
                Bracket
              </p>
              <h2 className="font-display text-lg font-bold uppercase tracking-wider text-white">
                Mata-Mata{daily.phase === 'crowned' ? ' — encerrado' : ''}
              </h2>
            </div>
            {liveRound && (
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-neon-green animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green inline-block" />
                ao vivo · {phaseSizeLabel(liveRound.size)}
              </span>
            )}
          </div>
          <div className="p-4">
            <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} />
          </div>
        </section>
      )}

      {/* Galeria de coroas (rodapé) */}
      <CrownsGallery limit={12} />
    </div>
  );
}

function PhaseChip({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.2em] transition-all ${
        active
          ? 'bg-neon-yellow text-black shadow-[0_0_12px_rgba(255,220,0,0.3)]'
          : 'bg-white/5 text-text-soft border border-white/10'
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
