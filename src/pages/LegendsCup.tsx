/**
 * LEGENDS CUP — regulamento, fase de grupos e a trilha do mata-mata.
 *
 * A tela responde três perguntas em ordem: COMO funciona (regulamento), ONDE
 * estou (tabela do grupo ou fase do mata-mata) e CONTRA QUEM jogo agora (os
 * cards reais das lendas, com foto e OVR).
 *
 * A campanha mora no estado do jogo (não em localStorage): o resultado da
 * Partida Rápida volta pelo FINALIZE_QUICK_PLAN, igual à Liga Ole.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, useGameDispatch } from '@/game/store';
import { Loader2, Play, Trophy, RotateCcw, ArrowLeft, Info, Users, Check } from 'lucide-react';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import { CinematicHero } from '@/components/CinematicHero';
import { overallFromAttributes } from '@/entities/player';
import {
  LEGENDS_CUP_ROUNDS, LEGENDS_CUP_OPPONENT_NAME, LEGENDS_CUP_SQUADS,
  GROUP_MATCHES, GROUP_QUALIFIERS, GROUP_SIZE, MANAGER_TEAM_ID,
  createLegendsCupState, currentGroupOpponent, goalDiff, isGroupStage,
  legendsCupPhaseExp, roundOf, sortStandings,
  type LegendsCupGroupTeam, type LegendsCupState,
} from '@/match/legendsCup/legendsCupModel';
import { buildLegendsCupOpponent, type LegendsCupOpponent } from '@/match/legendsCup/legendsCupSquad';
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';

const YELLOW = 'var(--color-neon-yellow)';

export function LegendsCup() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  // Selectors finos: a página não deve re-renderizar a cada tick de partida.
  const cup = useGameStore((s) => s.legendsCup);
  const titles = useGameStore((s) => s.legendsCupTitles ?? 0);
  const flash = useGameStore((s) => s.legendsCupResultFlash);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);

  const [opp, setOpp] = useState<LegendsCupOpponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = cup ? roundOf(cup.roundIndex) : null;
  const inGroup = !!cup && isGroupStage(cup.roundIndex);

  /** Força do elenco do manager — usada no sorteio e na simulação do grupo. */
  const myOverall = useMemo(() => {
    const ps = Object.values(players);
    if (!ps.length) return 70;
    return Math.round(ps.reduce((acc, p) => acc + overallFromAttributes(p.attrs, p.pos), 0) / ps.length);
  }, [players]);

  // Adversário do mata-mata: os cards de lenda da fase.
  useEffect(() => {
    if (!cup || cup.status !== 'active' || isGroupStage(cup.roundIndex)) { setOpp(null); return; }
    let alive = true;
    setLoading(true);
    buildLegendsCupOpponent(cup.roundIndex, cup.seed)
      .then((o) => { if (alive) setOpp(o); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cup]);

  /** Sorteia o grupo (3 clubes de managers reais) e abre a campanha. */
  const drawGroup = useCallback(async () => {
    if (drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const { fetchLigaOleRivals } = await import('@/match/ligaOle/fetchLigaOleTeams');
      // O multiplicador premia TÍTULO, não tentativa: recomeçar após ser
      // eliminado não pode inflar prêmio, senão vira farm de EXP.
      const runNumber = titles + 1;
      const seed = `legendscup-${club.shortName ?? club.name}-${Date.now()}`;
      const rows = await fetchLigaOleRivals({
        excludeShort: club.shortName,
        excludeName: club.name,
        count: GROUP_SIZE - 1,
        seed,
      });
      if (rows.length < GROUP_SIZE - 1) {
        setError('Não há managers suficientes na liga para formar o grupo agora. Tente de novo em instantes.');
        return;
      }
      const rivals: LegendsCupGroupTeam[] = rows.map((r) => ({
        id: r.id, name: r.name, short: r.short, overall: r.overall, managerId: r.managerId,
      }));
      const managerTeam: LegendsCupGroupTeam = {
        id: MANAGER_TEAM_ID,
        name: club.name,
        short: club.shortName ?? club.name.slice(0, 3).toUpperCase(),
        overall: myOverall,
        isManager: true,
      };
      dispatch({ type: 'CREATE_LEGENDS_CUP', cup: createLegendsCupState(seed, managerTeam, rivals, runNumber) });
    } catch {
      setError('Falha ao sortear o grupo. Verifique a conexão e tente de novo.');
    } finally {
      setDrawing(false);
    }
  }, [drawing, titles, club, myOverall, dispatch]);

  /** Entra na partida da rodada do grupo (adversário = clube de manager real). */
  const playGroupMatch = useCallback(async () => {
    if (!cup) return;
    const rival = currentGroupOpponent(cup);
    if (!rival) return;
    setLoading(true);
    try {
      const { fetchOpponentRoster } = await import('@/match/opponentRosterClient');
      const roster = await fetchOpponentRoster({ clubName: rival.name, clubShort: rival.short });
      const stub: OpponentStub = {
        id: `legendscup-grupo-${rival.id}`,
        name: rival.name,
        shortName: rival.short,
        strength: rival.overall,
        genesisAwayPlayers: roster?.players,
        formationScheme: (roster?.formationScheme as OpponentStub['formationScheme']) ?? '4-3-3',
      };
      dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      dispatch({ type: 'START_LEGENDS_CUP_MATCH', opponentId: stub.id });
      navigate('/match/quick');
    } finally {
      setLoading(false);
    }
  }, [cup, dispatch, navigate]);

  /** Entra na partida do mata-mata (adversário = time de lendas). */
  const playKnockout = useCallback(() => {
    if (!opp) return;
    dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: opp.stub, awayName: opp.stub.name } });
    dispatch({ type: 'START_LEGENDS_CUP_MATCH', opponentId: opp.stub.id });
    navigate('/match/quick');
  }, [opp, dispatch, navigate]);

  const phaseExp = cup ? legendsCupPhaseExp(cup.roundIndex, cup.runNumber) : 0;

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 pb-16">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-black text-white/70 hover:bg-white/10"
          style={{ borderRadius: 'var(--radius-sm)' }}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          Modo torneio
        </span>
        {titles > 0 && (
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2">
            <Trophy className="h-4 w-4" style={{ color: YELLOW }} />
            <span className="font-display text-sm font-black tabular-nums">{titles}</span>
          </div>
        )}
      </div>

      <CinematicHero
        image="/hero-legacy-full.png"
        objectPosition="center 22%"
        badgeLabel="Legends Cup"
        BadgeIcon={Trophy}
        eyebrow="Respeito máximo às lendas"
        title="Legends Cup"
        caption={
          titles > 0
            ? `${titles} ${titles === 1 ? 'título' : 'títulos'} · todas as lendas na final`
            : '5 fases · todas as lendas na final'
        }
      />

      {flash && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
            flash.outcome === 'champion' ? 'border-neon-yellow/40 bg-neon-yellow/[0.07]' : 'border-white/12 bg-white/[0.03]'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 font-display text-sm font-black uppercase tracking-wider">
            {flash.outcome === 'champion' ? (
              <>
                <Trophy className="h-4 w-4" style={{ color: YELLOW }} aria-hidden strokeWidth={2.4} />
                Campeão
              </>
            ) : (
              'Eliminado'
            )}
          </span>
          <span className="text-sm text-white/60">chegou até {flash.reachedRound}.</span>
          <button
            onClick={() => dispatch({ type: 'DISMISS_LEGENDS_CUP_RESULT' })}
            className="ml-auto text-[11px] uppercase tracking-wider text-white/40 hover:text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      {!cup ? (
        <StartCard onStart={drawGroup} drawing={drawing} />
      ) : (
        <>
          <Trail roundIndex={cup.roundIndex} />

          {inGroup ? (
            <GroupStage cup={cup} onPlay={playGroupMatch} loading={loading} phaseExp={phaseExp} />
          ) : (
            <KnockoutStage
              round={round!}
              cup={cup}
              opp={opp}
              loading={loading}
              phaseExp={phaseExp}
              onPlay={playKnockout}
            />
          )}

          <Bracket roundIndex={cup.roundIndex} runNumber={cup.runNumber} />

          <button
            onClick={() => dispatch({ type: 'RESET_LEGENDS_CUP' })}
            className="mx-auto flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/30 hover:text-white/70"
          >
            <RotateCcw className="h-3 w-3" /> Abandonar campanha
          </button>
        </>
      )}
    </div>
  );
}

