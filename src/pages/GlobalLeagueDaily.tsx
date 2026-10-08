/**
 * /liga-global/hoje — Ciclo Diário (Coroa do Dia)
 *
 * VOLT2: hero volt chapado + manchete Anton preta (sem marca d'água). Linha do
 * manager em faixa volt, corte do mata-mata em linha tracejada; bracket
 * integrado e galeria de coroas no rodapé.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Flag, Swords, ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { DailyBracket } from '@/components/matchglobal/DailyBracket';
import { CrownsGallery } from '@/components/matchglobal/CrownsGallery';
import { useGameStore, useGameDispatch } from '@/game/store';
import { decreeForWeek, isoWeekKey, type DecreeOption } from '@/systems/weeklyDecree';
import { submitDecreeVote, fetchDecreeTally, type DecreeTally } from '@/supabase/weeklyDecree';
import { FitaRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { FaltaRua, LinhaRua, VazioRua, ZonaRua, posRua } from '@/components/leagues/RuaTabela';
import { cn } from '@/lib/utils';
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

  // DS 2027: quanto falta pro corte — pontos reais até a última vaga do mata-mata.
  const meRow = daily.standings.find((r) => r.isMe);
  const cutRow = daily.cutSize >= 2 ? daily.standings.find((r) => r.rank === daily.cutSize) : undefined;
  const gapToCut = meRow && cutRow && meRow.rank > daily.cutSize ? Math.max(0, (cutRow.team.dailyPoints ?? 0) - (meRow.team.dailyPoints ?? 0)) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 overflow-x-hidden px-3 pb-10 sm:px-4 lg:px-8">
      {/* Voltar */}
      <div className="pt-3">
        <button
          type="button"
          onClick={() => navigate('/match/global')}
          className="inline-flex items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:text-rua"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {L('Liga Global', 'Global League')}
        </button>
      </div>

      <FitaRua tags={['#coroadodia', '#persista']} className="-mx-3 sm:-mx-4 lg:-mx-8" />

      {/* HERO */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-2">
        <SecaoRua label={L('#ligaglobal · ciclo diário', '#globalleague · daily cycle')} />
        <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(52px, 14vw, 104px)' }}>
          {L('Coroa do Dia', 'Crown of the Day')}
        </h1>
        <p className="font-voz text-[clamp(24px,6.4vw,34px)] leading-[1.05] text-suave">
          {daily.phase === 'qualifying' && L('A corrida tá aberta.', 'The race is open.')}
          {daily.phase === 'knockout' && L('Mata-mata rolando.', 'Knockout under way.')}
          {daily.phase === 'crowned' && daily.todayCrown
            ? L(`${daily.todayCrown.clubName} levou a coroa.`, `${daily.todayCrown.clubName} took the crown.`)
            : daily.phase === 'crowned' && L('Campeão coroado.', 'Champion crowned.')}
        </p>
      </motion.header>

      {/* Fase + contagem */}
      <div className="flex min-w-0 flex-col gap-4 bg-concreto p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <PhaseChip active={daily.phase === 'qualifying'} icon={<Flag className="h-3.5 w-3.5" />} label={L('Classificação', 'Qualifying')} />
          <span aria-hidden className="font-impact text-mudo">→</span>
          <PhaseChip active={daily.phase === 'knockout'} icon={<Swords className="h-3.5 w-3.5" />} label={L('Mata-Mata', 'Knockout')} />
          <span aria-hidden className="font-impact text-mudo">→</span>
          <PhaseChip active={daily.phase === 'crowned'} icon={<Crown className="h-3.5 w-3.5" />} label={L('Coroa', 'Crown')} />
        </div>
        {daily.phase === 'qualifying' && (
          <div className="flex flex-col gap-0.5">
            <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Corte em', 'Cut in')}</span>
            <span className="font-spray text-[36px] font-black leading-none text-rua">{fmtCountdown(daily.msToCut)}</span>
          </div>
        )}
        {daily.phase === 'knockout' && nextRound && (
          liveRound ? (
            <SeloRua tom="corre">● {L('Ao vivo', 'Live')}</SeloRua>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Próxima em', 'Next in')}</span>
              <span className="font-spray text-[36px] font-black leading-none text-rua">{fmtCountdown(Math.max(0, nextRound.scheduledKickoffMs - now))}</span>
            </div>
          )
        )}
      </div>

      {/* CAMPEÃO COROADO — LENDA: ouro chapado */}
      {daily.phase === 'crowned' && daily.todayCrown && (
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex min-w-0 items-end justify-between gap-4 overflow-hidden bg-ouro-27 p-5 text-asfalto-27 sm:p-8"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center gap-2 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
              <Crown aria-hidden className="h-4 w-4" /> {L('Campeão de', 'Champion of')} {daily.todayCrown.dailyDate}
            </span>
            <h2 className="font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(40px, 11vw, 76px)' }}>
              {daily.todayCrown.clubName}
            </h2>
            <p className="font-prova text-[12px] font-bold uppercase tracking-[0.08em]">
              {daily.todayCrown.runnerUpClubName && daily.todayCrown.finalScoreHome != null && daily.todayCrown.finalScoreAway != null
                ? `final ${daily.todayCrown.finalScoreHome}×${daily.todayCrown.finalScoreAway} vs ${daily.todayCrown.runnerUpClubName}${daily.todayCrown.finalWentToPens ? L(' (pênaltis)', ' (penalties)') : ''}`
                : L(`chave de ${daily.todayCrown.bracketSize} clubes`, `${daily.todayCrown.bracketSize}-club bracket`)}
            </p>
          </div>
          <MarcaRua tipo="nove" className="h-24 shrink-0 bg-asfalto-27 sm:h-32" />
        </motion.section>
      )}

      {/* QUALIFYING — corrida do dia */}
      {daily.phase === 'qualifying' && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <SecaoRua
              label={L(`Corrida do dia · top ${daily.cutSize || '—'} avançam`, `Race of the day · top ${daily.cutSize || '—'} advance`)}
              aside={`${daily.qualifyHour}h BRT`}
            />
            <h2 className="font-voz text-[clamp(34px,9vw,50px)] leading-[0.95] text-papel">
              {meRow && daily.cutSize >= 2 && meRow.rank <= daily.cutSize ? L('Tá no corte. Segura.', "You're in. Hold it.") : L('Quanto falta pro mata-mata', 'How far to the knockout')}
            </h2>
          </div>

          {daily.standings.length === 0 ? (
            <VazioRua
              titulo={L('Nenhuma partida hoje', 'No matches today')}
              frase={L(`Partida de liga soma na corrida. Mata-mata às ${daily.qualifyHour}h.`, `League matches count toward the race. Knockout at ${daily.qualifyHour}h.`)}
            />
          ) : (
            <>
              {gapToCut != null && cutRow && (
                <FaltaRua
                  valor={gapToCut}
                  unidade={L('pts', 'pts')}
                  frase={L(`é o que separa tu do ${posRua(cutRow.rank)}.`, `is all that's between you and ${posRua(cutRow.rank)}.`)}
                />
              )}
              <div className="flex min-w-0 flex-col gap-1.5">
                {daily.standings.map((row) => {
                  const isCut = daily.cutSize >= 2 && row.rank === daily.cutSize;
                  const inZone = daily.cutSize >= 2 && row.rank <= daily.cutSize;
                  const gd = row.team.dailyGoalDifference ?? 0;
                  return (
                    <div key={row.team.id} className="flex flex-col gap-1.5">
                      <LinhaRua
                        pos={row.rank}
                        tom={row.isMe ? 'eu' : row.rank === 1 ? 'lider' : inZone ? 'zona' : meRow && row.rank > meRow.rank ? 'abaixo' : 'normal'}
                        nome={row.team.clubName}
                        sub={`${L('J', 'P')}${row.team.dailyMatchesPlayed ?? 0} ${L('V', 'W')}${row.team.dailyWins ?? 0} · ${L('SG', 'GD')} ${gd > 0 ? '+' : ''}${gd}`}
                        chip={
                          (row.team.seasonCrowns ?? 0) > 0 ? (
                            <span className={cn('flex shrink-0 items-center gap-0.5 font-impact text-[14px]', row.isMe ? 'text-asfalto-27' : 'text-ouro-27')}>
                              <Crown aria-label={L('Coroas', 'Crowns')} className="h-3.5 w-3.5" />{row.team.seasonCrowns}
                            </span>
                          ) : null
                        }
                        valor={row.team.dailyPoints ?? 0}
                      />
                      {isCut && <ZonaRua label={L(`Corte · top ${daily.cutSize} ao mata-mata`, `Cut · top ${daily.cutSize} to knockout`)} />}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* KNOCKOUT / CROWNED — chave */}
      {(daily.phase === 'knockout' || daily.phase === 'crowned') && (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="min-w-0 truncate font-impact text-[30px] uppercase leading-none text-papel">
              {L('Mata-Mata', 'Knockout')}{daily.phase === 'crowned' ? L(' · encerrado', ' · finished') : ''}
            </h2>
            {liveRound && <SeloRua tom="corre">● {L('Ao vivo', 'Live')} · {phaseSizeLabel(liveRound.size)}</SeloRua>}
          </div>
          <DailyBracket bracket={daily.bracket} myTeamId={myTeamId} />
        </section>
      )}

      {/* FABLE — DECRETO DA SEMANA: a decisão de reinado. O voto muda como o
          SEU mundo joga a semana (pisos em MatchContextModifiers). */}
      <section className="flex min-w-0 flex-col gap-4 border-t-2 border-linha pt-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SecaoRua label={`${decree.title} · ${weekKey}`} aside={activeVote ? L('Decretado', 'Decreed') : undefined} />
          <h2 className="font-voz text-[clamp(28px,7.5vw,40px)] leading-[1] text-papel">{decree.question}</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                className={cn(
                  'flex flex-col gap-1.5 p-4 text-left transition-colors',
                  reigning
                    ? 'border-[3px] border-ouro-27 bg-asfalto-27'
                    : chosen
                      ? 'border-2 border-rua bg-concreto'
                      : activeVote
                        ? 'bg-concreto opacity-40'
                        : 'bg-concreto hover:bg-linha',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('min-w-0 truncate font-impact text-[20px] uppercase leading-none', reigning ? 'text-ouro-27' : chosen ? 'text-rua' : 'text-papel')}>
                    {opt.label}
                  </p>
                  {votes != null && (
                    <span className="shrink-0 font-prova text-[11px] font-bold text-mudo">{votes} {votes === 1 ? L('voto', 'vote') : L('votos', 'votes')}</span>
                  )}
                </div>
                <p className="text-[13px] leading-snug text-suave">{opt.effectText}</p>
                {reigning && (
                  <p className="inline-flex items-center gap-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-ouro-27">
                    <Crown className="h-3 w-3" strokeWidth={2.2} /> {L('Decreto do reino · até domingo', 'Kingdom decree · until Sunday')}
                  </p>
                )}
                {chosen && !reigning && (
                  <p className="inline-flex items-center gap-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-rua">
                    <Check className="h-3 w-3" strokeWidth={2.2} /> {L('Teu voto', 'Your vote')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        {globalWinner && activeVote && globalWinner !== activeVote && (
          <p className="font-prova text-[12px] text-suave">
            {emIngles()
              ? <>The kingdom chose <span className="font-bold text-ouro-27">{decree.options[globalWinner].label}</span> · applies to everyone.</>
              : <>O reino escolheu <span className="font-bold text-ouro-27">{decree.options[globalWinner].label}</span> · vale pra todos.</>}
          </p>
        )}
      </section>

      {/* Galeria de coroas (rodapé) */}
      <CrownsGallery limit={12} />
    </div>
  );
}

function PhaseChip({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] transition-colors',
        active ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-mudo',
      )}
    >
      {icon}
      {label}
    </span>
  );
}
