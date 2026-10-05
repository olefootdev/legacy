/**
 * /liga-global/hoje — Ciclo Diário (Coroa do Dia)
 *
 * VOLT2: hero volt chapado + manchete Anton preta (sem marca d'água). Linha do
 * manager em faixa volt, corte do mata-mata em linha tracejada; bracket
 * integrado e galeria de coroas no rodapé.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Flag, Swords, Clock, ArrowLeft, Scale, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { DailyBracket } from '@/components/matchglobal/DailyBracket';
import { CrownsGallery } from '@/components/matchglobal/CrownsGallery';
import { useGameStore, useGameDispatch } from '@/game/store';
import { decreeForWeek, isoWeekKey, type DecreeOption } from '@/systems/weeklyDecree';
import { submitDecreeVote, fetchDecreeTally, type DecreeTally } from '@/supabase/weeklyDecree';
import { Hashtag } from '@/components/ui';
import { L, emIngles } from '@/i18n/L';

function fmtCountdown(ms: number): string {
  if (ms <= 0) return L('agora', 'now');
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
    case 4: return L('Semifinal', 'Semi-final');
    case 8: return L('Quartas', 'Quarter-finals');
    case 16: return L('Oitavas', 'Round of 16');
    case 32: return L('Fase de 32', 'Round of 32');
    default: return L(`Fase de ${size}`, `Round of ${size}`);
  }
}

export default function GlobalLeagueDaily() {
  const navigate = useNavigate();
  const daily = useDailyCycle();
  const dispatch = useGameDispatch();
  // FABLE — Decreto da Semana (decisão de reinado): voto vale a semana ISO.
  const weeklyDecree = useGameStore((s) => s.weeklyDecree);
  const [now, setNow] = useState(() => Date.now());
  const [tally, setTally] = useState<DecreeTally | null>(null);
  const weekKey = isoWeekKey(now);
  const decree = decreeForWeek(weekKey);
  const activeVote = weeklyDecree?.weekKey === weekKey ? weeklyDecree.vote ?? null : null;
  const globalWinner = weeklyDecree?.weekKey === weekKey ? weeklyDecree.globalOption ?? null : null;

  // V2 (cross-user): lê o tally da semana e aplica o decreto VENCEDOR no save
  // (o reino decidiu — vale mesmo pra quem votou na opção derrotada).
  const refreshTally = useCallback(async () => {
    const t = await fetchDecreeTally(weekKey);
    if (!t) return;
    setTally(t);
    if (t.winner) dispatch({ type: 'SET_WEEKLY_DECREE_GLOBAL', weekKey, option: t.winner });
  }, [weekKey, dispatch]);
  useEffect(() => { void refreshTally(); }, [refreshTally]);

  const voteDecree = (option: DecreeOption) => {
    dispatch({ type: 'VOTE_WEEKLY_DECREE', option });
    // Fire-and-forget: grava o voto no Supabase e re-lê o placar do reino.
    void submitDecreeVote(weekKey, option).then((ok) => { if (ok) void refreshTally(); });
  };

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
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cimento hover:text-neon-yellow transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {L('Liga Global', 'Global League')}
        </button>
      </div>

      {/* HERO — volt chapado + manchete preta */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
        >
          <Hashtag className="mb-2 text-black/70">{L('#ligaglobal · ciclo diário', '#globalleague · daily cycle')}</Hashtag>
          <h1 className="font-impact text-5xl sm:text-7xl uppercase text-black leading-[1.1]">
            {L('Coroa do Dia', 'Crown of the Day')}
          </h1>
          <p className="mt-3 truncate font-impact text-xl sm:text-3xl uppercase leading-[1.1] text-black">
            {daily.phase === 'qualifying' && L('A corrida está aberta', 'The race is open')}
            {daily.phase === 'knockout' && L('Mata-Mata em andamento', 'Knockout in progress')}
            {daily.phase === 'crowned' && daily.todayCrown
              ? L(`${daily.todayCrown.clubName} é o campeão`, `${daily.todayCrown.clubName} are the champions`)
              : daily.phase === 'crowned' && L('Campeão coroado', 'Champion crowned')}
          </p>
        </motion.div>
      </section>

      {/* Indicador de fase + countdown */}
      <div className="sports-panel p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <PhaseChip active={daily.phase === 'qualifying'} icon={<Flag className="w-3.5 h-3.5" />} label={L('Classificação', 'Qualifying')} />
          <span className="text-poeira">›</span>
          <PhaseChip active={daily.phase === 'knockout'} icon={<Swords className="w-3.5 h-3.5" />} label={L('Mata-Mata', 'Knockout')} />
          <span className="text-poeira">›</span>
          <PhaseChip active={daily.phase === 'crowned'} icon={<Crown className="w-3.5 h-3.5" />} label={L('Coroa', 'Crown')} />
        </div>
        <div className="flex items-center gap-2">
          {daily.phase === 'qualifying' && (
            <div className="flex items-center gap-1.5 text-text-soft">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                {L('corte em', 'cut in')} <span className="font-bold text-white">{fmtCountdown(daily.msToCut)}</span>
              </span>
            </div>
          )}
          {daily.phase === 'knockout' && nextRound && (
            <div className="flex items-center gap-1.5 text-text-soft">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                {liveRound ? (
                  <span className="text-alta font-bold animate-pulse">● {L('ao vivo', 'live')}</span>
                ) : (
                  <>{L('próxima em', 'next in')} <span className="font-bold text-white">{fmtCountdown(Math.max(0, nextRound.scheduledKickoffMs - now))}</span></>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* FABLE — DECRETO DA SEMANA: a decisão de reinado. O voto muda como o
          SEU mundo joga a semana (pisos em MatchContextModifiers). */}
      <section className="sports-panel overflow-hidden">
        <div className="px-4 py-3 bg-deep-black border-b border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neon-yellow">
              {decree.title} · {weekKey}
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-[15px] font-bold leading-snug text-white">
              <Scale className="w-4 h-4 shrink-0 text-neon-yellow" /> {decree.question}
            </h2>
          </div>
          {activeVote && (
            <span className="shrink-0 bg-neon-yellow px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black">
              {L('Decretado', 'Decreed')}
            </span>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.entries(decree.options) as [DecreeOption, { label: string; effectText: string }][]).map(([key, opt]) => {
            const chosen = activeVote === key;
            const reigning = globalWinner === key;
            const votes = tally ? tally[key] : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => voteDecree(key)}
                disabled={!!activeVote}
                className={`text-left border p-3.5 transition-colors ${
                  chosen || reigning
                    ? 'border-neon-yellow bg-card'
                    : activeVote
                      ? 'border-white/10 opacity-40'
                      : 'border-white/16 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`ole-num min-w-0 truncate text-[13px] uppercase ${chosen || reigning ? 'text-neon-yellow' : 'text-white'}`}>
                    {opt.label}
                  </p>
                  {votes != null && (
                    <span className="font-mono text-xs text-cimento shrink-0">{votes} {votes === 1 ? L('voto', 'vote') : L('votos', 'votes')}</span>
                  )}
                </div>
                <p className="text-xs text-cimento mt-1">{opt.effectText}</p>
                {reigning && (
                  <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neon-yellow mt-2">
                    <Crown className="h-3 w-3" strokeWidth={2.2} /> {L('Decreto do reino · até domingo', 'Kingdom decree · until Sunday')}
                  </p>
                )}
                {chosen && !reigning && (
                  <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cimento mt-2">
                    <Check className="h-3 w-3" strokeWidth={2.2} /> {L('Seu voto', 'Your vote')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        {globalWinner && activeVote && globalWinner !== activeVote && (
          <p className="px-4 pb-3 -mt-1 text-[12px] text-cimento">
            {emIngles()
              ? <>The kingdom chose <span className="text-neon-yellow font-bold">{decree.options[globalWinner].label}</span> · applies to everyone.</>
              : <>O reino escolheu <span className="text-neon-yellow font-bold">{decree.options[globalWinner].label}</span> · vale pra todos.</>}
          </p>
        )}
      </section>

      {/* CAMPEÃO COROADO — faixa hero secundária */}
      {daily.phase === 'crowned' && daily.todayCrown && (
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden border-l-4 border-l-neon-yellow border border-white/10 bg-panel p-6 sm:p-8"
        >
          <div className="relative z-10 flex items-start gap-4 sm:gap-6">
            <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-neon-yellow shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neon-yellow mb-2">
                {L('Campeão de', 'Champion of')} {daily.todayCrown.dailyDate}
              </p>
              <h2 className="truncate font-impact text-4xl sm:text-6xl uppercase text-white leading-[1.1]">
                {daily.todayCrown.clubName}
              </h2>
              <p className="mt-3 truncate font-mono text-[12px] text-giz">
                {daily.todayCrown.runnerUpClubName && daily.todayCrown.finalScoreHome != null && daily.todayCrown.finalScoreAway != null
                  ? `final ${daily.todayCrown.finalScoreHome}–${daily.todayCrown.finalScoreAway} vs ${daily.todayCrown.runnerUpClubName}${daily.todayCrown.finalWentToPens ? L(' (pênaltis)', ' (penalties)') : ''}`
                  : L(`bracket de ${daily.todayCrown.bracketSize} clubes`, `${daily.todayCrown.bracketSize}-club bracket`)}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* QUALIFYING — corrida do dia */}
      {daily.phase === 'qualifying' && (
        <section className="sports-panel overflow-hidden">
          <div className="px-4 py-3 bg-deep-black border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Hashtag className="text-neon-yellow">{L('#classificação', '#qualifying')}</Hashtag>
              <h2 className="truncate font-impact text-xl uppercase leading-[1.1] text-white">
                {L('Corrida do Dia', 'Race of the Day')}
              </h2>
            </div>
            <span className="shrink-0 font-mono text-xs text-cimento text-right">
              {emIngles()
                ? <>top <span className="text-alta font-bold">{daily.cutSize || '—'}</span> advance</>
                : <>top <span className="text-alta font-bold">{daily.cutSize || '—'}</span> avançam</>}<br />
              <span className="text-[10px] uppercase tracking-[0.12em] text-poeira">{L('às', 'at')} {daily.qualifyHour}h BRT</span>
            </span>
          </div>

          {daily.standings.length === 0 ? (
            <div className="text-center text-cimento py-12 px-4">
              <Flag className="w-10 h-10 mx-auto mb-3 text-poeira" />
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-giz mb-1">{L('Nenhuma partida hoje', 'No matches today')}</p>
              <p className="text-xs text-cimento max-w-md mx-auto">
                {L(`Partidas de liga somam na corrida · mata-mata às ${daily.qualifyHour}h`, `League matches count toward the race · knockout at ${daily.qualifyHour}h`)}
              </p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[44px_1fr_36px_36px_44px_56px] gap-2 px-3 py-2 bg-deep-black border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.12em] text-cimento">
                <div className="text-center">#</div>
                <div>{L('Clube', 'Club')}</div>
                <div className="text-center">{L('J', 'P')}</div>
                <div className="text-center">{L('V', 'W')}</div>
                <div className="text-center">{L('SG', 'GD')}</div>
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
                      className={`grid h-11 grid-cols-[44px_1fr_36px_36px_44px_56px] gap-2 px-3 items-center transition-colors ${
                        row.isMe
                          ? 'bg-neon-yellow text-black'
                          : 'border-b border-white/[0.06] hover:bg-card'
                      }`}
                    >
                      <div className={`ole-num text-center text-[15px] ${row.isMe ? 'text-black' : inZone ? 'text-alta' : 'text-cimento'}`}>{row.rank}</div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`min-w-0 text-[14px] truncate ${row.isMe ? 'font-bold text-black' : 'text-giz'}`}>{row.team.clubName}</span>
                        {row.isMe && (
                          <span className="shrink-0 bg-black px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-neon-yellow">
                            {L('você', 'you')}
                          </span>
                        )}
                        {(row.team.seasonCrowns ?? 0) > 0 && (
                          <span className={`ole-num flex items-center gap-0.5 text-[10px] shrink-0 ${row.isMe ? 'text-black' : 'text-neon-yellow'}`}>
                            <Crown className="w-3 h-3" />{row.team.seasonCrowns}
                          </span>
                        )}
                      </div>
                      <div className={`ole-num text-center text-xs ${row.isMe ? 'text-black' : 'text-cimento'}`}>{row.team.dailyMatchesPlayed ?? 0}</div>
                      <div className={`ole-num text-center text-xs ${row.isMe ? 'text-black' : 'text-alta'}`}>{row.team.dailyWins ?? 0}</div>
                      <div className={`ole-num text-center text-xs ${row.isMe ? 'text-black' : (row.team.dailyGoalDifference ?? 0) >= 0 ? 'text-cimento' : 'text-baixa'}`}>
                        {(row.team.dailyGoalDifference ?? 0) > 0 ? '+' : ''}{row.team.dailyGoalDifference ?? 0}
                      </div>
                      <div className={`ole-num text-center text-[15px] ${row.isMe ? 'text-black' : 'text-white'}`}>{row.team.dailyPoints ?? 0}</div>
                    </motion.div>
                    {isCut && (
                      <div className="flex h-6 items-center gap-2 px-3" aria-label={L('Corte do mata-mata acima desta linha', 'Knockout cut above this line')}>
                        <span className="block h-0 grow border-t border-dashed border-alta" />
                        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-alta">
                          <Swords className="w-3 h-3" />
                          {L(`Corte · top ${daily.cutSize} ao mata-mata`, `Cut · top ${daily.cutSize} to knockout`)}
                        </span>
                        <span className="block h-0 grow border-t border-dashed border-alta" />
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
        <section className="sports-panel overflow-hidden">
          <div className="px-4 py-3 bg-deep-black border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Hashtag className="text-neon-yellow">{L('#chave', '#bracket')}</Hashtag>
              <h2 className="truncate font-impact text-xl uppercase leading-[1.1] text-white">
                {L('Mata-Mata', 'Knockout')}{daily.phase === 'crowned' ? L(' — encerrado', ' — finished') : ''}
              </h2>
            </div>
            {liveRound && (
              <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-alta animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-alta inline-block" />
                {L('ao vivo', 'live')} · {phaseSizeLabel(liveRound.size)}
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors ${
        active
          ? 'bg-neon-yellow text-black'
          : 'text-cimento border border-white/10'
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