/** Antes de começar: quem espera na final + o regulamento inteiro. */
function StartCard({ onStart, drawing }: { onStart: () => void; drawing: boolean }) {
  // Prévia real das lendas que entram na FINAL — o gancho emocional do torneio.
  // Determinístico por seed fixa: a vitrine não muda a cada render.
  const [finalLegends, setFinalLegends] = useState<PlayerEntity[]>([]);
  useEffect(() => {
    let alive = true;
    const finalIdx = LEGENDS_CUP_ROUNDS.length - 1;
    buildLegendsCupOpponent(finalIdx, 'legendscup-preview')
      .then((o) => { if (alive) setFinalLegends(o.legends.slice(0, 5)); })
      .catch(() => { /* sem lendas carregadas → some a vitrine, sem inventar nada */ });
    return () => { alive = false; };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-7">
      {finalLegends.length > 0 && (
        <div className="mb-7">
          <p className="mb-3 text-center font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            Quem espera na final
          </p>
          <div className="grid grid-cols-5 gap-2">
            {finalLegends.map((l) => (
              <div key={l.id} className="overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0d]">
                <div className="relative aspect-[3/4] bg-black">
                  {l.portraitUrl ? (
                    <img
                      src={l.portraitUrl}
                      alt={l.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-[50%_34%] grayscale"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[9px] text-white/20">sem foto</div>
                  )}
                  <span
                    className="absolute left-1 top-1 rounded px-1 py-0.5 font-display text-[10px] font-black text-black"
                    style={{ background: YELLOW }}
                  >
                    {overallFromAttributes(l.attrs, l.pos)}
                  </span>
                </div>
                <p className="truncate px-1.5 py-1 font-display text-[9px] font-black">{l.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="ole-headline-italic text-center text-2xl">Enfrente as lendas</h2>

      <ol className="mx-auto mt-6 max-w-xl space-y-3.5">
        <Rule n={1} title="Fase de grupos">
          Seu clube cai num grupo com <strong>{GROUP_SIZE - 1} managers reais</strong>. Turno único:{' '}
          {GROUP_MATCHES} jogos, todos contra todos. Vitória 3 pontos, empate 1.{' '}
          <strong>Os {GROUP_QUALIFIERS} primeiros classificam.</strong>
        </Rule>
        <Rule n={2} title="Mata-mata">
          Cinco fases, e aí o adversário muda: são os <strong>cards reais das lendas</strong> da
          OLEFOOT. Perdeu, acabou — não tem volta.
        </Rule>
        <Rule n={3} title="A cada degrau, mais lenda">
          O Playoff tem 4 lendas em campo. A final tem <strong>todas</strong>, com o Palhinha 95.
        </Rule>
        <Rule n={4} title="Prêmio">
          EXP por fase vencida, de 2,5M na classificação a <strong>100M no título</strong>. Ganhar o
          Cup dobra o prêmio da próxima campanha (até 4×).
        </Rule>
      </ol>

      <div className="mt-7 text-center">
        <button
          onClick={onStart}
          disabled={drawing}
          className="inline-flex items-center gap-2 rounded-xl px-8 py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          style={{ background: YELLOW }}
        >
          {drawing ? <><Loader2 className="h-4 w-4 animate-spin" /> Sorteando grupo…</> : <><Play className="h-4 w-4" /> Sortear grupo e começar</>}
        </button>
      </div>
    </div>
  );
}

function Rule({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs font-black text-black"
        style={{ background: YELLOW }}
      >
        {n}
      </span>
      <div className="min-w-0 text-sm leading-relaxed text-white/60">
        <span className="font-display font-black uppercase tracking-wider text-white">{title}</span>
        <span className="mx-1.5 text-white/25">·</span>
        {children}
      </div>
    </li>
  );
}

/** Trilha das fases — onde o manager está e o que falta. */
function Trail({ roundIndex }: { roundIndex: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LEGENDS_CUP_ROUNDS.map((r, i) => {
        const done = i < roundIndex;
        const active = i === roundIndex;
        return (
          <div
            key={r}
            className={`rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
              active ? 'text-black' : done ? 'border-white/20 text-white/50' : 'border-white/10 text-white/25'
            }`}
            style={active ? { background: YELLOW, borderColor: 'transparent' } : undefined}
          >
            {r}
          </div>
        );
      })}
    </div>
  );
}

/** Fase de grupos: tabela, jogos e o próximo confronto. */
function GroupStage({
  cup, onPlay, loading, phaseExp,
}: { cup: LegendsCupState; onPlay: () => void; loading: boolean; phaseExp: number }) {
  const sorted = sortStandings(Object.values(cup.standings));
  const nameOf = (id: string) => cup.groupTeams.find((t) => t.id === id)?.name ?? id;
  const shortOf = (id: string) => cup.groupTeams.find((t) => t.id === id)?.short ?? id;
  const rival = currentGroupOpponent(cup);
  const rodada = cup.groupRoundsPlayed;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#121214] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <Users className="h-4 w-4" style={{ color: YELLOW }} />
          <h2 className="ole-headline-italic text-xl">Grupo A</h2>
          <span className="ml-auto font-display text-[10px] uppercase tracking-[0.2em] text-white/40">
            Rodada {Math.min(rodada + 1, GROUP_MATCHES)} de {GROUP_MATCHES}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-white/35">
                <th className="px-2 py-2 text-left font-bold">#</th>
                <th className="px-2 py-2 text-left font-bold">Clube</th>
                {['J', 'V', 'E', 'D', 'SG', 'Pts'].map((h) => (
                  <th key={h} className="px-2 py-2 text-right font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const isMe = r.teamId === MANAGER_TEAM_ID;
                const qualifies = i < GROUP_QUALIFIERS;
                return (
                  <tr
                    key={r.teamId}
                    className={`border-t border-white/[0.06] ${isMe ? 'bg-neon-yellow/[0.07]' : ''}`}
                  >
                    <td className="px-2 py-2.5">
                      <span
                        className="inline-grid h-5 w-5 place-items-center rounded font-display text-[11px] font-black"
                        style={qualifies
                          ? { background: YELLOW, color: '#000' }
                          : { border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 font-bold ${isMe ? 'text-neon-yellow' : 'text-white/85'}`}>
                      {nameOf(r.teamId)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">{r.played}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">{r.wins}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">{r.draws}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">{r.losses}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">
                      {goalDiff(r) > 0 ? `+${goalDiff(r)}` : goalDiff(r)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-display font-black tabular-nums">{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/35">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Os {GROUP_QUALIFIERS} primeiros avançam ao Playoff. Os outros jogos da rodada são
          resolvidos junto com o seu — a tabela anda inteira.
        </p>
      </div>

      {/* Jogos do grupo, rodada a rodada */}
      <div className="rounded-2xl border border-white/10 bg-[#121214] p-5 sm:p-6">
        <h3 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Jogos</h3>
        <div className="mt-3 space-y-1">
          {Array.from({ length: GROUP_MATCHES }, (_, r) => (
            <div key={r}>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-white/25">Rodada {r + 1}</div>
              {cup.groupFixtures.filter((f) => f.round === r).map((f) => {
                const played = f.scoreHome !== undefined;
                return (
                  <div
                    key={`${f.round}-${f.homeId}-${f.awayId}`}
                    className={`flex items-center gap-2 py-1.5 text-sm ${f.isManager ? '' : 'text-white/45'}`}
                  >
                    <span className={`flex-1 truncate text-right ${f.isManager && f.homeId === MANAGER_TEAM_ID ? 'font-bold text-neon-yellow' : ''}`}>
                      {shortOf(f.homeId)}
                    </span>
                    <span className="w-14 shrink-0 text-center font-display font-black tabular-nums">
                      {played ? `${f.scoreHome}-${f.scoreAway}` : <span className="text-white/20">·</span>}
                    </span>
                    <span className={`flex-1 truncate ${f.isManager && f.awayId === MANAGER_TEAM_ID ? 'font-bold text-neon-yellow' : ''}`}>
                      {shortOf(f.awayId)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Próxima partida do manager */}
      {rival && (
        <div className="rounded-2xl border border-white/10 bg-[#121214] p-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Sua partida — rodada {rodada + 1}
            </span>
            <h2 className="ole-headline-italic text-2xl">{rival.name}</h2>
            <span className="ml-auto font-display text-sm font-black tabular-nums" style={{ color: YELLOW }}>
              força {rival.overall}
            </span>
          </div>
          <PlayBar onPlay={onPlay} loading={loading} phaseExp={phaseExp} expLabel="EXP por classificar" />
        </div>
      )}
    </div>
  );
}

/** Mata-mata: os cards das lendas que entram em campo nesta fase. */
function KnockoutStage({
  round, cup, opp, loading, phaseExp, onPlay,
}: {
  round: string; cup: LegendsCupState; opp: LegendsCupOpponent | null;
  loading: boolean; phaseExp: number; onPlay: () => void;
}) {
  const teamId = opp?.stub.id ?? 'legendscup';
  const persona = coachPersonaFor(teamId);
  const line = personaLine(teamId, 'pre', round);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          {cup.roundIndex === LEGENDS_CUP_ROUNDS.length - 1 ? 'A decisão' : 'Próximo desafio'}
        </span>
        <h2 className="ole-headline-italic text-2xl">{LEGENDS_CUP_OPPONENT_NAME[round as never]}</h2>
        {opp && (
          <span className="ml-auto font-display text-sm font-black tabular-nums" style={{ color: YELLOW }}>
            força {opp.stub.strength}
          </span>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[13px] italic leading-snug text-white/45">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic text-white/30" aria-hidden />
        <span><span className="not-italic font-display text-[11px] font-bold uppercase tracking-wider text-white/55">{persona.label}</span>: “{line}”</span>
      </p>

      {loading ? (
        <div className="grid place-items-center py-10 text-white/40"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : opp && opp.legends.length > 0 ? (
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {opp.legends.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0d]">
              <div className="relative aspect-[3/4] bg-black">
                {l.portraitUrl ? (
                  <img src={l.portraitUrl} alt={l.name} loading="lazy" referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-[50%_34%]" />
                ) : (
                  <div className="grid h-full place-items-center text-white/20">sem foto</div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-display text-xs font-black text-black" style={{ background: YELLOW }}>
                  {overallFromAttributes(l.attrs, l.pos)}
                </span>
              </div>
              <p className="truncate px-2 py-1.5 font-display text-[11px] font-black">{l.name}</p>
            </div>
          ))}
        </div>
      ) : null}

      <PlayBar onPlay={onPlay} loading={loading} phaseExp={phaseExp} expLabel="EXP por avançar" />
    </div>
  );
}

function PlayBar({
  onPlay, loading, phaseExp, expLabel,
}: { onPlay: () => void; loading: boolean; phaseExp: number; expLabel: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        onClick={onPlay}
        disabled={loading}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: YELLOW }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Jogar
      </button>
      <div className="text-right">
        <div className="font-display text-base font-black tabular-nums" style={{ color: YELLOW }}>
          {phaseExp.toLocaleString('pt-BR')}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/35">{expLabel}</div>
      </div>
    </div>
  );
}

/** Chaveamento: o caminho inteiro até a final, com o que espera em cada degrau. */
function Bracket({ roundIndex, runNumber }: { roundIndex: number; runNumber: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-5 sm:p-6">
      <h3 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
        O caminho até o título
      </h3>
      <div className="mt-4 space-y-1.5">
        {LEGENDS_CUP_ROUNDS.map((r, i) => {
          const legends = LEGENDS_CUP_SQUADS[r]?.length ?? 0;
          const done = i < roundIndex;
          const active = i === roundIndex;
          return (
            <div
              key={r}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 ${
                active ? 'border-neon-yellow/40 bg-neon-yellow/[0.06]' : 'border-white/[0.07]'
              }`}
            >
              <span className={`font-display text-xs font-black uppercase tracking-wider ${
                active ? 'text-neon-yellow' : done ? 'text-white/45' : 'text-white/70'
              }`}>
                {r}
              </span>
              <span className="text-[13px] text-white/40">{LEGENDS_CUP_OPPONENT_NAME[r]}</span>
              <span className="text-[11px] text-white/30">
                {legends > 0 ? `${legends} lendas + Jiva` : `${GROUP_SIZE - 1} managers reais`}
              </span>
              <span className="ml-auto font-display text-[11px] font-black tabular-nums text-white/50">
                {legendsCupPhaseExp(i, runNumber).toLocaleString('pt-BR')} EXP
              </span>
              {done && <Check className="h-3.5 w-3.5 text-neon-yellow" aria-hidden strokeWidth={3} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LegendsCup;
